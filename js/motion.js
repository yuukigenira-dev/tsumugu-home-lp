/* =========================================================
   motion.js — みまもりの家LP：やさしいモーション（自作・依存は Lenis のみ）
   ① スクロール表示（IntersectionObserver）  ② 写真ワイプ  ③ Lenis スムーススクロール（デスクトップのホイール操作のみ）
   ※ FV の入場は CSS アニメーション（css/motion.css）。調整値は css/motion.css の :root と、下の CONFIG。
   ※ prefers-reduced-motion: reduce では何もせず全表示（.motion-off を付ける）。
   ========================================================= */
(() => {
  'use strict';
  const root = document.documentElement;
  const CONFIG = {
    staggerMs: 90,          // 同時に現れた要素の段差
    staggerMax: 360,        // 段差の上限
    rootMargin: '0px 0px -10% 0px',   // 画面下端の10%手前に入ったら表示
    lenis: { duration: 1.1, wheelMultiplier: 1, anchorDuration: 1.2 },
    lenisSrc: 'js/vendor/lenis.min.js',
  };
  // 表示する要素（FV内は対象外）。fade＝ぼかさず軽く
  const REVEAL = [
    '.eyebrow', '.h-serif', '.section-lead', '.info__feature', '.info__catch', '.sub-title',
    '.charm', '.kw li', '.merit-list li', '.benefit-list li', '.faq-list details', '.spec-card', '.spec-list', '.snow',
    '.shot__body', '.perk', '.note', '.cta-row', '.also', '.access__place', '.route', '.town li', '.map-placeholder',
    '.worldview figcaption', '.tel-line', '.footer__logo', '.footer address', '.footer__policy',
  ];
  const REVEAL_FADE = ['.info-band', '.info-table', '.form', '.viewer__bar'];
  const WIPE = ['.shot .photo', '.worldview figure', '.movie__frame'];

  const styleGetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style').get;
  const styleOf = (el) => styleGetter.call(el);
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const off = () => { root.classList.add('motion-off'); root.classList.remove('motion-ready'); };
  if (mqReduce.matches || !('IntersectionObserver' in window)) { off(); return; }
  root.classList.add('motion-ready');
  mqReduce.addEventListener && mqReduce.addEventListener('change', (e) => { if (e.matches) off(); });

  /* ---------- ①② スクロール表示・写真ワイプ ---------- */
  const mark = (sel, attr, val) => document.querySelectorAll(sel).forEach((el) => {
    if (el.closest('.fv') || el.hasAttribute('data-reveal') || el.hasAttribute('data-wipe')) return;
    el.setAttribute(attr, val);
  });
  REVEAL.forEach((s) => mark(s, 'data-reveal', ''));
  REVEAL_FADE.forEach((s) => mark(s, 'data-reveal', 'fade'));
  WIPE.forEach((s) => mark(s, 'data-wipe', ''));

  const targets = Array.from(document.querySelectorAll('[data-reveal],[data-wipe]'));
  const io = new IntersectionObserver((entries) => {
    const inView = entries.filter((e) => e.isIntersecting).sort((a, b) =>
      (a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    inView.forEach((e, i) => {
      const el = e.target;
      io.unobserve(el);                       // 一度だけ
      // form 要素に name="style" があっても動くよう、HTMLElement の style getter を直接使う
      styleOf(el).setProperty('--mo-d', Math.min(i * CONFIG.staggerMs, CONFIG.staggerMax) + 'ms');
      el.classList.add('is-in');
      const done = () => el.classList.add('is-done');
      // 長いトランジション（ワイプのscale）が終わったら後始末
      setTimeout(done, (el.hasAttribute('data-wipe') ? 1900 : 1300) + Math.min(i * CONFIG.staggerMs, CONFIG.staggerMax));
    });
  }, { rootMargin: CONFIG.rootMargin, threshold: 0 });
  targets.forEach((el) => io.observe(el));

  /* ---------- ③ Lenis：デスクトップ（ホバー可能・精密ポインタ）のホイール操作のみ。タッチは端末ネイティブのまま ---------- */
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!desktop.matches) return;
  const s = document.createElement('script');
  s.src = CONFIG.lenisSrc; s.async = true;
  s.onload = () => {
    if (typeof window.Lenis !== 'function' || mqReduce.matches) return;
    const lenis = new window.Lenis({
      duration: CONFIG.lenis.duration,
      wheelMultiplier: CONFIG.lenis.wheelMultiplier,
      smoothWheel: true,
      syncTouch: false,          // タッチは既定どおりネイティブ
      autoRaf: true,
      // 3D模型・ナビなど、ホイールを自前で扱う要素は index.html の data-lenis-prevent(-wheel) で除外
    });
    window.__lenis = lenis;      // 確認用
    // ページ内リンク：Lenis は html の scroll-padding-top（＝固定ヘッダー分 var(--hdr)+8px）を自動で考慮するため、offset は 0
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest && ev.target.closest('a[href^="#"]');
      if (!a || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = id === '#top' ? document.body : document.getElementById(decodeURIComponent(id.slice(1)));
      if (!target) return;
      if (target.tagName === 'DETAILS' || a.dataset.noLenis != null) return;
      ev.preventDefault();
      lenis.scrollTo(id === '#top' ? 0 : target, { offset: 0, duration: CONFIG.lenis.anchorDuration });
      try { history.pushState(null, '', id); } catch (_) {}
    });
    mqReduce.addEventListener && mqReduce.addEventListener('change', (e) => { if (e.matches) { lenis.destroy(); window.__lenis = null; } });
  };
  document.head.appendChild(s);
})();
