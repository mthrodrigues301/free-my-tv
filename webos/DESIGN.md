# TV component pattern

Use rounded surfaces and a calm hierarchy inspired by Apple TV. Keep text large enough for viewing from a sofa. Use 8/16/24/32 px spacing, 14 px control corners and 28 px dialog corners. A blue focus ring identifies the current action; avoid a black rim around an entire group.

Settings and editing dialogs use a naturally darker surface, independently of the more transparent application shelf. Keep grouped settings short and support Back to return to the parent category. Every action must be reachable with directional keys and OK.

Use ES5 and old-TV CSS. Avoid backdrop filters, layout animation, unbounded image loads and continuous work in hidden views. Load poster/backdrop sizes for their actual display area. Animate only transform and opacity; show loading placeholders while data or artwork arrives.
