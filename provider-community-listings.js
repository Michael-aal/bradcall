(()=>{"use strict";
const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":"https://bradcall.onrender.com")).replace(/\/$/,"");
const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);
const form=$("#community-listing-search"),host=$("#community-listing-results"),count=$("#community-listing-count");
if(!form||!host)return;
async function load(){
 const params=new URLSearchParams(),q=$("#community-listing-query")?.value.trim(),locationText=$("#community-listing-location")?.value.trim(),category=$("#community-listing-category")?.value;
 if(q)params.set("q",q);if(locationText)params.set("location",locationText);if(category)params.set("category",category);
 host.innerHTML='<div class="dash-empty">Searching published Bradcall services…</div>';if(count)count.textContent="Loading";
 try{
  const response=await fetch(API+"/api/services?"+params.toString(),{headers:{Accept:"application/json"}});
  const data=await response.json().catch(()=>[]);
  if(!response.ok||!Array.isArray(data))throw Error(data.message||"Could not load marketplace listings.");
  if(count)count.textContent=data.length+" listing"+(data.length===1?"":"s");
  if(!data.length){host.innerHTML='<div class="dash-empty">No published services match those filters. Try another category or area, or check back later. No sample listings are substituted.</div>';return;}
  host.innerHTML=data.slice(0,50).map(s=>{const p=s.provider||{};return '<article class="dash-item"><div class="dash-item-top"><div><h3>'+esc(s.title||"Service listing")+'</h3><p>'+esc(s.description||"No description provided.")+'</p></div><span class="dash-badge '+(p.verified?"good":"")+'">'+(p.verified?"Verified provider":"Published listing")+'</span></div><div class="meta"><span>'+esc(s.category?.name||"General service")+'</span><span>'+esc(s.location||"Area not specified")+'</span><span>'+esc(p.displayName||"Provider")+'</span><span>'+money(s.price)+'</span>'+(p.available?'<span>Accepting bookings</span>':'')+(Number.isFinite(s.distanceKm)?'<span>'+esc(s.distanceKm)+' km away</span>':'')+'</div><div class="item-actions"><a class="dash-btn secondary" href="services.html?q='+encodeURIComponent(s.title||"")+'">View listing</a></div></article>';}).join("");
 }catch(error){if(count)count.textContent="Unavailable";host.innerHTML='<div class="dash-notice error">'+esc(error.message||"Could not load listings.")+' No fake or sample posts are shown.</div>';}
}
form.addEventListener("submit",e=>{e.preventDefault();load();});
$("#community-listing-category")?.addEventListener("change",load);
load();
})();