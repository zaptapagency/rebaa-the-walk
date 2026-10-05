/* ============================================================
   Rebaa — The Walk  ·  scroll choreography
   - Preloader until media is buffered
   - Top scroll-progress line + chapter rail
   - SCROLL-SCRUBBED video: each clip's playhead is tied to the
     scroll position through its section (frames advance as you
     scroll), not autoplay.
   - Parallax push-in + text reveal preserved
   - Respects prefers-reduced-motion
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- Preloader ---------- */
  var preloader = document.getElementById("preloader");
  var pFill = document.getElementById("preloaderFill");
  var pct = 0;
  var tick = setInterval(function () {
    pct = Math.min(96, pct + Math.random() * 16);
    if (pFill) pFill.style.width = pct + "%";
  }, 120);
  function hidePreloader() {
    if (!preloader || preloader.classList.contains("is-done")) return;
    clearInterval(tick);
    if (pFill) pFill.style.width = "100%";
    setTimeout(function () { preloader.classList.add("is-done"); }, 300);
  }

  /* ---------- Scrub targets ---------- */
  // Each: the scroll section, its media wrapper, its text, the video, duration.
  var targets = [];
  function register(sectionId, mediaSel, textSel, isHero) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    var video = sec.querySelector("video[data-scrub]");
    targets.push({
      sec: sec,
      media: sec.querySelector(mediaSel),
      text: textSel ? sec.querySelector(textSel) : null,
      content: isHero ? sec.querySelector(".hero__content") : null,
      video: video,
      dur: 0,
      isHero: !!isHero,
      ready: false,
      seekTo: -1
    });
  }
  register("hero", ".hero__media", null, true);
  register("araya", "[data-media]", "[data-text]", false);
  register("rosevilla", "[data-media]", "[data-text]", false);
  register("nayan", "[data-media]", "[data-text]", false);

  // Wire up durations + readiness; prime the first frame.
  var needed = targets.filter(function (t) { return t.video; }).length || 1;
  var readyCount = 0;
  targets.forEach(function (t) {
    if (!t.video) return;
    var onMeta = function () {
      if (t.dur) return;
      t.dur = t.video.duration || 0;
      t.ready = t.dur > 0;
      // Prime a frame so the poster swaps to live video.
      try { t.video.currentTime = 0.001; } catch (e) {}
      if (++readyCount >= needed) hidePreloader();
    };
    if (t.video.readyState >= 1 && t.video.duration) onMeta();
    else t.video.addEventListener("loadedmetadata", onMeta, { once: true });
    // nudge buffering
    try { t.video.load(); } catch (e) {}
  });

  // Hero autoplays (not scrubbed): keep it alive, pause when off-screen.
  var heroVid = document.getElementById("heroVid");
  if (heroVid) {
    var tryPlay = function () { var p = heroVid.play(); if (p && p.catch) p.catch(function () {}); };
    tryPlay();
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) tryPlay();
        else { try { heroVid.pause(); } catch (err) {} }
      });
    }, { threshold: 0.05 }).observe(heroVid);
  }

  // Never trap the user behind the loader.
  window.addEventListener("load", function () { setTimeout(hidePreloader, 900); });
  setTimeout(hidePreloader, 3500);

  /* ---------- Ambient backdrops (intro / end): lazy, play when visible ---------- */
  var ambVids = Array.prototype.slice.call(document.querySelectorAll("video[data-amb]"));
  var ambObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (!v.dataset.loaded) {
          v.dataset.loaded = "1";
          var s = document.createElement("source");
          s.src = v.dataset.amb; s.type = "video/mp4";
          v.appendChild(s); v.load();
        }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } else {
        try { v.pause(); } catch (err) {}
      }
    });
  }, { threshold: 0.05 });
  ambVids.forEach(function (v) { ambObserver.observe(v); });

  /* ---------- Chapter rail active state ---------- */
  var railItems = Array.prototype.slice.call(document.querySelectorAll(".rail__item"));
  var railSections = ["hero", "araya", "rosevilla", "nayan", "end"].map(function (id) {
    return document.getElementById(id);
  });
  function setActive(i) {
    railItems.forEach(function (it) { it.classList.toggle("is-active", +it.dataset.i === i); });
  }
  var railObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        var idx = railSections.indexOf(e.target);
        if (idx !== -1) setActive(idx);
      }
    });
  }, { threshold: 0.5, rootMargin: "-10% 0px -40% 0px" });
  railSections.forEach(function (s) { if (s) railObserver.observe(s); });

  /* ---------- Smooth scroll (Lenis) ---------- */
  var progressFill = document.getElementById("progressFill");
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return 1 - Math.pow(1 - t, 3); }, // easeOutCubic
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.3,
      syncTouch: false
    });
  }

  function applyScrub(t, p) {
    if (!t.video || !t.ready) return;
    var want = clamp(p, 0, 1) * (t.dur - 0.05);
    if (Math.abs(want - t.seekTo) < 0.02) return;        // ignore micro moves
    t.seekTo = want;
    if (t.video.readyState >= 2 && !t.video.seeking) {   // don't queue seeks
      try {
        if (t.video.fastSeek) t.video.fastSeek(want);    // smooth, non-blocking (all-keyframe clips)
        else t.video.currentTime = want;
      } catch (e) {}
    }
  }

  function render() {
    var sy = lenis ? lenis.scroll : window.scrollY;
    var vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    if (progressFill) progressFill.style.width = clamp(sy / (docH || 1), 0, 1) * 100 + "%";

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var top = t.sec.offsetTop;
      var range = t.isHero ? vh : (t.sec.offsetHeight - vh);
      var p = clamp((sy - top) / (range || 1), 0, 1);

      var near = (sy + vh) > top - vh && sy < top + t.sec.offsetHeight + vh;
      if (near) applyScrub(t, p);

      if (t.isHero) {
        if (t.media && !reduce) t.media.style.transform = "scale(" + (1.06 + p * 0.1) + ") translateY(" + p * 5 + "%)";
        if (t.content) {
          t.content.style.transform = "translateY(" + p * -40 + "px)";
          t.content.style.opacity = String(clamp(1 - p * 1.35, 0, 1));
        }
      } else {
        if (t.media && !reduce) t.media.style.transform = "scale(" + (1.12 - p * 0.12) + ")";
        if (t.text) {
          var inA = clamp(p / 0.24, 0, 1);
          var outA = 1 - clamp((p - 0.84) / 0.16, 0, 1);
          var a = Math.min(inA, outA);
          if (reduce) { t.text.style.opacity = "1"; t.text.style.transform = "none"; }
          else {
            t.text.style.opacity = String(a);
            t.text.style.transform = "translateY(" + ((1 - inA) * 44 - (1 - outA) * 34) + "px)";
          }
        }
      }
    }
  }

  function raf(time) {
    if (lenis) lenis.raf(time);
    render();
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  /* ---------- Anchor scrolling ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.3 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
  });
})();
