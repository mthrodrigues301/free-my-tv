/* A light glass treatment without blur or expensive framebuffer effects on old TVs. */
var Glass = (function () {
  'use strict';
  var style;
  function apply(value) {
    var transparency = Math.max(0, Math.min(95, Number(value) || 0)), alpha = (100 - transparency) / 100;
    if (!style) { style = document.createElement('style'); document.head.appendChild(style); }
    var fill = 'linear-gradient(135deg,rgba(255,255,255,' + (alpha * 0.7) + '),rgba(35,42,58,' + alpha + '))';
    var menuAlpha = 0.5 + alpha * 0.5;
    var menuFill = 'linear-gradient(135deg,rgba(30,36,48,' + menuAlpha + '),rgba(12,16,26,' + Math.min(1, menuAlpha + 0.12) + '))';
    style.textContent = '.sheet{background:rgba(0,0,0,' + (alpha * 0.35) + ')}' +
      '#settings .box,#shelfedit .box,#langpick .box,#citypick .box,#recommendations .box,#widgetpick .box,#widgetorder .box{background:' + menuFill + ';border:1px solid rgba(255,255,255,.45);box-shadow:inset 0 1px 1px rgba(255,255,255,.6),0 22px 70px rgba(0,0,0,.28);text-shadow:0 1px 6px rgba(0,0,0,.85)}' +
      '#platter,.night #platter{background:' + fill + ';border:1px solid rgba(255,255,255,.45)}';
  }
  return {apply: apply};
}());
var DvdClock = (function () {
  'use strict';
  function step(p, dt, maxX, maxY) {
    var x = p.x + p.dx * dt, y = p.y + p.dy * dt, dx = p.dx, dy = p.dy, bounced = false;
    if (x <= 32 || x >= maxX) { dx = -dx; x = Math.max(32, Math.min(maxX, x)); bounced = true; }
    if (y <= 32 || y >= maxY) { dy = -dy; y = Math.max(32, Math.min(maxY, y)); bounced = true; }
    return {x: x, y: y, dx: dx, dy: dy, bounced: bounced};
  }
  return {step: step};
}());
