/* Pixeltouch v2 — interactions */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const APPS = JSON.parse($('#appData').textContent);
  const root = document.documentElement;

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
  if (vid) {
    vid.muted = true; vid.defaultMuted = true; vid.volume = 0;
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

  const markLoaded = () => root.classList.add('is-loaded');
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
     APP LAB — dock of app icons drives one stage
     ========================================================= */
  const lab = $('.lab');
  const stage = $('#labStage');
  const dock = $('#labList');
  const items = $$('.lab__item');
  const screens = $$('.lab__screen');
  const details = $$('.lab__detail');
  let labCur = 0, labT0 = performance.now(), labPaused = false, labInView = false, userPicked = false;
  const LAB_DUR = 5000;
  const pickLab = i => {
    if (i === labCur) { labT0 = performance.now(); return; }
    const prev = labCur; labCur = i;
    const a = APPS[i];
    items.forEach((it, k) => {
      const on = k === i;
      it.classList.toggle('is-active', on);
      it.setAttribute('aria-selected', String(on)); it.tabIndex = on ? 0 : -1;
    });
    setTimeout(() => items[prev].style.setProperty('--lp', 0), 450);
    screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
    details.forEach((d, k) => { d.classList.toggle('is-active', k === i); d.querySelector('a').tabIndex = k === i ? 0 : -1; });
    stage.style.setProperty('--accent', a.accent);
    stage.style.setProperty('--tint', a.tint);
    labT0 = performance.now();
    if (innerWidth <= 960) dock.scrollTo({ left: items[i].offsetLeft - parseFloat(getComputedStyle(dock).paddingLeft), behavior: reduce ? 'auto' : 'smooth' });
  };
  items.forEach((it, i) => it.addEventListener('click', () => { userPicked = true; pickLab(i); }));
  dock.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!k) return;
    e.preventDefault(); userPicked = true;
    const n = (labCur + k + items.length) % items.length;
    pickLab(n); items[n].focus({ preventScroll: true });
  });
  const pauseOn = el => {
    el.addEventListener('mouseenter', () => { labPaused = true; lab.classList.add('is-paused'); });
    el.addEventListener('mouseleave', () => { labPaused = false; lab.classList.remove('is-paused'); labT0 = performance.now(); });
  };
  pauseOn($('.lab__info')); pauseOn(stage);
  new IntersectionObserver(([e]) => { labInView = e.isIntersecting; labT0 = performance.now(); }, { threshold: .3 }).observe(lab);
  const tickLab = now => {
    // autoplay only until the visitor makes a choice — then it's theirs
    if (labInView && !labPaused && !userPicked && !reduce && !document.hidden) {
      const p = (now - labT0) / LAB_DUR;
      items[labCur].style.setProperty('--lp', clamp(p).toFixed(4));
      if (p >= 1) pickLab((labCur + 1) % items.length);
    } else if (userPicked) items[labCur].style.setProperty('--lp', 0);
    else labT0 = now - (parseFloat(items[labCur].style.getPropertyValue('--lp')) || 0) * LAB_DUR;
    requestAnimationFrame(tickLab);
  };
  requestAnimationFrame(tickLab);
  const labPhone = $('#labPhone');
  if (finePointer) {
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      labPhone.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      labPhone.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', () => { labPhone.style.setProperty('--ry', '0deg'); labPhone.style.setProperty('--rx', '0deg'); });
  }

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
  // Inline each Liniqo illustration from its <template> when its card enters view, so the
  // draw-on animation is seen; it is re-drawn the next time the card comes back into view.
  const arts = $$('.tcard__art');
  const mountArt = art => {
    const tpl = $('template.tart', art);
    if (!tpl) return;
    art.querySelector('.tart-live')?.remove();
    const live = document.createElement('div');
    live.className = 'tart-live';
    live.append(tpl.content.cloneNode(true));
    art.append(live);
  };
  const artIO = new IntersectionObserver(es => es.forEach(e => {
    const art = e.target;
    if (e.isIntersecting && !art.dataset.on) { art.dataset.on = '1'; mountArt(art); }
    else if (!e.isIntersecting && art.dataset.on) {
      // fully out of view: clear it so the next visit draws in again (never removed while visible)
      delete art.dataset.on;
      art.querySelector('.tart-live')?.remove();
    }
  }), { threshold: 0 });
  arts.forEach(a => artIO.observe(a));
  if (finePointer) arts.forEach(a => a.closest('.tcard').addEventListener('mouseenter', () => { if (!a.dataset.busy) { a.dataset.busy = 1; mountArt(a); setTimeout(() => delete a.dataset.busy, 2200); } }));
  if (reduce) arts.forEach(mountArt);

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
