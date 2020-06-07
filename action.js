$(document).ready(function(){
})

$("div.refresh").click(function() {
    var oldlink = document.getElementsByTagName("link").item(2);
    var newlink = document.createElement("link");
    newlink.setAttribute("rel", "stylesheet");
    newlink.setAttribute("type", "text/css");
    var styleList = ['style.css', 'style1.css']
    newlink.setAttribute("href", styleList[Math.floor((Math.random()*styleList.length))]);
    document.getElementsByTagName("head").item(0).replaceChild(newlink, oldlink);
})