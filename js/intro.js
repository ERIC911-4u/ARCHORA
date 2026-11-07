// js/intro.js — intro video (max 16s). Plays on first visit and when the "Intro" tab is clicked.
(function () {
  var overlay = document.getElementById('intro-overlay');
  var video = document.getElementById('intro-video');
  var skip = document.getElementById('intro-skip');
  if (!overlay || !video) return;

  var PLAY_ONCE_PER_SESSION = true; // false = auto-play on every page load
  var MAX_SECONDS = 16;
  var timer = null, playing = false;

  function finish() {
    if (!playing) return; playing = false;
    clearTimeout(timer);
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    overlay.classList.add('is-hiding');
    document.body.classList.remove('intro-active');
    setTimeout(function () { if (!playing) { video.pause(); overlay.hidden = true; } }, 850);
  }

  function play(withSound) {
    playing = true;
    overlay.hidden = false;
    void overlay.offsetWidth;
    overlay.classList.remove('is-hiding');
    document.body.classList.add('intro-active');
    video.muted = !withSound;      // sound only allowed after a user click
    video.currentTime = 0;
    clearTimeout(timer);
    timer = setTimeout(finish, MAX_SECONDS * 1000 + 500);
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      if (withSound) { video.muted = true; video.play().catch(finish); } else finish();
    });
  }

  video.addEventListener('ended', finish);
  video.addEventListener('error', finish);
  var srcEl = video.querySelector('source');
  if (srcEl) srcEl.addEventListener('error', finish); // <source> errors don't bubble to <video>
  skip.addEventListener('click', finish);
  document.querySelectorAll('[data-intro-trigger]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.body.classList.remove('nav-open');
      play(true);
    });
  });

  var seen = false;
  try { seen = PLAY_ONCE_PER_SESSION && !!sessionStorage.getItem('introSeen'); } catch (e) {}
  if (seen) overlay.hidden = true; else play(false);
})();
