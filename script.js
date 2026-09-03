const $=id=>document.getElementById(id);
$("menuBtn").onclick=()=>{$("nav").classList.toggle("open")};

function showToast(msg){
  const t=$("toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2600);
}
function useHeroPlanner(){
  $("destination").value=$("heroDestination").value||"Kodaikanal";
  $("days").value=$("heroDays").value;
  $("budget").value=$("heroBudget").value||8000;
  location.hash="planner";
  setTimeout(generateTrip,300);
}

function generateTrip(){
  const dest=$("destination").value.trim()||"Kodaikanal";
  const days=Number($("days").value);
  const budget=Number($("budget").value)||8000;
  const interest=$("interest").value;
  const sets={
    Nature:["Scenic viewpoint","Nature trail / forest area","Lake or park","Sunset spot"],
    Adventure:["Easy outdoor activity","Scenic viewpoint","Nature trail","Local exploration"],
    Heritage:["Historic landmark","Local museum / heritage site","Cultural street","Traditional food experience"],
    Food:["Local breakfast spot","Popular regional lunch","Street-food area","Local dinner experience"],
    Relaxation:["Leisurely morning walk","Garden / lake visit","Café break","Sunset relaxation"]
  };
  const places=sets[interest];
  const perDay=Math.max(1,Math.floor(places.length/Math.min(days,4)));
  let html=`<h4>✨ ${days}-day ${dest} plan</h4><p><b>${interest}</b> • Target budget ₹${budget.toLocaleString("en-IN")}</p><ul>`;
  for(let i=0;i<days;i++){
    html+=`<li><b>Day ${i+1}:</b> ${places[i%places.length]}, ${places[(i+1)%places.length]}</li>`;
  }
  html+=`</ul><p style="margin-top:10px">🌱 Tip: Prefer local businesses and shared/public transport where practical.</p>`;
  $("tripResult").innerHTML=html;
  $("tripResult").classList.remove("hidden");
}

function calcBudget(){
  const d=Number($("bDays").value)||1,h=Number($("bHotel").value)||0,f=Number($("bFood").value)||0,t=Number($("bTransport").value)||0;
  const total=d*h+d*f+t;
  $("total").textContent="₹"+total.toLocaleString("en-IN");
}
calcBudget();

function openChat(){$("chat").classList.toggle("open");$("chatInput").focus()}
function sendChat(){
  const input=$("chatInput"), msg=input.value.trim(); if(!msg)return;
  const body=$("chatBody");
  body.innerHTML+=`<div class="user">${escapeHtml(msg)}</div>`;
  input.value="";
  let reply="I can help with destinations, itineraries, budgets, hotels and local experiences. Try: “Plan 3 days in Kodaikanal with ₹8,000.”";
  const lower=msg.toLowerCase();
  if(lower.includes("budget")) reply="For a budget trip, start by setting your hotel and food limits, then reserve some amount for transport and activities.";
  else if(lower.includes("kodaikanal")) reply="For Kodaikanal, a nature-focused plan could include viewpoints, parks, the lake area and local food. Use the AI Planner above to generate a sample itinerary.";
  else if(lower.includes("hotel")) reply="You can compare the sample stays in the Hotels section. In the full version, this section can be connected to live availability data.";
  setTimeout(()=>{body.innerHTML+=`<div class="bot">${reply}</div>`;body.scrollTop=body.scrollHeight},450);
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
