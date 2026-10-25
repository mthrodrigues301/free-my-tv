# Weather city selection

Home Settings → Weather city opens a search dialog. Type a name using the TV keyboard,
press Search cities, then choose the matching city/state/country. The selected coordinates
and label are stored locally in fmtv.prefs.weatherCity. Updates do not override the choice.
Use default city clears this preference and restores config.properties (or the time-zone fallback).
Cancel/Back leaves the current city unchanged. The field supports backspace while typing.

Geocoding uses Open-Meteo / GeoNames over HTTPS, without an API key. Only submitted search text
and the language are sent to the search service. Weather requests use the selected coordinates.
No location detection permission is required. The city affects weather/sunset only, not the TMDB
region or currency. Switching cities clears the old forecast and ignores older pending replies.
Offline search shows an error and preserves the current selection. A saved choice survives offline restarts.

Validation: node tools/test_city.js; bash tools/check.sh web. Browser checks cover search, OK,
city/state/country results, restart persistence and restoring the configured default.
