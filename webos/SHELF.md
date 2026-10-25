# All-app horizontal shelf

Left/Right traverses every detected installed app that is not explicitly hidden in config.properties.
Eight tiles are visible at a time; the shelf scrolls to keep the focused app visible.

Settings → Shelf selects favorites with OK and reorders the selected app with Left/Right.
The numbered favorites are the exact left-to-right prefix. All other apps follow alphabetically,
labelled After favorites in the editor. Removing a favorite moves it after the favorites instead of
hiding it. An empty favorite selection still shows every installed app. Uninstalled and duplicate
favorite IDs are ignored. The All Apps drawer also includes favorites, so it still lists all apps.

Changes remain local until the user finishes the requested adjustments.
Validation: node tools/test_shelf_order.js and bash tools/check.sh web.
