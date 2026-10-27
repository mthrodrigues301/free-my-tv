/* PKCE OAuth and Spotify transport. Refresh credentials are sealed by the webOS TEE; access tokens stay in memory. */
'use strict';
module.exports = function (service) {
  var crypto = require('crypto'), https = require('https'), http = require('http'), qs = require('querystring'), url = require('url');
  var clientId = 'f14f2730b173417b8d2dfc6e37688fc9', redirect = 'http://127.0.0.1:8787/callback';
  var store = require('./spotify-store')(service), restoring = false, restoreWait = [];
  var pending = null, session = null, server = null, retryAt = 0, refreshing = false, refreshWait = [], diagnostic = 'not_started', activity = null, authGeneration = 0, lastSeen = Date.now();
  function holdSession() { if (!activity && service.activityManager) service.activityManager.create('spotify-session', function (created) { activity = created; }); }
  setInterval(function () {
    if (pending && pending.expires < Date.now()) pending = null;
    if (!pending && Date.now() - lastSeen > 120000) { session = null; if (activity && service.activityManager) service.activityManager.complete(activity, {}, function () {}); activity = null; }
  }, 30000);
  function restore(done) {
    if (session) { done(); return; }
    restoreWait.push(done); if (restoring) return; restoring = true; var generation = authGeneration;
    store.load(function (refresh) {
      if (refresh && generation === authGeneration && !session) { session = {access: '', refresh: refresh, expires: 0}; holdSession(); }
      restoring = false; var waiting = restoreWait; restoreWait = []; waiting.forEach(function (fn) { fn(); });
    });
  }
  function random() { return crypto.randomBytes(32).toString('hex'); }
  function own(message) { return String(message.sender || '').split(' ')[0] === 'io.freemytv'; }
  function answer(message, value) { message.respond(value); }
  function denied(message) { answer(message, {returnValue: false, status: 403, error: 'caller_denied'}); }
  function request(host, path, method, headers, body, done) {
    var finished = false;
    function finish(code, value) { if (finished) return; finished = true; done(code, value); }
    var req = https.request({hostname: host, port: 443, path: path, method: method, headers: headers}, function (res) {
      var text = ''; res.setEncoding('utf8');
      res.on('data', function (chunk) { text += chunk; if (text.length > 2097152) { req.destroy(); finish(502, {}); } });
      res.on('end', function () { var value; try { value = JSON.parse(text || '{}'); } catch (e) { value = {}; }
        if (res.statusCode === 429) { var seconds = parseInt(res.headers['retry-after'], 10) || 60; retryAt = Date.now() + Math.max(1, seconds) * 1000; }
        finish(res.statusCode, value);
      });
    });
    req.setTimeout(15000, function () { req.destroy(); finish(504, {}); });
    req.on('error', function () { finish(502, {}); }); if (body) req.write(body); req.end();
  }
  function tokenRequest(body, done) {
    var text = qs.stringify(body);
    request('accounts.spotify.com', '/api/token', 'POST', {'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(text)}, text, done);
  }
  function access(done) { restore(function () { accessReady(done); }); }
  function accessReady(done) {
    if (!session) { done(null); return; }
    if (session.expires > Date.now() + 60000) { done(session.access); return; }
    refreshWait.push(done); if (refreshing) return; refreshing = true; var old = session;
    tokenRequest({grant_type: 'refresh_token', refresh_token: old.refresh, client_id: clientId}, function (code, value) {
      function complete() { refreshing = false; var waiting = refreshWait; refreshWait = []; waiting.forEach(function (fn) { fn(session && session !== old ? session.access : null); }); }
      if (session !== old) { complete(); return; }
      if (code === 200 && value.access_token) {
        session = {access: value.access_token, refresh: value.refresh_token || old.refresh, expires: Date.now() + (value.expires_in || 3600) * 1000};
        if (value.refresh_token && value.refresh_token !== old.refresh) { store.save(value.refresh_token, complete); return; }
      } else if (code === 400 && value.error === 'invalid_grant') {
        session = null; authGeneration++; store.clear(complete); return;
      }
      complete();
    });
  }
  function callback(req, res) {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Security-Policy', "default-src 'none'");
    var parsed = url.parse(req.url, true), query = parsed.query;
    if (req.method !== 'GET' || parsed.pathname !== '/callback' || req.headers.host !== '127.0.0.1:8787') { res.writeHead(404); res.end('Not found'); return; }
    if (!pending || pending.expires < Date.now() || typeof query.state !== 'string' || query.state !== pending.state) { res.writeHead(400); res.end('Invalid or expired authorization. Start again on the TV.'); return; }
    var attempt = pending; pending = null;
    if (query.error || typeof query.code !== 'string') { res.writeHead(400); res.end('Spotify authorization was not completed.'); return; }
    tokenRequest({client_id: clientId, grant_type: 'authorization_code', code: query.code, redirect_uri: redirect, code_verifier: attempt.verifier}, function (code, value) {
      if (attempt.generation !== authGeneration) { res.writeHead(409); res.end('Authorization cancelled.'); return; }
      if (code !== 200 || !value.access_token || !value.refresh_token) { res.writeHead(502); res.end('Could not authorize Spotify. Start again on the TV.'); return; }
      lastSeen = Date.now(); session = {access: value.access_token, refresh: value.refresh_token, expires: Date.now() + (value.expires_in || 3600) * 1000};
      store.save(value.refresh_token, function (saved) {
        if (attempt.generation !== authGeneration) { res.writeHead(409); res.end('Authorization cancelled.'); return; }
        res.writeHead(200); res.end(saved ? '<h1>Spotify conectado</h1><p>Autorização protegida na TV. Volte ao Free My TV.</p>' : '<h1>Spotify conectado nesta sessão</h1><p>O armazenamento protegido não está disponível. Será necessário reconectar após reiniciar.</p>');
      });
    });
  }
  service.register('spotifyStart', function (message) {
    // This method exposes only a fresh authorization URL, never credentials.
    function start() {
      holdSession(); lastSeen = Date.now(); var verifier = random(), state = random(); authGeneration++; pending = {generation: authGeneration, verifier: verifier, state: state, expires: Date.now() + 600000};
      var challenge = crypto.createHash('sha256').update(verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      answer(message, {returnValue: true, url: 'https://accounts.spotify.com/authorize?' + qs.stringify({client_id: clientId, response_type: 'code', redirect_uri: redirect, code_challenge_method: 'S256', code_challenge: challenge, state: state, scope: 'streaming user-read-private user-read-email user-read-playback-state user-modify-playback-state'})});
    }
    if (server) { start(); return; }
    server = http.createServer(callback); server.on('error', function () { server = null; answer(message, {returnValue: false, error: 'callback_port_unavailable'}); }); server.listen(8787, '127.0.0.1', start);
  });
  service.register('spotifyStatus', function (message) {
    function status() { answer(message, {returnValue: true, connected: !!session, pending: !!pending && pending.expires > Date.now(), storage: store.status(), player: diagnostic}); }
    if (own(message)) { lastSeen = Date.now(); restore(status); } else status();
  });
  service.register('spotifyReport', function (message) { if (!own(message)) { denied(message); return; } var status = message.payload && message.payload.status; if (['ready', 'initialization_error', 'authentication_error', 'account_error', 'authorization_required'].indexOf(status) >= 0) diagnostic = status; answer(message, {returnValue: true}); });
  service.register('spotifyToken', function (message) {
    if (!own(message)) { denied(message); return; }
    access(function (token) { answer(message, token ? {returnValue: true, access_token: token} : {returnValue: false, status: 401, error: 'authorization_required'}); });
  });
  service.register('spotifyDisconnect', function (message) { if (!own(message)) { denied(message); return; } authGeneration++; session = pending = null; store.clear(function (cleared) { answer(message, {returnValue: !!cleared, error: cleared ? '' : 'secure_storage_unavailable'}); }); });
  service.register('spotifyRequest', function (message) {
    if (!own(message)) { denied(message); return; }
    var payload = message.payload || {}, path, method = 'GET', body = null;
    if (payload.action === 'search' && typeof payload.query === 'string') path = '/v1/search?' + qs.stringify({q: payload.query.slice(0, 120), type: 'track', limit: 10});
    else if (payload.action === 'devices') path = '/v1/me/player/devices';
    else if (payload.action === 'playback') path = '/v1/me/player';
    else if (['play', 'pause', 'next', 'previous'].indexOf(payload.action) >= 0) {
      method = payload.action === 'next' || payload.action === 'previous' ? 'POST' : 'PUT'; path = '/v1/me/player/' + payload.action;
      if (payload.device_id && !/^[a-zA-Z0-9_-]{1,100}$/.test(payload.device_id)) { answer(message, {returnValue: false, status: 400}); return; }
      if (payload.device_id) path += '?' + qs.stringify({device_id: payload.device_id});
      if (payload.uri) { if (!/^spotify:track:[a-zA-Z0-9]{22}$/.test(payload.uri)) { answer(message, {returnValue: false, status: 400}); return; } body = JSON.stringify({uris: [payload.uri]}); }
    } else { answer(message, {returnValue: false, status: 400}); return; }
    if (retryAt > Date.now()) { answer(message, {returnValue: false, status: 429}); return; }
    access(function (token) {
      if (!token) { answer(message, {returnValue: false, status: 401}); return; }
      var headers = {Authorization: 'Bearer ' + token}; if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
      request('api.spotify.com', path, method, headers, body, function (code, value) { answer(message, {returnValue: code >= 200 && code < 300, status: code, data: code >= 200 && code < 300 ? value : {}}); });
    });
  });
};
