(function() {
  var backgrounds = ['img/WTY01986.JPG', 'img/WTY01889.JPG'];
  var current = 0;

  document.querySelector('.refresh').addEventListener('click', function() {
    current = (current + 1) % backgrounds.length;
    document.body.style.backgroundImage = 'url(' + backgrounds[current] + ')';
  });
})();
