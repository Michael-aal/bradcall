(() => {
  "use strict";
  const API=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
  const $=s=>document.querySelector(s);
  const token=()=>localStorage.getItem("bradcall_token")||"";
  const errorEl=$("#profile-error"),form=$("#profile-form"),button=$("#save-profile");
  let user=null;
  const dashboards={PARTNER:"consumer-dashboard.html",PROVIDER:"provider-dashboard.html",ADMIN:"admin-dashboard.html"};
  function showError(message){errorEl.textContent=message;errorEl.classList.add("visible");}
  function clearError(){errorEl.textContent="";errorEl.classList.remove("visible");}
  function goToWorkspace(role){location.replace(dashboards[role]||"index.html");}
  async function api(path,options={}) {
    const response=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token(),...(options.headers||{})}});
    const data=await response.json().catch(()=>({message:"Unexpected response from Bradcall."}));
    if(!response.ok)throw new Error(data.message||"Request failed.");
    return data;
  }
  $("#signout").addEventListener("click",()=>{localStorage.removeItem("bradcall_token");localStorage.removeItem("bradcall_user");location.href="index.html";});
  async function init(){
    if(!token()){location.replace("login.html");return;}
    try{
      const data=await api("/api/auth/me");user=data.user;
      localStorage.setItem("bradcall_user",JSON.stringify(user));
      if(user.role==="ADMIN"){goToWorkspace(user.role);return;}
      if(user.profileCompleted){goToWorkspace(user.role);return;}
      const isProvider=user.role==="PROVIDER";
      $("#welcome-title").textContent=isProvider?"Introduce your service business.":"Let's set up your customer profile.";
      $("#welcome-copy").textContent=isProvider?"Tell customers who you are, what you offer, and the area you serve.":"Add a few details so Bradcall can tailor your local service experience.";
      $("#role-label").textContent=isProvider?"SERVICE PROVIDER PROFILE":"CUSTOMER PROFILE";
      $("#form-title").textContent=isProvider?"Your provider profile":"Your personal details";
      $("#next-step").textContent=isProvider?"Provider workspace":"Customer dashboard";
      $("#avatar").textContent=(user.name||"B").trim().charAt(0).toUpperCase();
      $("#name").value=user.name||"";
      $("#phone").value=user.phone||"";
      $("#location").value=user.location||user.provider?.location||"";
      if(isProvider){
        $("#provider-fields").hidden=false;
        $("#displayName").required=true;
        $("#displayName").value=user.provider?.displayName||user.name||"";
        $("#bio").value=user.provider?.bio||"";
        $("#profile-note").textContent="Your provider profile is saved to your account. You can add individual service listings in your provider workspace next.";
      }else{
        $("#profile-note").textContent="Your name and area are saved to your account. You can browse services and manage requests from your customer dashboard.";
      }
    }catch(error){
      showError(error instanceof TypeError?"Could not reach Bradcall's API. Check the backend URL and try again.":error.message);
    }
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();clearError();
    const payload=Object.fromEntries(new FormData(form));
    payload.name=String(payload.name||"").trim();
    payload.phone=String(payload.phone||"").trim();
    payload.location=String(payload.location||"").trim();
    payload.displayName=String(payload.displayName||"").trim();
    payload.bio=String(payload.bio||"").trim();
    if(!payload.name||!payload.location){showError("Please enter your name and main area or city.");return;}
    if(user?.role==="PROVIDER"&&!payload.displayName){showError("Please enter your business or service name.");return;}
    button.disabled=true;button.textContent="Saving your profile…";
    try{
      const result=await api("/api/auth/profile",{method:"PATCH",body:JSON.stringify(payload)});
      user=result.user;localStorage.setItem("bradcall_user",JSON.stringify(user));
      button.textContent="Saved — opening your workspace…";
      goToWorkspace(user.role);
    }catch(error){
      showError(error instanceof TypeError?"Could not reach Bradcall's API. Your details have not been saved.":error.message);
      button.disabled=false;button.innerHTML='Save profile and continue <span aria-hidden="true">→</span>';
    }
  });
  init();
})();
