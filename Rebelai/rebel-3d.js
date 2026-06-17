/* Rebel AI — Three.js 3D Background + Card Tilt (performance tuned) */
(function Rebel3D() {
  'use strict';

  const mqMobile = window.matchMedia('(max-width: 768px)');
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  function isMobile() {
    return mqMobile.matches;
  }

  function isLowEnd() {
    if (isMobile()) return true;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 8;
    return cores <= 4 || mem <= 4;
  }

  function waitForSplash(cb) {
    const splash = document.getElementById('rebelSplash');
    if (!splash || splash.classList.contains('hidden')) {
      requestAnimationFrame(cb);
      return;
    }
    const obs = new MutationObserver(() => {
      if (splash.classList.contains('hidden')) {
        obs.disconnect();
        setTimeout(cb, 120);
      }
    });
    obs.observe(splash, { attributes: true, attributeFilter: ['class'] });
    setTimeout(cb, 4000);
  }

  function loadThree(cb) {
    if (typeof THREE !== 'undefined') {
      cb();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.async = true;
    s.onload = cb;
    s.onerror = () => document.body.classList.add('rebel-3d-fallback');
    document.body.appendChild(s);
  }

  function initPointerBridge() {
    let mx = 0;
    let my = 0;
    let pending = false;

    document.addEventListener('mousemove', e => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          window.__REBEL_POINTER__ = { mx, my, x: e.clientX, y: e.clientY };
          document.dispatchEvent(new CustomEvent('rebel:pointer', { detail: window.__REBEL_POINTER__ }));
        });
      }
    }, { passive: true });

    window.__REBEL_POINTER__ = { mx: 0, my: 0, x: 0, y: 0 };
  }

  function initThreeBackground() {
    if (mqReduce.matches) {
      document.body.classList.add('rebel-3d-fallback');
      return;
    }

    const canvas = document.getElementById('rebel3dCanvas');
    if (!canvas) return;

    window.__REBEL_3D_ACTIVE__ = true;
    document.body.classList.add('rebel-3d-active');

    const low = isLowEnd();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !low,
      powerPreference: low ? 'low-power' : 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, low ? 1 : 1.5));

    const knotSegs = low ? 64 : 96;
    const knotGeo = new THREE.TorusKnotGeometry(8, 2.2, knotSegs, low ? 8 : 12);
    const knotMat = new THREE.MeshBasicMaterial({
      color: 0x8a2be2,
      wireframe: true,
      transparent: true,
      opacity: low ? 0.28 : 0.38,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.set(12, 2, -15);
    scene.add(knot);

    const sphereGeo = new THREE.IcosahedronGeometry(6, low ? 0 : 1);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00ced1,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-10, -3, -20);
    scene.add(sphere);

    const pCount = low ? 120 : 220;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) positions[i] = (Math.random() - 0.5) * 80;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x00ced1, size: low ? 0.12 : 0.15, transparent: true, opacity: 0.55 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    let running = true;
    let visible = true;
    let animId = 0;
    const targetFps = low ? 24 : 40;
    const frameInterval = 1000 / targetFps;
    let lastFrame = 0;

    function animate(now) {
      animId = requestAnimationFrame(animate);
      if (!running || !visible) return;

      if (now - lastFrame < frameInterval) return;
      lastFrame = now;

      const ptr = window.__REBEL_POINTER__ || { mx: 0, my: 0 };
      knot.rotation.x += 0.003;
      knot.rotation.y += 0.005;
      sphere.rotation.x -= 0.002;
      sphere.rotation.y += 0.004;
      particles.rotation.y += 0.0005;

      camera.position.x += (ptr.mx * 4 - camera.position.x) * 0.03;
      camera.position.y += (-ptr.my * 3 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }

    function start() {
      if (!running) {
        running = true;
        lastFrame = 0;
        animate(performance.now());
      }
    }

    function stop() {
      running = false;
      cancelAnimationFrame(animId);
    }

    animate(performance.now());

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
      else if (visible) start();
    });

    const hero = document.querySelector('.hero');
    if (hero && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        visible = entries.some(e => e.isIntersecting);
        if (visible && !document.hidden) start();
        else stop();
      }, { rootMargin: '120px 0px', threshold: 0 });
      obs.observe(hero);
    }

    document.addEventListener('rebel:scroll-idle', () => start());
    document.addEventListener('rebel:scroll-active', () => {
      if (low) stop();
    });
  }

  function initCardTilt() {
    if (mqReduce.matches || isMobile()) return;

    document.querySelectorAll('.card-3d-tilt').forEach(card => {
      let raf = 0;
      card.addEventListener('mousemove', e => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width - 0.5;
          const y = (e.clientY - rect.top) / rect.height - 0.5;
          card.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(12px)`;
        });
      }, { passive: true });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  function initHeroTilt() {
    const hero = document.getElementById('hero3dVisual');
    if (!hero || mqReduce.matches || isMobile()) return;

    document.addEventListener('rebel:pointer', e => {
      const { mx, my } = e.detail;
      hero.style.transform = `perspective(1000px) rotateY(${mx * 18}deg) rotateX(${-my * 18}deg)`;
    });
  }

  function initScroll3D() {
    const sections = document.querySelectorAll('.scene-3d, .stats-section, .how-section, .cta-section');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('section-3d-in');
        entry.target.querySelectorAll('.feature-card, .stat-card, .timeline-item, .faq-item').forEach((el, i) => {
          el.style.animationDelay = (i * 0.07) + 's';
          el.classList.add('section-3d-in');
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    sections.forEach(s => obs.observe(s));
  }

  function initMagneticButtons() {
    if (isMobile() || mqReduce.matches) return;

    document.querySelectorAll('.btn-access-rebel, .btn-codespace, .btn-primary').forEach(btn => {
      btn.classList.add('btn-magnetic');
      btn.addEventListener('mousemove', e => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px) translateZ(8px)`;
      }, { passive: true });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPointerBridge();
    initCardTilt();
    initHeroTilt();
    initScroll3D();
    initMagneticButtons();

    waitForSplash(() => {
      loadThree(() => {
        try {
          initThreeBackground();
        } catch (err) {
          document.body.classList.add('rebel-3d-fallback');
          console.warn('Rebel 3D fallback:', err);
        }
      });
    });
  });
})();
