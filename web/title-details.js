/* Detail data belongs to TMDB; streaming audio/subtitle catalogues are not inferred. */
var TitleDetails = (function () {
  'use strict';
  var sheet, content, controls = [], current = 0, generation = 0, closed, player;
  function node(tag, text, parent, cls) {
    var n = document.createElement(tag); if (text) n.textContent = text;
    if (cls) n.className = cls; if (parent) parent.appendChild(n); return n;
  }
  function focus(at) { if (!controls.length) return; current = Math.max(0, Math.min(controls.length - 1, at)); controls[current].focus(); }
  function button(text, parent, action) {
    var b = node('button', text, parent); b.type = 'button'; b.onclick = action;
    b.onfocus = function () { current = controls.indexOf(b); }; controls.push(b); return b;
  }
  function hide() {
    generation++; closed = null;
    if (player && player.parentNode) player.parentNode.removeChild(player); player = null;
    if (sheet) { sheet.className = 'layer title-details'; if (document.activeElement) document.activeElement.blur(); }
  }
  function finish() { var callback = closed; hide(); if (callback) callback(); }
  function trailer(videos) {
    var valid = (videos || []).filter(function (v) { return v.site === 'YouTube' && /^[a-zA-Z0-9_-]{6,20}$/.test(v.key || '') && (v.type === 'Trailer' || v.type === 'Teaser'); });
    valid.sort(function (a, b) { return (b.type === 'Trailer' ? 2 : 0) + (b.official ? 1 : 0) - (a.type === 'Trailer' ? 2 : 0) - (a.official ? 1 : 0); });
    return valid[0] || null;
  }
  function paint(p, data, error) {
    var focusAt = current; controls = []; sheet.innerHTML = '';
    var hero = node('div', '', sheet, 'detail-backdrop'); hero.style.backgroundImage = 'url(' + Data.image(data.backdrop_path || p.backdrop, 'w1280') + ')';
    var heading = node('div', '', sheet, 'detail-heading');
    node('h1', data.title || data.name || p.title, heading);
    var meta = [(data.release_date || data.first_air_date || '').slice(0, 4)];
    if (data.vote_average) meta.push('★ ' + data.vote_average.toFixed(1));
    if (data.runtime) meta.push(trf('{m}m', {m: data.runtime}));
    if (data.genres) meta.push(data.genres.map(function (g) { return g.name; }).join(' · '));
    node('div', meta.filter(function (v) { return !!v; }).join('  ·  '), heading, 'detail-meta');
    var actions = node('div', '', sheet, 'detail-actions'), app = Data.appFor(p.app);
    if (app) button(trf('Open {app}', {app: p.service || app.title}), actions, function () {
      TV.launch(app.id, null, function (ok) { if (!ok) status.textContent = tr('Could not open the streaming app.'); });
    });
    button(tr('Back'), actions, finish);
    var status = node('div', error === 'loading' ? tr('Loading details…') : error ? tr('Could not load all details. Check your connection.') : '', heading, 'detail-status');
    content = node('div', '', sheet, 'detail-content');
    node('h2', tr('Synopsis'), content);
    node('p', data.overview || (error === 'loading' ? tr('Loading details…') : tr('No synopsis available.')), content);
    var cast = data.credits && data.credits.cast || [];
    node('h2', tr('Cast'), content);
    var castRow = node('div', '', content, 'detail-cast');
    for (var i = 0; i < cast.length && i < 18; i++) {
      var actor = node('div', '', castRow, 'detail-actor');
      if (cast[i].profile_path) { var image = node('img', '', actor); image.src = Data.image(cast[i].profile_path, 'w185'); image.alt = cast[i].name || ''; }
      node('div', cast[i].name, actor); node('small', cast[i].character || '', actor);
    }
    if (!cast.length) node('p', tr('Not provided by TMDB.'), content);
    node('h2', tr('Voice cast and dubbing'), content);
    var voice = cast.filter(function (a) { return /\(voice\)|\(voz\)|voice actor|dublador/i.test(a.character || ''); });
    if (voice.length) node('p', voice.map(function (a) { return a.name + ' — ' + a.character; }).join(' · '), content);
    node('p', tr('Local dubbing credits are not provided by TMDB. Check the streaming service.'), content, 'detail-note');
    node('h2', tr('Languages'), content);
    var languages = data.spoken_languages || [];
    node('p', languages.length ? languages.map(function (l) { return l.english_name || l.name || l.iso_639_1; }).join(' · ') : tr('Not provided by TMDB.'), content);
    node('p', tr('Production languages reported by TMDB. Available audio and subtitles depend on the streaming service.'), content, 'detail-note');
    var video = trailer(data.videos && data.videos.results), preview = node('div', '', sheet, 'detail-trailer');
    node('h2', tr('Trailer'), preview);
    if (video) {
      var screen = node('div', '', preview, 'trailer-screen');
      screen.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + video.key + '/hqdefault.jpg)';
      button(tr('Play trailer here'), preview, function () {
        if (player && player.parentNode) { player.parentNode.removeChild(player); player = null; return; }
        player = node('iframe', '', screen); player.title = tr('Trailer'); player.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
        player.setAttribute('allowfullscreen', ''); player.tabIndex = -1;
        player.src = 'https://www.youtube-nocookie.com/embed/' + video.key + '?autoplay=1&rel=0';
        controls[current].focus();
      });
      button(tr('Open in YouTube'), preview, function () { TV.launch('youtube.leanback.v4', {contentTarget: 'https://www.youtube.com/watch?v=' + video.key}, function (ok) { if (!ok) status.textContent = tr('Could not open YouTube.'); }); });
      node('p', tr('If embedded playback is unavailable, open it in YouTube.'), preview, 'detail-note');
    } else node('p', error === 'loading' ? tr('Loading details…') : tr('No trailer available.'), preview);
    node('div', tr('Up/Down scrolls details. Left/Right selects actions. Back closes.'), sheet, 'detail-hint');
    focus(focusAt);
    setTimeout(function () { if (closed) focus(focusAt); }, 0);
  }
  function handleKey(e) {
        var k = e.keyCode; e.stopPropagation();
        if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); finish(); }
        else if (k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); content.scrollTop += k === TV.keys.down ? 150 : -150; }
        else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); focus(current + (k === TV.keys.right ? 1 : -1)); }
        else if (k === TV.keys.ok) { e.preventDefault(); if (controls[current]) controls[current].click(); }
      }
  function open(p, done) {
    if (!sheet) {
      sheet = node('div', '', document.getElementById('stage'), 'layer title-details'); sheet.id = 'title-details';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      sheet.onkeydown = handleKey;
    }
    hide(); closed = done; current = 0; var request = ++generation;
    sheet.className = 'layer title-details open'; paint(p, {}, 'loading');
    Data.titleDetails(p, function (err, data) { if (request === generation && closed) paint(p, data || {}, !!err); });
  }
  return {handleKey: handleKey, open: open, hide: hide, trailer: trailer};
}());
