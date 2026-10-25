/* Read-only counters. Never accepts file paths or commands from the caller. */
'use strict';
var fs = require('fs');
var Service = require('webos-service');
var service = new Service('io.freemytv.metrics');
function cpu(text) {
  var values = text.split('\n')[0].trim().split(/\s+/).slice(1, 9).map(Number);
  if (values.length !== 8 || values.some(function (n) { return !isFinite(n); })) throw new Error('Invalid CPU counters');
  return {total: values.reduce(function (a, b) { return a + b; }, 0), idle: values[3] + values[4]};
}
function ram(text) {
  var values = {}, lines = text.split('\n');
  lines.forEach(function (line) {
    var match = /^(\w+):\s+(\d+)\s+kB/.exec(line);
    if (match) values[match[1]] = Number(match[2]) * 1024;
  });
  // Do not substitute MemFree: reclaimable cache is available memory too.
  if (!values.MemTotal || values.MemAvailable === undefined) return null;
  return {total: values.MemTotal, available: values.MemAvailable};
}
service.register('sample', function (message) {
  fs.readFile('/proc/stat', 'utf8', function (cpuError, stat) {
    fs.readFile('/proc/meminfo', 'utf8', function (ramError, memory) {
      var result = {returnValue: true, cpu: null, ram: null};
      try { if (!cpuError) result.cpu = cpu(stat); } catch (e) {}
      try { if (!ramError) result.ram = ram(memory); } catch (e) {}
      message.respond(result);
    });
  });
});

/* A loopback HTTP document gives YouTube a real referring page in packaged webOS apps.
 * Bind only to loopback, serve one fixed document, never proxy requests or expose files. */
var trailerServer = null, trailerPort = null, trailerWaiting = [];
service.register('trailerPlayer', function (message) {
  if (trailerPort) { message.respond({returnValue: true, url: 'http://127.0.0.1:' + trailerPort + '/player'}); return; }
  trailerWaiting.push(message);
  if (trailerServer) return;
  var http = require('http');
  trailerServer = http.createServer(function (request, response) {
    if (request.method !== 'GET' || request.url !== '/player') { response.writeHead(404); response.end(); return; }
    fs.readFile(__dirname + '/trailer-player.html', function (error, html) {
      response.writeHead(error ? 500 : 200, {'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
      response.end(error ? 'Player unavailable' : html);
    });
  });
  trailerServer.on('error', function () {
    trailerServer = null; trailerPort = null;
    var waiting = trailerWaiting; trailerWaiting = []; waiting.forEach(function (m) { m.respond({returnValue: false, errorText: 'Could not start local player'}); });
  });
  trailerServer.listen(0, '127.0.0.1', function () {
    trailerPort = trailerServer.address().port;
    var waiting = trailerWaiting; trailerWaiting = []; waiting.forEach(function (m) { m.respond({returnValue: true, url: 'http://127.0.0.1:' + trailerPort + '/player'}); });
  });
});
