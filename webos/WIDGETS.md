# Local customizable widget carousel

The bottom drawer contains a horizontally scrollable row of widgets. Press Down again from
its shortcuts to focus the row, then Left/Right to browse; Up/Back returns to the shortcuts.
Drag horizontally with the Magic Remote pointer or swipe on a touchscreen. Dragging suppresses
the resulting click so it cannot accidentally activate the Add tile. Vertical motion is left alone.

The final + tile opens Add widgets. Only missing widgets are listed. Select one to append it,
or Cancel/Back to leave the selection unchanged. Choices persist locally in fmtv.prefs.widgetOrder.
The catalogue includes Weather, Performance, Crypto, Clock and date, Sunrise and sunset.
Unknown/duplicate saved IDs are ignored. Existing weather/quotes/performance switches still apply;
adding a hidden widget enables the corresponding switch. Adding Crypto enables at least Bitcoin.
Weather and sun widgets share the selected city's data; the clock uses the TV's local time.

No publication or installation is part of these pending local changes.
Tests: node tools/test_widgets.js and bash tools/check.sh web.

## Reordering

Home Settings → Widget order opens the organizer. Up/Down chooses a widget; Left/Right moves it one position. Pointer users can use the visible arrow buttons. Apply order saves the left-to-right sequence, Cancel/Back discards the draft. The + card remains at the end. OK/click on an existing carousel widget opens the same organizer, returning focus to that widget after saving. Hidden widgets retain their saved order for later re-enabling.

## Size, view modes and removal

In the organizer, OK/click on a widget's name switches Full/Compact. Changes are drafts until Apply order. Full weather shows the forecast; compact weather shows current conditions. Compact performance shows FPS, stalls, CPU and RAM percentage; full mode retains JS memory, worst frame and RAM totals. Compact crypto omits daily change. Clock and sun cards use smaller natural dimensions even in full mode. Empty or sparse cards shrink to fit their data. View modes persist independently for every widget.

The × button removes a widget. Remote users select a widget and move Down to Remove selected widget. Apply saves removals; Cancel keeps the old set. Removed widgets are available again through +. Legacy Weather/Performance/Quotes toggles are kept in sync. Edge arrows show which side has off-screen content and support pointer navigation.
