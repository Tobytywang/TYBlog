$(document).ready(function(){
})

/* 点击刷新按钮，刷新页面 */
$("div.refresh").click(function() {
    var old_link = document.getElementsByTagName("link").item(2);
    var new_link = document.createElement("link");
    new_link.setAttribute("rel", "stylesheet");
    new_link.setAttribute("type", "text/css");
    var styleList = ['style.css', 'style1.css']
    new_link.setAttribute("href", styleList[Math.floor((Math.random()*styleList.length))]);
    document.getElementsByTagName("head").item(0).replaceChild(new_link, old_link);
})