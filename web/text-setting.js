/* Native text entry keeps the TV's on-screen keyboard available. */
var TextSetting = (function () {
  'use strict';
  var sheet, done;
  function hide() { if (sheet) sheet.className = 'sheet'; done = null; }
  function open(title, value, save, close) {
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'text-setting'; document.getElementById('stage').appendChild(sheet); }
    sheet.className = 'sheet open'; sheet.innerHTML = '';
    var box = document.createElement('div'); box.className = 'box'; sheet.appendChild(box);
    var h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    var input = document.createElement('input'); input.type = 'text'; input.maxLength = 140; input.value = value; input.setAttribute('aria-label', title); box.appendChild(input);
    done = function () { hide(); close(); };
    var buttons = [];
    [tr('Save'), tr('Cancel')].forEach(function (label, i) { var b = document.createElement('button'); b.textContent = label; b.onclick = function () { if (!i) save(input.value); var callback = done; if (callback) callback(); }; box.appendChild(b); buttons.push(b); });
    sheet.onkeydown = function (e) { var k = e.keyCode; e.stopPropagation(); if (k === TV.keys.back || k === 27) { e.preventDefault(); var callback = done; if (callback) callback(); } else if (k === TV.keys.down) { e.preventDefault(); buttons[0].focus(); } else if (k === TV.keys.up) { e.preventDefault(); input.focus(); } else if (e.target !== input && (k === TV.keys.left || k === TV.keys.right)) { e.preventDefault(); buttons[k === TV.keys.right ? 1 : 0].focus(); } else if (k === TV.keys.ok && e.target === input) { e.preventDefault(); buttons[0].focus(); } };
    input.focus();
  }
  return {open: open, hide: hide};
}());
