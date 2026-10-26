/* ==========================================================
   SHAPE Potential Africa
   ========================================================== */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('#year').textContent = new Date().getFullYear();

  /* ---------- theme toggle ---------- */
  const toggle = $('.theme-toggle');
  const syncTheme = () => {
    const dark = root.dataset.theme === 'dark';
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    $('meta[name="theme-color"]').setAttribute('content', dark ? '#15110e' : '#ffffff');
  };
  syncTheme();

  /* ---------- mobile menu ---------- */
  const burger = $('.nav__burger');
  const menu = $('.menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
  }
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', () => setMenu(false)));

  // Without GSAP (offline / blocked CDN) the page still works, just without motion.
  if (typeof window.gsap === 'undefined') {
    root.classList.remove('js');
    $$('.value').forEach(v => v.addEventListener('click', () => $$('.value').forEach(x => x.classList.toggle('is-open', x === v))));
    toggle.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('spa-theme', root.dataset.theme); } catch (e) {}
      syncTheme();
    });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- particle Africa ---------- */
  const africa = (() => {
    const canvas = $('#africa');
    const ctx = canvas.getContext('2d');
    const src = window.AFRICA_POINTS || [];
    const aspect = window.AFRICA_ASPECT || 0.9;
    // colours sampled from the logo; light theme skips the palest gold so dots stay visible on white
    const palettes = {
      dark: ['#a82a02', '#cb3302', '#d4461a', '#d95a1c', '#e0782a', '#eba12c', '#f2c060'],
      light: ['#a82a02', '#b82e02', '#cb3302', '#d4461a', '#d95a1c', '#e38a28', '#eba12c'],
    };
    const palette = () => palettes[root.dataset.theme === 'dark' ? 'dark' : 'light'];
    let W, H, dpr, particles = [], mouse = { x: -9999, y: -9999 }, scatter = 0, running = true, formed = 0;

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = W < 769;
      const h = mobile ? Math.min(H * 0.42, W * 0.9 / aspect) : Math.min(H * 0.78, W * 0.42 / aspect);
      const w = h * aspect;
      const ox = mobile ? (W - w) / 2 : W - w - Math.max(24, W * 0.06);
      const oy = mobile ? 84 : (H - h) / 2 + 20;
      const step = mobile ? 2 : 1;
      const pal = palette();
      const prev = particles;
      particles = [];
      for (let i = 0; i < src.length; i += step) {
        const [nx, ny] = src[i];
        const old = prev[particles.length];
        const t = Math.min(1, Math.max(0, ny * 0.75 + nx * 0.35 + (Math.random() - 0.5) * 0.25));
        particles.push({
          hx: ox + nx * h, hy: oy + ny * h,
          x: old ? old.x : Math.random() * W,
          y: old ? old.y : Math.random() * H,
          vx: 0, vy: 0,
          r: Math.random() < 0.06 ? 2.4 : 1.2 + Math.random() * 0.9,
          t, c: pal[Math.round(t * (pal.length - 1))],
          ph: Math.random() * Math.PI * 2,
          dx: (Math.random() - 0.5) * 2, dy: (Math.random() - 0.5) * 2,
        });
      }
      canvas.style.opacity = mobile ? 0.6 : 1;
    }

    let lastT = 0;
    function tick(time) {
      if (!running) { lastT = 0; return; }
      const t = time * 0.001;
      // normalise physics to 60fps so high-refresh screens behave the same
      const dt = lastT ? Math.min(3, (time - lastT) / 16.67) : 1;
      lastT = time;
      ctx.clearRect(0, 0, W, H);
      const R = 110, R2 = R * R;
      const spread = scatter * Math.max(W, H) * 0.6;
      const k = 0.02 + formed * 0.05;
      const damp = Math.pow(0.82, dt);
      const buckets = {};
      for (const p of particles) {
        const wave = Math.sin(t * 1.4 + p.hx * 0.012 + p.hy * 0.008) * 1.6;
        const tx = p.hx + p.dx * spread + Math.cos(t + p.ph) * 0.6;
        const ty = p.hy + p.dy * spread + wave;
        p.vx += (tx - p.x) * k * dt;
        p.vy += (ty - p.y) * k * dt;
        const mx = p.x - mouse.x, my = p.y - mouse.y, d2 = mx * mx + my * my;
        if (d2 < R2) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 6;
          p.vx += (mx / d) * f; p.vy += (my / d) * f;
        }
        p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        (buckets[p.c] ||= []).push(p);
      }
      for (const c in buckets) {
        ctx.fillStyle = c;
        ctx.beginPath();
        for (const p of buckets[c]) { ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }

    layout();
    window.addEventListener('resize', layout);
    const hero = $('#hero');
    hero.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });

    // dots drift apart as the hero scrolls away; pause drawing once it is off screen
    ScrollTrigger.create({
      trigger: hero, start: 'top top', end: 'bottom top',
      onUpdate: s => { scatter = s.progress * s.progress * 0.9; },
      onToggle: s => { const was = running; running = s.isActive || s.progress < 1; if (running && !was) requestAnimationFrame(tick); },
    });

    return {
      start() { requestAnimationFrame(tick); },
      form() { gsap.to({ v: 0 }, { v: 1, duration: 2.4, ease: 'power2.out', onUpdate() { formed = this.targets()[0].v; } }); },
      recolor() { const pal = palette(); particles.forEach(p => { p.c = pal[Math.round(p.t * (pal.length - 1))]; }); },
    };
  })();

  toggle.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('spa-theme', root.dataset.theme); } catch (e) {}
    syncTheme();
    africa.recolor();
  });

  /* ---------- hero intro ---------- */
  function intro() {
    africa.start(); africa.form();
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__title .line > span', { y: 0, duration: 1.3, stagger: 0.1 })
      .from('.hero__lede, .hero__cta > *', { y: 20, opacity: 0, duration: 1, stagger: 0.08 }, 0.35);
    if (reduced) tl.progress(1);
  }
  // wait briefly for web fonts so the headline doesn't reflow mid-animation
  Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 600))]).then(intro);

  /* ---------- gentle reveal on scroll ---------- */
  if (!reduced) {
    gsap.set('.reveal', { y: 28, opacity: 0 });
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%', once: true,
      onEnter: els => gsap.to(els, { y: 0, opacity: 1, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'transform' }),
    });
  }

  /* ---------- values: open one letter at a time ---------- */
  (() => {
    const items = $$('.value');
    const open = v => items.forEach(x => x.classList.toggle('is-open', x === v));
    const hover = matchMedia('(hover: hover)').matches;
    items.forEach(v => {
      if (hover) v.addEventListener('pointerenter', () => open(v));
      v.addEventListener('click', () => open(v));
      v.addEventListener('focus', () => open(v));
    });
  })();

  /* ---------- pillar icons draw in ---------- */
  $$('.pillar').forEach(p => ScrollTrigger.create({ trigger: p, start: 'top 85%', once: true, onEnter: () => p.classList.add('is-drawn') }));

  /* ---------- footer word rises ---------- */
  gsap.from('.footer__word span', { yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* ---------- counters ---------- */
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count, suffix = el.dataset.suffix || '';
    const fmt = v => Math.round(v).toLocaleString('en-US') + suffix;
    if (reduced) return;
    el.textContent = fmt(0);
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: () => gsap.to(obj, { v: end, duration: 1.8, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(obj.v); } }),
    });
  });

  /* ---------- roadmap ---------- */
  (() => {
    const timeline = $('.timeline');
    const fill = document.createElement('span');
    fill.className = 'timeline__fill';
    timeline.prepend(fill);
    gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: timeline, start: 'top 65%', end: 'bottom 65%', scrub: true } });
    $$('.phase').forEach(ph => {
      ScrollTrigger.create({ trigger: ph, start: 'top 65%', onEnter: () => ph.classList.add('is-active'), onLeaveBack: () => ph.classList.remove('is-active') });
    });
  })();

  /* ---------- benefit loop ---------- */
  gsap.to('.loop__arc', { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', scrollTrigger: { trigger: '.loop', start: 'top 75%' } });

  /* ---------- nav ---------- */
  (() => {
    const nav = $('#nav');
    let last = 0;
    ScrollTrigger.create({
      onUpdate: s => {
        const y = s.scroll();
        nav.classList.toggle('is-scrolled', y > 10);
        nav.classList.toggle('is-hidden', y > last && y > 400 && !document.body.classList.contains('menu-open'));
        last = y;
      },
    });
    $$('.nav__links a').forEach(a => {
      const sec = $(a.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: s => a.classList.toggle('is-active', s.isActive) });
    });
  })();

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
