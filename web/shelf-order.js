/* Favorites define the left-to-right prefix; every other installed app follows. */
var ShelfOrder = (function () {
  'use strict';
  function arrange(apps, chosen) {
    var unique = [], ids = [], pinned = [];
    apps.forEach(function (app) {
      if (app && app.id && ids.indexOf(app.id) < 0) { unique.push(app); ids.push(app.id); }
    });
    (Array.isArray(chosen) ? chosen : []).forEach(function (id) {
      var i = ids.indexOf(id);
      if (i >= 0 && pinned.indexOf(unique[i]) < 0) pinned.push(unique[i]);
    });
    var remaining = unique.filter(function (app) { return pinned.indexOf(app) < 0; });
    remaining.sort(function (a, b) {
      var left = (a.title || a.id).toLowerCase(), right = (b.title || b.id).toLowerCase();
      if (left === right) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      return left < right ? -1 : 1;
    });
    return {pinned: pinned, all: pinned.concat(remaining)};
  }
  return {arrange: arrange};
}());
