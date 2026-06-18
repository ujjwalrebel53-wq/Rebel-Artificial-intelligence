/* ═══════════════════════════════════════════════════════════
   REBEL AI — ADVANCED JS LAYER v2.0
   Particles, splash, command palette, animations
   ═══════════════════════════════════════════════════════════ */

(function RebelAdvanced() {
  'use strict';

  // ── Splash Screen ─────────────────────────────────────────
  const SPLASH_STEPS = [
    'Loading core modules',
    'Initializing neural network',
    'Connecting AI models',
    'Syncing voice engine',
    'Ready — welcome to Rebel AI',
  ];

  function initSplash() {
    const splash = document.getElementById('rebelSplash');
    const bar = document.getElementById('splashBarFill');
    const status = document.getElementById('splashStatus');
    if (!splash) return;

    if (sessionStorage.getItem('rebel_splash_ok')) {
      splash.classList.add('hidden');
      document.body.style.overflow = '';
      return;
    }

    let progress = 0;
    let step = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 28 + 14;
      if (progress > 100) progress = 100;
      if (bar) bar.style.width = progress + '%';

      const stepIdx = Math.min(Math.floor(progress / 22), SPLASH_STEPS.length - 1);
      if (stepIdx !== step && status) {
        step = stepIdx;
        status.textContent = SPLASH_STEPS[step];
      }

      if (progress >= 100) {
        clearInterval(interval);
        sessionStorage.setItem('rebel_splash_ok', '1');
        setTimeout(() => {
          splash.classList.add('hidden');
          document.body.style.overflow = '';
        }, 180);
      }
    }, 110);

    document.body.style.overflow = 'hidden';
  }

  // ── Particle Network — disabled for performance ───────────
  function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (canvas) canvas.style.display = 'none';
  }

  // ── Scroll perf: throttle paints while scrolling ──────────
  function initScrollPerf() {
    let timer;
    window.addEventListener('scroll', () => {
      document.body.classList.add('is-scrolling');
      clearTimeout(timer);
      timer = setTimeout(() => document.body.classList.remove('is-scrolling'), 140);
    }, { passive: true });
  }

  // ── Scroll Progress ───────────────────────────────────────
  function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const scrollTop = window.pageYOffset;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
    }, { passive: true });
  }

  // ── Hero Typing Effect ────────────────────────────────────
  const HERO_PHRASES = [
    'Unleash the Code.',
    'Think Different.',
    'Break the Rules.',
    'Build the Future.',
    'Rebel Against Limits.',
  ];

  function initHeroTyping() {
    const el = document.getElementById('heroTyping');
    if (!el) return;

    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;

    function tick() {
      const phrase = HERO_PHRASES[phraseIdx];
      if (!deleting) {
        el.textContent = phrase.slice(0, ++charIdx);
        if (charIdx === phrase.length) {
          deleting = true;
          setTimeout(tick, 2200);
          return;
        }
      } else {
        el.textContent = phrase.slice(0, --charIdx);
        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % HERO_PHRASES.length;
        }
      }
      setTimeout(tick, deleting ? 40 : 70);
    }

    setTimeout(tick, 1200);
  }

  // ── Animated Stats Counters ───────────────────────────────
  function initStatsCounters() {
    const cards = document.querySelectorAll('.stat-value[data-target]');
    if (!cards.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.animated) return;
        el.dataset.animated = '1';

        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const decimals = parseInt(el.dataset.decimal) || 0;
        const duration = 2000;
        const start = performance.now();

        function animate(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = target * eased;

          if (decimals > 0) {
            el.textContent = current.toFixed(decimals) + suffix;
          } else if (target >= 1000) {
            el.textContent = Math.floor(current).toLocaleString('en-IN') + suffix;
          } else {
            el.textContent = Math.floor(current) + suffix;
          }

          if (progress < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
        observer.unobserve(el);
      });
    }, { threshold: 0.3 });

    cards.forEach(c => observer.observe(c));
  }

  // ── FAQ Accordion ─────────────────────────────────────────
  function initFAQ() {
    document.querySelectorAll('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq-item');
        const wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
        if (!wasOpen) item.classList.add('open');
      });
    });
  }

  // ── Mobile Menu ───────────────────────────────────────────
  function initMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const nav = document.getElementById('mainNav');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      nav.classList.toggle('open');
      btn.innerHTML = nav.classList.contains('open')
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
    });

    nav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        nav.classList.remove('open');
        btn.innerHTML = '<i class="fas fa-bars"></i>';
      });
    });
  }

  // ── Command Palette ───────────────────────────────────────
  function initCommandPalette() {
    const palette = document.getElementById('cmdPalette');
    const input = document.getElementById('cmdInput');
    const list = document.getElementById('cmdList');
    const backdrop = document.getElementById('cmdBackdrop');
    const openBtn = document.getElementById('openCmdPaletteBtn');
    if (!palette || !input) return;

    let activeIdx = 0;

    function getVisibleItems() {
      return [...list.querySelectorAll('.cmd-item:not(.hidden)')];
    }

    function openPalette() {
      palette.classList.add('open');
      input.value = '';
      filterCommands('');
      activeIdx = 0;
      highlightActive();
      setTimeout(() => input.focus(), 50);
    }

    function closePalette() {
      palette.classList.remove('open');
      input.value = '';
    }

    function filterCommands(q) {
      const query = q.toLowerCase().trim();
      list.querySelectorAll('.cmd-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.classList.toggle('hidden', query && !text.includes(query));
      });
      activeIdx = 0;
      highlightActive();
    }

    function highlightActive() {
      const items = getVisibleItems();
      items.forEach((item, i) => item.classList.toggle('active', i === activeIdx));
      if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
    }

    function runAction(action) {
      closePalette();
      const map = {
        access: () => document.getElementById('accessRebelBtn')?.click(),
        chat: () => {
          document.getElementById('accessRebelBtn')?.click();
          setTimeout(() => document.getElementById('accessChatBtn')?.click(), 300);
        },
        voice: () => {
          document.getElementById('accessRebelBtn')?.click();
          setTimeout(() => document.getElementById('accessVoiceBtn')?.click(), 300);
        },
        codespace: () => document.getElementById('codespaceBtn')?.click(),
        admin: () => document.getElementById('adminPanelBtn')?.click(),
        dev: () => document.getElementById('aboutDevBtn')?.click(),
        features: () => document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' }),
        stats: () => document.querySelector('#stats')?.scrollIntoView({ behavior: 'smooth' }),
        faq: () => document.querySelector('#faq')?.scrollIntoView({ behavior: 'smooth' }),
      };
      map[action]?.();
    }

    openBtn?.addEventListener('click', e => { e.preventDefault(); openPalette(); });
    backdrop?.addEventListener('click', closePalette);

    input.addEventListener('input', () => filterCommands(input.value));
    input.addEventListener('keydown', e => {
      const items = getVisibleItems();
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); highlightActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); highlightActive(); }
      else if (e.key === 'Enter' && items[activeIdx]) { items[activeIdx].click(); }
      else if (e.key === 'Escape') closePalette();
    });

    list.querySelectorAll('.cmd-item').forEach(item => {
      item.addEventListener('click', () => runAction(item.dataset.action));
    });

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        palette.classList.contains('open') ? closePalette() : openPalette();
      }
      if (e.key === 'Escape' && palette.classList.contains('open')) closePalette();
    });
  }

  // ── CTA & Terminal Button Wiring ──────────────────────────
  function initCTAButtons() {
    document.getElementById('ctaAccessBtn')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('accessRebelBtn')?.click();
    });
    document.getElementById('ctaVoiceBtn')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('accessRebelBtn')?.click();
      setTimeout(() => document.getElementById('accessVoiceBtn')?.click(), 300);
    });
    document.getElementById('terminalCodespaceBtn')?.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('codespaceBtn')?.click();
    });
  }

  // ── Terminal Demo Animation ─────────────────────────────────
  function initTerminalDemo() {
    const terminal = document.getElementById('demoTerminal');
    if (!terminal) return;

    let running = false;
    let timerId = null;

    const commands = [
      { cmd: 'rebel status --all', out: ['API: online ✓', 'Voice: ready ✓', 'Codespace: active ✓'] },
      { cmd: 'rebel chat "Explain quantum computing"', out: ['Rebel Gpt: Quantum computing uses qubits…'] },
      { cmd: 'rebel deploy --production', out: ['Deploying to edge network…', '✓ Live at rebel-ai.dev'] },
    ];
    let cmdIdx = 0;

    function tick() {
      if (!running) return;
      const c = commands[cmdIdx % commands.length];
      cmdIdx++;

      const cursorLine = terminal.querySelector('.t-line:last-child');
      if (cursorLine) cursorLine.remove();

      const cmdLine = document.createElement('div');
      cmdLine.className = 't-line';
      cmdLine.innerHTML = `<span class="t-prompt">rebel@ai:~$</span> ${c.cmd}`;
      terminal.appendChild(cmdLine);

      c.out.forEach((line, i) => {
        setTimeout(() => {
          if (!running) return;
          const outLine = document.createElement('div');
          outLine.className = 't-line t-out';
          outLine.textContent = line;
          terminal.appendChild(outLine);
          terminal.scrollTop = terminal.scrollHeight;
        }, (i + 1) * 400);
      });

      setTimeout(() => {
        if (!running) return;
        const newCursor = document.createElement('div');
        newCursor.className = 't-line';
        newCursor.innerHTML = '<span class="t-prompt">rebel@ai:~$</span> <span class="t-cursor">▌</span>';
        terminal.appendChild(newCursor);

        while (terminal.children.length > 12) {
          terminal.removeChild(terminal.firstChild);
        }
      }, c.out.length * 400 + 300);
    }

    function startDemo() {
      if (running) return;
      running = true;
      tick();
      timerId = setInterval(tick, 8000);
    }

    function stopDemo() {
      running = false;
      if (timerId) clearInterval(timerId);
      timerId = null;
    }

    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) startDemo();
          else stopDemo();
        });
      }, { threshold: 0.15 });
      obs.observe(terminal);
    } else {
      startDemo();
    }
  }

  // ── Clear Chat Button ─────────────────────────────────────
  function initClearChat() {
    document.getElementById('clearChatBtn')?.addEventListener('click', () => {
      const chatMessages = document.getElementById('chatMessages');
      if (!chatMessages) return;
      if (!confirm('Clear all chat messages?')) return;
      chatMessages.innerHTML = '<div class="message bot-message">Chat cleared. Welcome back to Rebel Gpt!</div>';
      try {
        const cu = JSON.parse(localStorage.getItem('rbl_current_user'));
        const key = 'rbl_chat_history_' + (cu?.email || 'guest');
        localStorage.removeItem(key);
      } catch (e) {}
    });
  }

  // ── Markdown Renderer (exported for main.js) ────────────────
  function renderMarkdown(text) {
    if (!text) return '';

    const codeBlocks = [];
    let html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push({ lang: lang || 'code', code: code.trim() });
      return `%%CODEBLOCK_${idx}%%`;
    });

    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="msg-inline-code">$1</code>')
      .replace(/^### (.+)$/gm, '<strong style="display:block;margin:8px 0 4px;font-size:0.95em;">$1</strong>')
      .replace(/^## (.+)$/gm, '<strong style="display:block;margin:10px 0 4px;font-size:1em;">$1</strong>')
      .replace(/^# (.+)$/gm, '<strong style="display:block;margin:12px 0 6px;font-size:1.05em;">$1</strong>')
      .replace(/^[-•] (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">• $1</div>')
      .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:12px;margin:3px 0;">$&</div>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    codeBlocks.forEach((block, idx) => {
      const langMap = { js: 'app.js', javascript: 'app.js', ts: 'app.ts', html: 'index.html', css: 'style.css', md: 'README.md', python: 'app.py', php: 'index.php' };
      const langKey = (block.lang || 'code').toLowerCase();
      const fakeFile = langMap[langKey] || ('snippet.' + (langKey === 'code' ? 'txt' : langKey));
      let body;
      if (window.RebelSyntax && window.RebelSyntax.highlightCode) {
        body = window.RebelSyntax.highlightCode(block.code, fakeFile);
      } else {
        body = block.code
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
      const blockHtml = `<div class="msg-code-block"><div class="msg-code-header"><span>${block.lang || 'code'}</span><button class="msg-code-copy" onclick="RebelAdvanced.copyCode(this)"><i class="fas fa-copy"></i> Copy</button></div><pre>${body}</pre></div>`;
      html = html.replace(`%%CODEBLOCK_${idx}%%`, blockHtml);
    });

    return html;
  }

  function copyCode(btn) {
    const pre = btn.closest('.msg-code-block')?.querySelector('pre');
    if (!pre) return;
    navigator.clipboard.writeText(pre.textContent).then(() => {
      btn.innerHTML = '<i class="fas fa-check"></i> Copied';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 2000);
    });
  }

  function copyMessage(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // ── Init ──────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    initScrollPerf();
    initScrollProgress();
    initHeroTyping();
    initStatsCounters();
    initFAQ();
    initMobileMenu();
    initCommandPalette();
    initCTAButtons();
    initClearChat();

    requestAnimationFrame(() => {
      initParticles();
      initTerminalDemo();
    });
  });

  window.RebelAdvanced = { renderMarkdown, copyCode, copyMessage };
})();
