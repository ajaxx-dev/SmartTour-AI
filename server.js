import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

function tokenFor(user){ return jwt.sign({id:user.id,name:user.name,email:user.email,role:user.role}, process.env.JWT_SECRET, {expiresIn:"7d"}); }
function auth(req,res,next){
  try {
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer ")) throw new Error("Missing token");
    req.user=jwt.verify(h.slice(7),process.env.JWT_SECRET); next();
  } catch { res.status(401).json({error:"Authentication required"}); }
}
function admin(req,res,next){ if(req.user?.role!=="admin") return res.status(403).json({error:"Admin only"}); next(); }

app.get("/api/health", async (_,res)=>{
  try { await pool.query("SELECT 1"); res.json({ok:true,database:"connected"}); }
  catch(e){res.status(500).json({ok:false,error:e.message});}
});

app.post("/api/auth/register", async(req,res)=>{
  const {name,email,password}=req.body;
  if(!name||!email||!password||password.length<8) return res.status(400).json({error:"Name, email and password (8+ characters) are required"});
  try{
    const [exists]=await pool.query("SELECT id FROM users WHERE email=?",[email.toLowerCase()]);
    if(exists.length) return res.status(409).json({error:"Email already registered"});
    const hash=await bcrypt.hash(password,12);
    const [r]=await pool.query("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)",[name,email.toLowerCase(),hash]);
    const user={id:r.insertId,name,email:email.toLowerCase(),role:"user"};
    res.status(201).json({user,token:tokenFor(user)});
  }catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/auth/login", async(req,res)=>{
  const {email,password}=req.body;
  try{
    const [rows]=await pool.query("SELECT id,name,email,password_hash,role FROM users WHERE email=?",[String(email||"").toLowerCase()]);
    if(!rows.length || !(await bcrypt.compare(password||"",rows[0].password_hash))) return res.status(401).json({error:"Invalid email or password"});
    const u={id:rows[0].id,name:rows[0].name,email:rows[0].email,role:rows[0].role};
    res.json({user:u,token:tokenFor(u)});
  }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/auth/me",auth,async(req,res)=>res.json({user:req.user}));

app.get("/api/hotels",async(req,res)=>{
  try{
    const q=String(req.query.destination||"");
    const [rows]=await pool.query("SELECT * FROM hotels WHERE destination LIKE ? ORDER BY rating DESC",[`${q}%`]);
    res.json(rows);
  }catch(e){res.status(500).json({error:e.message});}
});
app.get("/api/restaurants",async(req,res)=>{
  try{
    const q=String(req.query.destination||"");
    const [rows]=await pool.query("SELECT * FROM restaurants WHERE destination LIKE ? ORDER BY rating DESC",[`${q}%`]);
    res.json(rows);
  }catch(e){res.status(500).json({error:e.message});}
});

async function geocode(place){
  const u=new URL("https://geocoding-api.open-meteo.com/v1/search");
  u.searchParams.set("name",place); u.searchParams.set("count","1"); u.searchParams.set("language","en"); u.searchParams.set("format","json");
  const r=await fetch(u); if(!r.ok) throw new Error("Geocoding failed");
  const d=await r.json(); if(!d.results?.length) throw new Error("Destination not found");
  return d.results[0];
}
app.get("/api/geocode",async(req,res)=>{
  try{ const x=await geocode(String(req.query.q||"")); res.json(x); }
  catch(e){res.status(404).json({error:e.message});}
});

app.get("/api/weather",async(req,res)=>{
  try{
    let {lat,lon,place}=req.query;
    if(place){const g=await geocode(place); lat=g.latitude; lon=g.longitude;}
    if(lat==null||lon==null) return res.status(400).json({error:"lat/lon or place required"});
    const u=new URL("https://api.open-meteo.com/v1/forecast");
    u.searchParams.set("latitude",lat);u.searchParams.set("longitude",lon);
    u.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");
    u.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
    u.searchParams.set("forecast_days","7");u.searchParams.set("timezone","auto");
    const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=11.41&longitude=76.69&current=temperature_2m,weather_code"); if(!r.ok) throw new Error("Weather service failed");
    res.json(await r.json());
  }catch(e){res.status(500).json({error:e.message});}
});

async function placesSearch(q,lat,lon){
  if((process.env.PLACES_MODE||"mysql")==="foursquare" && process.env.PLACES_API_KEY){
    const u=new URL(process.env.PLACES_BASE_URL||"https://api.foursquare.com/v3/places/search");
    u.searchParams.set("query",q); u.searchParams.set("ll",`${lat},${lon}`); u.searchParams.set("limit","12");
    const r=await fetch(u,{headers:{Authorization:process.env.PLACES_API_KEY,Accept:"application/json"}});
    if(!r.ok) throw new Error("Places provider failed");
    const d=await r.json();
    return (d.results||[]).map(x=>({id:x.fsq_id,name:x.name,category:x.categories?.[0]?.name||"Place",latitude:x.geocodes?.main?.latitude,longitude:x.geocodes?.main?.longitude,address:x.location?.formatted||""}));
  }
  const term=`%${q}%`;
  const [h]=await pool.query("SELECT id,name,'Hotel' category,latitude,longitude,description address FROM hotels WHERE name LIKE ? OR destination LIKE ? LIMIT 12",[term,term]);
  const [r]=await pool.query("SELECT id,name,'Restaurant' category,latitude,longitude,description address FROM restaurants WHERE name LIKE ? OR destination LIKE ? LIMIT 12",[term,term]);
  return [...h,...r];
}
app.get("/api/places",async(req,res)=>{
  try{const q=String(req.query.q||"tourism"); const lat=Number(req.query.lat||11.4064),lon=Number(req.query.lon||76.6932); res.json(await placesSearch(q,lat,lon));}
  catch(e){res.status(500).json({error:e.message});}
});

function demoPlan({destination,days,budget,interests}){
 const spots=["Explore the main local attraction","Visit a cultural or heritage site","Try local cuisine and visit a market","Enjoy a nature/scenic location","Explore a hidden gem and relax"];
 const per=Math.floor(Number(budget)/Number(days));
 return Array.from({length:Number(days)},(_,i)=>({day:i+1,budget:per,activities:[spots[i%spots.length], interests?`Choose an activity related to ${interests}`:"Visit a highly rated attraction","Local lunch and evening exploration"]}));
}
async function aiText(input){
 const key=process.env.OPENAI_API_KEY;
 if(!key) return null;
 const base=process.env.OPENAI_BASE_URL||"https://api.openai.com/v1";
 const r = await fetch(`${base}/responses`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5",
        input: input
    })
});

if (!r.ok) {
    throw new Error(`AI service returned ${r.status}`);
}

const d = await r.json();

return d.output_text ||
    d.output?.flatMap(x => x.content || [])
        .map(x => x.text || "")
        .join("") ||
    "";
}
app.post("/api/plan",auth,async(req,res)=>{
 const {destination,days=3,budget=10000,interests=""}=req.body;
 if(!destination) return res.status(400).json({error:"Destination required"});
 try{
   const prompt=`Create a practical tourism itinerary. Destination: ${destination}. Days: ${days}. Total budget INR ${budget}. Interests: ${interests||"general sightseeing"}. Return ONLY JSON: {"itinerary":[{"day":1,"budget":0,"activities":["...","...","..."]}]}. Keep total daily budgets within total budget.`;
   let raw=await aiText(prompt), parsed;
   if(raw){ const clean=raw.replace(/```json|```/g,"").trim(); parsed=JSON.parse(clean); }
   else parsed={itinerary:demoPlan({destination,days,budget,interests})};
   const [r]=await pool.query("INSERT INTO trips(user_id,destination,days,budget,interests,itinerary) VALUES(?,?,?,?,?,?)",[req.user.id,destination,days,budget,interests,JSON.stringify(parsed.itinerary)]);
   res.json({tripId:r.insertId,mode:raw?"ai":"demo",destination,days,budget,interests,itinerary:parsed.itinerary});
 }catch(e){res.status(500).json({error:e.message});}
});
app.get("/api/trips",auth,async(req,res)=>{
 const [rows]=await pool.query("SELECT id,destination,days,budget,interests,created_at FROM trips WHERE user_id=? ORDER BY created_at DESC",[req.user.id]); res.json(rows);
});

app.post("/api/chat",auth,async(req,res)=>{
 const message=String(req.body.message||"").trim(); if(!message) return res.status(400).json({error:"Message required"});
 try{
   const prompt=`You are SmartTour AI, a concise and helpful tourism assistant. User asks: ${message}. Give safe, practical travel planning advice. Do not claim live availability unless provided by an API.`;
   const out=await aiText(prompt);
   res.json({reply:out||`Demo assistant: I can help plan routes, budgets, hotels, restaurants, weather-aware activities and itineraries. Try asking about a destination and your budget.`});
 }catch(e){res.status(500).json({error:e.message});}
});

app.get("/api/admin/stats",auth,admin,async(_,res)=>{
 const [[users]] = await pool.query("SELECT COUNT(*) count FROM users");
 const [[hotels]] = await pool.query("SELECT COUNT(*) count FROM hotels");
 const [[restaurants]] = await pool.query("SELECT COUNT(*) count FROM restaurants");
 const [[trips]] = await pool.query("SELECT COUNT(*) count FROM trips");
 res.json({users:users.count,hotels:hotels.count,restaurants:restaurants.count,trips:trips.count});
});
app.get("/api/admin/users",auth,admin,async(_,res)=>{const [r]=await pool.query("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC");res.json(r);});
app.get("/api/admin/trips",auth,admin,async(_,res)=>{const [r]=await pool.query("SELECT t.id,t.destination,t.days,t.budget,t.created_at,u.name user_name FROM trips t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 100");res.json(r);});
app.post("/api/admin/hotels",auth,admin,async(req,res)=>{
 const {name,destination,price_per_night,rating,latitude,longitude,description,image_url}=req.body;
 const [r]=await pool.query("INSERT INTO hotels(name,destination,price_per_night,rating,latitude,longitude,description,image_url) VALUES(?,?,?,?,?,?,?,?)",[name,destination,price_per_night,rating,latitude,longitude,description,image_url]);res.json({id:r.insertId});
});
app.post("/api/admin/restaurants",auth,admin,async(req,res)=>{
 const {name,destination,cuisine,average_cost,rating,latitude,longitude,description,image_url}=req.body;
 const [r]=await pool.query("INSERT INTO restaurants(name,destination,cuisine,average_cost,rating,latitude,longitude,description,image_url) VALUES(?,?,?,?,?,?,?,?,?)",[name,destination,cuisine,average_cost,rating,latitude,longitude,description,image_url]);res.json({id:r.insertId});
});
app.get("/api/admin/settings",auth,admin,async(_,res)=>{const [r]=await pool.query("SELECT setting_key,setting_value,updated_at FROM api_settings ORDER BY setting_key");res.json(r);});
app.put("/api/admin/settings",auth,admin,async(req,res)=>{
 const {key,value}=req.body;
 if(!key) return res.status(400).json({error:"key required"});
 await pool.query("INSERT INTO api_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=?",[key,value,value]); res.json({ok:true});
});

app.get("*",(_,res)=>res.sendFile(path.join(__dirname,"../frontend/index.html")));
app.listen(PORT,()=>console.log(`SmartTour AI Advanced: http://localhost:${PORT}`));
