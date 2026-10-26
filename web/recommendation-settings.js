/* Remote-friendly multiple selection; only Apply commits the draft. */
var RecommendationSettings = (function () {
  'use strict';
  var sheet, box, status, list, controls = [], index = 0, draft, page = '', done, generation = 0;
  function node(tag, text, parent) {
    var n = document.createElement(tag);
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }
  function focus(at) {
    if (!controls.length) return;
    index = Math.max(0, Math.min(controls.length - 1, at));
    SettingsUI.focus(controls[index]);
    var b = controls[index];
    if (b.offsetTop < list.scrollTop) list.scrollTop = b.offsetTop;
    else if (b.offsetTop + b.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = b.offsetTop + b.offsetHeight - list.clientHeight;
  }
  function button(text, action, checked) {
    var b = node('button', text, list); b.type = 'button';
    if (checked !== undefined) { b.setAttribute('role', 'checkbox'); b.setAttribute('aria-checked', checked ? 'true' : 'false'); }
    b.onclick = action;
    b.onfocus = function () { index = controls.indexOf(b); };
    controls.push(b);
    return b;
  }
  function toggle(array, value) {
    var i = array.indexOf(value);
    if (i < 0) array.push(value); else array.splice(i, 1);
  }
  function hide() {
    generation++;
    if (sheet) { sheet.className = 'layer sheet'; if (document.activeElement) document.activeElement.blur(); }
    done = null;
  }
  function finish(apply) {
    var callback = done;
    if (apply) Data.applyRecommendationFilters(draft);
    hide();
    if (callback) callback();
  }
  function start(title) {
    generation++;
    sheet.innerHTML = ''; controls = []; index = 0;
    box = node('div', '', sheet); box.className = 'box';
    node('div', title, box).className = 'title';
    status = node('div', '', box); status.className = 'rec-status'; status.setAttribute('role', 'status');
    list = node('div', '', box); list.className = 'rec-options';
    node('div', tr('Use arrows and OK. Apply saves all filters.'), box).className = 'hint';
    SettingsUI.decorate(sheet, function () { if (page) main(); else finish(false); });
  }
  function count(ids) { return ids.length ? String(ids.length) : tr('All genres'); }
  function main(at) {
    page = ''; start(tr('TMDB recommendations'));
    status.textContent = tr('Selections stay active after restarting. Genres match any selected option.');
    button(tr('Movie genres') + ': ' + count(draft.movie), function () { genres('movie'); });
    button(tr('Series genres') + ': ' + count(draft.tv), function () { genres('tv'); });
    button(tr('Include anime'), function () { draft.anime = !draft.anime; main(2); }, draft.anime);
    button(tr('Streaming services') + ': ' + (draft.providers === null ? tr('All installed services') : draft.providers.length), function () { providers(); });
    button(tr('Reset filters'), function () { draft = RecommendationFilters.normalize(null); main(4); });
    button(tr('Apply filters'), function () { finish(true); });
    button(tr('Cancel'), function () { finish(false); });
    focus(at || 0);
  }
  function genres(kind) {
    page = kind; start(kind === 'movie' ? tr('Movie genres') : tr('Series genres'));
    var request = generation;
    status.textContent = tr('Loading genres…');
    button(tr('Back'), function () { main(kind === 'movie' ? 0 : 1); }); focus(0);
    Data.recommendationGenres(kind, function (err, options) {
      if (!done || generation !== request) return;
      list.innerHTML = ''; controls = [];
      status.textContent = err || !options.length ? tr('Could not load genres. Check the TMDB key and connection.') : tr('No genre selected means all genres.');
      button(tr('All genres'), function () { draft[kind] = []; genres(kind); }, !draft[kind].length);
      for (var i = 0; i < options.length; i++) {
        (function (g, at) {
          button(g.name, function () {
            toggle(draft[kind], g.id);
            controls[at].setAttribute('aria-checked', draft[kind].indexOf(g.id) >= 0 ? 'true' : 'false');
            controls[0].setAttribute('aria-checked', !draft[kind].length ? 'true' : 'false');
          }, draft[kind].indexOf(g.id) >= 0);
        })(options[i], i + 1);
      }
      button(tr('Back'), function () { main(kind === 'movie' ? 0 : 1); });
      if (err || !options.length) button(tr('Try again'), function () { genres(kind); });
      focus(0);
    });
  }
  function providers(at) {
    page = 'providers'; start(tr('Streaming services'));
    var options = Data.recommendationServices();
    status.textContent = tr('Only selected services with an installed app are used. No services means no suggestions.');
    button(tr('All installed services'), function () { draft.providers = null; providers(0); }, draft.providers === null);
    for (var i = 0; i < options.length; i++) {
      (function (service, at) {
        button(service.name, function () {
          if (draft.providers === null) draft.providers = options.map(function (o) { return o.id; });
          toggle(draft.providers, service.id);
          providers(at);
        }, RecommendationFilters.provider(service.id, draft));
      })(options[i], i + 1);
    }
    button(tr('Back'), function () { main(3); }); focus(at || 0);
  }
  function open(callback) {
    if (!sheet) {
      sheet = node('div', '', document.getElementById('stage')); sheet.id = 'recommendations';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.onkeydown = function (e) {
        var k = e.keyCode; e.stopPropagation();
        if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); if (page) main(); else finish(false); }
        else if (k === TV.keys.down || k === TV.keys.right) { e.preventDefault(); focus(index + 1); }
        else if (k === TV.keys.up || k === TV.keys.left) { e.preventDefault(); focus(index - 1); }
        else if (k === TV.keys.ok) { e.preventDefault(); if (controls[index]) controls[index].click(); }
      };
    }
    draft = Prefs.recommendations(); done = callback;
    sheet.className = 'layer sheet open'; sheet.setAttribute('aria-label', tr('TMDB recommendations'));
    main();
  }
  return {open: open, hide: hide};
}());
