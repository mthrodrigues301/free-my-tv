/* Spotify credentials live only in the authorization service and player memory. */
var Music = (function () {
  'use strict';
  var root, player, ready = false, connecting = false, active = false, controls = [], current = 0;
  var status, title, artist, cover, play, close, sdkLoaded = false, message = '', track = null, paused = true, enter, source = 'spotify', youtube, youtubeInput, youtubeState = -1, youtubeBridge, youtubeGeneration = 0, youtubeShell, youtubeResults, youtubeQuery = '', youtubeItems = [], youtubeKey = '', searchRequest, searchGeneration = 0, keyInput, spotifyDevice = '', spotifyInput, spotifyResults, spotifyQuery = '', spotifyItems = [], spotifySearchRequest, spotifySearchGeneration = 0;
  function node(tag, cls, text, parent) { var n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; parent.appendChild(n); return n; }
  function local() { return /^https?:$/.test(location.protocol) && location.hostname === '127.0.0.1' && location.port === '8770'; }
  function onTV() { return TV.name === 'webos' && !!window.PalmServiceBridge; }
  function lunaSpotify(method, payload, done) {
    var bridge = new window.PalmServiceBridge(), finished = false;
    var timer = setTimeout(function () { if (finished) return; finished = true; try { bridge.cancel(); } catch (e) {} done({returnValue: false, status: 504}); }, 20000);
    bridge.onservicecallback = function (raw) { if (finished) return; finished = true; clearTimeout(timer); var data; try { data = JSON.parse(raw); } catch (e) {} done(data || {returnValue: false, status: 502}); };
    try { bridge.call('luna://io.freemytv.metrics/' + method, JSON.stringify(payload || {})); } catch (e) { clearTimeout(timer); if (!finished) { finished = true; done({returnValue: false, status: 502}); } }
    return {abort: function () { finished = true; clearTimeout(timer); try { bridge.cancel(); } catch (e) {} }};
  }
  function reportSpotify(status) { if (onTV()) lunaSpotify('spotifyReport', {status: status}, function () {}); }
  var authorizationTimer = 0, authorizationDeadline = 0, sessionKeepalive = 0;
  function keepSession() { if (!onTV() || sessionKeepalive) return; sessionKeepalive = setInterval(function () { lunaSpotify('spotifyStatus', {}, function () {}); }, 15000); }
  function waitAuthorization() {
    if (Date.now() > authorizationDeadline) { connecting = false; say(tr('Spotify authorization expired. Connect again.')); return; }
    lunaSpotify('spotifyStatus', {}, function (result) {
      if (!connecting) return;
      if (result.connected) { connecting = false; loadSpotify(); }
      else authorizationTimer = setTimeout(waitAuthorization, 3000);
    });
  }
  function say(text) { message = text; if (status) status.textContent = text; }
  function focus(at) { if (!controls.length) return; current = Math.max(0, Math.min(controls.length - 1, at)); SettingsUI.focus(controls[current]); }
  function button(text, parent, action) { var b = node('button', '', text, parent); b.type = 'button'; b.onclick = function () { action(); }; b.onfocus = function () { current = controls.indexOf(b); active = true; if (enter) enter(); }; controls.push(b); return b; }
  function keyboardSearch(field, submit) {
    field.setAttribute('enterkeyhint', 'search');
    var previous = '', at = 0;
    function confirm(event) { if (event) event.preventDefault(); var value = field.value; if (previous === value && Date.now() - at < 350) return; previous = value; at = Date.now(); submit(); }
    field.onsearch = confirm; field.onchange = confirm;
    field.onkeyup = function (event) { if (event.key === 'Enter' || event.keyCode === 13) confirm(event); };
  }
  function state(value) {
    if (!value) return;
    track = value.track_window && value.track_window.current_track; paused = value.paused;
    if (source !== 'spotify') return;
    if (title) title.textContent = track ? track.name : tr('Nothing playing yet');
    if (artist) artist.textContent = track ? track.artists.map(function (a) { return a.name; }).join(' · ') : '';
    var images = track && track.album && track.album.images || [];
    if (cover) { cover.textContent = images.length ? '' : '♪'; if (images.length) cover.style.backgroundImage = 'url(' + images[0].url + ')'; }
    if (play) play.textContent = paused ? tr('Play') : tr('Pause');
  }
  function command(name) {
    if (!player || !ready) { say(tr('Connect Spotify first.')); return; }
    player.activateElement();
    player[name]().then(function () {}, function () { say(tr('Could not control playback. Select this player in Spotify.')); });
  }
  function token(callback) {
    if (onTV()) { lunaSpotify('spotifyToken', {}, function (result) { if (result.returnValue && result.access_token) callback(result.access_token); else { connecting = false; reportSpotify('authorization_required'); say(tr('Connect your Spotify account again.')); } }); return; }
    var request = new XMLHttpRequest();
    request.open('GET', 'http://127.0.0.1:8788/token', true); request.timeout = 10000;
    request.setRequestHeader('X-FreeMyTV-Local', '1');
    request.onload = function () {
      var data; try { data = JSON.parse(request.responseText); } catch (e) {}
      if (request.status === 200 && data && data.access_token) callback(data.access_token);
      else { connecting = false; say(tr('Local token unavailable. Check the Spotify environment variable.')); }
    };
    request.onerror = request.ontimeout = function () { connecting = false; say(tr('Start the local Spotify bridge to connect.')); };
    request.send();
  }
  function createPlayer() {
    if (!window.Spotify || player) return;
    player = new Spotify.Player({name: onTV() ? 'Free My TV LG' : 'Free My TV Local', getOAuthToken: token, volume: .5});
    player.addListener('ready', function (device) { spotifyDevice = device.device_id; keepSession(); reportSpotify('ready'); ready = true; connecting = false; say(tr('Spotify connected. Choose a song or select this player in Spotify.')); });
    player.addListener('not_ready', function () { ready = false; connecting = false; say(tr('Player offline. Reconnect Spotify.')); });
    player.addListener('player_state_changed', state);
    player.addListener('initialization_error', function () { reportSpotify('initialization_error'); connecting = false; say(tr('This browser cannot initialize Spotify playback.')); });
    player.addListener('authentication_error', function () { reportSpotify('authentication_error'); connecting = false; ready = false; say(onTV() ? tr('Connect your Spotify account again.') : tr('Spotify rejected the token or its permissions. Renew the environment variable.')); });
    player.addListener('account_error', function () { reportSpotify('account_error'); connecting = false; ready = false; say(tr('Spotify Premium is required for this player.')); });
    player.addListener('autoplay_failed', function () { say(tr('Press Play to allow audio in this browser.')); });
    player.connect().then(function (ok) { if (!ok) { connecting = false; say(tr('Could not connect Spotify. Check the token and connection.')); } }, function () { connecting = false; say(tr('Could not connect Spotify. Check the token and connection.')); });
  }
  function connect() {
    if (onTV()) {
      if (ready || connecting) return; connecting = true;
      lunaSpotify('spotifyStatus', {}, function (result) {
        if (result.connected) { connecting = false; loadSpotify(); return; }
        lunaSpotify('spotifyStart', {}, function (start) {
          if (!start.returnValue || !/^https:\/\/accounts\.spotify\.com\/authorize\?/.test(start.url || '')) { connecting = false; say(tr('Could not start Spotify authorization.')); return; }
          say(tr('Authorize Free My TV in Spotify, then return here.'));
          TV.launch('com.webos.app.browser', {target: start.url}, function () {}); authorizationDeadline = Date.now() + 600000; waitAuthorization();
        });
      }); return;
    }
    loadSpotify();
  }
  function loadSpotify() {
    if (!local() && !onTV()) { say(tr('Spotify integration is currently available only in the local preview.')); return; }
    if (ready || connecting) return;
    connecting = true; say(tr('Connecting to Spotify…'));
    if (player) { player.connect(); return; }
    if (window.Spotify) { createPlayer(); return; }
    if (sdkLoaded) return;
    sdkLoaded = true;
    window.onSpotifyWebPlaybackSDKReady = createPlayer;
    var script = document.createElement('script'); script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = function () { sdkLoaded = false; connecting = false; say(tr('Could not load the Spotify player.')); };
    document.head.appendChild(script);
  }
  function spotifyRequest(path, body, callback) {
    if (onTV()) {
      var action = path === '/play' ? 'play' : path.indexOf('/search?') === 0 ? 'search' : path.slice(1);
      var payload = {action: action};
      if (action === 'search') payload.query = decodeURIComponent(path.split('q=')[1] || '');
      if (body) { payload.uri = body.uri; payload.device_id = body.device_id; }
      return lunaSpotify('spotifyRequest', payload, function (result) { callback(result.status || (result.returnValue ? 200 : 502), result.data || {}); });
    }
    var request = new XMLHttpRequest(); request.open(body ? 'POST' : 'GET', 'http://127.0.0.1:8788' + path, true); request.timeout = 15000;
    request.setRequestHeader('X-FreeMyTV-Local', '1'); if (body) request.setRequestHeader('Content-Type', 'application/json');
    request.onload = function () { var data; try { data = JSON.parse(request.responseText); } catch (e) {} callback(request.status, data || {}); };
    request.onerror = request.ontimeout = function () { callback(0, {}); }; request.send(body ? JSON.stringify(body) : null); return request;
  }
  function spotifyError(code) {
    say(code === 429 ? tr('Spotify search is temporarily rate limited. Try again later.') : code === 401 ? (onTV() ? tr('Connect your Spotify account again.') : tr('Renew your Spotify token in the local process environment.')) : code === 403 ? tr('The Spotify token does not allow this action.') : tr('Start the updated local Spotify bridge and try again.'));
  }
  function renderSpotifyResults() {
    if (!spotifyResults) return; spotifyResults.innerHTML = '';
    controls = Array.prototype.slice.call(root.querySelectorAll('button,input'));
    spotifyItems.forEach(function (item) {
      var row = button('', spotifyResults, function () {
        if (!ready || !spotifyDevice) { say(tr('Connect Spotify first.')); return; }
        player.activateElement(); stopYoutube();
        spotifyRequest('/play', {uri: item.uri, device_id: spotifyDevice}, function (code) { if (code !== 200) spotifyError(code); });
      }); row.className = 'music-result'; node('strong', '', item.name, row); node('small', '', (item.artists || []).map(function (a) { return a.name; }).join(' · '), row);
    });
  }
  function searchSpotify() {
    spotifyQuery = spotifyInput.value.replace(/^\s+|\s+$/g, '').slice(0, 120);
    if (!local() && !onTV()) { say(tr('Spotify integration is currently available only in the local preview.')); return; }
    if (!spotifyQuery) return; if (spotifySearchRequest) spotifySearchRequest.abort();
    var stamp = ++spotifySearchGeneration; say(tr('Searching music…'));
    spotifySearchRequest = spotifyRequest('/search?q=' + encodeURIComponent(spotifyQuery), null, function (code, data) {
      if (stamp !== spotifySearchGeneration || !root || source !== 'spotify') return;
      spotifySearchRequest = null; if (code !== 200) { spotifyError(code); return; }
      spotifyItems = data.tracks && data.tracks.items || []; renderSpotifyResults(); say(spotifyItems.length ? tr('Choose a song to play.') : tr('No songs found.'));
    });
  }
  function youtubeCommand(command) {
    if (youtube && youtube.contentWindow) youtube.contentWindow.postMessage(JSON.stringify({type: 'trailer-command', command: command}), '*');
  }
  function stopYoutube() {
    youtubeGeneration++;
    if (youtubeShell && youtubeShell.parentNode) youtubeShell.parentNode.removeChild(youtubeShell); youtubeShell = null;
    if (youtube && youtube.parentNode) youtube.parentNode.removeChild(youtube);
    youtube = null; youtubeState = -1;
    try { if (youtubeBridge) youtubeBridge.cancel(); } catch (e) {}
    youtubeBridge = null;
  }
  function dockYoutube(docked) {
    if (youtubeShell) youtubeShell.className = 'music-youtube-persistent' + (docked ? ' music-mini' : '');
  }
  function ensureYoutubeShell() {
    if (youtubeShell) return;
    youtubeShell = node('div', 'music-youtube-persistent', '', document.getElementById('stage'));
    var bar = node('div', 'music-mini-actions', '', youtubeShell);
    function miniButton(text, action) {
      var b = node('button', '', text, bar); b.type = 'button'; b.onclick = action;
    }
    miniButton(tr('Play / Pause'), function () { youtubeCommand(youtubeState === 1 ? 'pause' : 'play'); });
    miniButton(tr('Close player'), stopYoutube);
    bar.addEventListener('keydown', function (e) {
      var buttons = bar.querySelectorAll('button'), at = Array.prototype.indexOf.call(buttons, document.activeElement);
      if (e.keyCode === 37 || e.keyCode === 39) { e.preventDefault(); e.stopPropagation(); SettingsUI.focus(buttons[Math.max(0, Math.min(buttons.length - 1, at + (e.keyCode === 39 ? 1 : -1)))]); }
      else if (e.keyCode === 13) { e.preventDefault(); e.stopPropagation(); document.activeElement.click(); }
      else if (e.keyCode === 27 || e.keyCode === TV.keys.back) { e.preventDefault(); e.stopPropagation(); if (close) close('top'); }
    }, true);
  }
  function playYoutube(key) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(key)) return;
    if (player && ready) player.pause().then(function () {}, function () {});
    stopYoutube(); ensureYoutubeShell(); var stamp = youtubeGeneration;
    say(tr('Loading video…'));
    function mountVideo(url) {
      if (stamp !== youtubeGeneration || !root || source !== 'youtube') return;
      youtube = node('iframe', 'music-youtube-frame', '', youtubeShell); youtube.title = 'YouTube';
      youtube.setAttribute('allow', 'autoplay; encrypted-media'); youtube.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); youtube.tabIndex = -1;
      youtube.src = url + '#' + key;
    }
    if (TV.name === 'webos' && window.PalmServiceBridge) {
      youtubeBridge = new window.PalmServiceBridge();
      youtubeBridge.onservicecallback = function (rawResult) {
        var result; try { result = JSON.parse(rawResult); } catch (e) {}
        if (stamp !== youtubeGeneration) return;
        if (result && result.returnValue && /^http:\/\/127\.0\.0\.1:\d+\/player$/.test(result.url)) mountVideo(result.url);
        else say(tr('Could not load the YouTube player.'));
      };
      youtubeBridge.call('luna://io.freemytv.metrics/trailerPlayer', '{}');
    } else if (/^https?:$/.test(location.protocol)) mountVideo('trailer-player.html');
    else say(tr('Could not load the YouTube player.'));
  }
  window.addEventListener('message', function (event) {
    if (!youtube || event.source !== youtube.contentWindow) return;
    var data; try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if (!data) return;
    if (data.type === 'trailer-state') { youtubeState = data.code; say(data.code === 3 ? tr('Loading video…') : ''); }
    else if (data.type === 'trailer-error') say(tr('This video cannot play here. Try another YouTube link.'));
    else if (data.type === 'trailer-blocked') say(tr('Press Play to allow audio in this browser.'));
  });
  function renderYoutubeResults() {
    if (!youtubeResults) return;
    youtubeResults.innerHTML = '';
    controls = Array.prototype.slice.call(root.querySelectorAll('button,input'));
    youtubeItems.forEach(function (item) {
      var row = button('', youtubeResults, function () { playYoutube(item.id.videoId); }); row.className = 'music-result';
      var image = node('img', '', '', row), snippet = item.snippet || {}, thumb = snippet.thumbnails && snippet.thumbnails.medium;
      image.alt = ''; if (thumb && /^https:\/\/i\.ytimg\.com\//.test(thumb.url)) image.src = thumb.url;
      function decode(value) { var text = document.createElement('textarea'); text.innerHTML = value || ''; return text.value; }
      node('strong', '', decode(snippet.title), row); node('small', '', decode(snippet.channelTitle), row);
      row.onfocus = function () { current = controls.indexOf(row); active = true; if (enter) enter(); row.scrollIntoView(false); document.getElementById('stage').scrollTop = 0; };
    });
  }
  function searchYoutube() {
    var query = youtubeInput.value.replace(/^\s+|\s+$/g, '').slice(0, 120);
    youtubeQuery = query; youtubeKey = keyInput.value.replace(/^\s+|\s+$/g, '');
    if (!youtubeKey) { say(tr('Add a YouTube Data API key to enable music search.')); SettingsUI.focus(keyInput); return; }
    if (!query) { SettingsUI.focus(youtubeInput); return; }
    if (searchRequest) searchRequest.abort();
    var stamp = ++searchGeneration, request = new XMLHttpRequest(); searchRequest = request;
    say(tr('Searching music…')); youtubeItems = []; renderYoutubeResults();
    request.open('GET', 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&videoSyndicated=true&maxResults=10&relevanceLanguage=pt&q=' + encodeURIComponent(query), true);
    request.setRequestHeader('X-Goog-Api-Key', youtubeKey); request.timeout = 15000;
    request.onload = function () {
      if (stamp !== searchGeneration || !root || source !== 'youtube') return;
      searchRequest = null; var data; try { data = JSON.parse(request.responseText); } catch (e) {}
      if (request.status !== 200 || !data) { say(request.status === 403 ? tr('Check the YouTube API key, API activation and search quota.') : tr('Could not search YouTube. Please try again.')); return; }
      youtubeItems = (data.items || []).filter(function (item) { return item.id && /^[a-zA-Z0-9_-]{11}$/.test(item.id.videoId); });
      renderYoutubeResults(); say(youtubeItems.length ? tr('Choose a video to play.') : tr('No videos found.'));
    };
    request.onerror = request.ontimeout = function () { if (stamp === searchGeneration) say(tr('Could not search YouTube. Please try again.')); };
    request.send();
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) youtubeCommand('pause'); });
  function sourceButtons(parent) {
    var bar = node('div', 'music-sources', '', parent);
    ['spotify', 'youtube'].forEach(function (id) {
      var b = button(id === 'spotify' ? 'Spotify' : 'YouTube', bar, function () {
        if (source === id) return;
        source = id;
        if (id === 'spotify') stopYoutube();
        if (id === 'youtube' && player && ready) player.pause().then(function () {}, function () {});
        var host = root.parentNode, done = close, onEnter = enter;
        mount(host, done, onEnter); focus(id === 'youtube' ? 1 : 0);
      });
      b.setAttribute('aria-pressed', source === id ? 'true' : 'false');
    });
  }
  function hide() { spotifySearchGeneration++; if (spotifySearchRequest) spotifySearchRequest.abort(); spotifySearchRequest = null; spotifyInput = spotifyResults = null; dockYoutube(true); searchGeneration++; if (searchRequest) searchRequest.abort(); searchRequest = null; youtubeResults = keyInput = youtubeInput = null; active = false; status = title = artist = cover = play = null; if (root && root.parentNode) root.parentNode.removeChild(root); root = null; }
  function mount(parent, done, onEnter) {
    hide(); close = done; enter = onEnter; controls = [];
    root = node('div', 'music-panel', '', parent); root.id = 'music-panel';
    sourceButtons(root);
    if (source === 'youtube') {
      root.className += ' music-youtube';
      var side = node('div', 'music-content', '', root);
      node('h1', '', tr('Find music on YouTube'), side);
      youtubeInput = node('input', 'music-link', '', side); youtubeInput.type = 'search'; youtubeInput.value = youtubeQuery; youtubeInput.placeholder = tr('Song or artist'); youtubeInput.setAttribute('aria-label', tr('Song or artist'));
      keyboardSearch(youtubeInput, searchYoutube);
      controls.push(youtubeInput); youtubeInput.onfocus = function () { current = controls.indexOf(youtubeInput); active = true; if (enter) enter(); };
      button(tr('Search'), side, searchYoutube).className = 'music-search-button';
      youtubeResults = node('div', 'music-results', '', side); youtubeResults.setAttribute('aria-label', tr('Search results'));
      var config = node('div', 'music-youtube-config', '', root);
      node('label', '', tr('YouTube Data API key (this session only)'), config).htmlFor = 'music-youtube-key';
      keyInput = node('input', 'music-link', '', config); keyInput.id = 'music-youtube-key'; keyInput.type = 'password'; keyInput.autocomplete = 'off'; keyInput.value = youtubeKey;
      keyInput.oninput = function () { youtubeKey = keyInput.value; }; keyInput.onfocus = function () { current = controls.indexOf(keyInput); active = true; if (enter) enter(); }; controls.push(keyInput);
      status = node('p', 'music-status', '', config); status.setAttribute('role', 'status');
      node('p', 'music-note', tr('Search by song or artist. The video stays visible in a mini player when you switch tabs.'), config);
      dockYoutube(false); renderYoutubeResults();
      return;
    }
    root.className += ' music-spotify';
    var searchBox = node('div', 'music-spotify-search', '', root);
    spotifyInput = node('input', 'music-link', '', searchBox); spotifyInput.type = 'search'; spotifyInput.value = spotifyQuery; spotifyInput.placeholder = tr('Song or artist'); spotifyInput.setAttribute('aria-label', tr('Song or artist')); controls.push(spotifyInput); keyboardSearch(spotifyInput, searchSpotify);
    spotifyInput.onfocus = function () { current = controls.indexOf(spotifyInput); active = true; if (enter) enter(); };
    button(tr('Search'), searchBox, searchSpotify).className = 'music-search-button'; spotifyResults = node('div', 'music-results', '', searchBox);
    cover = node('div', 'music-cover', '♪', root);
    var content = node('div', 'music-content', '', root);
    node('div', 'music-label', 'SPOTIFY', content);
    title = node('h1', '', tr('Nothing playing yet'), content); artist = node('p', 'music-artist', '', content);
    status = node('p', 'music-status', message || tr('Connect your local Spotify player.'), content); status.setAttribute('role', 'status');
    var actions = node('div', 'music-actions', '', content);
    button(tr('Connect Spotify'), actions, connect);
    button(tr('Previous track'), actions, function () { command('previousTrack'); });
    play = button(tr('Play'), actions, function () { command('togglePlay'); });
    button(tr('Next track'), actions, function () { command('nextTrack'); });
    button(tr('Disconnect'), actions, function () { if (player) player.disconnect(); clearTimeout(authorizationTimer); clearInterval(sessionKeepalive); sessionKeepalive = 0; if (onTV()) lunaSpotify('spotifyDisconnect', {}, function (result) { if (!result.returnValue) say(tr('Could not remove the saved authorization. Try disconnecting again.')); }); player = null; ready = connecting = false; say(tr('Spotify disconnected.')); });
    node('p', 'music-note', (onTV() ? tr('Spotify authorization is encrypted on this TV when secure storage is available. Disconnect removes it.') : tr('Spotify authorization is kept only in memory. Reconnect after restarting the service.')), content);
    if (track) state({track_window: {current_track: track}, paused: paused});
    renderSpotifyResults();
    if (onTV() && !ready && !connecting) lunaSpotify('spotifyStatus', {}, function (result) { if (root && source === 'spotify' && result.connected) connect(); });
    if (!local() && !onTV()) say(tr('Spotify integration is currently available only in the local preview.'));
  }
  function handleKey(e) {
    var key = e.keyCode;
    if ((document.activeElement === youtubeInput || document.activeElement === keyInput || document.activeElement === spotifyInput) && key !== TV.keys.up && key !== TV.keys.down && key !== TV.keys.ok && key !== TV.keys.back && key !== 27) return;
    e.preventDefault(); e.stopPropagation();
    if (key === TV.keys.back || key === 27 || key === TV.keys.up) { active = false; close('top'); }
    else if (key === TV.keys.down) { if (current < controls.length - 1) focus(current + 1); else { active = false; close('shelf'); } }
    else if (key === TV.keys.left || key === TV.keys.right) focus(current + (key === TV.keys.right ? 1 : -1));
    else if (key === TV.keys.ok && controls[current]) { if (controls[current] === spotifyInput) searchSpotify(); else if (controls[current] === youtubeInput) searchYoutube(); else if (controls[current] === keyInput) focus(2); else controls[current].click(); }
  }
  return {connect: connect, pauseVideo: function () { youtubeCommand('pause'); }, mount: mount, hide: hide, handleKey: handleKey, focusFirst: function () { active = true; focus(0); }, active: function () { return active; }};
}());
