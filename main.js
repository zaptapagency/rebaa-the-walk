/* ============================================================
   Rebaa — The Walk  ·  scroll choreography
   - Preloader until first media is ready
   - Top scroll-progress line + chapter rail
   - FRAME-SEQUENCE SCRUB: chapters are decoded JPEG frames drawn
     to a <canvas>, indexed by scroll position. No video seeking,
     so scrubbing is perfectly smooth and never sticks.
   - Hero + intro/closing use autoplaying video (ambient)
   - Lenis smooth scroll · parallax · text reveal
   - Respects prefers-reduced-motion
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  window.addEventListener("load", function () { setTimeout(hidePreloader, 700); });
  setTimeout(hidePreloader, 3200);

  var FW = 1024, FH = 572; // frame intrinsic size

  /* ---------- Build targets (hero + 3 frame-scrubbed chapters) ---------- */
  var targets = [];

  // hero (autoplay video, parallax only)
  (function () {
    var sec = document.getElementById("hero");
    if (sec) targets.push({
      isHero: true, sec: sec,
      media: sec.querySelector(".hero__media"),
      content: sec.querySelector(".hero__content")
    });
  })();

  // chapters (canvas scrub from a single sprite sheet — one request each)
  ["araya", "rosevilla", "nayan"].forEach(function (id) {
    var sec = document.getElementById(id);
    if (!sec) return;
    var canvas = sec.querySelector("canvas[data-sheet]");
    var fs = {
      isHero: false, sec: sec,
      media: sec.querySelector("[data-media]"),
      text: sec.querySelector("[data-text]"),
      canvas: canvas,
      ctx: canvas ? canvas.getContext("2d", { alpha: false }) : null,
      sheetSrc: canvas ? canvas.getAttribute("data-sheet") : null,
      cols: canvas ? parseInt(canvas.getAttribute("data-cols"), 10) : 1,
      count: canvas ? parseInt(canvas.getAttribute("data-count"), 10) : 0,
      img: null, loaded: false, loading: false, drawn: -1
    };
    if (canvas) { canvas.width = FW; canvas.height = FH; }
    // draw poster immediately as a placeholder
    if (fs.ctx) {
      var poster = new Image();
      poster.onload = function () { if (!fs.loaded && fs.drawn < 0) fs.ctx.drawImage(poster, 0, 0, FW, FH); };
      poster.src = canvas.getAttribute("data-poster");
    }
    targets.push(fs);
  });

  // One sprite sheet per chapter → one request, no HTTP/2 flooding.
  function loadSheet(fs) {
    if (fs.loaded || fs.loading || !fs.sheetSrc) return;
    fs.loading = true;
    var im = new Image();
    im.onload = function () { fs.img = im; fs.loaded = true; fs.loading = false; };
    im.onerror = function () { fs.loading = false; };
    im.src = fs.sheetSrc;
  }
  function releaseSheet(fs) {
    if (!fs.loaded) return;         // free the large decoded sheet when far away
    fs.img = null; fs.loaded = false; fs.drawn = -1;
  }
  function drawCell(fs, idx) {
    if (!fs.ctx || !fs.loaded) return;
    var sx = (idx % fs.cols) * FW;
    var sy = Math.floor(idx / fs.cols) * FH;
    fs.ctx.drawImage(fs.img, sx, sy, FW, FH, 0, 0, FW, FH);
    fs.drawn = idx;
  }

  // Preload the first chapter's sheet so the hero → chapter hand-off is seamless.
  setTimeout(function () {
    var first = targets.filter(function (t) { return !t.isHero; })[0];
    if (first) loadSheet(first);
  }, 900);

  /* ---------- Hero video (autoplay, pause off-screen) ---------- */
  var heroVid = document.getElementById("heroVid");
  if (heroVid) {
    var tryPlay = function () { var p = heroVid.play(); if (p && p.catch) p.catch(function () {}); };
    tryPlay();
    // Keep the hero clip playing (it's tiny) rather than pausing off-screen,
    // which would abort/re-request its range and log console errors.
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) tryPlay(); });
    }, { threshold: 0.05 }).observe(heroVid);
  }

  /* ---------- Ambient backdrops (intro / closing) ---------- */
  Array.prototype.slice.call(document.querySelectorAll("video[data-amb]")).forEach(function (v) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (!v.dataset.loaded) {
            v.dataset.loaded = "1";
            var s = document.createElement("source");
            s.src = v.dataset.amb; s.type = "video/mp4";
            v.appendChild(s); v.load();
          }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else { try { v.pause(); } catch (err) {} }
      });
    }, { threshold: 0.05 }).observe(v);
  });

  /* ---------- Chapter rail (scroll-based active state) ---------- */
  var railItems = Array.prototype.slice.call(document.querySelectorAll(".rail__item"));
  var railIds = ["hero", "araya", "rosevilla", "nayan", "end"];
  var activeRail = -1;
  function setActive(i) {
    if (i === activeRail) return;
    activeRail = i;
    railItems.forEach(function (it) { it.classList.toggle("is-active", +it.dataset.i === i); });
  }

  /* ---------- Lenis smooth scroll ---------- */
  var progressFill = document.getElementById("progressFill");
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return 1 - Math.pow(1 - t, 3); },
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.3,
      syncTouch: false
    });
  }

  function render() {
    var sy = lenis ? lenis.scroll : window.scrollY;
    var vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    if (progressFill) progressFill.style.width = clamp(sy / (docH || 1), 0, 1) * 100 + "%";

    var mid = sy + vh * 0.5, railPick = 0;

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      var top = t.sec.offsetTop;
      var h = t.sec.offsetHeight;
      var range = t.isHero ? vh : (h - vh);
      var p = clamp((sy - top) / (range || 1), 0, 1);

      if (mid >= top) railPick = (t.isHero ? 0 : (t.sec.id === "araya" ? 1 : t.sec.id === "rosevilla" ? 2 : 3));

      if (t.isHero) {
        if (t.media && !reduce) t.media.style.transform = "scale(" + (1.06 + p * 0.1) + ") translateY(" + p * 5 + "%)";
        if (t.content) {
          t.content.style.transform = "translateY(" + p * -40 + "px)";
          t.content.style.opacity = String(clamp(1 - p * 1.35, 0, 1));
        }
      } else {
        var near = (sy + vh * 1.5) > top && sy < (top + h + vh * 0.5);
        if (near) loadSheet(t);
        else if (sy > top + h + vh || (sy + vh) < top - vh) releaseSheet(t); // free when far
        var idx = Math.round(p * (t.count - 1));
        if (idx !== t.drawn) drawCell(t, idx);

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

    // rail: last section whose top we've passed; "end" when near the bottom
    if (sy + vh >= docH - 4) railPick = 4;
    setActive(railPick);
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
