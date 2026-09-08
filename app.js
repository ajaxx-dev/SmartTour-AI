const API="http://localhost:5000"; let token=localStorage.getItem("smarttour_token"); let user=JSON.parse(localStorage.getItem("smarttour_user")||"null");
const $=id=>document.getElementById(id); function toast(m){$("toast").textContent=m;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",2500)}
function api(path,opts={}){opts.headers={...(opts.headers||{}),...(token?{Authorization:`Bearer ${token}`}:{})};if(opts.body&&typeof opts.body!=="string"){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(opts.body)}return fetch(API+path,opts).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed");return d})}
function renderAuth(){ $("authArea").innerHTML=user?`<span class="muted">Hi, ${user.name.split(" ")[0]}</span><button class="ghost" onclick="logout()">Log out</button>${user.role==="admin"?`<button class="primary" onclick="openAdmin()">Admin</button>`:""}`:`<button class="ghost" onclick="showAuth('login')">Log in</button><button class="primary" onclick="showAuth('register')">Get started</button>`}
function logout(){localStorage.clear();token=null;user=null;renderAuth();toast("Logged out")}
function showAuth(mode){$("authModal").classList.remove("hidden");$("authName").style.display=mode==="register"?"block":"none";$("loginTab").style.opacity=mode==="login"?1:.5;$("registerTab").style.opacity=mode==="register"?1:.5;$("authMsg").textContent="";$("authForm").dataset.mode=mode}
function hideAuth(){$("authModal").classList.add("hidden")}
$("authForm").addEventListener("submit",async e=>{e.preventDefault();const mode=e.target.dataset.mode||"login";try{const d=await api(`/auth/${mode==="register"?"register":"login"}`,{method:"POST",body:{name:$("authName").value,email:$("authEmail").value,password:$("authPassword").value}});token=d.token;user=d.user;localStorage.setItem("smarttour_token",token);localStorage.setItem("smarttour_user",JSON.stringify(user));hideAuth();renderAuth();toast("Welcome to SmartTour AI");}catch(x){$("authMsg").textContent=x.message}});
async function loadDiscover(destination){if(!destination)return;try{const [h,r]=await Promise.all([api(`/hotels?destination=${encodeURIComponent(destination)}`),api(`/restaurants?destination=${encodeURIComponent(destination)}`)]);$("hotels").innerHTML=h.length?h.map(cardHotel).join(""):"<div class='card'>No hotel records for this destination yet.</div>";$("restaurants").innerHTML=r.length?r.map(cardRest).join(""):"<div class='card'>No restaurant records for this destination yet.</div>";drawMarkers([...h.map(x=>({...x,kind:"Hotel"})),...r.map(x=>({...x,kind:"Restaurant"}))]);}catch(e){toast(e.message)}}
function cardHotel(x){return `<div class="placeCard"><img src="${x.image_url||"https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=500&q=80"}"><div><h3>${x.name}</h3><div class="rating">★ ${x.rating} · ₹${Number(x.price_per_night).toLocaleString("en-IN")}/night</div><p class="muted">${x.description||""}</p></div></div>`}
function cardRest(x){return `<div class="placeCard"><img src="${x.image_url||"https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=500&q=80"}"><div><h3>${x.name}</h3><div class="rating">★ ${x.rating} · ${x.cuisine||"Local"} · ₹${Number(x.average_cost).toLocaleString("en-IN")}</div><p class="muted">${x.description||""}</p></div></div>`}
$("plannerForm").addEventListener("submit",async e=>{e.preventDefault();if(!token){showAuth("login");toast("Please login to generate and save a trip");return}const data={destination:$("destination").value,days:Number($("days").value),budget:Number($("budgetInput").value),interests:$("interests").value};$("planResult").innerHTML="<div class='card'>✦ Building your itinerary...</div>";try{const p=await api("/plan",{method:"POST",body:data});$("planResult").innerHTML=`<div class="card"><div class="eyebrow">${p.mode==="ai"?"AI GENERATED":"DEMO MODE"}</div><h2>${p.destination} · ${p.days} days</h2>${p.itinerary.map(d=>`<div class="day"><b>Day ${d.day}</b> <span class="muted">· ₹${Number(d.budget).toLocaleString("en-IN")}</span><ul>${d.activities.map(a=>`<li>${a}</li>`).join("")}</ul></div>`).join("")}</div>`;loadDiscover(data.destination);$("weatherPlace").value=data.destination;loadWeather();}catch(x){$("planResult").innerHTML=`<div class="card">${x.message}</div>`}});
async function getWeather() {
    try {
        const response = await fetch(
            "/api/weather?lat=11.41&lon=76.69"
        );

        if (!response.ok) {
            throw new Error("Weather request failed");
        }

        const data = await response.json();

        console.log("Weather:", data);

        const weather = document.getElementById("weatherResult");

        if (weather) {
            weather.innerHTML = `
                <h3>🌤️ Ooty Weather</h3>
                <p>Temperature: ${data.current.temperature_2m} °C</p>
                <p>Weather Code: ${data.current.weather_code}</p>
            `;
        }

    } catch (error) {
        console.error(error);
        alert("Unable to load weather");
    }
}
function weatherText(c){return c===0?"Clear":c<4?"Partly cloudy":c<70?"Rain/showers":"Weather change"} function weatherIcon(c){return c===0?"☀️":c<4?"⛅":c<70?"🌧️":"🌦️"}
let map=L.map("map").setView([11.4064,76.6932],8);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);let markerLayer=L.layerGroup().addTo(map);
function drawMarkers(items){markerLayer.clearLayers();items.filter(x=>x.latitude&&x.longitude).forEach(x=>L.marker([x.latitude,x.longitude]).bindPopup(`<b>${x.name}</b><br>${x.kind}<br>${x.address||""}`).addTo(markerLayer));if(items.some(x=>x.latitude&&x.longitude))map.fitBounds(markerLayer.getBounds().pad(.2))}
$("destination").addEventListener("change",e=>loadDiscover(e.target.value));
["hotelCost","nights","foodCost","transportCost","activityCost"].forEach(id=>$(id).addEventListener("input",calc));function calc(){const n=Number($("nights").value),t=Number($("hotelCost").value)*n+Number($("foodCost").value)*(n+1)+Number($("transportCost").value)+Number($("activityCost").value);$("total").textContent="₹"+t.toLocaleString("en-IN")}calc();
async function sendChat(){if(!token){showAuth("login");toast("Login to use the AI assistant");return}const input=$("chatMessage"),m=input.value.trim();if(!m)return;const log=$("chatLog");log.innerHTML+=`<div class="bubble user">${m}</div>`;input.value="";try{const d=await api("/chat",{method:"POST",body:{message:m}});log.innerHTML+=`<div class="bubble ai">${d.reply}</div>`;log.scrollTop=log.scrollHeight}catch(e){log.innerHTML+=`<div class="bubble ai">${e.message}</div>`}}
async function openAdmin(){ $("adminSection").classList.remove("hidden");$("adminSection").scrollIntoView({behavior:"smooth"});try{const [s,u,t]=await Promise.all([api("/admin/stats"),api("/admin/users"),api("/admin/trips")]);$("adminStats").innerHTML=Object.entries(s).map(([k,v])=>`<div class="statCard"><small>${k.toUpperCase()}</small><b>${v}</b></div>`).join("");$("adminUsers").innerHTML=u.slice(0,8).map(x=>`<div class="adminRow"><b>${x.name}</b><br>${x.email} · ${x.role}</div>`).join("");$("adminTrips").innerHTML=t.slice(0,8).map(x=>`<div class="adminRow"><b>${x.destination}</b><br>${x.user_name} · ₹${Number(x.budget).toLocaleString("en-IN")}</div>`).join("");}catch(e){toast(e.message)}}
renderAuth();loadDiscover("Ooty");loadWeather();