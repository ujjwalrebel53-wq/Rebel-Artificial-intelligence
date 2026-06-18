/* Rebel AI v3 — Advanced platform layer (perf-safe) */
(function RebelV3() {
  'use strict';

  const THEMES = ['default', 'midnight', 'neon'];

  function initV3Class() {
    document.documentElement.classList.add('rebel-v3');
  }

  function initTheme() {
    const saved = localStorage.getItem('rebel_theme') || 'default';
    applyTheme(saved);

    document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-rebel-theme') || 'default';
      const idx = THEMES.indexOf(cur);
      const next = THEMES[(idx + 1) % THEMES.length];
      applyTheme(next);
      localStorage.setItem('rebel_theme', next);
    });
  }

  function applyTheme(name) {
    if (!name || name === 'default') {
      document.documentElement.removeAttribute('data-rebel-theme');
    } else {
      document.documentElement.setAttribute('data-rebel-theme', name);
    }
    const btn = document.getElementById('themeToggleBtn');
    if (btn) {
      const icons = { default: 'fa-moon', midnight: 'fa-star', neon: 'fa-bolt' };
      btn.innerHTML = '<i class="fas ' + (icons[name] || 'fa-moon') + '"></i>';
    }
  }

  function initScrollSpy() {
    const links = document.querySelectorAll('.main-nav .nav-link[href^="#"]');
    if (!links.length) return;

    const sections = [...links]
      .map(a => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
      });
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    sections.forEach(s => obs.observe(s));
  }

  function initBackToTop() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.pageYOffset > 400);
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    const openBtn = document.getElementById('openShortcutsBtn');
    const closeBtn = document.getElementById('closeShortcutsBtn');
    if (!modal) return;

    function open() { modal.classList.add('open'); }
    function close() { modal.classList.remove('open'); }

    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.addEventListener('keydown', e => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        modal.classList.contains('open') ? close() : open();
      }
      if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });
  }

  function initLiveStatus() {
    const pill = document.getElementById('apiStatusPill');
    if (!pill) return;

    async function ping() {
      try {
        const r = await fetch('/api/public/settings', { cache: 'no-store' });
        if (!r.ok) throw new Error('offline');
        pill.className = 'api-status-pill online';
        pill.innerHTML = '<span class="api-status-dot"></span> API Live';
      } catch (e) {
        pill.className = 'api-status-pill offline';
        pill.innerHTML = '<span class="api-status-dot"></span> Local';
      }
    }

    ping();
    setInterval(ping, 60000);
  }

  function initCapabilityCards() {
    const map = {
      chat: () => {
        document.getElementById('accessRebelBtn')?.click();
        setTimeout(() => document.getElementById('accessChatBtn')?.click(), 350);
      },
      voice: () => {
        document.getElementById('accessRebelBtn')?.click();
        setTimeout(() => document.getElementById('accessVoiceBtn')?.click(), 350);
      },
      codespace: () => document.getElementById('codespaceBtn')?.click(),
      admin: () => document.getElementById('adminPanelBtn')?.click(),
    };

    document.querySelectorAll('.cap-card[data-cap]').forEach(card => {
      card.addEventListener('click', () => map[card.dataset.cap]?.());
    });
  }

  function extendCommandPalette() {
    const list = document.getElementById('cmdList');
    if (!list) return;

    const extras = [
      { action: 'capabilities', icon: 'fa-th-large', label: 'Platform Capabilities' },
      { action: 'shortcuts', icon: 'fa-keyboard', label: 'Keyboard Shortcuts' },
      { action: 'theme', icon: 'fa-palette', label: 'Cycle Theme' },
    ];

    extras.forEach(item => {
      if (list.querySelector('[data-action="' + item.action + '"]')) return;
      const btn = document.createElement('button');
      btn.className = 'cmd-item';
      btn.dataset.action = item.action;
      btn.innerHTML = '<i class="fas ' + item.icon + '"></i><span>' + item.label + '</span>';
      btn.addEventListener('click', () => {
        document.getElementById('cmdPalette')?.classList.remove('open');
        if (item.action === 'capabilities') document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' });
        if (item.action === 'shortcuts') document.getElementById('shortcutsModal')?.classList.add('open');
        if (item.action === 'theme') document.getElementById('themeToggleBtn')?.click();
      });
      list.appendChild(btn);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initV3Class();
    initTheme();
    initScrollSpy();
    initBackToTop();
    initShortcutsModal();
    initLiveStatus();
    initCapabilityCards();
    setTimeout(extendCommandPalette, 100);
  });
})();
