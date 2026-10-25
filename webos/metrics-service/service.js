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
