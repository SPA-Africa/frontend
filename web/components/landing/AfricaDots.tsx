'use client';

// Particle map of Africa for the hero. Ported from the static site: dots ease
// into the outline on load, push away from the pointer and drift apart as the
// hero scrolls out of view. Recolours when the theme toggle fires `spa-theme`.

import { useEffect, useRef } from 'react';
import { AFRICA_ASPECT, AFRICA_POINTS } from '@/lib/africa-points';

// colours sampled from the logo; light theme skips the palest gold so dots stay visible on white
const palettes = {
  dark: ['#a82a02', '#cb3302', '#d4461a', '#d95a1c', '#e0782a', '#eba12c', '#f2c060'],
  light: ['#a82a02', '#b82e02', '#cb3302', '#d4461a', '#d95a1c', '#e38a28', '#eba12c'],
};

interface Particle {
  hx: number; hy: number; x: number; y: number; vx: number; vy: number;
  r: number; t: number; c: string; ph: number; dx: number; dy: number;
}

export default function AfricaDots({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    const hero = canvas?.parentElement;
    if (!canvas || !ctx || !hero) return;

    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const palette = () => palettes[root.dataset.theme === 'dark' ? 'dark' : 'light'];

    let W = 0, H = 0, particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999 };
    let scatter = 0, formed = reduced ? 1 : 0, running = true, raf = 0, lastT = 0, formStart = 0;

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas!.clientWidth; H = canvas!.clientHeight;
      canvas!.width = W * dpr; canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = W < 769;
      const h = mobile ? Math.min(H * 0.42, (W * 0.9) / AFRICA_ASPECT) : Math.min(H * 0.78, (W * 0.42) / AFRICA_ASPECT);
      const w = h * AFRICA_ASPECT;
      const ox = mobile ? (W - w) / 2 : W - w - Math.max(24, W * 0.06);
      const oy = mobile ? 24 : (H - h) / 2 + 20;
      const step = mobile ? 2 : 1;
      const pal = palette();
      const prev = particles;
      particles = [];
      for (let i = 0; i < AFRICA_POINTS.length; i += step) {
        const [nx, ny] = AFRICA_POINTS[i];
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
      canvas!.style.opacity = mobile ? '0.6' : '1';
    }

    function tick(time: number) {
      if (!running) { lastT = 0; raf = 0; return; }
      // "form" easing: power2.out over 2.4s
      if (formed < 1) {
        if (!formStart) formStart = time;
        const p = Math.min(1, (time - formStart) / 2400);
        formed = 1 - (1 - p) * (1 - p);
      }
      const t = time * 0.001;
      // normalise physics to 60fps so high-refresh screens behave the same
      const dt = lastT ? Math.min(3, (time - lastT) / 16.67) : 1;
      lastT = time;
      ctx!.clearRect(0, 0, W, H);
      const R = 110, R2 = R * R;
      const spread = scatter * Math.max(W, H) * 0.6;
      const k = 0.02 + formed * 0.05;
      const damp = Math.pow(0.82, dt);
      const buckets: Record<string, Particle[]> = {};
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
        ctx!.fillStyle = c;
        ctx!.beginPath();
        for (const p of buckets[c]) { ctx!.moveTo(p.x + p.r, p.y); ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        ctx!.fill();
      }
      raf = requestAnimationFrame(tick);
    }

    // dots drift apart as the hero scrolls away; pause drawing once it is off screen
    function onScroll() {
      const r = hero!.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      scatter = progress * progress * 0.9;
      const was = running;
      running = progress < 1;
      if (running && !was && !raf) raf = requestAnimationFrame(tick);
    }
    const onMove = (e: PointerEvent) => {
      const r = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const onLeave = () => { mouse.x = mouse.y = -9999; };
    const recolor = () => { const pal = palette(); particles.forEach(p => { p.c = pal[Math.round(p.t * (pal.length - 1))]; }); };

    layout();
    onScroll();
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', layout);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('spa-theme', recolor);
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      running = false;
      window.removeEventListener('resize', layout);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('spa-theme', recolor);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
