$(document).ready(function(){
    img = "bg0" + parseInt(Math.random()*5)
    background_image = "url(img/" + img + ".jpg)"
    $(".bg").css("background-image", background_image);
    $(".content").addClass(img)
});