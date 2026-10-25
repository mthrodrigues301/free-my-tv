'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var storage = {}, requests;
function boot() {
  requests = [];
  function XHR() { requests.push(this); }
  XHR.prototype.open = function (method, url) { this.url = url; };
  XHR.prototype.setRequestHeader = function () {};
  XHR.prototype.send = function () {};
  var c = {CONFIG: {latitude: '-22.822', longitude: '-47.267', city: 'Sumaré - SP', tmdbRegion: 'BR'},
    TV: {zone: function () { return 'America/Sao_Paulo'; }}, navigator: {language: 'pt-BR'},
    localStorage: {getItem: function (k) { return storage[k] || null; }, setItem: function (k, v) { storage[k] = v; }},
    I18N: {lang: 'pt'}, XMLHttpRequest: XHR};
  c.window = c;
  vm.runInNewContext(fs.readFileSync('web/data.js', 'utf8'), c);
  return c;
}
function reply(r, body, status) { r.status = status || 200; r.responseText = JSON.stringify(body); r.readyState = 4; r.onreadystatechange(); }
function forecast(temp) { return {current: {temperature_2m: temp}, daily: {temperature_2m_max: [temp], temperature_2m_min: [temp], sunrise: ['2026-10-25T06:00'], sunset: ['2026-10-25T18:00']}}; }
var c = boot();
assert.strictEqual(c.Data.city, 'Sumaré - SP');
assert.strictEqual(c.Data.setCity({name: 'Invalid', lat: 100, lon: 0}), false);
c.Data.setCity({name: 'Campinas — São Paulo — Brasil', lat: -22.9, lon: -47.06});
var old = requests[0];
c.Data.setCity({name: 'Santos', lat: -23.96, lon: -46.33});
reply(old, forecast(99));
assert.strictEqual(c.Data.weather, null, 'An older request must not change the new city weather');
reply(requests[1], forecast(24));
assert.strictEqual(c.Data.weather.temp, 24);
assert.strictEqual(c.Data.city, 'Santos');
c = boot(); assert.strictEqual(c.Data.city, 'Santos', 'Selection persists across restarts');
c.Data.setCity(null); assert.strictEqual(c.Data.city, 'Sumaré - SP');
assert.strictEqual(c.Data.weather, null, 'Changing location clears the previous forecast');
var cities;
c.Data.searchCities('Sumaré', function (err, list) { assert.ifError(err); cities = list; });
assert.ok(requests[requests.length - 1].url.indexOf('Sumar%C3%A9') >= 0);
reply(requests[requests.length - 1], {results: [{name: 'Sumaré', admin1: 'São Paulo', country: 'Brasil', latitude: -22.82, longitude: -47.27}, {name: 'Bad coordinates', latitude: 999, longitude: 0}]});
assert.strictEqual(cities.length, 1);
assert.strictEqual(cities[0].name, 'Sumaré — São Paulo — Brasil');
c.Data.searchCities('Nothing', function (err, list) { assert.ifError(err); assert.strictEqual(list.length, 0); });
reply(requests[requests.length - 1], {});
c.Data.searchCities('Offline', function (err) { assert.ok(err); });
requests[requests.length - 1].onerror();
console.log('City persistence, validation, geocoding errors and stale weather responses passed.');
