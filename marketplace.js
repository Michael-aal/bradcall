const API_BASE=(window.BRADCALL_API_URL||(location.hostname==="localhost"||location.hostname==="127.0.0.1"?"http://localhost:5000":location.origin)).replace(/\/$/,"");
const $=s=>document.querySelector(s);
const showError=message=>{const el=$("#form-error");if(el){el.textContent=message;el.classList.add("visible")}};
const clearError=()=>{const el=$("#form-error");if(el){el.textContent="";el.classList.remove("visible")}};
const friendlyError=e=>e instanceof TypeError?"Could not reach Bradcall's API at "+API_BASE+". Page origin: "+location.origin+". This usually means a CORS or deployment configuration problem.":e.message||"Something went wrong.";
const saveSession=d=>{localStorage.setItem("bradcall_token",d.token);localStorage.setItem("bradcall_user",JSON.stringify(d.user))};
const goForRole=(role,status,user)=>{const normalized=String(role||"").trim().toUpperCase();const target=(status==="SUSPENDED"||status==="BANNED")?"trust-center.html":normalized==="ADMIN"?"admin-dashboard.html":normalized==="PROVIDER"?"provider-dashboard.html":["PARTNER","CUSTOMER","CONSUMER"].includes(normalized)?"consumer-dashboard.html":"profile-setup.html";location.replace(target);};

const loginForm=$("#login-form");
if(loginForm)loginForm.addEventListener("submit",async e=>{
 e.preventDefault();clearError();
 const email=$("#email").value.trim(),password=$("#password").value;
 if(!email||!password)return showError("Enter your email and password.");
 try{const r=await fetch(API_BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}),d=await r.json();if(!r.ok){if(r.status===403&&d.code==="VERIFICATION_REQUIRED"){location.href="verify.html?email="+encodeURIComponent(email)+"&method="+encodeURIComponent(d.method||"EMAIL");return}throw Error(d.message||"Unable to log in.")}saveSession(d);goForRole(d.user.role,d.user.status,d.user)}catch(err){showError(friendlyError(err))}
});

const registerForm=$("#register-form");
const providerFields=$("#provider-fields"),companyNameField=$("#company-name-field"),companyNameInput=$("#company-name"),phoneField=$("#phone"),categoryField=$("#primary-category"),locationField=$("#location"),stateField=$("#state"),nameLabel=$("#name-label"),nameInput=$("#name");
const accountType=()=>document.querySelector('input[name="accountType"]:checked')?.value||"PARTNER";
function syncProviderFields(){
 const type=accountType(),isProvider=type!=="PARTNER",isCompany=type==="COMPANY";
 if(providerFields)providerFields.hidden=!isProvider;
 if(companyNameField)companyNameField.hidden=!isCompany;
 if(companyNameInput){companyNameInput.required=isCompany;companyNameInput.disabled=!isCompany;}
 if(categoryField){categoryField.required=isProvider;categoryField.disabled=!isProvider;}
 if(phoneField)phoneField.required=isProvider;
 if(nameLabel)nameLabel.textContent=isCompany?"Contact person's full name":"Full name";
 if(nameInput)nameInput.placeholder=isCompany?"Owner or authorised representative's full name":"Your full name";
 const title=$("#provider-fields-title"),copy=$("#provider-fields-copy");
 if(title)title.textContent=isCompany?"Company / business details":"Individual service provider";
 if(copy)copy.textContent=isCompany?"Tell customers about your business. Your contact details and service area are captured above.":"Tell customers what you do. Your phone, state and service area are captured above.";
}
if(registerForm){
 document.querySelectorAll('input[name="accountType"]').forEach(option=>option.addEventListener("change",syncProviderFields));
 syncProviderFields();
 registerForm.addEventListener("submit",async e=>{
  e.preventDefault();clearError();
  const name=nameInput.value.trim(),email=$("#email").value.trim(),password=$("#password").value,confirm=$("#confirm-password").value;
  const type=accountType(),role=type==="PARTNER"?"PARTNER":"PROVIDER";
  const acceptedPolicies=$("#accepted-policies")?.checked===true;
  const phone=phoneField?.value.trim()||"",primaryCategory=categoryField?.value.trim()||"",companyName=companyNameInput?.value.trim()||"",area=locationField?.value.trim()||"",state=stateField?.value||"";
  if(!name||!email||!password||!confirm)return showError("Complete all required fields.");
  if(password.length<8)return showError("Use a password with at least 8 characters.");
  if(password.length>128)return showError("Password must be no longer than 128 characters.");
  if(password!==confirm)return showError("Your passwords do not match.");
  if(!state||!area)return showError("Choose your state and enter your town or area.");
  if(role==="PROVIDER"&&(!phone||!primaryCategory))return showError("Complete your phone number and choose a service category.");
  if(type==="COMPANY"&&!companyName)return showError("Enter your company or business name.");
  if(companyName.length>120)return showError("Company or business name must be 120 characters or fewer.");
  if((role==="PROVIDER"||phone)&&!/^\+?[0-9 ()-]{7,30}$/.test(phone))return showError("Enter a valid phone number.");
  if(!acceptedPolicies)return showError("Accept the Terms and Privacy Policy before registering.");
  const payload={name,email,password,role,acceptedPolicies,phone,state,location:area,verificationMethod:"EMAIL"};
  if(role==="PROVIDER")Object.assign(payload,{providerType:type==="COMPANY"?"COMPANY":"INDIVIDUAL",primaryCategory,...(type==="COMPANY"?{companyName}:{})});
  try{const r=await fetch(API_BASE+"/api/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw Error(d.message||"Unable to create your account.");window.location.href="verify.html?email="+encodeURIComponent(d.email||email)+"&method="+encodeURIComponent(d.method||"EMAIL")+(d.deliveryPending?"&pending=1":"");}catch(err){showError(friendlyError(err))}
 });
}
document.querySelectorAll("[data-open-login]").forEach(el=>el.addEventListener("click",()=>location.href="login.html"));
const requestedRole=new URLSearchParams(location.search).get("role");
if(registerForm){
 const initialType=requestedRole==="PROVIDER"?"INDIVIDUAL":requestedRole==="COMPANY"?"COMPANY":requestedRole==="PARTNER"?"PARTNER":requestedRole;
 if(["PARTNER","INDIVIDUAL","COMPANY"].includes(initialType)){
  const option=document.querySelector('input[name="accountType"][value="'+initialType+'"]');
  if(option)option.checked=true;
 }
 syncProviderFields();
}

const verifyForm=$("#verify-form");
if(verifyForm){
 const params=new URLSearchParams(window.location.search),emailInput=$("#verify-email"),codeInput=$("#verify-code"),message=$("#verify-error"),copy=$("#verify-copy");
 emailInput.value=params.get("email")||"";
 if(copy)copy.textContent=params.get("pending")==="1"?"Your account was created, but the email code could not be delivered. Check delivery settings and request a new code.":"Enter the six-digit code sent to your email address.";
 const showVerifyError=(text)=>{message.textContent=text;message.classList.add("visible")};
 verifyForm.addEventListener("submit",async event=>{
  event.preventDefault();message.classList.remove("visible");
  const email=emailInput.value.trim(),code=codeInput.value.trim();
  try{const response=await fetch(API_BASE+"/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})}),data=await response.json();if(!response.ok)throw Error(data.message||"Could not verify this code.");copy.textContent="Your contact is verified. You can now log in to Bradcall.";verifyForm.hidden=true;$("#resend-code").hidden=true;const link=document.createElement("a");link.className="auth-submit";link.style.display="block";link.style.textAlign="center";link.style.textDecoration="none";link.href="login.html";link.textContent="Continue to log in";verifyForm.after(link);}catch(error){showVerifyError(error.message||"Could not verify this code.");}
 });
 $("#resend-code").addEventListener("click",async()=>{
  message.classList.remove("visible");const email=emailInput.value.trim();if(!email)return showVerifyError("Enter the email address used to register.");
  const button=$("#resend-code");button.disabled=true;button.textContent="Sending…";
  try{const response=await fetch(API_BASE+"/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})}),data=await response.json();if(!response.ok)throw Error(data.message||"Could not send a new code.");copy.textContent=data.message||"A new code was requested.";}catch(error){showVerifyError(error.message||"Could not send a new code.");}finally{button.disabled=false;button.textContent="Send a new code";}
 });
}
