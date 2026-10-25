/* Frame cadence is an estimate, not GPU/video FPS. System counters are TV-wide. */
var Metrics = (function () {
  'use strict';
  var enabled = true, panel, raf = null, timer = null, bridge = null, pending = false;
  var previous = null, started = null, frames = 0, stalls = 0, worst = 0, fps = null, frameMs = null;
  var cpuPrevious = null, cpuPercent = null, memory = null, epoch = 0;
  var request = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
  var cancel = window.cancelAnimationFrame || window.webkitCancelAnimationFrame;
  try { enabled = localStorage.getItem('fmtv.metrics') !== 'off'; } catch (e) {}
  function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function active() { return enabled && !document.hidden; }
  function unavailable() { return tr('Unavailable'); }
  function mb(n) { return (n / 1048576).toFixed(1) + ' MiB'; }
  function frame(t) {
    if (!active()) return;
    if (typeof t !== 'number') t = now();
    if (previous !== null) {
      var gap = Math.max(0, t - previous);
      if (gap > 100) stalls++;
      worst = Math.max(worst, gap);
      frames++;
    }
    if (started === null) started = t;
    if (t - started >= 1000 && frames) {
      fps = frames * 1000 / (t - started);
      frameMs = (t - started) / frames;
      frames = 0; started = t;
    }
    previous = t;
    raf = request.call(window, frame);
  }
  function sampleSystem() {
    if (pending || !window.PalmServiceBridge) return;
    pending = true;
    var generation = epoch, current = new window.PalmServiceBridge();
    bridge = current;
    var timeout = setTimeout(function () { finish(null); }, 2500);
    function finish(value) {
      if (generation !== epoch || bridge !== current) return;
      clearTimeout(timeout); pending = false; bridge = null;
      try { current.cancel(); } catch (e) {}
      cpuPercent = null; memory = null;
      if (value && value.returnValue !== false) {
        if (value.cpu && isFinite(value.cpu.total) && isFinite(value.cpu.idle)) {
          if (cpuPrevious) {
            var total = value.cpu.total - cpuPrevious.total, idle = value.cpu.idle - cpuPrevious.idle;
            if (total > 0 && idle >= 0 && idle <= total) cpuPercent = 100 * (total - idle) / total;
          }
          cpuPrevious = value.cpu;
        } else cpuPrevious = null;
        if (value.ram && value.ram.total > 0 && value.ram.available >= 0 && value.ram.available <= value.ram.total) memory = value.ram;
      } else cpuPrevious = null;
      render();
    }
    current.onservicecallback = function (raw) {
      var value = null;
      try { value = JSON.parse(raw); } catch (e) {}
      finish(value);
    };
    try { current.call('luna://io.freemytv.metrics/sample', '{}'); } catch (e) { finish(null); }
  }
  function render() {
    if (!panel) return;
    var heap = window.performance && performance.memory;
    var js = heap && heap.usedJSHeapSize > 0 ? mb(heap.usedJSHeapSize) : unavailable();
    panel.textContent = tr('Performance') + ' | ' +
      'FPS (UI): ' + (fps === null ? unavailable() : fps.toFixed(1) + ' | ' + frameMs.toFixed(1) + ' ms') + ' | ' +
      tr('Stalls >100 ms') + ': ' + stalls + ' | ' + tr('Worst frame') + ': ' + worst.toFixed(0) + ' ms\n' +
      tr('JavaScript memory') + ': ' + js + ' | ' +
      tr('CPU (TV total)') + ': ' + (cpuPercent === null ? unavailable() : cpuPercent.toFixed(1) + '%') + ' | ' +
      tr('RAM (TV total)') + ': ' + (memory ? mb(memory.total - memory.available) + ' / ' + mb(memory.total) : unavailable());
  }
  function stop() {
    epoch++;
    if (raf !== null && cancel) cancel.call(window, raf);
    clearInterval(timer); raf = null; timer = null;
    try { if (bridge) bridge.cancel(); } catch (e) {}
    bridge = null; pending = false;
    previous = null; started = null; frames = 0; cpuPrevious = null;
    cpuPercent = null; memory = null; fps = null; frameMs = null;
  }
  function resume() {
    stop();
    panel.style.display = active() && !document.querySelector('#saver.on') ? 'block' : 'none';
    if (!active()) return;
    if (request) raf = request.call(window, frame);
    render(); sampleSystem();
    timer = setInterval(function () {
      panel.style.display = document.querySelector('#saver.on') ? 'none' : 'block';
      render(); sampleSystem();
    }, 3000);
  }
  function init() {
    panel = document.createElement('div'); panel.id = 'metrics';
    document.getElementById('stage').appendChild(panel);
    document.addEventListener('visibilitychange', resume);
    resume();
  }
  return {init: init, enabled: function () { return enabled; }, toggle: function () {
    enabled = !enabled;
    try { localStorage.setItem('fmtv.metrics', enabled ? 'on' : 'off'); } catch (e) {}
    resume();
  }};
}());
Metrics.init();
