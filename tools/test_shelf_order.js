'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert'), context = {};
vm.runInNewContext(fs.readFileSync('web/shelf-order.js', 'utf8'), context);
function ids(list) { return list.map(function (a) { return a.id; }).join(','); }
var apps = [];
for (var i = 0; i < 12; i++) apps.push({id: 'app' + i, title: 'App ' + ('0' + i).slice(-2)});
var sorted = context.ShelfOrder.arrange(apps, ['app10', 'app2', 'missing', 'app10', 'app7']);
assert.strictEqual(ids(sorted.pinned), 'app10,app2,app7');
assert.strictEqual(sorted.all.length, 12, 'Apps beyond the eight visible slots must remain navigable');
assert.strictEqual(ids(sorted.all).split(',').slice(0, 3).join(','), 'app10,app2,app7');
assert.strictEqual(ids(sorted.all).split(',').slice(3).join(','), 'app0,app1,app3,app4,app5,app6,app8,app9,app11');
var none = context.ShelfOrder.arrange(apps.concat([apps[0]]), []);
assert.strictEqual(none.pinned.length, 0); assert.strictEqual(none.all.length, 12);
assert.strictEqual(context.ShelfOrder.arrange([], ['missing']).all.length, 0);
assert.strictEqual(context.ShelfOrder.arrange(apps, null).all.length, 12);
assert.strictEqual(apps[0].id, 'app0', 'Original app list must not be reordered');
console.log('All-app shelf, favorite order, missing apps, empty selection and duplicates passed.');
