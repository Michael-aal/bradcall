(() => {
"use strict";
const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(v)||0);
const params=new URLSearchParams(location.search),providerId=params.get("id")||"",preferredService=params.get("service")||"";
let provider=null;
function pill(text,kind=""){return '<span class="profile-pill '+kind+'">'+esc(text)+'</span>'}
function showStatus(message,error=false){const node=$("#profile-status");node.textContent=message;node.classList.toggle("error",error);node.hidden=false;}
async function load(){
 if(!providerId){showStatus("This provider link is incomplete. Return to discovery and choose a provider.",true);return;}
 try{
  const response=await fetch(API+"/api/services/providers/"+encodeURIComponent(providerId));
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||"Could not load this provider profile.");
  provider=data;
  $("#profile-status").hidden=true;$("#profile-content").hidden=false;
  $("#profile-avatar").textContent=String(data.displayName||"B").trim().slice(0,1).toUpperCase();
  $("#profile-name").textContent=data.displayName||"Service provider";
  $("#profile-kind").textContent=data.providerType==="COMPANY"?"COMPANY SERVICE PROVIDER":"INDIVIDUAL SERVICE PROVIDER";
  $("#profile-location").textContent=data.location||"Service area not listed";
  $("#profile-bio").textContent=data.bio||"This provider has not added an introduction yet. Review the services below and send a request if one matches what you need.";
  $("#profile-pills").innerHTML=pill(data.available?"Available for requests":"Not taking new requests",data.available?"good":"")+(data.verified?pill("Identity/profile verified","good"):"")+pill((Number(data.completedJobs)||0)+" completed jobs")+pill(data.averageRating?data.averageRating+" / 5 · "+(data.reviewCount||0)+" reviews":"No reviews yet");
  $("#profile-skills").innerHTML=(data.skills||[]).map(s=>pill(s)).join("")+(data.yearsExperience!=null?pill(data.yearsExperience+" years experience"):"");
  const services=Array.isArray(data.services)?data.services:[];
  $("#profile-services").innerHTML=services.length?services.map(s=>'<article class="profile-service-card"><div><span class="profile-service-category">'+esc(s.category?.name||data.primaryCategory||"SERVICE")+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.description||"Ask the provider for details about this service.")+'</p><small>'+esc(s.location||data.location||"Area not listed")+'</small></div><div class="profile-service-end"><strong>'+money(s.price)+'</strong><button type="button" data-book-service="'+esc(s.id)+'" '+(!data.available?'disabled':'')+'>Choose service</button></div></article>').join(""):'<div class="profile-empty">This provider has not published an active service listing yet.</div>';
  $("#profile-reviews").innerHTML=(data.reviews||[]).length?data.reviews.map(r=>'<article class="profile-review"><strong>'+esc("★".repeat(Math.max(0,Math.min(5,Number(r.rating)||0))))+' <span>'+esc(r.rating)+'/5</span></strong><p>'+esc(r.comment||"No written comment.")+'</p><small>'+esc(new Date(r.createdAt).toLocaleDateString("en-NG"))+'</small></article>').join(""):'<div class="profile-empty">No reviews have been recorded for this provider yet.</div>';
  const select=$("#booking-service");
  select.innerHTML='<option value="">Choose a service</option>'+services.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.title)+' · '+esc(money(s.price))+'</option>').join("");
  if(preferredService&&services.some(s=>s.id===preferredService))select.value=preferredService;
  if(!data.available){$("#booking-status").hidden=false;$("#booking-status").textContent="This provider is not currently accepting new requests.";}
 }catch(error){showStatus(error.message||"Could not load this provider profile. Try again.",true);}
}
document.addEventListener("click",event=>{const button=event.target.closest("[data-book-service]");if(!button)return;$("#booking-service").value=button.dataset.bookService;$("#booking-form").scrollIntoView({behavior:"smooth",block:"center"});$("#booking-details").focus();});
$("#booking-form").addEventListener("submit",async event=>{
 event.preventDefault();
 const token=localStorage.getItem("bradcall_token")||"";
 if(!token){location.href="login.html";return;}
 let user={};try{user=JSON.parse(localStorage.getItem("bradcall_user")||"{}");}catch{}
 if(user.role&&user.role!=="PARTNER"){const status=$("#booking-status");status.hidden=false;status.textContent="Bookings must be sent from a customer account. You can still browse and share provider profiles.";return;}
 const serviceId=$("#booking-service").value,details=$("#booking-details").value.trim(),locationText=$("#booking-location").value.trim(),button=$("#booking-form button[type=submit]");
 if(!serviceId){$("#booking-status").hidden=false;$("#booking-status").textContent="Choose one of this provider’s services first.";return;}
 button.disabled=true;button.textContent="Sending request…";
 try{
  const response=await fetch(API+"/api/requests",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({serviceId,details,location:locationText})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||"The booking request could not be sent.");
  location.href="messages.html?requestId="+encodeURIComponent(data.id);
 }catch(error){const status=$("#booking-status");status.hidden=false;status.textContent=error.message||"Could not send booking request.";button.disabled=false;button.innerHTML='Send booking request <span aria-hidden="true">→</span>';}
});
load();
})();