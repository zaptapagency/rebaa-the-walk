/* ============================================================
   Rebaa — single-project page engine
   Preloader · Lenis smooth scroll · hero video autoplay ·
   sprite-sheet scrub walkthrough · parallax · reveal-on-scroll
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* Preloader */
  var pre = document.getElementById("preloader");
  var pf = document.getElementById("preloaderFill");
  var pct = 0;
  var tick = setInterval(function () { pct = Math.min(96, pct + Math.random() * 16); if (pf) pf.style.width = pct + "%"; }, 120);
  function hide() {
    if (!pre || pre.classList.contains("is-done")) return;
    clearInterval(tick); if (pf) pf.style.width = "100%";
    setTimeout(function () { pre.classList.add("is-done"); }, 300);
  }
  window.addEventListener("load", function () { setTimeout(hide, 600); });
  setTimeout(hide, 3000);

  /* Hero video autoplay */
  var hv = document.getElementById("heroVid");
  if (hv) {
    var play = function () { var p = hv.play(); if (p && p.catch) p.catch(function () {}); };
    play();
    new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) play(); }); }, { threshold: 0.05 }).observe(hv);
  }

  /* Sprite-sheet scrub */
  var FW = 1024, FH = 572, scrub = null;
  (function () {
    var c = document.querySelector("canvas[data-sheet]");
    if (!c) return;
    var sec = c.closest("[data-scrub-sec]");
    scrub = {
      sec: sec, media: sec.querySelector("[data-media]"), canvas: c,
      ctx: c.getContext("2d", { alpha: false }),
      src: c.getAttribute("data-sheet"), cols: +c.getAttribute("data-cols"),
      count: +c.getAttribute("data-count"), img: null, loaded: false, loading: false, drawn: -1
    };
    c.width = FW; c.height = FH;
    var poster = new Image();
    poster.onload = function () { if (!scrub.loaded && scrub.drawn < 0) scrub.ctx.drawImage(poster, 0, 0, FW, FH); };
    poster.src = c.getAttribute("data-poster");
    loadSheet();
  })();
  function loadSheet() {
    if (!scrub || scrub.loaded || scrub.loading) return;
    scrub.loading = true;
    var im = new Image();
    im.onload = function () { scrub.img = im; scrub.loaded = true; scrub.loading = false; };
    im.onerror = function () { scrub.loading = false; };
    im.src = scrub.src;
  }
  function drawCell(idx) {
    if (!scrub || !scrub.loaded) return;
    var sx = (idx % scrub.cols) * FW, sy = Math.floor(idx / scrub.cols) * FH;
    scrub.ctx.drawImage(scrub.img, sx, sy, FW, FH, 0, 0, FW, FH);
    scrub.drawn = idx;
  }

  /* Reveal-on-scroll */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.2 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* Lenis + render loop */
  var pfill = document.getElementById("progressFill");
  var heroMedia = document.querySelector(".p-hero__media");
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return 1 - Math.pow(1 - t, 3); }, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  }
  function render() {
    var sy = lenis ? lenis.scroll : window.scrollY;
    var vh = window.innerHeight;
    var docH = document.documentElement.scrollHeight - vh;
    if (pfill) pfill.style.width = clamp(sy / (docH || 1), 0, 1) * 100 + "%";
    if (heroMedia && !reduce) { var hp = clamp(sy / vh, 0, 1); heroMedia.style.transform = "scale(" + (1.06 + hp * 0.1) + ")"; }
    if (scrub) {
      var top = scrub.sec.offsetTop, range = scrub.sec.offsetHeight - vh;
      var p = clamp((sy - top) / (range || 1), 0, 1);
      var near = (sy + vh * 1.5) > top && sy < top + scrub.sec.offsetHeight + vh;
      if (near) loadSheet();
      var idx = Math.round(p * (scrub.count - 1));
      if (idx !== scrub.drawn) drawCell(idx);
      if (scrub.media && !reduce) scrub.media.style.transform = "scale(" + (1.12 - p * 0.12) + ")";
    }
  }
  function raf(t) { if (lenis) lenis.raf(t); render(); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  /* Smooth anchors */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (ev) {
      var el = document.getElementById(a.getAttribute("href").slice(1));
      if (!el) return;
      ev.preventDefault();
      if (lenis) lenis.scrollTo(el, { duration: 1.2 });
      else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });
})();
