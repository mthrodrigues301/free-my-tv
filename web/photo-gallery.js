/* Inline randomized collage, using Flickr justified-layout and local photos only. */
var PhotoGallery = (function () {
  'use strict';
  var sheet, track, controls = [], photos = [], geometry, current = 0, offset = 0, closed, openPhoto, previous = '';
  function shuffle(source) {
    var list = source.slice();
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), value = list[i]; list[i] = list[j]; list[j] = value; }
    if (list.length > 1 && list.map(function (p) { return p.id; }).join('|') === previous) list.push(list.shift());
    previous = list.map(function (p) { return p.id; }).join('|'); return list;
  }
  function node(tag, text, parent, cls) { var n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; }
  function focus(at) {
    current = Math.max(0, Math.min(controls.length - 1, at));
    if (!controls.length) return;
    controls[current].focus();
    track.parentNode.scrollTop = 0; track.parentNode.scrollLeft = 0;
    if (current >= 0 && geometry) {
      var box = geometry.boxes[current];
      if (box.top < offset) offset = box.top;
      else if (box.top + box.height > offset + 550) offset = box.top + box.height - 550;
      offset = Math.max(0, Math.min(Math.max(0, geometry.containerHeight - 550), offset));
      track.style.webkitTransform = track.style.transform = 'translateY(' + (-offset) + 'px)';
    }
  }
  function button(text, parent, action) {
    var b = node('button', text, parent); b.type = 'button'; b.onclick = action;
    b.onfocus = function () { current = controls.indexOf(b); }; controls.push(b); return b;
  }
  function hide() { if (sheet) sheet.className = 'photo-gallery inline'; closed = null; }
  function finish(destination) { if (closed) closed(destination); }
  function paint() {
    sheet.innerHTML = ''; controls = []; offset = 0;
    var viewport = node('div', '', sheet, 'gallery-viewport');
    track = node('div', '', viewport, 'gallery-track');
    if (!photos.length) node('p', tr('No photos added yet.'), track);
    geometry = PhotoLayout(photos.map(function (p) { return Math.max(0.35, Math.min(3, p.aspectRatio || 1.5)); }),
      {containerWidth: 1760, containerPadding: 8, boxSpacing: 18, targetRowHeight: 205 + Math.random() * 50, targetRowHeightTolerance: 0.2, showWidows: true});
    for (var i = 0; i < photos.length; i++) {
      (function (at) {
        var b = button('', track, function () {
          openPhoto(at, photos, function (index) { focus(index); });
        }), rect = geometry.boxes[at];
        b.className = 'gallery-photo'; b.setAttribute('aria-label', trf('Photo {n}', {n: at + 1}));
        b.style.left = rect.left + 'px'; b.style.top = rect.top + 'px'; b.style.width = rect.width + 'px'; b.style.height = rect.height + 'px';
        var soft = node('div', '', b, 'gallery-photo-soft'); soft.style.backgroundImage = 'url(' + (photos[at].blur || photos[at].backdrop) + ')';
        var img = node('img', '', b); img.src = photos[at].backdrop; img.alt = trf('Photo {n}', {n: at + 1});
      })(i);
    }
    focus(0);
    setTimeout(function () { if (closed) focus(0); }, 0);
  }
  function move(dx, dy) {
    if (!controls.length) { finish(dy > 0 ? 'shelf' : 'top'); return; }
    if (dx) { focus(Math.max(0, Math.min(controls.length - 1, current + dx))); return; }
    var box = geometry.boxes[current], center = box.left + box.width / 2, best = -1, distance = Infinity;
    for (var i = 0; i < geometry.boxes.length; i++) {
      var b = geometry.boxes[i], delta = b.top + b.height / 2 - box.top - box.height / 2;
      if ((dy < 0 && delta >= -box.height / 2) || (dy > 0 && delta <= box.height / 2)) continue;
      var d = Math.abs(delta) * 3 + Math.abs(b.left + b.width / 2 - center);
      if (d < distance) { distance = d; best = i; }
    }
    if (best >= 0) focus(best); else finish(dy > 0 ? 'shelf' : 'top');
  }
  function handleKey(e) {
    var k = e.keyCode; e.stopPropagation();
    if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); finish(); }
    else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); move(k === TV.keys.right ? 1 : -1, 0); }
    else if (k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); move(0, k === TV.keys.down ? 1 : -1); }
    else if (k === TV.keys.ok) { e.preventDefault(); if (controls[current]) controls[current].click(); }
  }
  function open(source, showPhoto, done, parent) {
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'photo-gallery'; sheet.setAttribute('role', 'region'); sheet.setAttribute('aria-label', tr('Photos')); sheet.onkeydown = handleKey; }
    (parent || document.getElementById('cards')).appendChild(sheet);
    closed = done; openPhoto = showPhoto; photos = shuffle(source);
    sheet.className = 'photo-gallery inline open'; paint();
  }
  return {reshuffle: function () { if (sheet && sheet.parentNode && photos.length) { photos = shuffle(photos); paint(); } }, focusFirst: function () { focus(0); }, handleKey: handleKey, open: open, hide: hide, shuffle: shuffle};
}());
