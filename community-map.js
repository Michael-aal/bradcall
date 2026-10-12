(() => {
"use strict";
const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
const root=document.querySelector("[data-community-map]");if(!root)return;
const $=s=>root.querySelector(s);
const mapNode=$("#community-map-canvas"),search=$("#community-map-search"),button=$("#community-map-submit"),caption=$("#community-map-caption"),list=$("#community-map-list");
let map,layer,coverage,initialized=false;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);
function say(text){if(caption)caption.textContent=text;}
function loadLeaflet(){return new Promise((resolve,reject)=>{if(window.L)return resolve();const css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(css);const script=document.createElement("script");script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.onload=resolve;script.onerror=()=>reject(new Error("Map library could not load. Check your internet connection."));document.head.appendChild(script);});}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function geocode(query){const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q="+encodeURIComponent(query);const response=await fetch(url,{headers:{Accept:"application/json"}});if(!response.ok)throw new Error("Community search is temporarily unavailable.");const data=await response.json();if(!data.length)return null;return {lat:Number(data[0].lat),lng:Number(data[0].lon),label:data[0].display_name};}
function popup(service){return '<div class="map-popup"><strong>'+esc(service.title||service.provider?.displayName||"Local service area")+'</strong><p>'+esc(service.category?.name||"Service provider")+'</p><p>'+esc(service.location||"Service area")+'</p><p>'+money(service.price)+'</p><a href="register.html">Join to request this service</a></div>';}
function renderList(services){if(!list)return;list.innerHTML=services.length?services.slice(0,6).map(s=>'<article class="map-list-item"><strong>'+esc(s.title)+'</strong><span>'+esc(s.location)+'</span><small>'+esc(s.category?.name||"Service")+' · '+money(s.price)+'</small></article>').join(""):'<div class="dash-empty">No public service listings found yet. The map will show provider service areas as listings become available.</div>';}
async function refresh(place){if(!map){await loadLeaflet();map=window.L.map(mapNode,{scrollWheelZoom:false}).setView([6.5244,3.3792],12);window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'}).addTo(map);layer=window.L.layerGroup().addTo(map);coverage=window.L.circle([6.5244,3.3792],{radius:3500,color:"#019E81",weight:2,fillColor:"#019E81",fillOpacity:.08}).addTo(map);initialized=true;}
  const query=(place||search?.value||"Lagos, Nigeria").trim();
  say("Finding the map area for "+query+"…");
  let center;try{center=await geocode(query.includes("Nigeria")?query:query+", Nigeria");}catch(e){say(e.message);return;}
  if(!center){say("We couldn't find that area. Try a neighborhood name plus its city.");return;}
  map.setView([center.lat,center.lng],13);coverage.setLatLng([center.lat,center.lng]);coverage.setRadius(3000);layer.clearLayers();
  let services=[];try{const r=await fetch(API+"/api/services");if(r.ok)services=await r.json();}catch{}
  const relevant=services.filter(s=>String(s.location||"").toLowerCase().includes(query.split(",")[0].toLowerCase())||String(s.location||"").toLowerCase().includes(query.split(",").slice(-1)[0].trim().toLowerCase()));
  renderList(relevant);
  const seen=new Set();let marked=0;
  for(const service of relevant.slice(0,8)){const area=String(service.location||"").trim();if(!area||seen.has(area.toLowerCase()))continue;seen.add(area.toLowerCase());try{await wait(1100);const lookup=area.includes(",")?area+", Nigeria":query.toLowerCase().includes(area.toLowerCase())?area+", Lagos, Nigeria":area+", "+query+", Nigeria";const point=await geocode(lookup);if(!point)continue;window.L.marker([point.lat,point.lng]).bindPopup(popup(service)).addTo(layer);marked++;}catch{}}
  say("Map centered on "+query+". The shaded circle is an approximate community view, not an exact boundary. "+marked+" service-area marker"+(marked===1?"":"s")+" found. Map data © OpenStreetMap.");
}
if(button)button.addEventListener("click",()=>{if(search.value.trim())refresh(search.value.trim());});
if(search)search.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();refresh(search.value.trim());}});
refresh(search?.value||"Lagos, Nigeria").catch(e=>say(e.message));
})();
