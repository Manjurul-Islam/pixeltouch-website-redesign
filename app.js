/* Pixeltouch v2 interactions */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const APPS = JSON.parse($('#appData').textContent);
  const root = document.documentElement;

  /* ---------- every load starts at the top (no restored scroll, no jump to a #hash) ---------- */
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  scrollTo(0, 0);
  addEventListener('pageshow', e => { if (e.persisted) scrollTo(0, 0); });
  addEventListener('beforeunload', () => scrollTo(0, 0));

  /* ---------- smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToHash = hash => {
    const el = hash === '#top' ? document.body : document.querySelector(hash);
    if (!el) return;
    if (lenis) lenis.scrollTo(hash === '#top' ? 0 : el, { offset: hash === '#top' ? 0 : -90 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  };
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const h = a.getAttribute('href');
    if (h.length < 2) return;
    e.preventDefault(); closeMenu(); closeMega(); scrollToHash(h);
  }));

  /* ---------- hero video: muted, fades in when ready ---------- */
  const vid = $('#heroVideo');
  // 4K masters, best codec first. Each is only used if this device can decode it smoothly
  // (hardware / power-efficient) — otherwise the 1080p H.264 safety net plays instead.
  const HERO_SRC = [
    { src: 'assets/hero-4k-av1.mp4?v=4', type: 'video/mp4; codecs="av01.0.12M.10"', br: 4100000 },
    { src: 'assets/hero-4k-hevc.mp4?v=4', type: 'video/mp4; codecs="hvc1.1.6.L153.B0"', br: 5900000 },
    { src: 'assets/hero-4k.mp4?v=4', type: 'video/mp4; codecs="avc1.640033"', br: 10200000 },
  ];
  const HERO_SAFE = 'assets/hero-1080.mp4?v=4';
  const HERO_720 = 'assets/hero-720.mp4?v=2';
  const pickHeroSrc = async () => {
    // never decode more pixels than the screen can show: phones/tablets get 720p/1080p, 4K only for big, sharp screens
    const px = Math.max(innerWidth, innerHeight * 16 / 9) * Math.min(devicePixelRatio || 1, 2);
    if (px <= 1400 || (innerWidth < 768 && matchMedia('(pointer: coarse)').matches)) return HERO_720;
    if (px <= 2300 || matchMedia('(pointer: coarse)').matches) return HERO_SAFE;
    const slow = navigator.connection && (navigator.connection.saveData || /(^|-)2g$/.test(navigator.connection.effectiveType || ''));
    if (slow) return HERO_SAFE;
    const can = HERO_SRC.filter(o => vid.canPlayType(o.type) !== '');
    if (!navigator.mediaCapabilities) return (can.find(o => !o.type.includes('avc1')) || can[0] || { src: HERO_SAFE }).src;
    for (const o of can) {
      try {
        const r = await navigator.mediaCapabilities.decodingInfo({ type: 'file',
          video: { contentType: o.type, width: 3840, height: 2160, bitrate: o.br, framerate: 24 } });
        if (r.supported && r.smooth && r.powerEfficient) return o.src;
      } catch (_) { /* unknown codec string: try the next */ }
    }
    return HERO_SAFE;
  };
  if (vid) {
    vid.muted = true; vid.defaultMuted = true; vid.volume = 0;
    // start the film once the loader is done so it never competes with first paint
    // phones: let the intro (title + mockup rise) finish before the film starts decoding
    const afterIntro = () => new Promise(r => setTimeout(r, innerWidth <= 960 ? 1900 : 0));
    (window.__loaderDone || Promise.resolve()).then(afterIntro).then(pickHeroSrc).then(src => { vid.src = src; vid.dataset.src = src; vid.load(); vid.play()?.catch(() => {}); watchHero(); });
    // safety net: if a device still can't keep up with 4K (dropping >20% of frames while visible),
    // swap to the 1080p master in place — same frame, no restart, no stutter.
    function watchHero() {
      if (!vid.getVideoPlaybackQuality) return;
      let base = null;
      const check = () => {
        if (vid.dataset.src === HERO_SAFE) return;
        if (document.hidden || vid.paused || vid.getBoundingClientRect().bottom < 0) { base = null; return setTimeout(check, 3000); }
        const q = vid.getVideoPlaybackQuality();
        if (!base) { base = q; return setTimeout(check, 4000); }
        const total = q.totalVideoFrames - base.totalVideoFrames, dropped = q.droppedVideoFrames - base.droppedVideoFrames;
        if (total > 60 && dropped / total > .2) {
          const t = vid.currentTime;
          vid.src = vid.dataset.src = HERO_SAFE;
          vid.addEventListener('loadedmetadata', () => { vid.currentTime = t; vid.playbackRate = .85; vid.play().catch(() => {}); }, { once: true });
          return;
        }
        base = q; setTimeout(check, 4000);
      };
      setTimeout(check, 3000);
    }
    const ready = () => { vid.classList.add('is-ready'); vid.playbackRate = .85; };
    if (vid.readyState >= 3) ready(); else vid.addEventListener('canplay', ready, { once: true });
    vid.play()?.catch(() => {});
    // never let it end: restart instantly if a browser ignores loop, resume if it stalls
    vid.loop = true;
    vid.addEventListener('ended', () => { vid.currentTime = 0; vid.play().catch(() => {}); });
    vid.addEventListener('pause', () => { if (!reduce && !document.hidden && vid.getBoundingClientRect().bottom > 0) vid.play().catch(() => {}); });
    if (reduce) vid.pause();
    new IntersectionObserver(([e]) => { if (!reduce) e.isIntersecting ? vid.play().catch(() => {}) : vid.pause(); }).observe(vid);
  }

  /* ---------- headline split ---------- */
  $$('[data-split]').forEach(el => {
    let i = 0;
    el.querySelectorAll(':scope > span').forEach(line => {
      line.innerHTML = line.textContent.trim().split(/\s+/).map(w => `<span class="w"><span style="--i:${i++}">${w}</span></span>`).join(' ');
    });
    el.classList.add('is-split');
  });

  /* ---------- statement: word-by-word ink ---------- */
  const stmt = $('[data-words]');
  let words = [];
  if (stmt) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)) frag.append(' ');
            else { const s = document.createElement('span'); s.className = 'sw'; s.textContent = t; frag.append(s); }
          });
          n.replaceWith(frag);
        }
      });
    };
    walk(stmt);
    words = $$('.sw, .ico', stmt);
  }

  const markLoaded = () => { if (root.classList.contains('is-loaded')) return; root.classList.add('is-loaded'); setTimeout(() => root.classList.add('title-done'), 2600); };
  (window.__loaderDone || Promise.resolve()).then(() => requestAnimationFrame(() => requestAnimationFrame(markLoaded)));
  setTimeout(markLoaded, 7000);

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .1 });
  $$('[data-reveal], .tech').forEach(el => io.observe(el));

  /* ---------- count-up ---------- */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    if (reduce) return;
    const el = e.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), t0 = performance.now();
    const tick = now => {
      const k = clamp((now - t0) / 1700), ease = 1 - Math.pow(1 - k, 4);
      el.textContent = (to * ease).toFixed(dec);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* =========================================================
     HEADER — sliding hover blob, mega menu, mobile sheet
     ========================================================= */
  const hdr = $('#hdr');
  const nav = $('#nav');
  const blob = $('.nav__blob');
  const links = $$('.nav__link');
  const moveBlob = el => {
    if (!el) { blob.style.setProperty('--bo', 0); return; }
    const r = el.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    blob.style.setProperty('--bx', (r.left - nr.left) + 'px');
    blob.style.setProperty('--bw', r.width + 'px');
    blob.style.setProperty('--bo', 1);
  };
  links.forEach(a => { a.addEventListener('mouseenter', () => moveBlob(a)); a.addEventListener('focus', () => moveBlob(a)); });
  nav.addEventListener('mouseleave', () => moveBlob(null));

  const megaLi = $('.nav__has-mega'), trigger = $('#appsTrigger');
  let megaT;
  const openMega = () => { clearTimeout(megaT); megaLi.classList.add('is-open'); trigger.setAttribute('aria-expanded', 'true'); };
  function closeMega() { clearTimeout(megaT); megaLi?.classList.remove('is-open'); trigger?.setAttribute('aria-expanded', 'false'); }
  if (finePointer) {
    megaLi.addEventListener('mouseenter', openMega);
    megaLi.addEventListener('mouseleave', () => { megaT = setTimeout(closeMega, 180); });
  }
  trigger.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); openMega(); $('.mega__app')?.focus(); } });
  megaLi.addEventListener('focusout', e => { if (!megaLi.contains(e.relatedTarget)) closeMega(); });

  const burger = $('#burger');
  function closeMenu() { hdr.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', () => {
    const open = hdr.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); closeMega(); } });
  document.addEventListener('click', e => { if (!hdr.contains(e.target)) closeMenu(); });

  // active section
  const secMap = { apps: 'apps', about: 'about', tech: 'tech', philosophy: 'philosophy', contact: 'contact' };
  const sio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(secMap).forEach(id => { const s = document.getElementById(id); s && sio.observe(s); });

  /* =========================================================
     HERO SHOWCASE — screens glide into the device, loop forever.
     Only the screen inside the device is in colour.
     ========================================================= */
  const show = $('#show');
  const cards = $$('.hc', show);
  const N = cards.length;
  let cur = 0, autoT0 = performance.now(), paused = false, inView = true;
  const prevPos = new Array(N).fill(null);
  const DUR = 3400;

  const layout = () => {
    const sw = parseFloat(getComputedStyle(cards[0]).width);
    const W = parseFloat(getComputedStyle(show).getPropertyValue('--W')) || sw / .8935;
    const s = .8, gap = Math.max(18, sw * .09);
    const first = W / 2 + gap + sw * s / 2;              // first side card clears the bezel
    const step = sw * s + gap;
    cards.forEach((c, i) => {
      let d = ((i - cur) % N + N) % N;
      if (d > N / 2) d -= N;
      const ad = Math.abs(d);
      const x = d === 0 ? 0 : Math.sign(d) * (first + (ad - 1) * step);
      const o = ad === 0 ? 1 : ad === 1 ? 1 : ad === 2 ? .85 : ad === 3 ? .5 : 0;
      // a card that wraps around the loop jumps while invisible — never on screen
      const jump = prevPos[i] !== null && Math.abs(d - prevPos[i]) > 1;
      c.classList.toggle('no-anim', jump);
      c.style.setProperty('--x', x.toFixed(1) + 'px');
      c.style.setProperty('--s', d === 0 ? 1 : s);
      c.style.setProperty('--o', o);
      c.style.setProperty('--bl', (ad === 0 ? 0 : ad === 1 ? 5 : 8) + 'px');   // subtle depth blur, active screen stays sharp
      c.style.zIndex = 10 - ad;
      c.classList.toggle('is-center', d === 0);
      c.classList.toggle('is-side', d !== 0);
      c.setAttribute('aria-current', d === 0 ? 'true' : 'false');
      prevPos[i] = d;
    });
    if (cards.some(c => c.classList.contains('no-anim'))) requestAnimationFrame(() => requestAnimationFrame(() => cards.forEach(c => c.classList.remove('no-anim'))));
  };
  const go = n => { cur = (n % N + N) % N; layout(); autoT0 = performance.now(); };
  // hold the first auto-advance until the mockup has settled after the loader
  (window.__loaderDone || Promise.resolve()).then(() => { autoT0 = performance.now() + 1600; });
  const tickShow = now => {
    if (paused || !inView || reduce || document.hidden) autoT0 = now - Math.min(now - autoT0, DUR * .5);
    else if (now - autoT0 >= DUR) go(cur + 1);
    requestAnimationFrame(tickShow);
  };
  if (N) {
    layout(); requestAnimationFrame(tickShow);
    cards.forEach((c, i) => c.addEventListener('click', () => { if (i !== cur) go(i); }));
    show.addEventListener('mouseenter', () => paused = true);
    show.addEventListener('mouseleave', () => { paused = false; });
    new IntersectionObserver(([e]) => inView = e.isIntersecting).observe(show);
    let sx = null;
    show.addEventListener('pointerdown', e => { sx = e.clientX; });
    addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    });
    let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(layout, 120); });
    document.fonts?.ready.then(layout);
  }

  /* =========================================================
     PORTFOLIO — stacked sticky cards; each new card slides over
     the last, which settles back (scale + shade). Dock follows.
     ========================================================= */
  const stackEl = $('#stack');
  const scards = $$('.scard');
  const sdock = $('#sdock');
  const sItems = $$('.sdock__item');
  let sCur = -1, sTops = [], sNat = [];
  const layoutStack = () => {
    // natural (unstuck) document top of each card and its sticky top
    const prevT = scards.map(c => c.style.transform);
    scards.forEach(c => { c.style.position = 'relative'; c.style.top = '0px'; });
    const base = stackEl.getBoundingClientRect().top + scrollY;
    sNat = scards.map(c => c.getBoundingClientRect().top + scrollY - base);
    scards.forEach(c => { c.style.position = ''; c.style.top = ''; });
    sTops = scards.map(c => parseFloat(getComputedStyle(c).top) || 0);
    sNat = sNat.map(v => v + base);
    scards.forEach((c, i) => c.style.transform = prevT[i]);
  };
  const setDock = i => {
    if (i === sCur) return;
    sCur = i;
    sItems.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    if (sdock.scrollWidth > sdock.clientWidth + 2) sdock.scrollTo({ left: sItems[i].offsetLeft - (sdock.clientWidth - sItems[i].offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  };
  const updateStack = () => {
    const vh = innerHeight;
    // e[i]: 0 when card i's natural top is at the viewport bottom, 1 when it reaches its sticky top
    const e = scards.map((c, i) => clamp((vh - (sNat[i] - scrollY)) / Math.max(1, vh - sTops[i])));
    let active = 0;
    scards.forEach((c, i) => {
      let depth = 0;
      for (let j = i + 1; j < scards.length; j++) depth += e[j];
      depth = Math.min(depth, 3);
      c.style.setProperty('--d', depth.toFixed(3));
      // fully covered cards leave the render tree (keeps mobile GPU memory flat while scrolling the stack)
      const hide = depth >= 1.2 ? 'hidden' : '';
      if (c.style.visibility !== hide) c.style.visibility = hide;
      c.querySelector('.scard__phone').style.setProperty('--e', (reduce ? 1 : e[i]).toFixed(3));
      if (e[i] > .55) active = i;
    });
    setDock(active);
  };
  sItems.forEach((b, i) => b.addEventListener('click', () => {
    const y = sNat[i] - sTops[i];
    if (lenis) lenis.scrollTo(y, { duration: 1.2 }); else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }));
  layoutStack(); updateStack();
  // mobile browsers fire resize as the URL bar slides; only re-measure when the width really changes
  let stackW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - stackW) < 2 && matchMedia('(pointer: coarse)').matches) return; stackW = innerWidth; layoutStack(); updateStack(); });
  addEventListener('load', () => { layoutStack(); updateStack(); });
  addEventListener('scroll', () => requestAnimationFrame(updateStack), { passive: true });
  if (lenis) lenis.on('scroll', updateStack);

  /* =========================================================
     TECHNOLOGY — pinned horizontal travel
     ========================================================= */
  const tech = $('.tech'), track = $('#techTrack'), techIdx = $('#techIdx'), techBar = $('#techBar');
  let techTravel = 0;
  const sizeTech = () => {
    if (innerWidth <= 960) { tech.style.removeProperty('--tech-h'); techTravel = 0; return; }
    techTravel = Math.max(0, track.scrollWidth - innerWidth);
    tech.style.setProperty('--tech-h', (innerHeight + techTravel) + 'px');
  };
  sizeTech(); addEventListener('resize', sizeTech); addEventListener('load', sizeTech);
  let techP = 0, techPT = 0;
  // Liniqo live figures: crisper line colour per theme; re-mounted when the theme flips
  const figLine = () => root.dataset.theme === 'dark' ? '#9aa3b0' : '#6b7480';
  const figBg = () => root.dataset.theme === 'dark' ? '#161b22' : '#ffffff';
  const paintFigs = () => $$('.tfig').forEach(f => {
    f.setAttribute('data-line', figLine()); f.setAttribute('data-bg', figBg());
    const fresh = f.cloneNode(false);            // embed.js re-scans added nodes
    f.replaceWith(fresh); fresh.__auto = 0;
  }) || window.__pollCentre?.();
  $$('.tfig').forEach(f => { f.setAttribute('data-line', figLine()); f.setAttribute('data-bg', figBg()); });
  window.__repaintFigs = paintFigs;
  // keep every figure moving on its own: run Liniqo's looping "tour" (an unseen pointer walking
  // the figure); a real pointer still takes over on hover and the loop resumes on leave.
  const loadLiniqo = () => { if (loadLiniqo.done) return; loadLiniqo.done = 1; const sc = document.createElement('script'); sc.src = 'https://liniqo.com/live/embed.js'; sc.async = true; document.body.append(sc); };
  new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { loadLiniqo(); o.disconnect(); } }, { rootMargin: '1200px 0px' }).observe(tech);
  const autoplayFigs = () => $$('.tfig').forEach(f => {
    if (f.__auto) return;
    const t = setInterval(() => { if (f.__liniqo && f.__liniqo.play) { clearInterval(t); f.__auto = 1; if (!reduce) f.__liniqo.play(true); } }, 250);
    setTimeout(() => clearInterval(t), 20000);
  });
  autoplayFigs();
  // optical centring: fit each figure's drawn artwork (not its padded 400×320 box) to the frame
  const centreFig = f => {
    const svg = f.querySelector('svg'), art = f.parentElement;
    if (!svg || !art) return;
    if (!f.__bb) { try { const b = svg.getBBox(); if (b.width) f.__bb = b; } catch (_) {} }
    const b = f.__bb; if (!b) return;
    const u = f.offsetWidth / 400, aw = art.clientWidth, ah = art.clientHeight;
    // equal visual weight: every drawing gets the same footprint (geometric mean of its drawn box),
    // then is capped so it always fits the frame with headroom for its animation
    const area = Math.sqrt(b.width * b.height) * u, target = Math.sqrt(aw * ah) * .52;
    const sc = Math.min(target / area, (aw * .86) / (b.width * u), (ah * .7) / (b.height * u));
    f.style.setProperty('--s', sc.toFixed(3));
    f.style.setProperty('--dx', ((200 - (b.x + b.width / 2)) * u).toFixed(1) + 'px');
    f.style.setProperty('--dy', ((160 - (b.y + b.height / 2)) * u + ah * .04 / sc).toFixed(1) + 'px');
  };
  const centreAll = () => $$('.tfig').forEach(centreFig);
  let cTimer = 0;
  const pollCentre = () => {
    clearInterval(cTimer);
    cTimer = setInterval(() => { centreAll(); if ($$('.tfig').every(f => f.__bb)) clearInterval(cTimer); }, 300);
    setTimeout(() => clearInterval(cTimer), 20000);
  };
  pollCentre();
  window.__pollCentre = pollCentre;
  addEventListener('resize', centreAll);
  new MutationObserver(autoplayFigs).observe(track, { childList: true, subtree: true });

  /* ---------- theme switch: circular reveal from the button (View Transitions), cross-fade fallback ---------- */
  const tsw = $('#tswitch');
  const metaTheme = $('meta[name="theme-color"]');
  const syncSwitch = () => {
    const dark = root.dataset.theme === 'dark';
    tsw.setAttribute('aria-pressed', String(dark));
    tsw.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    metaTheme.content = dark ? '#0a0c0f' : '#f4f6f8';
  };
  const applyTheme = dark => {
    if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    try { sessionStorage.setItem('pt-theme', dark ? 'dark' : 'light'); } catch (_) {}
    syncSwitch(); window.__repaintFigs?.();
  };
  tsw.addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark';
    if (reduce) return applyTheme(dark);
    if (document.startViewTransition) {
      const r = tsw.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const vt = document.startViewTransition(() => applyTheme(dark));
      vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }));
    } else {
      root.classList.add('theme-fade'); applyTheme(dark);
      setTimeout(() => root.classList.remove('theme-fade'), 600);
    }
  });
  syncSwitch();

  /* PHILOSOPHY — touch: highlight the tenet nearest the viewport centre */
  const tenets = $$('.tenet');

  /* =========================================================
     CTA — magnetic icons
     ========================================================= */
  const ctaCard = $('#ctaCard'), cicons = $$('.cicon');
  if (finePointer) {
    ctaCard.addEventListener('pointermove', e => {
      cicons.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy), f = clamp(1 - d / 340);
        c.style.setProperty('--ix', (dx * f * .22).toFixed(1) + 'px');
        c.style.setProperty('--iy', (dy * f * .22).toFixed(1) + 'px');
        c.style.setProperty('--ir', (dx * f * .03 * (i % 2 ? 1 : -1)).toFixed(2) + 'deg');
      });
    });
    ctaCard.addEventListener('pointerleave', () => cicons.forEach(c => { c.style.setProperty('--ix', '0px'); c.style.setProperty('--iy', '0px'); c.style.setProperty('--ir', '0deg'); }));
  }

  /* =========================================================
     FOOTER — gradient light follows the cursor through the wordmark
     ========================================================= */
  const fw = $('#footWord'), fwg = $('#fwg');
  if (fw && fwg) {
    // the light glides after the cursor (lerped), never jumps
    let tx = 110, ty = 20, cx = 110, cy = 20, run = false;
    const step = () => {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      fwg.setAttribute('cx', cx.toFixed(2)); fwg.setAttribute('cy', cy.toFixed(2));
      if (Math.abs(tx - cx) > .05 || Math.abs(ty - cy) > .05) requestAnimationFrame(step); else run = false;
    };
    fw.addEventListener('pointermove', e => {
      const r = $('svg', fw).getBoundingClientRect();
      tx = 44 + (e.clientX - r.left) / r.width * 141; ty = 8 + (e.clientY - r.top) / r.height * 27;
      if (!run) { run = true; requestAnimationFrame(step); }
    });
  }

  /* =========================================================
     dark buttons: glow follows cursor
     ========================================================= */
  $$('.btn--dark').forEach(b => b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    b.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* =========================================================
     SCROLL + RAF LOOP
     ========================================================= */
  const hero = $('.hero'), prog = $('#progress'), footWord = $('#footWord');
  let lastY = scrollY, acc = 0, hpT = 0, hp = 0, cpT = .5, cp = .5;
  let scrolledState = null, hiddenState = false;
  const setHidden = v => { if (v !== hiddenState) { hiddenState = v; hdr.classList.toggle('is-hidden', v); } };
  const onScroll = () => {
    const y = scrollY, vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    prog.style.setProperty('--p', clamp(y / max).toFixed(4));
    const sc = y > 24;
    if (sc !== scrolledState) { scrolledState = sc; hdr.classList.toggle('is-scrolled', sc); }
    const dy = y - lastY; lastY = y;
    // accumulate distance in one direction; reset when direction flips
    acc = (Math.sign(dy) === Math.sign(acc) || acc === 0) ? acc + dy : dy;
    if (y < vh * .8 || hdr.classList.contains('menu-open') || megaLi.classList.contains('is-open')) { setHidden(false); acc = 0; }
    else if (acc > 90) setHidden(true);
    else if (acc < -40) setHidden(false);
    hpT = clamp(y / (hero.offsetHeight * .9));
    if (words.length) {
      const r = stmt.getBoundingClientRect();
      const p = clamp((vh * .85 - r.top) / (r.height + vh * .3));
      const n = words.length;
      words.forEach((w, k) => w.style.setProperty('--o', clamp(p * n * 1.2 - k).toFixed(3)));
    }
    if (techTravel) {
      const r = tech.getBoundingClientRect();
      techPT = clamp(-r.top / (r.height - vh));
    }
    { const r = ctaCard.getBoundingClientRect(); cpT = clamp((vh - r.top) / (vh + r.height)); }
    if (footWord) { const sc = footWord.parentElement, r = sc.getBoundingClientRect(); sc.style.setProperty('--fp', clamp((vh - r.top) / (r.height * .9)).toFixed(3)); }
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  const loop = () => {
    hp = lerp(hp, hpT, .1); hero.style.setProperty('--hp', hp.toFixed(4));
    cp = lerp(cp, cpT, .08); ctaCard.style.setProperty('--cp', cp.toFixed(4));
    if (techTravel) {
      techP = lerp(techP, techPT, .14);
      track.style.setProperty('--tx', (-techP * techTravel).toFixed(1) + 'px');
      techBar.style.setProperty('--tp', techP.toFixed(4));
      techIdx.textContent = String(Math.min(6, 1 + Math.floor(techP * 6.2))).padStart(2, '0');
    }
    requestAnimationFrame(loop);
  };
  if (!reduce) requestAnimationFrame(loop);
  else { techP = 0; }

  /* ---------- contact form → mail client ---------- */
  const form = $('#contactForm'), status = $('#formStatus');
  form?.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    $$('input[required], textarea[required]', form).forEach(f => {
      const bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { status.textContent = 'Please fill in the highlighted fields.'; return; }
    const d = new FormData(form);
    const body = `${d.get('message')}\n\n— ${d.get('name')} (${d.get('email')})`;
    location.href = `mailto:support@pixeltouch.net?subject=${encodeURIComponent(d.get('subject') + ' — ' + d.get('name'))}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your mail app… thanks for reaching out!';
  });
  $$('input, textarea', form).forEach(f => f.addEventListener('input', () => f.closest('.field')?.classList.remove('is-invalid')));
})();
