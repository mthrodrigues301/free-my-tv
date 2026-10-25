/* Persistent recommendation rules shared by the catalogue, cache and details. */
var RecommendationFilters = (function () {
  'use strict';
  function ids(value) {
    var out = [];
    for (var i = 0; Array.isArray(value) && i < value.length; i++) {
      var n = Number(value[i]);
      if (isFinite(n) && n > 0 && n % 1 === 0 && out.indexOf(n) < 0) out.push(n);
    }
    return out.sort(function (a, b) { return a - b; });
  }
  function normalize(value) {
    var v = value && typeof value === 'object' ? value : {}, providers = null;
    if (Array.isArray(v.providers)) {
      providers = [];
      for (var i = 0; i < v.providers.length; i++) {
        if (typeof v.providers[i] === 'string' && /^[a-z]+$/.test(v.providers[i]) && providers.indexOf(v.providers[i]) < 0) providers.push(v.providers[i]);
      }
      providers.sort();
    }
    return {movie: ids(v.movie), tv: ids(v.tv), anime: v.anime !== false, providers: providers};
  }
  function provider(key, f) { return f.providers === null || f.providers.indexOf(key) >= 0; }
  function matches(p, f) {
    var genres = f[p.kind] || [], got = p.genreIds || [], match = !genres.length;
    for (var i = 0; i < genres.length; i++) if (got.indexOf(genres[i]) >= 0) match = true;
    return match && (f.anime || p.anime === false) && (!p.detailed || (!!p.app && provider(p.app, f)));
  }
  function anime(o) {
    var k = o.keywords, list = k && (k.keywords || k.results) || [];
    for (var i = 0; i < list.length; i++) if ((list[i].name || '').toLowerCase() === 'anime') return true;
    // TMDB keyword tagging can be incomplete: include Japanese animation as well.
    var animation = false, japan = o.original_language === 'ja', genres = o.genres || [];
    for (i = 0; i < genres.length; i++) if (genres[i].id === 16) animation = true;
    for (i = 0; o.origin_country && i < o.origin_country.length; i++) if (o.origin_country[i] === 'JP') japan = true;
    for (i = 0; o.production_countries && i < o.production_countries.length; i++) if (o.production_countries[i].iso_3166_1 === 'JP') japan = true;
    return animation && japan;
  }
  return {normalize: normalize, provider: provider, matches: matches, anime: anime};
}());
