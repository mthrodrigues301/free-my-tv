# TV component pattern

Use rounded surfaces and a calm hierarchy inspired by Apple TV. Keep text large enough for viewing from a sofa. Use 8/16/24/32 px spacing, 14 px control corners and 28 px dialog corners. A blue focus ring identifies the current action; avoid a black rim around an entire group.

Settings and editing dialogs use a naturally darker surface, independently of the more transparent application shelf. Keep grouped settings short and support Back to return to the parent category. Every action must be reachable with directional keys and OK.

Use ES5 and old-TV CSS. Avoid backdrop filters, layout animation, unbounded image loads and continuous work in hidden views. Load poster/backdrop sizes for their actual display area. Animate only transform and opacity; show loading placeholders while data or artwork arrives.

## Settings components

`web/settings-ui.js` and `web/settings-ui.css` own all configuration dialogs: Home Settings, language, shelf, city, recommendation filters, widget picker, widget organizer and custom message. Call `SettingsUI.decorate(sheet, back)` after rendering the panel, and use `SettingsUI.focus(control)` for native focus. Keep feature-specific layout separate from shared colors, dimensions, typography and focus rules.

Use the shared 1120 px shell at x=400, y=88, a title and Back header, 70 px controls with 8 px spacing, 16 px control corners, 28 px shell corners, and a blue focus ring. Settings retain at least 88% opacity for legibility independently of shelf transparency. Variable content scrolls inside its list; focusing a control must never scroll the 1920x1080 stage. Preserve each feature's existing apply/cancel behavior.

## Music and voice (1.8.0)

The music source picker lives inside the content region below the main tabs. YouTube search uses the official Data API, with a key held only in session memory. Never persist it or include it in a build. The same iframe remains attached to the stage while switching tabs: only its container changes between the main player and visible miniplayer. Pause video when the app is hidden or its screensaver begins. Explicitly closing the player releases its iframe.

Spotify playback and track search are a local preview prototype. The local helper `tools/spotify_local.py` (kept outside the published changes) reads `SPOTIFY_ACCESS_TOKEN` from the process environment, binds only to loopback and permits the preview origin. It is not a Spotify authorization solution for packaged TVs.

Visible tabs retain stable IDs independent of their displayed positions. Persist the selection and keep at least one tab enabled. Voice search uses browser speech recognition when available. On webOS, focus the native input so the TV keyboard can provide dictation; remote microphone behavior requires validation on the actual device.
