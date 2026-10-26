/* Focused OAuth isolation and PKCE checks. No real credentials or network. */
'use strict';
var assert = require('assert'), vm = require('vm'), fs = require('fs'), crypto = require('crypto'), qs = require('querystring'), handlers = {}, callback;
var outgoing = [], response = {status: 200, data: {access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600}};
var fakeHttps = {request: function (options, received) {
  var req = {setTimeout: function () {}, on: function () {}, write: function (text) { outgoing.push({options: options, body: text}); }, destroy: function () {}, end: function () {
    var events = {}; received({statusCode: response.status, headers: {}, setEncoding: function () {}, on: function (name, fn) { events[name] = fn; }});
    events.data(JSON.stringify(response.data)); events.end();
  }}; return req;
}};
var service = {register: function (name, fn) { handlers[name] = fn; }};
var context = {setInterval: function () {}, module: {exports: {}}, Buffer: Buffer, Date: Date, require: function (name) {
  if (name === 'https') return fakeHttps;
  if (name === 'http') return {createServer: function (fn) { callback = fn; return {on: function () {}, listen: function (port, host, done) { assert.strictEqual(port, 8787); assert.strictEqual(host, '127.0.0.1'); done(); }}; }};
  return require(name);
}};
vm.runInNewContext(fs.readFileSync('webos/metrics-service/spotify.js', 'utf8'), context); context.module.exports(service);
function call(name, payload, sender) { var reply; handlers[name]({payload: payload || {}, sender: sender || 'io.freemytv', respond: function (value) { reply = value; }}); return reply; }
var start = call('spotifyStart'), auth = require('url').parse(start.url, true).query;
assert.strictEqual(auth.code_challenge_method, 'S256'); assert.strictEqual(auth.redirect_uri, 'http://127.0.0.1:8787/callback');
assert(!/test-access|test-refresh|code_verifier/.test(start.url));
var status, html, res = {setHeader: function () {}, writeHead: function (code) { status = code; }, end: function (value) { html = value; }};
callback({method: 'GET', url: '/callback?state=wrong&code=test', headers: {host: '127.0.0.1:8787'}}, res); assert.strictEqual(status, 400);
callback({method: 'GET', url: '/callback?' + qs.stringify({state: auth.state, code: 'test-code'}), headers: {host: '127.0.0.1:8787'}}, res);
assert.strictEqual(status, 200); assert(!/test-access|test-refresh/.test(html));
var exchanged = qs.parse(outgoing[0].body);
assert.strictEqual(crypto.createHash('sha256').update(exchanged.code_verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), auth.code_challenge);
assert.strictEqual(call('spotifyToken', {}, 'other.app').status, 403);
assert.strictEqual(call('spotifyToken').access_token, 'test-access');
assert(!JSON.stringify(call('spotifyStatus')).match(/test-access|test-refresh/));
assert.strictEqual(call('spotifyRequest', {action: 'delete-account'}).status, 400);
assert.strictEqual(call('spotifyRequest', {action: 'play', uri: 'https://example.com'}).status, 400);
call('spotifyDisconnect'); assert.strictEqual(call('spotifyToken').status, 401);
console.log('Spotify PKCE, state validation, caller isolation, memory-only session and disconnect passed.');
