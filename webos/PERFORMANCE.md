# Performance panel (custom fork)

The panel starts enabled. Home Settings → Performance panel toggles it and saves the choice.
It pauses sampling while the app is hidden. The overlay hides over the screensaver.

- **FPS (UI)**: requestAnimationFrame callback cadence, an estimate of interface responsiveness;
  not GPU presentation rate, video FPS or performance inside other apps.
- **Stalls >100 ms**: visible callback gaps over 100 ms, counted during this app session.
  A resumed/hidden period is excluded. This counts delayed frames, not crashes or a diagnosis of their cause.
- **Worst frame**: longest measured callback interval in this session.
- **JavaScript memory**: performance.memory.usedJSHeapSize when supported. This is the JS heap only,
  not total app RAM, and may be approximate. Otherwise shown as Unavailable.
- **CPU (TV total)**: aggregate busy tick percentage between samples from /proc/stat, excluding idle
  and I/O wait. First sample has no percentage. This is the whole TV, not the app's CPU usage.
- **RAM (TV total)**: MemTotal minus MemAvailable from /proc/meminfo, alongside total memory.
  Includes OS and other apps; reclaimable cache is treated as available. Values use MiB (1024² bytes).

The bundled io.freemytv.metrics JS service only reads two fixed /proc files asynchronously. It has no
network endpoint, shell execution, write method or user-supplied file paths. Sampling is every 3 seconds
while enabled and visible. The monitor itself consumes some CPU/RAM and can affect performance.
If a firmware denies the service or counters, the corresponding fields show Unavailable.
On Samsung/desktop, CPU and system RAM are unavailable because the webOS service is absent.

Build and install as described in the main README. The Python webOS packager includes the JS service.
Personal config.properties (including TMDB keys) and generated packages must remain out of Git.

Validation: `node tools/test_metrics.js` and `bash tools/check.sh web`.
