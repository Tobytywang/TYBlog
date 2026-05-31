(function() {
  var backgrounds = ['img/WTY01986.JPG', 'img/WTY01889.JPG'];
  var current = 0;
  var refresh = document.querySelector('.refresh');

  // 阻止 mousedown 默认行为，防止快速双击触发文字选中
  refresh.addEventListener('mousedown', function(e) {
    e.preventDefault();
  });

  refresh.addEventListener('click', function() {
    current = (current + 1) % backgrounds.length;
    document.body.style.backgroundImage = 'url(' + backgrounds[current] + ')';
  });
})();
