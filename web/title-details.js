/* Detail data belongs to TMDB; streaming audio/subtitle catalogues are not inferred. */
var TitleDetails = (function () {
  'use strict';
  var sheet, content, controls = [], current = 0, generation = 0, closed, player, playerBridge, playerTimeout, playerMessage, loading, playerState = -1, fullscreen = false, fullButton, playButton, trailerScreen;
  function node(tag, text, parent, cls) {
    var n = document.createElement(tag); if (text) n.textContent = text;
    if (cls) n.className = cls; if (parent) parent.appendChild(n); return n;
  }
  function focus(at) {
    if (!controls.length) return;
    current = Math.max(0, Math.min(controls.length - 1, at));
    var target = controls[current];
    try { target.focus({preventScroll: true}); } catch (e) { target.focus(); }
    if (content && content.contains(target)) {
      var r = target.getBoundingClientRect(), viewport = content.getBoundingClientRect();
      if (r.top < viewport.top + 12) content.scrollTop -= viewport.top + 12 - r.top;
      else if (r.bottom > viewport.bottom - 12) content.scrollTop += r.bottom - viewport.bottom + 12;
    }
    sheet.scrollTop = 0; document.getElementById('stage').scrollTop = 0;
  }
  function setFullscreen(value) {
    fullscreen = !!value; sheet.className = 'layer title-details open' + (fullscreen ? ' trailer-fullscreen' : '');
    if (fullButton) fullButton.textContent = fullscreen ? tr('Exit fullscreen') : tr('Fullscreen');
    if (fullscreen && fullButton) focus(controls.indexOf(fullButton));
  }
  function sendPlayer(command) { if (player) player.contentWindow.postMessage(JSON.stringify({type: 'trailer-command', command: command}), '*'); }
  function showLoading(value) { if (loading) loading.style.display = value ? '' : 'none'; }
  function directional(dx, dy) {
    var from = controls[current].getBoundingClientRect(), x = (from.left + from.right) / 2, y = (from.top + from.bottom) / 2, best = -1, score = Infinity;
    for (var i = 0; i < controls.length; i++) {
      if (i === current || (fullscreen && !controls[i].parentNode.classList.contains('trailer-actions'))) continue;
      var r = controls[i].getBoundingClientRect(), vx = (r.left + r.right) / 2 - x, vy = (r.top + r.bottom) / 2 - y;
      if (dx ? vx * dx < 20 : vy * dy < 20) continue;
      var distance = dx ? Math.abs(vx) + Math.abs(vy) * 2 : Math.abs(vy) + Math.abs(vx) * .65;
      if (distance < score) { score = distance; best = i; }
    }
    if (best >= 0) focus(best); else if (dy && content && !fullscreen) content.scrollTop += dy * 180;
  }
  function button(text, parent, action) {
    var b = node('button', text, parent); b.type = 'button'; b.onclick = function () { action(); if (closed) focus(current); };
    b.onfocus = function () { current = controls.indexOf(b); }; controls.push(b); return b;
  }
  function stopPlayer() {
    clearTimeout(playerTimeout); showLoading(false); playerState = -1;
    if (playButton) playButton.textContent = tr('Play trailer here');
    if (playerMessage) window.removeEventListener('message', playerMessage); playerMessage = null;
    try { if (playerBridge) playerBridge.cancel(); } catch (e) {} playerBridge = null;
    if (player && player.parentNode) player.parentNode.removeChild(player); player = null;
  }
  function startPlayer(screen, video, status) {
    stopPlayer(); showLoading(true); var stamp = generation;
    function error(code) { stopPlayer(); status.textContent = tr('Embedded playback unavailable. Open the trailer in YouTube.') + (code ? ' (' + code + ')' : ''); }
    function mount(url) {
      if (stamp !== generation || !closed) return;
      player = node('iframe', '', screen); player.title = tr('Trailer'); player.setAttribute('allow', 'autoplay; encrypted-media; fullscreen'); player.style.pointerEvents = 'none'; player.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); player.tabIndex = -1;
      playerMessage = function (event) {
        if (!player || event.source !== player.contentWindow) return;
        var data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
        if (!data) return;
        if (data.type === 'trailer-state') {
          playerState = data.code;
          if (playerState === 1) { clearTimeout(playerTimeout); showLoading(false); status.textContent = ''; }
          else if (playerState === 3) showLoading(true);
          else if (playerState === 2 || playerState === 0) showLoading(false);
          if (playButton) playButton.textContent = playerState === 1 || playerState === 3 ? tr('Pause trailer') : tr('Play trailer here');
        }
        else if (data.type === 'trailer-blocked') { clearTimeout(playerTimeout); showLoading(false); status.textContent = tr('Press Play to start the trailer.'); }
        else if (data.type === 'trailer-back') { if (fullscreen) setFullscreen(false); else stopPlayer(); }
        else if (data.type === 'trailer-error') error(data.code);
      };
      window.addEventListener('message', playerMessage);
      playerTimeout = setTimeout(function () { error(0); }, 45000);
      player.src = url + '#' + video.key;
    }
    status.textContent = tr('Loading trailer…');
    if (TV.name === 'webos' && window.PalmServiceBridge) {
      playerBridge = new window.PalmServiceBridge();
      playerTimeout = setTimeout(function () { error(0); }, 8000);
      playerBridge.onservicecallback = function (raw) {
        if (stamp !== generation || !closed) return;
        clearTimeout(playerTimeout); var result;
        try { result = JSON.parse(raw); } catch (e) {}
        if (result && result.returnValue && /^http:\/\/127\.0\.0\.1:\d+\/player$/.test(result.url)) mount(result.url); else error(0);
      };
      try { playerBridge.call('luna://io.freemytv.metrics/trailerPlayer', '{}'); } catch (e) { error(0); }
    } else if (/^https?:$/.test(location.protocol)) mount('trailer-player.html');
    else error(0);
  }
  function hide() {
    generation++; closed = null; fullscreen = false;
    stopPlayer();
    if (sheet) { sheet.className = 'layer title-details'; if (document.activeElement) document.activeElement.blur(); }
  }
  function finish() { var callback = closed; hide(); if (callback) callback(); }
  function trailer(videos) {
    var valid = (videos || []).filter(function (v) { return v.site === 'YouTube' && /^[a-zA-Z0-9_-]{6,20}$/.test(v.key || '') && (v.type === 'Trailer' || v.type === 'Teaser'); });
    valid.sort(function (a, b) { return (b.type === 'Trailer' ? 2 : 0) + (b.official ? 1 : 0) - (a.type === 'Trailer' ? 2 : 0) - (a.official ? 1 : 0); });
    return valid[0] || null;
  }
  function paint(p, data, error) {
    var focusAt = current; stopPlayer(); controls = []; playButton = fullButton = loading = null; sheet.innerHTML = '';
    var hero = node('div', '', sheet, 'detail-backdrop'); hero.style.backgroundImage = 'url(' + Data.image(data.backdrop_path || p.backdrop, 'w1280') + ')';
    var heading = node('div', '', sheet, 'detail-heading');
    node('h1', data.title || data.name || p.title, heading);
    var meta = [(data.release_date || data.first_air_date || '').slice(0, 4)];
    if (data.vote_average) meta.push('★ ' + data.vote_average.toFixed(1));
    if (data.runtime) meta.push(trf('{m}m', {m: data.runtime}));
    if (data.genres) meta.push(data.genres.map(function (g) { return g.name; }).join(' · '));
    node('div', meta.filter(function (v) { return !!v; }).join('  ·  '), heading, 'detail-meta');
    var actions = node('div', '', sheet, 'detail-actions'), app = Data.appFor(p.app);
    if (!app && data.availability) { for (var a = 0; a < data.availability.length && !app; a++) if (data.availability[a].appId) app = {id: data.availability[a].appId, title: data.availability[a].name}; }
    if (app) button(trf('Open {app}', {app: p.service || app.title}), actions, function () {
      TV.launch(app.id, null, function (ok) { if (!ok) status.textContent = tr('Could not open the streaming app.'); });
    });
    button(tr('Back'), actions, finish);
    button(tr('More information'), actions, function () { content.scrollTop += 380; });
    var status = node('div', error === 'loading' ? tr('Loading details…') : error ? tr('Could not load all details. Check your connection.') : '', heading, 'detail-status');
    content = node('div', '', sheet, 'detail-content');
    var cast = data.credits && data.credits.cast || [];
    node('h2', tr('Where to watch'), content);
    var availability = data.availability || [], labels = {flatrate: tr('Subscription'), free: tr('Free'), ads: tr('With ads'), rent: tr('Rent'), buy: tr('Buy')};
    if (!availability.length) node('p', error === 'loading' ? tr('Loading details…') : tr('No regional availability information found.'), content, 'detail-note');
    var providers = node('div', '', content, 'detail-providers');
    for (var v = 0; v < availability.length; v++) {
      (function (provider) {
        var text = provider.name + ' · ' + labels[provider.type];
        if (provider.appId) button(text, providers, function () { TV.launch(provider.appId, null, function (ok) { if (!ok) status.textContent = tr('Could not open the streaming app.'); }); });
        else node('div', text, providers, 'provider-tag');
      })(availability[v]);
    }
    node('p', 'TMDB / JustWatch' + (data.availabilityRegion ? ' · ' + data.availabilityRegion : ''), content, 'detail-note');
    node('h2', tr('Synopsis'), content);
    node('p', data.overview || (error === 'loading' ? tr('Loading details…') : tr('No synopsis available.')), content);
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
      var screen = node('div', '', preview, 'trailer-screen'); trailerScreen = screen;
      screen.style.backgroundImage = 'url(https://i.ytimg.com/vi/' + video.key + '/hqdefault.jpg)';
      var trailerActions = node('div', '', preview, 'trailer-actions');
      playButton = button(tr('Play trailer here'), trailerActions, function () {
        if (player) { sendPlayer(playerState === 1 || playerState === 3 ? 'pause' : 'play'); return; }
        startPlayer(screen, video, status);
        focus(current);
      });
      fullButton = button(tr('Fullscreen'), trailerActions, function () { if (!player) startPlayer(screen, video, status); setFullscreen(!fullscreen); });
      button(tr('Open in YouTube'), trailerActions, function () { TV.launch('youtube.leanback.v4', {contentTarget: 'https://www.youtube.com/watch?v=' + video.key}, function (ok) { if (!ok) status.textContent = tr('Could not open YouTube.'); }); });
      loading = node('div', '', screen, 'trailer-loading'); loading.setAttribute('role', 'status'); node('span', '', loading, 'loading-spinner'); node('div', tr('Loading trailer…'), loading); showLoading(false);
      node('p', tr('If embedded playback is unavailable, open it in YouTube.'), preview, 'detail-note');
    } else node('p', error === 'loading' ? tr('Loading details…') : tr('No trailer available.'), preview);
    node('div', tr('Arrows select actions. Back exits fullscreen or returns. More information scrolls the details.'), sheet, 'detail-hint');
    focus(focusAt);
    setTimeout(function () { if (closed) focus(focusAt); }, 0);
  }
  function handleKey(e) {
    var k = e.keyCode; e.stopPropagation();
    if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); if (fullscreen) { setFullscreen(false); if (fullButton) focus(controls.indexOf(fullButton)); } else finish(); }
    else if (k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); directional(0, k === TV.keys.down ? 1 : -1); }
    else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); directional(k === TV.keys.right ? 1 : -1, 0); }
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
