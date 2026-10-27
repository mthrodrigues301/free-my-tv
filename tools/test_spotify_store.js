/* Simulated webOS services with real AES-GCM; no personal credentials. */
'use strict';
var assert = require('assert'), crypto = require('crypto'), makeStore = require('../webos/metrics-service/spotify-store');
var rows = [], key = null, handles = {}, sequence = 0, unavailable = false, writes = [];
var service = {call: function (uri, payload, done) {
  var method = uri.split('/').pop(), result = {returnValue: true};
  if (unavailable) { done({returnValue: false}); return; }
  if (uri.indexOf('com.palm.db/') >= 0) {
    if (method === 'putKind') assert.strictEqual(payload.owner, 'io.freemytv.metrics');
    if (method === 'find') result.results = JSON.parse(JSON.stringify(rows));
    if (method === 'put') { rows = JSON.parse(JSON.stringify(payload.objects)); rows[0]._id = 'record'; rows[0]._rev = sequence++; writes.push(JSON.stringify(payload)); }
    if (method === 'del') { assert.strictEqual(payload.purge, true); rows = []; }
  } else {
    if (method === 'generateKey') { if (key) result = {returnValue: false, errorCode: -10002}; else key = crypto.randomBytes(32); }
    if (method === 'removeKey') key = null;
    if (method === 'begin') {
      if (!key) result = {returnValue: false, errorCode: -10001};
      else { var iv = payload.params.iv ? Buffer.from(payload.params.iv, 'base64') : crypto.randomBytes(12); result.handle = String(++sequence); result.iv = iv.toString('base64'); handles[result.handle] = {params: payload.params, iv: iv}; }
    }
    if (method === 'finish') {
      var op = handles[payload.handle], input = Buffer.from(payload.data, 'base64'), cipher;
      try {
        if (op.params.purpose[0] === 'encrypt') { cipher = crypto.createCipheriv('aes-256-gcm', key, op.iv); result.output = Buffer.concat([cipher.update(input), cipher.final(), cipher.getAuthTag()]).toString('base64'); }
        else { cipher = crypto.createDecipheriv('aes-256-gcm', key, op.iv); cipher.setAuthTag(input.subarray(input.length - 16)); result.output = Buffer.concat([cipher.update(input.subarray(0, input.length - 16)), cipher.final()]).toString('base64'); }
        delete handles[payload.handle];
      } catch (e) { result = {returnValue: false}; }
    }
    if (method === 'abort') delete handles[payload.handle];
  }
  done({payload: result});
}};
function save(store, text) { var value; store.save(text, function (result) { value = result; }); return value; }
function load(store) { var value; store.load(function (result) { value = result; }); return value; }
var first = makeStore(service); assert.strictEqual(load(first), '');
assert.strictEqual(save(first, 'test-refresh-credential'), true);
assert(!writes.join('').includes('test-refresh-credential'));
assert(!writes.join('').includes(Buffer.from('test-refresh-credential').toString('base64')));
var savedCipher = rows[0].cipher;
var restarted = makeStore(service); assert.strictEqual(load(restarted), 'test-refresh-credential');
assert.strictEqual(save(restarted, 'rotated-test-credential'), true); assert.notStrictEqual(rows[0].cipher, savedCipher);
assert.strictEqual(load(makeStore(service)), 'rotated-test-credential');
rows[0].cipher = 'AAAA' + rows[0].cipher.slice(4); assert.strictEqual(load(makeStore(service)), null); assert.strictEqual(Object.keys(handles).length, 0);
unavailable = true; var count = writes.length; assert.strictEqual(save(restarted, 'never-write-plaintext'), null); assert.strictEqual(writes.length, count); unavailable = false;
restarted.clear(function (result) { assert.strictEqual(result, true); }); assert.strictEqual(key, null); assert.strictEqual(rows.length, 0); assert.strictEqual(load(makeStore(service)), '');
console.log('Encrypted restore after service restart, rotation, tamper rejection, unavailable coffer and credential deletion passed.');
