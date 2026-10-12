const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const modal=$("#modal"),roles=$("#roles"),form=$("#form");
function registerAs(role="PARTNER"){location.href="register.html?role="+encodeURIComponent(role);}
function openModal(service="",role=""){
  if(role){registerAs(role==="provider"?"PROVIDER":"PARTNER");return;}
  if(!modal)return;
  modal.classList.add("open");roles.hidden=!!service;form.hidden=!service;
  if(service){$("#mt").textContent="Request this service";$("#mp").textContent="Sign in or create an account to continue your service request.";$("#rs").value=service;}
  else{$("#mt").textContent="Choose your path";$("#mp").textContent="One marketplace. Two ways to use it.";}
}
function closeModal(){modal?.classList.remove("open");}
$("#join")?.addEventListener("click",e=>{e.preventDefault();registerAs();});
$("#login")?.addEventListener("click",e=>{e.preventDefault();location.href="login.html";});
$("#provider")?.addEventListener("click",()=>registerAs("PROVIDER"));
$("#partner")?.addEventListener("click",()=>registerAs("PARTNER"));
$("#ctaProvider")?.addEventListener("click",()=>registerAs("PROVIDER"));
$("#ctaPartner")?.addEventListener("click",()=>registerAs("PARTNER"));
$("#close")?.addEventListener("click",closeModal);
$(".backdrop")?.addEventListener("click",closeModal);
$$(".request").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.service)));
$$("[data-role]").forEach(b=>b.addEventListener("click",()=>registerAs(b.dataset.role==="provider"?"PROVIDER":"PARTNER")));
$$("[data-plan]").forEach(b=>b.addEventListener("click",()=>registerAs("PROVIDER")));
function filter(q,note){q=q.toLowerCase().trim();let n=0;$$(".provider").forEach(c=>{const ok=!q||c.dataset.service.toLowerCase().includes(q);c.hidden=!ok;if(ok)n++;});if($("#note"))$("#note").textContent=note||"Popular nearby";if($("#empty"))$("#empty").hidden=n!==0;}
$("#find")?.addEventListener("click",()=>{const q=$("#q")?.value||"",loc=$("#loc")?.value||"";filter(q,loc?"Services near "+loc:"Search results");$("#providers")?.scrollIntoView({behavior:"smooth"});});
$$("[data-q]").forEach(b=>b.addEventListener("click",()=>{$("#q").value=b.dataset.q;filter(b.dataset.q,"Category: "+b.dataset.q);$("#providers")?.scrollIntoView({behavior:"smooth"});}));
$("#all")?.addEventListener("click",()=>filter("","Popular nearby"));
$("#send")?.addEventListener("click",()=>{if(!$("#rd")?.value.trim()){$("#rd")?.focus();return;}registerAs("PARTNER");});
$("#hamb")?.addEventListener("click",()=>{const nav=$(".topbar nav");if(!nav)return;const open=nav.classList.toggle("mobile-open");$("#hamb").setAttribute("aria-expanded",String(open));$("#hamb").setAttribute("aria-label",open?"Close navigation":"Open navigation");});
$$(".topbar nav a").forEach(a=>a.addEventListener("click",()=>$(".topbar nav")?.classList.remove("mobile-open")));
if(window.lucide)window.lucide.createIcons();
