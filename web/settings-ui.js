/* Shared settings shell and focus behavior for every configuration dialog. ES5. */
var SettingsUI = (function () {
  'use strict';
  function has(node, cls) { return (' ' + node.className + ' ').indexOf(' ' + cls + ' ') >= 0; }
  function add(node, cls) { if (!has(node, cls)) node.className += ' ' + cls; }
  function focus(target) {
    if (!target) return;
    try { target.focus({preventScroll: true}); } catch (e) { target.focus(); }
    var parent = target.parentNode;
    while (parent && parent.id !== 'stage') {
      if (has(parent, 'rec-options') || has(parent, 'city-results') || has(parent, 'widget-options') || has(parent, 'widget-order-list')) {
        var r = target.getBoundingClientRect(), box = parent.getBoundingClientRect();
        if (r.top < box.top + 6) parent.scrollTop -= box.top + 6 - r.top;
        else if (r.bottom > box.bottom - 6) parent.scrollTop += r.bottom - box.bottom + 6;
        break;
      }
      parent = parent.parentNode;
    }
    var stage = document.getElementById('stage'); if (stage) stage.scrollTop = stage.scrollLeft = 0;
  }
  function decorate(sheet, back) {
    if (!sheet) return;
    var box = sheet.querySelector('.box'); if (!box) return;
    add(sheet, 'settings-panel'); add(box, 'settings-dialog');
    var title = box.querySelector('.title') || box.querySelector('h2');
    if (title && !box.querySelector('.settings-header')) {
      var header = document.createElement('div'); header.className = 'settings-header';
      box.insertBefore(header, box.firstChild); header.appendChild(title);
      var button = document.createElement('button'); button.type = 'button'; button.className = 'settings-back';
      // The hardware Back key is always available; keep the existing D-pad list order.
      button.tabIndex = -1; button.setAttribute('data-settings-back', 'true'); button.textContent = '‹  ' + tr('Back'); button.onclick = back;
      header.appendChild(button);
    }
    var rows = box.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) {
      var toggle = rows[i].querySelector('.toggle');
      rows[i].setAttribute('role', toggle ? 'switch' : 'button');
      if (toggle) rows[i].setAttribute('aria-checked', has(toggle, 'on') ? 'true' : 'false');
    }
    if (!sheet._settingsFocusBound) {
      sheet._settingsFocusBound = true;
      sheet.addEventListener('focus', function () { setTimeout(function () { var stage = document.getElementById('stage'); if (stage) stage.scrollTop = stage.scrollLeft = 0; }, 0); }, true);
    }
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    if (title) sheet.setAttribute('aria-label', title.textContent);
  }
  return {decorate: decorate, focus: focus};
}());
