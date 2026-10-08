"use strict";
renderHome(); showScreen("home");
let last = performance.now();
(function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === "play" && !paused) update(dt); else padMenu(dt);
  draw();
  syncUi();
  requestAnimationFrame(loop);
})(last);
