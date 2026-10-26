/* General catalogue search; recommendation preferences do not restrict manual queries. */
var MediaSearch = (function () {
  'use strict';
  var sheet, input, status, results, pager, controls = [], current = 0, generation = 0, timer = 0, recognition = null, voiceButton;
  var query = '', kind = 'all', page = 1, pages = 0, items = [], closed, detail, suspended = false, cards = [];
  function node(tag, text, parent, cls) { var n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; }
  function button(text, parent, action) { var b = node('button', text, parent); b.type = 'button'; b.onclick = action; b.onfocus = function () { current = controls.indexOf(b); }; return b; }
  function focus(at) {
    if (!controls.length) return;
    current = Math.max(0, Math.min(controls.length - 1, at)); try { controls[current].focus({preventScroll: true}); } catch (e) { controls[current].focus(); }
    document.getElementById('stage').scrollTop = 0; sheet.scrollTop = 0;
    if (current >= 7 && current < 7 + cards.length) {
      var row = Math.floor((current - 7) / 4); results.scrollTop = Math.max(0, row * 320 - 320);
    }
    loadVisible();
  }
  function loadVisible() {
    if (!results) return;
    var first = Math.max(0, Math.floor(results.scrollTop / 320) * 4 - 4), last = first + 16;
    for (var i = first; i < cards.length && i < last; i++) {
      var img = cards[i].querySelector('img');
      if (img && !img.getAttribute('src')) img.src = img.getAttribute('data-src');
    }
  }
  function hide() { if (recognition) { recognition.onend = null; recognition.abort(); recognition = null; } generation++; clearTimeout(timer); closed = null; suspended = false; if (sheet) { sheet.className = 'layer media-search'; if (document.activeElement) document.activeElement.blur(); } }
  function finish() { var callback = closed; hide(); if (callback) callback(); }
  function listControls() { controls = Array.prototype.slice.call(sheet.querySelectorAll('button,input')); }
  function render(busy) {
    results.innerHTML = ''; pager.innerHTML = ''; cards = [];
    if (busy) {
      for (var s = 0; s < 8; s++) node('div', '', results, 'search-result skeleton');
    } else {
      for (var i = 0; i < items.length; i++) {
        (function (p, index) {
          var card = button('', results, function () {
            suspended = true; sheet.className = 'layer media-search';
            detail(p, function () { suspended = false; sheet.className = 'layer media-search open'; focus(7 + index); });
          }); card.className = 'search-result'; card.setAttribute('aria-label', p.title);
          if (p.poster || p.backdrop) { var img = node('img', '', card); img.alt = ''; if (!p.backdrop) img.className = 'poster-only'; img.setAttribute('data-src', Data.image(p.backdrop || p.poster, p.backdrop ? 'w780' : 'w342')); }
          else node('div', tr('No image'), card, 'search-no-image');
          node('div', p.title, card, 'search-result-title');
          node('small', (p.kind === 'movie' ? tr('Movies') : tr('Shows')) + (p.year ? ' · ' + p.year : ''), card);
          cards.push(card);
        })(items[i], i);
      }
      if (pages > 1) {
        if (page > 1) button(tr('Previous page'), pager, function () { run(page - 1, true); });
        node('span', trf('Page {page} of {total}', {page: page, total: pages}), pager);
        if (page < pages) button(tr('Next page'), pager, function () { run(page + 1, true); });
      }
    }
    listControls(); results.scrollTop = 0; loadVisible();
  }
  function run(wanted, takeFocus) {
    query = input.value.replace(/^\s+|\s+$/g, '').slice(0, 150); page = wanted || 1;
    clearTimeout(timer); var request = ++generation;
    if (!query) { items = []; pages = 0; status.textContent = tr('Type a movie or series title to begin.'); render(false); return; }
    status.textContent = tr('Searching titles…'); render(true);
    Data.searchTitles(query, kind, page, function (err, list, total) {
      if (request !== generation || !closed) return;
      items = list || []; pages = total || 0;
      status.textContent = err ? tr('Could not search. Check the TMDB key and connection.') : items.length ? trf('{n} titles on this page', {n: items.length}) : tr('No titles found. Try another name.');
      render(false); if (takeFocus) focus(items.length ? 7 : 1);
    });
  }
  function handleKey(e) {
    var k = e.keyCode; e.stopPropagation();
    if (k === TV.keys.back || k === 27 || (k === 8 && e.target !== input)) { e.preventDefault(); finish(); return; }
    if (e.target === input) {
      if (k === TV.keys.ok) { e.preventDefault(); input.blur(); run(1, true); }
      else if (k === TV.keys.down) { e.preventDefault(); focus(items.length ? 7 : 2); }
      else if (k === TV.keys.up) { e.preventDefault(); focus(0); }
      return;
    }
    if (k === TV.keys.ok) { e.preventDefault(); if (controls[current]) controls[current].click(); }
    else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); focus(current + (k === TV.keys.right ? 1 : -1)); }
    else if (k === TV.keys.up || k === TV.keys.down) {
      e.preventDefault(); var d = k === TV.keys.down ? 1 : -1;
      if (current >= 7 && current < 7 + cards.length) focus(current < 11 && d < 0 ? 1 : Math.max(7, Math.min(controls.length - 1, current + d * 4)));
      else focus(d > 0 && current >= 2 && cards.length ? 7 : current + d);
    }
  }
  function voiceSearch() {
    var Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognition) { recognition.stop(); return; }
    // The TV keyboard owns the remote microphone; never blur its input on keyboard dismissal.
    if (TV.name === 'webos' || !Speech) {
      focus(1); status.textContent = TV.name === 'webos' ? tr('Use the microphone on the TV keyboard to dictate, then choose Search.') : tr('Voice input is unavailable in this browser. Use your keyboard dictation.'); return;
    }
    recognition = new Speech(); recognition.lang = 'pt-BR'; recognition.interimResults = true; recognition.continuous = false;
    voiceButton.setAttribute('aria-pressed', 'true'); status.textContent = tr('Listening… Say a movie or series name.');
    recognition.onresult = function (event) {
      var words = '', finalResult = false;
      for (var i = 0; i < event.results.length; i++) { words += event.results[i][0].transcript; finalResult = finalResult || event.results[i].isFinal; }
      input.value = words.slice(0, 150); if (finalResult) run(1, true);
    };
    recognition.onerror = function () { status.textContent = tr('Could not hear you. Check microphone permission and try again.'); };
    recognition.onend = function () { recognition = null; voiceButton.setAttribute('aria-pressed', 'false'); };
    try { recognition.start(); } catch (e) { recognition = null; voiceButton.setAttribute('aria-pressed', 'false'); status.textContent = tr('Could not start the microphone.'); }
  }
  function open(showDetails, done) {
    if (!sheet) {
      sheet = node('div', '', document.getElementById('stage'), 'layer media-search'); sheet.id = 'media-search';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.onkeydown = handleKey;
    }
    hide(); closed = done; detail = showDetails; sheet.className = 'layer media-search open'; sheet.innerHTML = ''; current = 1;
    var sidebar = node('div', '', sheet, 'search-sidebar');
    button(tr('Back'), sidebar, finish);
    node('h1', tr('Search titles'), sidebar); node('p', tr('Find a film, a series or your next favorite.'), sidebar);
    input = node('input', '', sidebar); input.type = 'text'; input.maxLength = 150; input.value = query; input.placeholder = tr('Movie or series name'); input.setAttribute('aria-label', tr('Movie or series name'));
    input.onfocus = function () { current = 1; };
    input.oninput = function () { generation++; clearTimeout(timer); timer = setTimeout(function () { run(1, false); }, 450); };
    button(tr('Search titles'), sidebar, function () { run(1, true); });
    voiceButton = button('🎙', sidebar, voiceSearch); voiceButton.className = 'search-voice'; voiceButton.setAttribute('aria-label', tr('Search by voice')); voiceButton.setAttribute('aria-pressed', 'false');
    var chips = node('div', '', sidebar, 'search-types');
    [['all', tr('All')], ['movie', tr('Movies')], ['tv', tr('Shows')]].forEach(function (choice) {
      var b = button(choice[1], chips, function () {
        kind = choice[0]; var buttons = chips.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', buttons[i] === b ? 'true' : 'false');
        run(1, true);
      }); b.setAttribute('aria-pressed', kind === choice[0] ? 'true' : 'false');
    });
    node('p', tr('Search the full catalogue. Recommendation filters do not limit this search.'), sidebar, 'search-note');
    status = node('div', tr('Type a movie or series title to begin.'), sheet, 'search-status'); status.setAttribute('role', 'status');
    results = node('div', '', sheet, 'search-results'); results.onscroll = loadVisible;
    pager = node('div', '', sheet, 'search-pager');
    render(false); focus(1); if (query) run(page, false);
  }
  return {open: open, hide: hide, handleKey: handleKey};
}());
