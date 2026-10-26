/* Native text input opens the TV keyboard; all actions also work with arrows and OK. */
var CityPicker = (function () {
  'use strict';
  var sheet, box, input, status, results, controls = [], index = 0, generation = 0, closed;
  function node(tag, text, parent) {
    var n = document.createElement(tag);
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function focus(at) {
    index = Math.max(0, Math.min(controls.length - 1, at));
    SettingsUI.focus(controls[index]);
  }
  function button(text, parent, action) {
    var b = node('button', text, parent); b.type = 'button'; b.onclick = action;
    b.onfocus = function () { index = controls.indexOf(b); };
    return b;
  }
  function listControls() {
    controls = [input].concat(Array.prototype.slice.call(box.querySelectorAll('button:not([data-settings-back])')));
  }
  function search() {
    var query = input.value.replace(/^\s+|\s+$/g, '');
    generation++; var id = generation;
    results.innerHTML = ''; listControls();
    if (query.length < 2) { status.textContent = tr('Enter at least two characters.'); focus(0); return; }
    input.blur(); focus(1); status.textContent = tr('Searching cities…');
    Data.searchCities(query, function (err, cities) {
      if (id !== generation || !closed) return;
      results.innerHTML = '';
      status.textContent = err ? tr('Could not search. Check your connection and try again.') :
        cities.length ? tr('Choose a city to apply it.') : tr('No cities found. Try another name.');
      for (var i = 0; i < cities.length; i++) {
        (function (city) {
          button(city.name, results, function () { Data.setCity(city); finish(); });
        })(cities[i]);
      }
      listControls();
      if (cities.length) focus(2);
    });
  }
  function hide() {
    generation++;
    if (sheet) { sheet.className = 'layer sheet'; if (document.activeElement) document.activeElement.blur(); }
    closed = null;
  }
  function finish() { var done = closed; hide(); if (done) done(); }
  function open(done) {
    if (!sheet) {
      sheet = node('div', '', document.getElementById('stage')); sheet.id = 'citypick';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.onkeydown = function (e) {
        var k = e.keyCode;
        e.stopPropagation();
        if (k === TV.keys.back || k === 27 || (k === 8 && e.target !== input)) { e.preventDefault(); finish(); return; }
        if (e.target === input && k !== TV.keys.up && k !== TV.keys.down && k !== TV.keys.ok) return;
        if (k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); focus(index + (k === TV.keys.down ? 1 : -1)); }
        else if (k === TV.keys.ok) { e.preventDefault(); if (e.target === input) search(); else e.target.click(); }
        else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); focus(index + (k === TV.keys.right ? 1 : -1)); }
      };
    }
    generation++; closed = done;
    sheet.className = 'layer sheet open'; sheet.innerHTML = '';
    sheet.setAttribute('aria-label', tr('Weather city'));
    box = node('div', '', sheet); box.className = 'box';
    node('div', tr('Weather city'), box).className = 'title';
    node('div', tr('Current city') + ': ' + (Data.city || tr('Automatic')), box).className = 'city-current';
    input = node('input', '', box); input.type = 'text'; input.maxLength = 100;
    input.placeholder = tr('City name, e.g. Sumaré'); input.setAttribute('aria-label', tr('City name'));
    input.onfocus = function () { index = 0; };
    button(tr('Search cities'), box, search).className = 'city-search';
    status = node('div', tr('Search by name and select the correct state and country.'), box);
    status.className = 'city-status'; status.setAttribute('role', 'status');
    results = node('div', '', box); results.className = 'city-results';
    button(tr('Use default city'), box, function () { Data.setCity(null); finish(); });
    button(tr('Cancel'), box, finish);
    node('div', 'Open-Meteo / GeoNames', box).className = 'hint';
    SettingsUI.decorate(sheet, finish);
    listControls(); focus(0);
  }
  return {open: open, hide: hide};
}());
