/* Screensaver work runs only while visible; backgrounds change every 15 seconds. */
var ScreenRest = (function () {
  'use strict';
  var frame = 0, timer = 0, running = false;
  function stop() { running = false; window.cancelAnimationFrame(frame); clearInterval(timer); frame = timer = 0; }
  function node(cls, parent) { var n = document.createElement('div'); n.className = cls; parent.appendChild(n); return n; }
  function start(root, picks) {
    stop(); running = true; root.innerHTML = '';
    var mode = Prefs.saverMode(), photos = mode === 'photos' ? PhotoGallery.shuffle(window.LOCAL_PHOTOS || []) : picks;
    var soft, photo, index = -1;
    if (mode !== 'dvd') { soft = node('rest-soft', root); photo = node('rest-photo', root); node('shade', root); }
    var clock = node('clock' + (mode === 'dvd' ? ' dvd-clock' : ''), root), time = node('time', clock), date = node('date', clock), info = node('rest-info', clock), message = node('rest-message', clock);
    var x = 160, y = 180, dx = 74, dy = 51, last = Date.now(), color = 0, width = 700, height = 330;
    var colors = ['#78e8ff', '#ff81ce', '#a0ff94', '#ffcf70', '#b69cff', '#fff'];
    function update() {
      var now = Date.now(), weather = Data.weather, lines = [];
      time.textContent = formatDate('format|h:mm', now); date.textContent = formatDate('format|EEEE, MMMM d', now);
      if (weather) lines.push((Data.city || '') + '  ' + Data.degrees(weather.temp));
      info.textContent = lines.join('\n'); message.textContent = Prefs.saverText();
      width = clock.offsetWidth; height = clock.offsetHeight;
    }
    function change() {
      if (!photo || !photos.length) return;
      index = (index + 1) % photos.length; var p = photos[index];
      photo.style.backgroundImage = 'url(' + (mode === 'photos' ? p.full || p.backdrop : Data.image(p.backdrop, 'w1280')) + ')';
      photo.style.backgroundSize = mode === 'photos' ? 'contain' : 'cover';
      soft.style.backgroundImage = 'url(' + (mode === 'photos' ? p.blur || p.backdrop : Data.image(p.backdrop, 'w300')) + ')';
    }
    function animate() {
      if (!running) return;
      var now = Date.now(), next = DvdClock.step({x: x, y: y, dx: dx, dy: dy}, Math.min(.05, (now - last) / 1000), 1920 - width - 32, 1080 - height - 32); last = now;
      x = next.x; y = next.y; dx = next.dx; dy = next.dy;
      if (next.bounced) clock.style.color = colors[(++color) % colors.length];
      clock.style.webkitTransform = clock.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      frame = window.requestAnimationFrame(animate);
    }
    update(); change(); var seconds = 0;
    timer = setInterval(function () { update(); if (++seconds % 15 === 0) change(); }, 1000);
    if (mode === 'dvd') frame = window.requestAnimationFrame(animate);
  }
  return {start: start, stop: stop};
}());
