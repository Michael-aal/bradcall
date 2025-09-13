let text = document.querySelector(".text")
let section = document.querySelector(".section1")
let input = document.querySelector(".input")
let receiver = document.querySelector(".receiver")
let send = document.querySelector(".sendbtn")

setTimeout( ()=>{
    text.textContent = "Let get started  Login / Sign up."
    
    setTimeout( ()=>{
    text.textContent = "On this website , You have the ability to render or request for services."
     
        setTimeout( ()=>{
    text.textContent = "Thanks for using this website."
1}, 15000)

1}, 10000)

1}, 5000)



//customer care

send.addEventListener("click", ()=>{
    let sender = document.querySelector(".send")
 let chatInput = document.querySelector(".msg").value

 sender.innerHTML = chatInput

console.log(chatInput)
 console.log(sender)

})
