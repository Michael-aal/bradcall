(() => {
"use strict";
const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
const $=s=>document.querySelector(s);
let nearbyCoordinates=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);
async function loadRelated(category){
 const panel=$("#service-graph-panel"),host=$("#service-graph-results");
 if(!panel||!host)return;
 if(!category){panel.hidden=true;return;}
 try{
  const response=await fetch(API+"/api/services/related?category="+encodeURIComponent(category));
  const data=await response.json().catch(()=>({}));
  const items=response.ok&&Array.isArray(data.relatedCategories)?data.relatedCategories:[];
  if(!items.length){panel.hidden=true;return;}
  panel.hidden=false;
  host.innerHTML=items.map(item=>'<article class="dash-item"><div class="dash-item-top"><div><h3>'+esc(item.category)+'</h3><p>Often booked with '+esc(category)+' in '+esc(item.area)+'.</p></div><span class="dash-badge">'+esc(item.sharedCustomers)+' customers</span></div><div class="item-actions"><button class="dash-btn secondary" type="button" data-related-category="'+esc(item.category)+'">Explore this category</button></div></article>').join("");
  host.querySelectorAll("[data-related-category]").forEach(button=>button.addEventListener("click",()=>{const select=$("#public-service-category");if(select){const option=[...select.options].find(item=>item.value.toLowerCase()===button.dataset.relatedCategory.toLowerCase()||item.text.toLowerCase()===button.dataset.relatedCategory.toLowerCase());if(option)select.value=option.value;}const query=$("#public-service-query");if(query)query.value=button.dataset.relatedCategory;load();}));
 }catch{panel.hidden=true;}
}
async function load(){const host=$("#public-service-results");if(!host)return;const params=new URLSearchParams();const q=$("#public-service-query")?.value.trim(),category=$("#public-service-category")?.value;if(q)params.set("q",q);if(category)params.set("category",category);if(nearbyCoordinates){params.set("latitude",nearbyCoordinates.latitude);params.set("longitude",nearbyCoordinates.longitude);params.set("radiusKm","10");}host.innerHTML='<div class="dash-empty">Searching the marketplace…</div>';try{const response=await fetch(API+"/api/services?"+params.toString());const data=await response.json().catch(()=>[]);if(!response.ok)throw new Error(data.message||"Could not load services.");if(!Array.isArray(data)||!data.length){$("#service-graph-panel")&&($("#service-graph-panel").hidden=true);host.innerHTML='<div class="dash-empty">No live listings match this search yet. Providers can create listings after registering.</div>';return;}host.innerHTML=data.map(s=>'<article class="dash-item"><div class="dash-item-top"><div><h3>'+esc(s.title)+'</h3><p>'+esc(s.description)+'</p></div><span class="dash-badge '+(s.provider?.verified?"good":"")+'">'+(s.provider?.verified?"Verified provider":"Service listing")+'</span></div><div class="meta"><span>'+esc(s.category?.name||"General")+'</span><span>'+esc(s.location)+'</span><span>'+money(s.price)+'</span><span>'+esc(s.provider?.displayName||"Provider")+'</span>'+(Number.isFinite(s.distanceKm)?'<span>'+s.distanceKm+' km away</span>':'')+'</div><p class="hint proof-of-work">'+(Number(s.provider?.completedJobs)>0?esc(s.provider.completedJobs)+' completed jobs':'New provider · building a work record')+' · '+(Number(s.provider?.averageRating)>0?'Rating '+esc(s.provider.averageRating)+' / 5 ('+esc(s.provider.reviewCount)+' reviews)':'No verified reviews yet')+' · '+(s.provider?.availabilityUpdatedAt?'Status updated '+esc(new Date(s.provider.availabilityUpdatedAt).toLocaleDateString("en-NG")):'Status update unavailable')+'</p><div class="item-actions"><a class="dash-btn" href="register.html">Request this service</a></div></article>').join("");const queryText=$("#public-service-query")?.value.trim().toLowerCase();const queryCategory=data.find(s=>(s.category?.name||"").toLowerCase()===queryText)?.category?.name||"";const selectedCategory=$("#public-service-category")?.value||queryCategory;loadRelated(selectedCategory);}catch(error){host.innerHTML='<div class="dash-notice error">'+esc(error.message)+' Make sure the Bradcall API is running and configured.</div>';}}
const searchParams=new URLSearchParams(location.search);if($("#public-service-query")&&searchParams.get("q"))$("#public-service-query").value=searchParams.get("q");
const form=$("#public-service-search");if(form)form.addEventListener("submit",e=>{e.preventDefault();load();});
$("#public-service-category")?.addEventListener("change",load);
$("#public-service-near-me")?.addEventListener("click",()=>{if(!navigator.geolocation){alert("This browser does not support location services.");return;}$("#public-service-results").innerHTML='<div class="dash-empty">Finding services near your area…</div>';navigator.geolocation.getCurrentPosition(pos=>{nearbyCoordinates={latitude:pos.coords.latitude,longitude:pos.coords.longitude};load();},()=>{$("#public-service-results").innerHTML='<div class="dash-empty">Location permission was not granted or device location is off. Enable location in your device settings, then try again.</div>';},{enableHighAccuracy:false,timeout:10000,maximumAge:60000});});
load();
})();
