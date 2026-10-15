(() => {
"use strict";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":"https://bradcall.onrender.com")).replace(/\/$/,"");
const menu=$("#mobile-nav"),hamb=$("#hamb"),mobileClose=$("#mobile-close");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);
const icon=()=>{if(window.lucide)window.lucide.createIcons()};
function goServices(q="",locationText=""){const p=new URLSearchParams();if(q)p.set("q",q);if(locationText)p.set("location",locationText);location.href="services.html"+(p.toString()?"?"+p.toString():"");}
function goRegister(role=""){location.href="register.html"+(role?"?role="+encodeURIComponent(role):"");}
function openMenu(){if(!menu||!hamb)return;menu.hidden=false;document.body.classList.add("menu-open");hamb.setAttribute("aria-expanded","true");hamb.setAttribute("aria-label","Close navigation");mobileClose?.focus();icon();}
function closeMenu(){if(!menu||!hamb)return;menu.hidden=true;document.body.classList.remove("menu-open");hamb.setAttribute("aria-expanded","false");hamb.setAttribute("aria-label","Open navigation");}
hamb?.addEventListener("click",()=>menu.hidden?openMenu():closeMenu());
mobileClose?.addEventListener("click",closeMenu);
$$(".mobile-nav a").forEach(a=>a.addEventListener("click",closeMenu));
$("#search-form")?.addEventListener("submit",e=>{e.preventDefault();goServices($("#q")?.value.trim()||"",$("#loc")?.value.trim()||"");});
$$("[data-q]").forEach(b=>b.addEventListener("click",()=>goServices(b.dataset.q||"")));
$$("[data-plan]").forEach(b=>b.addEventListener("click",()=>goRegister("PROVIDER")));
$("#all")?.addEventListener("click",()=>goServices());
$("#map-explore")?.addEventListener("click",()=>goServices());
const results=$("#live-service-results"),status=$("#live-service-status");
async function loadLiveListings(){
 if(!results)return;
 try{
  const response=await fetch(API+"/api/services?limit=6");
  const data=await response.json().catch(()=>[]);
  if(!response.ok||!Array.isArray(data))throw Error(data.message||"The marketplace could not return its listings.");
  if(!data.length){
   results.innerHTML='<div class="listing-empty"><i data-lucide="package-search"></i><b>No published services yet</b><span>There are no active service listings available to show right now. Check back soon, or join Bradcall to publish a real service.</span><a href="register.html?role=PROVIDER">Offer a service <i data-lucide="arrow-up-right"></i></a></div>';
   if(status)status.textContent="Showing no sample or fabricated listings.";
   icon();return;
  }
  const list=data.slice(0,6);
  results.innerHTML=list.map(s=>{
   const p=s.provider||{},cat=s.category?.name||"Local service",where=s.location||p.location||"Area not specified";
   return '<article class="live-listing"><div class="listing-mark"><i data-lucide="briefcase-business"></i></div><div class="listing-copy"><span class="listing-category">'+esc(cat)+'</span><h3>'+esc(s.title||"Service listing")+'</h3><p>'+esc(s.description||"Contact the provider for service details.")+'</p><div class="listing-meta"><span><i data-lucide="map-pin"></i>'+esc(where)+'</span><span><i data-lucide="user-round"></i>'+esc(p.displayName||"Bradcall provider")+'</span>'+(p.verified?'<span class="listing-verified"><i data-lucide="badge-check"></i>Verified provider</span>':'')+'</div></div><div class="listing-end"><strong>'+money(s.price)+'</strong><a href="services.html?q='+encodeURIComponent(s.title||cat)+'">View listing <i data-lucide="arrow-up-right"></i></a></div></article>';
  }).join("");
  if(status)status.textContent="Showing "+list.length+" real published listing"+(list.length===1?"":"s")+" returned by Bradcall.";
  icon();
 }catch(error){
  results.innerHTML='<div class="listing-empty"><i data-lucide="wifi-off"></i><b>Live listings are temporarily unavailable</b><span>We could not connect to the Bradcall marketplace. No sample listings are being substituted.</span><a href="services.html">Open marketplace <i data-lucide="arrow-up-right"></i></a></div>';
  if(status)status.textContent="Live data could not be loaded.";
  icon();
 }
}
loadLiveListings();
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&menu&&!menu.hidden)closeMenu();});
icon();
})();