/* Only ciphertext enters DB8. The AES key stays in the webOS TEE. */
'use strict';
module.exports = function (service) {
  var kind = 'io.freemytv.metrics.spotify:1', key = 'spotify-refresh-v1', record = null, queue = [], busy = false;
  var state = 'not_checked';
  function call(uri, payload, done) {
    var ended = false, request, timer = setTimeout(function () { finish({returnValue: false}); if (request && request.cancel) request.cancel(); }, 8000);
    function finish(value) { if (ended) return; ended = true; clearTimeout(timer); done(value && value.payload || value || {returnValue: false}); }
    try { request = service.call(uri, payload, finish); } catch (e) { finish({returnValue: false}); }
  }
  function km(method, payload, done) { call('luna://com.webos.service.keymanager3/' + method, payload, done); }
  function db(method, payload, done) { call('luna://com.palm.db/' + method, payload, done); }
  function initialize(done) {
    db('putKind', {id: kind, owner: 'io.freemytv.metrics', indexes: []}, function (result) {
      if (!result.returnValue) { done(false); return; }
      db('find', {query: {from: kind, limit: 1}}, function (found) {
        if (!found.returnValue) { done(false); return; }
        record = found.results && found.results[0] || null; done(true);
      });
    });
  }
  function crypt(purpose, data, iv, done) {
    var params = {type: 'AES', mode: ['GCM'], purpose: [purpose], padding: ['None'], mac_length: '128'};
    if (iv) params.iv = iv;
    km('begin', {name: key, params: params}, function (begun) {
      if (!begun.returnValue || !begun.handle) { done(null); return; }
      km('finish', {handle: begun.handle, data: data}, function (finished) {
        // Release a handle on failure; successful finish already consumes it.
        if (!finished.returnValue) { km('abort', {handle: begun.handle}, function () { done(null); }); return; }
        done(finished.output ? {data: finished.output, iv: begun.iv || iv} : null);
      });
    });
  }
  function enqueue(work, done) {
    queue.push({work: work, done: done}); next();
  }
  function next() {
    if (busy || !queue.length) return; busy = true;
    var job = queue.shift(); initialize(function (ok) {
      if (!ok) { finish(null); return; } job.work(finish);
    });
    function finish(value) { state = value === null ? 'unavailable' : 'encrypted_tv'; busy = false; job.done(value); next(); }
  }
  return {
    status: function () { return state; },
    load: function (done) { enqueue(function (finish) {
      if (!record) { finish(''); return; }
      if (record.version !== 1 || typeof record.cipher !== 'string' || record.cipher.length > 32768 || typeof record.iv !== 'string') { finish(null); return; }
      crypt('decrypt', record.cipher, record.iv, function (value) {
        var plain = value && Buffer.from(value.data, 'base64').toString('utf8');
        finish(plain && plain.length <= 8192 ? plain : null);
      });
    }, done); },
    save: function (refresh, done) { enqueue(function (finish) {
      if (typeof refresh !== 'string' || !refresh || refresh.length > 8192) { finish(null); return; }
      km('generateKey', {name: key, params: {type: 'AES', size: 256, mode: ['GCM'], purpose: ['encrypt', 'decrypt'], padding: ['None'], mac_length: '128'}}, function (generated) {
        if (!generated.returnValue && generated.errorCode !== -10002) { finish(null); return; }
        crypt('encrypt', Buffer.from(refresh, 'utf8').toString('base64'), null, function (value) {
          if (!value || !value.iv) { finish(null); return; }
          var object = {_kind: kind, version: 1, cipher: value.data, iv: value.iv};
          if (record) { object._id = record._id; object._rev = record._rev; }
          db('put', {objects: [object]}, function (saved) { finish(saved.returnValue ? true : null); });
        });
      });
    }, done); },
    clear: function (done) { enqueue(function (finish) {
      // Remove the key first so even a failed database purge cannot restore login.
      km('removeKey', {name: key}, function (removed) {
        if (!removed.returnValue && removed.errorCode !== -10001) { finish(null); return; }
        db('del', {query: {from: kind}, purge: true}, function (deleted) { record = null; finish(deleted.returnValue ? true : null); });
      });
    }, done); }
  };
};
