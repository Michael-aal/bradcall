const API_BASE=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
const $=s=>document.querySelector(s);
const showError=message=>{const el=$("#form-error");if(el){el.textContent=message;el.classList.add("visible")}};
const clearError=()=>{const el=$("#form-error");if(el){el.textContent="";el.classList.remove("visible")}};
const friendlyError=e=>e instanceof TypeError?"Could not reach Bradcall's API at "+API_BASE+". Page origin: "+location.origin+". This usually means a CORS or deployment configuration problem.":e.message||"Something went wrong.";
const saveSession=d=>{localStorage.setItem("bradcall_token",d.token);localStorage.setItem("bradcall_user",JSON.stringify(d.user))};
const goForRole=(role,status)=>location.href=(status==="SUSPENDED"||status==="BANNED")?"trust-center.html":role==="PROVIDER"?"provider-dashboard.html":role==="ADMIN"?"admin-dashboard.html":"consumer-dashboard.html";

const loginForm=$("#login-form");
if(loginForm)loginForm.addEventListener("submit",async e=>{
 e.preventDefault();clearError();
 const email=$("#email").value.trim(),password=$("#password").value;
 if(!email||!password)return showError("Enter your email and password.");
 try{const r=await fetch(API_BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}),d=await r.json();if(!r.ok)throw Error(d.message||"Unable to log in.");saveSession(d);goForRole(d.user.role,d.user.status)}catch(err){showError(friendlyError(err))}
});

const registerForm=$("#register-form");
const providerFields=$("#provider-fields"),phoneField=$("#phone"),categoryField=$("#primary-category"),locationField=$("#location");
function syncProviderFields(){
 const isProvider=document.querySelector('input[name="role"]:checked')?.value==="PROVIDER";
 if(providerFields)providerFields.hidden=!isProvider;
 [phoneField,categoryField,locationField].forEach(field=>{if(field)field.required=isProvider});
}
if(registerForm){
 document.querySelectorAll('input[name="role"]').forEach(option=>option.addEventListener("change",syncProviderFields));
 syncProviderFields();
 registerForm.addEventListener("submit",async e=>{
  e.preventDefault();clearError();
  const name=$("#name").value.trim(),email=$("#email").value.trim(),password=$("#password").value,confirm=$("#confirm-password").value;
  const role=document.querySelector('input[name="role"]:checked')?.value||"PARTNER";
  const acceptedPolicies=$("#accepted-policies")?.checked===true;
  const phone=phoneField?.value.trim()||"",primaryCategory=categoryField?.value.trim()||"",location=locationField?.value.trim()||"";
  if(!name||!email||!password||!confirm)return showError("Complete all required fields.");
  if(password.length<8)return showError("Use a password with at least 8 characters.");
  if(password.length>128)return showError("Password must be no longer than 128 characters.");
  if(password!==confirm)return showError("Your passwords do not match.");
  if(role==="PROVIDER"&&(!phone||!primaryCategory||!location))return showError("Complete your phone number, service category, and service location.");
  if(role==="PROVIDER"&&!/^\+?[0-9 ()-]{7,30}$/.test(phone))return showError("Enter a valid phone number.");
  if(!acceptedPolicies)return showError("Accept the Terms and Privacy Policy before registering.");
  const payload={name,email,password,role,acceptedPolicies};
  if(role==="PROVIDER")Object.assign(payload,{providerType:"INDIVIDUAL",phone,primaryCategory,location});
  try{const r=await fetch(API_BASE+"/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw Error(d.message||"Unable to create your account.");saveSession(d);goForRole(d.user.role,d.user.status)}catch(err){showError(friendlyError(err))}
 });
}

document.querySelectorAll("[data-open-login]").forEach(el=>el.addEventListener("click",()=>location.href="login.html"));
const requestedRole=new URLSearchParams(location.search).get("role");
if(registerForm&&["PARTNER","PROVIDER"].includes(requestedRole)){
 const option=document.querySelector('input[name="role"][value="'+requestedRole+'"]');
 if(option)option.checked=true;
 syncProviderFields();
}
