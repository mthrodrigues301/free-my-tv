'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var sheet;
function element() {
  var n = {children: [], style: {}, appendChild: function (child) { this.children.push(child); },
    setAttribute: function () {}, focus: function () { if (this.onfocus) this.onfocus(); },
    click: function () { this.onclick(); }, blur: function () {}};
  Object.defineProperty(n, 'innerHTML', {set: function () { n.children = []; }});
  return n;
}
var context = {SettingsUI: {focus: function (n) { n.focus(); }, decorate: function () {}}, setTimeout: function (fn) { fn(); }, trf: function (s, v) { return s.replace('{widget}', v.widget); }, tr: function (s) { return s; }, TV: {keys: {back: 461, up: 38, down: 40, left: 37, right: 39, ok: 13}},
  document: {createElement: element, activeElement: element(), getElementById: function () { return {appendChild: function (n) { sheet = n; }}; }}};
vm.runInNewContext(fs.readFileSync('web/widgets.js', 'utf8'), context);
var c = context.WidgetCatalog;
assert.strictEqual(JSON.stringify(c.order(null)), '["weather","performance","prices"]');
assert.strictEqual(JSON.stringify(c.order(['clock', 'bad', 'clock', 'sun'])), '["clock","sun"]');
assert.strictEqual(JSON.stringify(c.available(['weather', 'performance', 'prices'])), '["clock","sun"]');
assert.strictEqual(c.available(c.ids()).length, 0);
assert.strictEqual(c.clamp(-100, 2500, 1760), 0);
assert.strictEqual(c.clamp(9999, 2500, 1760), 740);
assert.strictEqual(c.clamp(50, 340, 1760), 0);
function allButtons(parent) {
  var found = [];
  parent.children.forEach(function (n) { if (n.onclick) found.push(n); found = found.concat(allButtons(n)); });
  return found;
}
var picked = [], closed = 0;
context.WidgetPicker.open(['weather', 'performance', 'prices'], function (id) { picked.push(id); }, function () { closed++; });
var buttons = allButtons(sheet);
assert.strictEqual(buttons.length, 3, 'Two available widgets and Cancel');
assert.ok(buttons[0].textContent.indexOf('Clock') >= 0);
buttons[0].click();
assert.strictEqual(picked[0], 'clock'); assert.strictEqual(closed, 1);
assert.strictEqual(sheet.className, 'layer sheet');
context.WidgetPicker.open(c.ids(), function () { throw new Error('Already added widgets cannot be picked'); }, function () { closed++; });
assert.strictEqual(allButtons(sheet).length, 1, 'Only Cancel when all widgets are selected');
allButtons(sheet)[0].click(); assert.strictEqual(closed, 2);
console.log('Widget catalogue, duplicate filtering, carousel bounds, add and cancel passed.');

var orderSaved = null, orderClosed = 0;
function key(code) { sheet.onkeydown({keyCode: code, preventDefault: function () {}, stopPropagation: function () {}}); }
context.WidgetOrganizer.open(['weather', 'performance'], 0, function (order) { orderSaved = order; }, function () { orderClosed++; });
key(39); key(40); key(40); key(13);
assert.strictEqual(JSON.stringify(orderSaved), '["performance","weather"]', 'Remote moves the widget and Apply commits');
assert.strictEqual(orderClosed, 1);
orderSaved = null;
context.WidgetOrganizer.open(['weather', 'performance'], 0, function (order) { orderSaved = order; }, function () { orderClosed++; });
key(39); key(27);
assert.strictEqual(orderSaved, null, 'Back cancels the draft order');
assert.strictEqual(orderClosed, 2);
var original = ['weather','performance'];
assert.strictEqual(JSON.stringify(c.move(original, 0, -1)), JSON.stringify(original));
assert.strictEqual(JSON.stringify(c.move(original, 1, 1)), JSON.stringify(original));
assert.strictEqual(JSON.stringify(original), '["weather","performance"]');
console.log('Widget reordering with the remote, apply, cancel and boundaries passed.');
