/* node tools/test_metrics.js: deterministic counter and lifecycle checks. */
'use strict';
var assert = require('assert'), fs = require('fs'), vm = require('vm');
var handler, response;
function Service() {}
Service.prototype.register = function (name, fn) { handler = fn; };
var reads = {
  '/proc/stat': 'cpu  100 0 50 800 50 0 0 0 100 0\n',
  '/proc/meminfo': 'MemTotal: 1000 kB\nMemFree: 50 kB\nMemAvailable: 400 kB\n'
};
vm.runInNewContext(fs.readFileSync('webos/metrics-service/service.js', 'utf8'), {
  require: function (name) { return name === 'webos-service' ? Service : {
    readFile: function (path, encoding, done) { done(reads[path] === null ? new Error('denied') : null, reads[path]); }
  }; }
});
handler({respond: function (r) { response = r; }});
assert.strictEqual(response.cpu.total, 1000, 'Guest ticks must not be counted twice');
assert.strictEqual(response.cpu.idle, 850);
assert.strictEqual(response.ram.available, 409600, 'Use available memory, not free memory');
reads['/proc/stat'] = null;
reads['/proc/meminfo'] = 'MemTotal: 1000 kB\nMemFree: 50 kB\n';
handler({respond: function (r) { response = r; }});
assert.strictEqual(response.cpu, null);
assert.strictEqual(response.ram, null, 'Missing counters must stay unavailable');
var next, interval, onVisibility;
function element() {
  var value = '', children = [];
  return {style: {}, appendChild: function (n) { children.push(n); },
    set textContent(v) { value = v; },
    get textContent() { return value + ' ' + children.map(function (n) { return n.textContent; }).join(' '); }};
}
var panel = element();
var document = {
  hidden: false, createElement: element,
  addEventListener: function (name, fn) { onVisibility = fn; }
};
var context = {
  document: document, localStorage: {getItem: function () { return null; }, setItem: function () {}},
  tr: function (s) { return s; },
  setTimeout: function () {}, clearTimeout: function () {},
  setInterval: function (fn) { interval = fn; return 1; }, clearInterval: function () { interval = null; },
  performance: {now: function () { return 0; }},
  requestAnimationFrame: function (fn) { next = fn; return 1; },
  cancelAnimationFrame: function () { next = null; }
};
context.window = context;
vm.runInNewContext(fs.readFileSync('web/metrics.js', 'utf8'), context);
context.Metrics.mount(panel);
for (var i = 0; i <= 120; i++) next(i * 1000 / 60);
interval();
assert.ok(/FPS \(UI\)\s+60.0/.test(panel.textContent));
assert.ok(/JavaScript memory\s+Unavailable/.test(panel.textContent));
next(2300); interval();
assert.ok(/Stalls >100 ms\s+1/.test(panel.textContent));
document.hidden = true; onVisibility();
assert.strictEqual(next, null); assert.strictEqual(interval, null);
document.hidden = false; onVisibility(); next(100000); next(100016); interval();
assert.ok(/Stalls >100 ms\s+1/.test(panel.textContent), 'Time spent hidden is not a stall');
context.Metrics.toggle();
assert.strictEqual(panel.style.display, 'none'); assert.strictEqual(next, null); assert.strictEqual(interval, null);
console.log('Metrics counters, fallbacks and visibility lifecycle passed.');
