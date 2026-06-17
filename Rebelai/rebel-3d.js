/* Rebel AI — Three.js 3D Background + Card Tilt */
(function Rebel3D() {
  'use strict';

  function initThreeBackground() {
    const canvas = document.getElementById('rebel3dCanvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 30;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Main torus knot — Rebel purple core
    const knotGeo = new THREE.TorusKnotGeometry(8, 2.2, 128, 16);
    const knotMat = new THREE.MeshBasicMaterial({
      color: 0x8a2be2,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.position.set(12, 2, -15);
    scene.add(knot);

    // Inner glow sphere
    const sphereGeo = new THREE.IcosahedronGeometry(6, 1);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x00ced1,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-10, -3, -20);
    scene.add(sphere);

    // Particle field
    const pCount = 400;
    const positions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) positions[i] = (Math.random() - 0.5) * 80;
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x00ced1, size: 0.15, transparent: true, opacity: 0.6 });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Ring
    const ringGeo = new THREE.RingGeometry(14, 14.3, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8a2be2, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(0, 0, -25);
    scene.add(ring);

    let mx = 0, my = 0;
    document.addEventListener('mousemove', e => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      knot.rotation.x += 0.003;
      knot.rotation.y += 0.005;
      sphere.rotation.x -= 0.002;
      sphere.rotation.y += 0.004;
      particles.rotation.y += 0.0005;
      ring.rotation.z += 0.001;

      camera.position.x += (mx * 4 - camera.position.x) * 0.03;
      camera.position.y += (-my * 3 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(animId);
      else animate();
    });
  }

  function initCardTilt() {
    document.querySelectorAll('.card-3d-tilt').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(10px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  function initHeroTilt() {
    const hero = document.getElementById('hero3dVisual');
    if (!hero) return;
    document.addEventListener('mousemove', e => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      hero.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg)`;
    });
  }

  function initScroll3D() {
    const sections = document.querySelectorAll('.scene-3d, .stats-section, .how-section, .cta-section');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-3d-in');
          entry.target.querySelectorAll('.feature-card, .stat-card, .timeline-item, .faq-item').forEach((el, i) => {
            el.style.animationDelay = (i * 0.08) + 's';
            el.classList.add('section-3d-in');
          });
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    sections.forEach(s => obs.observe(s));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThreeBackground();
    initCardTilt();
    initHeroTilt();
    initScroll3D();
  });
})();
