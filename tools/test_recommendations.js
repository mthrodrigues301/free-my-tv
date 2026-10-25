'use strict';
var fs = require('fs'), vm = require('vm'), assert = require('assert');
var storage = {}, requests = [], pending = [], c;
function boot() {
  requests = []; pending = [];
  function XHR() {}
  XHR.prototype.open = function (method, url) { this.url = url; };
  XHR.prototype.setRequestHeader = function () {};
  XHR.prototype.send = function () { requests.push(this.url); pending.push(this); };
  c = {CONFIG: {tmdbKey: 'test', latitude: '-22', longitude: '-47', city: 'Sumare', tmdbRegion: 'BR'},
    TV: {zone: function () { return ''; }}, navigator: {language: 'en-US'},
    localStorage: {getItem: function (k) { return storage[k] || null; }, setItem: function (k,v) { storage[k] = v; }},
    I18N: {lang: 'en', base: 'en', locale: function () { return 'en-US'; }}, XMLHttpRequest: XHR,
    tr: function (s) { return s; }, trf: function (s) { return s; }, plural: function (s) { return s; }};
  c.window = c;
  ['recommendation-filters.js','data.js'].forEach(function (file) { vm.runInNewContext(fs.readFileSync('web/'+file,'utf8'),c); });
  c.Data.setApps([{id: 'netflix', title:'Netflix'}, {id:'amazon',title:'Prime Video'}]);
  return c;
}
function reply(x, body, status) { x.status=status||200; x.responseText=JSON.stringify(body); x.readyState=4; x.onreadystatechange(); }
function item(id, genre) { return {id:id, title:'Movie '+id, name:'Show '+id, backdrop_path:'/image.jpg',genre_ids:[genre],vote_average:8,vote_count:100,release_date:'2026-10-01',first_air_date:'2026-10-02'}; }
function drain() {
  var count = 0;
  while (pending.length) {
    assert.ok(count++ < 250);
    var x=pending.shift(), url=x.url, body={};
    if (url.indexOf('/watch/providers/')>=0) body={results:[{provider_id:8,provider_name:'Netflix'},{provider_id:119,provider_name:'Amazon Prime Video'}]};
    else if (url.indexOf('/trending/')>=0 || url.indexOf('/discover/')>=0) { body={results:[item(1,28),item(2,35),item(3,28),item(4,28)]}; if (url.indexOf('/trending/')>=0) { var low=item(5,28); low.vote_average=4; body.results.push(low); } }
    else if (/\/(movie|tv)\/\d+\?/.test(url)) {
      var id=Number(url.match(/\/(movie|tv)\/(\d+)/)[2]);
      body={title:'Movie '+id,name:'Show '+id,original_language:'en',genres:[{id:id===2?35:28,name:'Action'}],
        keywords:{keywords:id===3?[{name:'anime'}]:[]}, 'watch/providers':{results:{BR:{flatrate:[{provider_id:id===4?119:8,provider_name:id===4?'Amazon Prime Video':'Netflix'}]}}}};
    } else if (url.indexOf('/genre/')>=0) body={genres:[{id:28,name:'Action'},{id:35,name:'Comedy'}]};
    reply(x,body);
  }
}
boot();
var F=c.RecommendationFilters;
assert.deepStrictEqual(JSON.parse(JSON.stringify(F.normalize({movie:[28,'28',35,-1,'bad'],providers:['netflix','netflix',false]}))),{movie:[28,35],tv:[],anime:true,providers:['netflix']});
assert.strictEqual(F.anime({genres:[{id:16}],original_language:'ja'}),true);
assert.strictEqual(F.anime({genres:[{id:16}],original_language:'en'}),false);
assert.strictEqual(F.anime({keywords:{results:[{name:'anime'}]}}),true);
c.Data.applyRecommendationFilters({movie:[28],tv:[28],anime:false,providers:['netflix']});
drain();
assert.ok(requests.some(function(u){return u.indexOf('with_genres=28')>=0;}));
assert.ok(requests.filter(function(u){return u.indexOf('/discover/')>=0;}).every(function(u){return u.indexOf('with_watch_providers=8')>=0;}));
assert.ok(c.Data.picks(null).length>0);
assert.ok(c.Data.collection('trending').length>0);
assert.ok(c.Data.collection('releases').length>0);
assert.ok(c.Data.collection('trending').every(function(p){return p.id!==5;}), 'Low-rated titles are excluded from Trending');
assert.ok(c.Data.collection('trending').some(function(p){return p.releases===true;}), 'A title can belong to both sections');
assert.ok(c.Data.picks(null).every(function(p){return p.id===1 && p.app==='netflix' && p.anime===false;}),'Trending and discovery must both exclude wrong genre, anime and provider');
boot();
assert.strictEqual(c.Prefs.recommendations().anime,false,'Preferences survive reboot');
assert.ok(c.Data.picks(null).every(function(p){return p.id===1;}),'Cached picks remain filtered');
c.Data.applyRecommendationFilters({movie:[35],tv:[35],providers:['netflix'],anime:true});
assert.strictEqual(c.Data.picks(null).length,0,'Old suggestions disappear immediately');
// Change while a previous request is in flight. Its results must never win.
c.Data.applyRecommendationFilters({movie:[28],tv:[28],providers:['netflix'],anime:false});
drain();
assert.ok(c.Data.picks(null).length>0);
assert.ok(c.Data.picks(null).every(function(p){return p.id===1;}));
c.Data.applyRecommendationFilters({providers:[]}); drain();
assert.strictEqual(c.Data.picks(null).length,0,'Selecting no providers must not fall back to all');
var before=requests.length; c.Data.refresh(); drain();
assert.strictEqual(requests.slice(before).filter(function(u){return u.indexOf('themoviedb.org')>=0;}).length,0,'An empty successful catalogue is cached');
console.log('Recommendation filters: persistence, genres, anime, streaming, cache and in-flight changes passed.');
