const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

const modal=$("#modal"),roles=$("#roles"),form=$("#form"),dialog=document.querySelector(".dialog");
const menu=$("#mobile-nav"),hamb=$("#hamb"),mobileClose=$("#mobile-close");
let lastFocused=null;

function refreshIcons(){if(window.lucide)window.lucide.createIcons()}

function openMenu(){
  menu.hidden=false;document.body.classList.add("menu-open");
  hamb.setAttribute("aria-expanded","true");hamb.setAttribute("aria-label","Close navigation");
  mobileClose.focus();refreshIcons();
}
function closeMenu(){
  menu.hidden=true;document.body.classList.remove("menu-open");
  hamb.setAttribute("aria-expanded","false");hamb.setAttribute("aria-label","Open navigation");
}
hamb?.addEventListener("click",()=>menu.hidden?openMenu():closeMenu());
mobileClose?.addEventListener("click",closeMenu);
$$(".mobile-nav a").forEach(a=>a.addEventListener("click",closeMenu));
$("#mobile-login")?.addEventListener("click",()=>{closeMenu();openModal()});
$("#mobile-join")?.addEventListener("click",()=>{closeMenu();openModal()});

function openModal(service="",role=""){
  lastFocused=document.activeElement;
  modal.hidden=false;document.body.classList.add("modal-open");
  roles.hidden=!!service||!!role;form.hidden=!service&&!role;
  if(service){$("#mt").textContent="Request this service";$("#mp").textContent="Give the provider enough detail to understand the job.";$("#rs").value=service}
  else if(role){$("#mt").textContent=role==="provider"?"Create your provider profile":"Join as a partner";$("#mp").textContent=role==="provider"?"Start with a service profile. Upgrade later when you need more reach.":"Browse existing services and send requests.";$("#rs").value=role==="provider"?"New service profile":"Service request"}
  else{$("#mt").textContent="Choose your path";$("#mp").textContent="One marketplace. Two ways to use it."}
  requestAnimationFrame(()=>dialog.focus());refreshIcons();
}
function closeModal(){
  modal.hidden=true;document.body.classList.remove("modal-open");
  form.hidden=true;roles.hidden=false;
  if(lastFocused&&typeof lastFocused.focus==="function")lastFocused.focus();
}
$("#join").onclick=()=>openModal();$("#login").onclick=()=>openModal();
$("#provider").onclick=()=>openModal("", "provider");$("#partner").onclick=()=>openModal("", "partner");$("#ctaProvider").onclick=()=>openModal("", "provider");
$("#close").onclick=closeModal;$$("[data-close-modal]").forEach(el=>el.onclick=closeModal);
$$(".request").forEach(b=>b.onclick=()=>openModal(b.dataset.service));
$$("[data-role]").forEach(b=>b.onclick=()=>openModal("",b.dataset.role));
$$("[data-plan]").forEach(b=>b.onclick=()=>openModal("", "provider"));

function filter(q,location,note){
  q=q.toLowerCase().trim();location=location.toLowerCase().trim();let n=0;
  $$(".provider").forEach(c=>{
    const service=c.dataset.service.toLowerCase(),loc=c.dataset.location.toLowerCase();
    const ok=(!q||service.includes(q))&&(!location||loc.includes(location));
    c.hidden=!ok;if(ok)n++;
  });
  $("#note").textContent=note||"Popular nearby";$("#empty").hidden=n!==0;
}
$("#search-form").addEventListener("submit",e=>{
  e.preventDefault();
  const q=$("#q").value,loc=$("#loc").value;
  filter(q,loc,loc?"Services near "+loc:"Search results");
  $("#providers").scrollIntoView({behavior:"smooth",block:"start"});
});
$$("[data-q]").forEach(b=>b.onclick=()=>{
  $("#q").value=b.dataset.q;$("#loc").value="";
  filter(b.dataset.q,"","Category: "+b.dataset.q);
  $("#providers").scrollIntoView({behavior:"smooth",block:"start"});
});
$("#all").onclick=()=>{filter("","","Popular nearby");$("#providers").scrollIntoView({behavior:"smooth",block:"start"})};
$("#map-explore").onclick=()=>$("#services").scrollIntoView({behavior:"smooth"});

form.addEventListener("submit",e=>{
  e.preventDefault();
  if(!$("#rd").value.trim()){ $("#rd").focus();return }
  $("#mt").textContent="Request ready";
  $("#mp").textContent="The frontend flow is ready for the real request API and provider dashboard.";
  form.hidden=true;
});

document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(!modal.hidden)closeModal();
    else if(!menu.hidden)closeMenu();
  }
  if(e.key==="Tab"&&!modal.hidden){
    const focusable=[...dialog.querySelectorAll("button,input,textarea,[href]")].filter(el=>!el.disabled&&el.offsetParent!==null);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
});

refreshIcons();
