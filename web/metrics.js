/* Frame cadence is an estimate, not GPU/video FPS. System counters are TV-wide. */
var Metrics = (function () {
  'use strict';
  var compact = false, enabled = true, panel, fields = {}, raf = null, timer = null, bridge = null, pending = false;
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
  function mount(card, summary) {
    compact = summary === true;
    panel = card; fields = {};
    function node(cls, text, parent) {
      var n = document.createElement('div'); n.className = cls; n.textContent = text || '';
      parent.appendChild(n); return n;
    }
    node('head', tr('Performance'), card);
    var grid = node('metric-grid', '', card);
    var defs = [['fps', 'FPS (UI)'], ['stalls', tr('Stalls >100 ms')], ['worst', tr('Worst frame')],
      ['heap', tr('JavaScript memory')], ['cpu', tr('CPU (TV total)')], ['ram', tr('RAM (TV total)')]];
    for (var i = 0; i < defs.length; i++) {
      if (compact && (defs[i][0] === 'worst' || defs[i][0] === 'heap')) continue;
      var cell = node('metric-cell', '', grid);
      node('metric-label', defs[i][1], cell);
      fields[defs[i][0]] = node('metric-value', '', cell);
    }
    render();
  }
  function render() {
    if (!panel) return;
    var heap = window.performance && performance.memory;
    fields.fps.textContent = fps === null ? unavailable() : fps.toFixed(1) + (compact ? '' : ' | ' + frameMs.toFixed(1) + ' ms');
    fields.stalls.textContent = String(stalls);
    if (fields.worst) fields.worst.textContent = worst.toFixed(0) + ' ms';
    if (fields.heap) fields.heap.textContent = heap && heap.usedJSHeapSize > 0 ? mb(heap.usedJSHeapSize) : unavailable();
    fields.cpu.textContent = cpuPercent === null ? unavailable() : cpuPercent.toFixed(1) + '%';
    fields.ram.textContent = memory ? (compact ? ((memory.total - memory.available) * 100 / memory.total).toFixed(1) + '%' : mb(memory.total - memory.available) + ' / ' + mb(memory.total)) : unavailable();
    panel.style.display = enabled ? '' : 'none';
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
    if (!active()) return;
    if (request) raf = request.call(window, frame);
    render(); sampleSystem();
    timer = setInterval(function () {
      render(); sampleSystem();
    }, 3000);
  }
  function init() {
    document.addEventListener('visibilitychange', resume);
    resume();
  }
  return {init: init, mount: mount, unmount: function () { panel = null; fields = {}; }, enabled: function () { return enabled; }, toggle: function () {
    enabled = !enabled;
    try { localStorage.setItem('fmtv.metrics', enabled ? 'on' : 'off'); } catch (e) {}
    resume(); render();
  }};
}());
Metrics.init();
