/* Rebel AI — lightweight scroll reveal only (no WebGL / mouse tracking) */
(function Rebel3D() {
  'use strict';

  function initScrollReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const sections = document.querySelectorAll('.scene-3d, .stats-section, .how-section, .cta-section');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('section-3d-in');
        entry.target.querySelectorAll('.feature-card, .stat-card, .timeline-item, .faq-item').forEach((el, i) => {
          el.style.animationDelay = (i * 0.05) + 's';
          el.classList.add('section-3d-in');
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -24px 0px' });

    sections.forEach(s => obs.observe(s));
  }

  document.addEventListener('DOMContentLoaded', initScrollReveal);
})();
