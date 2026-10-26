/* Small catalogue: new widgets can be registered without changing the picker. */
var WidgetCatalog = (function () {
  'use strict';
  var ids = ['weather', 'performance', 'prices', 'clock', 'sun'];
  function order(saved) {
    if (!Array.isArray(saved)) return ids.slice(0, 3);
    return saved.filter(function (id, index) { return ids.indexOf(id) >= 0 && saved.indexOf(id) === index; });
  }
  function title(id) {
    switch (id) {
      case 'weather': return tr('Weather');
      case 'performance': return tr('Performance');
      case 'prices': return tr('Crypto');
      case 'clock': return tr('Clock and date');
      case 'sun': return tr('Sunrise and sunset');
    }
    return '';
  }
  function modes(saved) {
    var out = {};
    for (var i = 0; i < ids.length; i++) if (saved && saved[ids[i]] === 'compact') out[ids[i]] = 'compact';
    return out;
  }
  function layout(id, mode, content) {
    var compact = mode === 'compact', c = content || {}, width = 460, height = 260;
    if (id === 'weather') {
      width = compact ? 340 : c.weather && c.forecast ? 1000 : c.sun ? 650 : 400;
      height = !c.weather ? 180 : compact ? 220 : 300;
    } else if (id === 'performance') { width = compact ? 400 : 728; height = compact ? 220 : 300; }
    else if (id === 'prices') { width = compact ? 400 : 728; height = Math.min(300, 100 + (compact ? 44 : 52) * Math.max(1, Math.min(4, c.coins || 0))); }
    else if (id === 'clock') { width = compact ? 300 : 460; height = compact ? 180 : 240; }
    else if (id === 'sun') { width = compact ? 340 : 460; height = !c.sun ? 180 : compact ? 200 : 260; }
    else if (id === 'add') { width = 240; height = 180; }
    return {width: width, height: height};
  }

  function move(saved, index, direction) {
    var out = order(saved), target = index + direction;
    if (index < 0 || index >= out.length || target < 0 || target >= out.length) return out;
    var value = out[index]; out[index] = out[target]; out[target] = value;
    return out;
  }
  return {layout: layout, modes: modes, move: move, ids: function () { return ids.slice(); }, order: order, title: title,
    available: function (selected) { return ids.filter(function (id) { return selected.indexOf(id) < 0; }); },
    edges: function (offset, total, viewport) { return {left: offset > 1, right: offset < Math.max(0, total - viewport) - 1}; },
    clamp: function (offset, total, viewport) { return Math.max(0, Math.min(Math.max(0, total - viewport), offset)); }};
}());

var WidgetPicker = (function () {
  'use strict';
  var sheet, buttons = [], current = 0, done = null;
  function node(tag, cls, text, parent) {
    var n = document.createElement(tag); n.className = cls;
    n.textContent = text; parent.appendChild(n); return n;
  }
  function focus(at) { current = Math.max(0, Math.min(buttons.length - 1, at)); SettingsUI.focus(buttons[current]); }
  function hide() {
    if (sheet) { sheet.className = 'layer sheet'; if (document.activeElement) document.activeElement.blur(); }
    done = null;
  }
  function finish() { var callback = done; hide(); if (callback) callback(); }
  function open(selected, pick, close) {
    if (!sheet) {
      sheet = document.createElement('div'); sheet.id = 'widgetpick';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      document.getElementById('stage').appendChild(sheet);
      sheet.onkeydown = function (e) {
        var k = e.keyCode; e.stopPropagation();
        if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); finish(); }
        else if (k === TV.keys.down || k === TV.keys.right) { e.preventDefault(); focus(current + 1); }
        else if (k === TV.keys.up || k === TV.keys.left) { e.preventDefault(); focus(current - 1); }
        else if (k === TV.keys.ok) { e.preventDefault(); buttons[current].click(); }
      };
    }
    done = close; buttons = []; sheet.innerHTML = ''; sheet.className = 'layer sheet open';
    sheet.setAttribute('aria-label', tr('Add widgets'));
    var box = node('div', 'box', '', sheet);
    node('div', 'title', tr('Add widgets'), box);
    node('div', 'widget-picker-hint', tr('Choose a widget to add to your carousel.'), box);
    var available = WidgetCatalog.available(selected), list = node('div', 'widget-options', '', box);
    if (!available.length) node('div', 'widget-picker-empty', tr('All available widgets are already added.'), list);
    available.forEach(function (id) {
      var button = node('button', 'widget-option', '+  ' + WidgetCatalog.title(id), list);
      button.type = 'button'; button.onfocus = function () { current = buttons.indexOf(button); };
      button.onclick = function () { pick(id); finish(); };
      buttons.push(button);
    });
    var cancel = node('button', 'widget-picker-cancel', tr('Cancel'), box);
    cancel.type = 'button'; cancel.onclick = finish;
    cancel.onfocus = function () { current = buttons.indexOf(cancel); };
    buttons.push(cancel); SettingsUI.decorate(sheet, finish); focus(0);
  }
  return {open: open, hide: hide};
}());

/* Change left-to-right order with the remote or the visible arrow buttons. */
var WidgetOrganizer = (function () {
  'use strict';
  var sheet, draft, draftModes, selectedIndex = 0, current = 0, buttons = [], save, closed;
  function node(tag, text, parent) {
    var n = document.createElement(tag); n.textContent = text; parent.appendChild(n); return n;
  }
  function focus(at) {
    current = Math.max(0, Math.min(buttons.length - 1, at));
    while (buttons[current].disabled && current < buttons.length - 1) current++;
    SettingsUI.focus(buttons[current]);
  }
  function hide() {
    if (sheet) { sheet.className = 'layer sheet'; if (document.activeElement) document.activeElement.blur(); }
    closed = null; save = null;
  }
  function finish(apply) {
    var callback = closed;
    if (apply && save) save(draft.slice(), WidgetCatalog.modes(draftModes));
    hide(); if (callback) callback();
  }
  function move(index, direction) {
    var target = index + direction;
    if (target < 0 || target >= draft.length) return;
    draft = WidgetCatalog.move(draft, index, direction);
    render(target);
  }
  function render(at) {
    sheet.innerHTML = ''; buttons = [];
    var box = node('div', '', sheet); box.className = 'box';
    node('div', tr('Widget order'), box).className = 'title';
    node('div', tr('Up/Down selects. Left/Right moves. OK switches Full/Compact. × removes.'), box).className = 'widget-picker-hint';
    var list = node('div', '', box); list.className = 'widget-order-list';
    if (!draft.length) node('div', tr('No widgets to arrange.'), list);
    for (var i = 0; i < draft.length; i++) {
      (function (index) {
        var row = node('div', '', list); row.className = 'widget-order-row';
        var name = node('button', (index + 1) + '. ' + WidgetCatalog.title(draft[index]) + ' · ' + (draftModes[draft[index]] === 'compact' ? tr('Compact view') : tr('Full view')), row); name.type = 'button';
        name.onfocus = function () { current = index; selectedIndex = index; };
        name.onclick = function () {
          var id = draft[index];
          if (draftModes[id] === 'compact') delete draftModes[id]; else draftModes[id] = 'compact';
          render(index);
        };
        buttons.push(name);
        var left = node('button', '‹', row), right = node('button', '›', row);
        left.type = right.type = 'button';
        left.setAttribute('aria-label', tr('Move left')); right.setAttribute('aria-label', tr('Move right'));
        left.disabled = index === 0; right.disabled = index === draft.length - 1;
        left.onclick = function () { move(index, -1); }; right.onclick = function () { move(index, 1); };
        left.onfocus = right.onfocus = function () { current = index; };
        var remove = node('button', '×', row); remove.type = 'button'; remove.className = 'widget-remove';
        remove.setAttribute('aria-label', trf('Remove {widget}', {widget: WidgetCatalog.title(draft[index])}));
        remove.onclick = function () { draft.splice(index, 1); render(Math.min(index, Math.max(0, draft.length - 1))); };
        remove.onfocus = function () { current = index; };

      })(i);
    }
    var removeSelected = node('button', tr('Remove selected widget'), box); removeSelected.type = 'button';
    removeSelected.disabled = !draft.length;
    removeSelected.onclick = function () { if (draft.length) { draft.splice(selectedIndex, 1); render(Math.max(0, Math.min(selectedIndex, draft.length - 1))); } };
    removeSelected.onfocus = function () { current = draft.length; }; buttons.push(removeSelected);
    var apply = node('button', tr('Apply order'), box); apply.type = 'button'; apply.onclick = function () { finish(true); };
    apply.onfocus = function () { current = draft.length + 1; }; buttons.push(apply);
    var cancel = node('button', tr('Cancel'), box); cancel.type = 'button'; cancel.onclick = function () { finish(false); };
    cancel.onfocus = function () { current = draft.length + 2; }; buttons.push(cancel);
    SettingsUI.decorate(sheet, function () { finish(false); });
    focus(at || 0);
    setTimeout(function () { if (closed) focus(at || 0); }, 0);
  }
  function open(selected, initial, onSave, onClose, modes) {
    if (!sheet) {
      sheet = document.createElement('div'); sheet.id = 'widgetorder';
      sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      document.getElementById('stage').appendChild(sheet);
      sheet.onkeydown = function (e) {
        var k = e.keyCode; e.stopPropagation();
        if (k === TV.keys.back || k === 27 || k === 8) { e.preventDefault(); finish(false); }
        else if (k === TV.keys.up || k === TV.keys.down) { e.preventDefault(); focus(current + (k === TV.keys.down ? 1 : -1)); }
        else if (k === TV.keys.left || k === TV.keys.right) { e.preventDefault(); if (current < draft.length) move(current, k === TV.keys.right ? 1 : -1); }
        else if (k === TV.keys.ok) { e.preventDefault(); buttons[current].click(); }
      };
    }
    draft = WidgetCatalog.order(selected); draftModes = WidgetCatalog.modes(modes); save = onSave; closed = onClose;
    sheet.className = 'layer sheet open'; sheet.setAttribute('aria-label', tr('Widget order'));
    render(Math.min(initial || 0, Math.max(0, draft.length - 1)));
  }
  return {open: open, hide: hide};
}());
