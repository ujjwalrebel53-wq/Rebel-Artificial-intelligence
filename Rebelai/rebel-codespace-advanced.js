/* Rebel Codespace Advanced v4 — palette, templates, minimap, diff, zip */
(function RebelCodespaceAdvanced() {
  'use strict';

  const $ = id => document.getElementById(id);
  let CS = null;
  let paletteIdx = 0;
  let zenMode = false;

  const TEMPLATES = {
    landing: {
      name: 'Landing Page',
      icon: 'fa-rocket',
      desc: 'Hero + features + CTA',
      files: {
        'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Rebel Launch</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <header class="nav">\n    <strong>Rebel</strong>\n    <nav><a href="#features">Features</a><a href="#cta">Start</a></nav>\n  </header>\n  <section class="hero">\n    <h1>Build faster with Rebel AI</h1>\n    <p>Codespace, live preview, private terminal — all in one.</p>\n    <button id="ctaBtn" type="button">Get Started</button>\n  </section>\n  <section id="features" class="features">\n    <article><h3>AI Pair</h3><p>Fix bugs & generate code instantly.</p></article>\n    <article><h3>Live Preview</h3><p>See changes in real time.</p></article>\n    <article><h3>Private Shell</h3><p>Your own terminal workspace.</p></article>\n  </section>\n  <footer>© Rebel AI</footer>\n  <script src="app.js"><\/script>\n</body>\n</html>`,
        'style.css': `* { box-sizing: border-box; margin: 0; }\nbody { font-family: system-ui, sans-serif; background: #0a0a12; color: #fff; }\n.nav { display: flex; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }\n.nav a { color: #00ced1; margin-left: 16px; text-decoration: none; }\n.hero { text-align: center; padding: 80px 20px; background: linear-gradient(180deg, rgba(138,43,226,0.2), transparent); }\n.hero h1 { font-size: clamp(2rem, 5vw, 3.2rem); margin-bottom: 12px; }\n.hero p { opacity: 0.75; max-width: 520px; margin: 0 auto 24px; }\n#ctaBtn { padding: 14px 32px; border: none; border-radius: 10px; background: linear-gradient(135deg, #8a2be2, #00ced1); color: #fff; font-weight: 600; cursor: pointer; }\n.features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 40px 24px; max-width: 960px; margin: 0 auto; }\n.features article { padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(138,43,226,0.25); }\nfooter { text-align: center; padding: 24px; opacity: 0.4; font-size: 0.85rem; }`,
        'app.js': `document.getElementById('ctaBtn')?.addEventListener('click', () => {\n  alert('Rebel Codespace — you are live!');\n});`,
        'README.md': '# Landing Page Template\n\nEdit index.html, style.css, app.js. Press F5 for preview.',
      },
    },
    todo: {
      name: 'Todo App',
      icon: 'fa-check-square',
      desc: 'Add, complete, filter tasks',
      files: {
        'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Rebel Todo</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main class="todo-app">\n    <h1>Rebel Todo</h1>\n    <form id="todoForm"><input id="todoInput" placeholder="New task…" autocomplete="off"><button type="submit">Add</button></form>\n    <ul id="todoList"></ul>\n    <p class="stats"><span id="todoCount">0</span> items</p>\n  </main>\n  <script src="app.js"><\/script>\n</body>\n</html>`,
        'style.css': `body { font-family: system-ui; background: #12121a; color: #fff; min-height: 100vh; display: grid; place-items: center; margin: 0; }\n.todo-app { width: min(420px, 92vw); padding: 24px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(0,206,209,0.3); }\nh1 { color: #8a2be2; margin-bottom: 16px; font-size: 1.6rem; }\n#todoForm { display: flex; gap: 8px; margin-bottom: 16px; }\n#todoInput { flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: #1a1a24; color: #fff; }\nbutton { padding: 10px 16px; border: none; border-radius: 8px; background: #8a2be2; color: #fff; cursor: pointer; }\n#todoList { list-style: none; padding: 0; margin: 0; }\n#todoList li { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }\n#todoList li.done span { text-decoration: line-through; opacity: 0.45; }\n.stats { margin-top: 12px; font-size: 0.85rem; opacity: 0.6; }`,
        'app.js': `const list = document.getElementById('todoList');\nconst count = document.getElementById('todoCount');\nlet todos = JSON.parse(localStorage.getItem('rebel_todos') || '[]');\n\nfunction render() {\n  list.innerHTML = '';\n  todos.forEach((t, i) => {\n    const li = document.createElement('li');\n    if (t.done) li.className = 'done';\n    li.innerHTML = '<input type="checkbox" ' + (t.done ? 'checked' : '') + '><span>' + t.text + '</span><button type="button" data-i="' + i + '">×</button>';\n    li.querySelector('input').onchange = () => { todos[i].done = !todos[i].done; save(); };\n    li.querySelector('button').onclick = () => { todos.splice(i, 1); save(); };\n    list.appendChild(li);\n  });\n  count.textContent = todos.filter(t => !t.done).length;\n}\nfunction save() { localStorage.setItem('rebel_todos', JSON.stringify(todos)); render(); }\n\ndocument.getElementById('todoForm').onsubmit = e => {\n  e.preventDefault();\n  const inp = document.getElementById('todoInput');\n  const text = inp.value.trim();\n  if (!text) return;\n  todos.push({ text, done: false });\n  inp.value = '';\n  save();\n};\nrender();`,
        'README.md': '# Todo App\n\nLocalStorage todos. Try live preview!',
      },
    },
    dashboard: {
      name: 'Dashboard',
      icon: 'fa-chart-line',
      desc: 'Stats cards + chart bars',
      files: {
        'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Rebel Dashboard</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="dash">\n    <aside class="sidebar"><h2>Rebel</h2><a class="active">Overview</a><a>Analytics</a></aside>\n    <main>\n      <h1>Dashboard</h1>\n      <div class="cards" id="cards"></div>\n      <div class="chart" id="chart"></div>\n    </main>\n  </div>\n  <script src="app.js"><\/script>\n</body>\n</html>`,
        'style.css': `* { box-sizing: border-box; } body { margin: 0; font-family: system-ui; background: #0d0d14; color: #fff; }\n.dash { display: flex; min-height: 100vh; }\n.sidebar { width: 200px; padding: 20px; background: #12121c; border-right: 1px solid rgba(255,255,255,0.06); }\n.sidebar a { display: block; padding: 8px 0; color: rgba(255,255,255,0.5); text-decoration: none; }\n.sidebar a.active { color: #00ced1; }\nmain { flex: 1; padding: 24px; }\n.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 20px 0; }\n.card { padding: 16px; border-radius: 12px; background: rgba(138,43,226,0.15); border: 1px solid rgba(138,43,226,0.3); }\n.card strong { font-size: 1.8rem; display: block; color: #00ced1; }\n.chart { display: flex; align-items: flex-end; gap: 8px; height: 120px; }\n.bar { flex: 1; background: linear-gradient(180deg, #8a2be2, #00ced1); border-radius: 6px 6px 0 0; min-height: 8px; }`,
        'app.js': `const stats = [{ label: 'Users', val: 1284 }, { label: 'Sessions', val: 432 }, { label: 'AI Calls', val: 8901 }, { label: 'Uptime', val: '99.9%' }];\nconst cards = document.getElementById('cards');\nstats.forEach(s => {\n  cards.insertAdjacentHTML('beforeend', '<div class="card"><span>' + s.label + '</span><strong>' + s.val + '</strong></div>');\n});\nconst chart = document.getElementById('chart');\n[40, 65, 45, 80, 55, 90, 70].forEach(h => {\n  const b = document.createElement('div');\n  b.className = 'bar';\n  b.style.height = h + '%';\n  chart.appendChild(b);\n});`,
        'README.md': '# Dashboard Template',
      },
    },
  };

  const PALETTE_CMDS = [
    { id: 'save', label: 'Save Project', icon: 'fa-save', kbd: 'Ctrl+S', run: () => CS.saveProject({ manual: true }) },
    { id: 'preview', label: 'Live Preview', icon: 'fa-eye', kbd: 'F5', run: () => CS.runPreview() },
    { id: 'palette', label: 'Command Palette', icon: 'fa-terminal', kbd: 'Ctrl+Shift+P', run: () => openPalette() },
    { id: 'fix-all-ai', label: 'Fix All with AI', icon: 'fa-robot', run: () => CS.fixWithAi() },
    { id: 'lint', label: 'Scan Problems', icon: 'fa-exclamation-triangle', run: () => { CS.runLinter(); CS.showTermPanel('problems'); } },
    { id: 'zen', label: 'Toggle Zen Mode', icon: 'fa-compress', kbd: 'Ctrl+K Z', run: () => toggleZen() },
    { id: 'templates', label: 'Project Templates', icon: 'fa-layer-group', run: () => CS.showPanel('templates') },
    { id: 'export-zip', label: 'Export as ZIP', icon: 'fa-file-archive', run: () => exportZip() },
    { id: 'new-file', label: 'New File', icon: 'fa-file', run: () => document.getElementById('ide-new-file-btn')?.click() },
    { id: 'format', label: 'Format Document', icon: 'fa-magic', run: () => document.getElementById('ide-format-btn')?.click() },
    { id: 'find', label: 'Search in Files', icon: 'fa-search', kbd: 'Ctrl+F', run: () => { CS.showPanel('search'); $('ide-search-input')?.focus(); } },
    { id: 'git', label: 'Source Control', icon: 'fa-code-branch', run: () => CS.showPanel('git') },
    { id: 'terminal', label: 'Private Terminal', icon: 'fa-lock', run: () => CS.showTermPanel('terminal') },
    { id: 'explain', label: 'AI: Explain Selection', icon: 'fa-lightbulb', run: () => aiQuick('explain') },
    { id: 'refactor', label: 'AI: Refactor Selection', icon: 'fa-wrench', run: () => aiQuick('refactor') },
    { id: 'tests', label: 'AI: Generate Tests', icon: 'fa-vial', run: () => aiQuick('tests') },
  ];

  function toast(msg) {
    let t = document.querySelector('.ide-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ide-toast';
      $('codespaceModal')?.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  function updateBreadcrumb() {
    const el = $('ide-breadcrumb-file');
    if (el && CS) el.textContent = CS.getCurrentFile() || 'app.js';
  }

  function updateMinimap() {
    const map = $('ide-minimap');
    const ta = $('ide-textarea');
    if (!map || !ta) return;
    const lines = ta.value.split('\n');
    const max = 80;
    const slice = lines.length > max ? lines.filter((_, i) => i % Math.ceil(lines.length / max) === 0) : lines;
    map.innerHTML = slice.map(line => {
      let cls = 'mm-code';
      const t = line.trim();
      if (!t) cls = 'mm-empty';
      else if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) cls = 'mm-comment';
      else if (/^(function|const|let|var|class|import|export|if|for|while|return)\b/.test(t)) cls = 'mm-kw';
      else if (t.includes('error') || t.includes('Error')) cls = 'mm-error';
      return `<span class="${cls}"></span>`;
    }).join('');
    const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
    map.style.setProperty('--mm-scroll', (ratio * 100) + '%');
  }

  function renderTemplates() {
    const el = $('ide-templates-list');
    if (!el) return;
    el.innerHTML = Object.entries(TEMPLATES).map(([key, t]) =>
      `<button type="button" class="ide-template-card" data-template="${key}">
        <i class="fas ${t.icon}"></i>
        <strong>${t.name}</strong>
        <span>${t.desc}</span>
      </button>`
    ).join('');
    el.querySelectorAll('.ide-template-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = TEMPLATES[btn.dataset.template];
        if (!tpl) return;
        if (!confirm('Load "' + tpl.name + '" template? Current unsaved work will be replaced.')) return;
        CS.applyTemplate(tpl.files);
        toast('Template: ' + tpl.name);
        updateBreadcrumb();
        updateMinimap();
      });
    });
  }

  function renderGitDiff() {
    const el = $('ide-git-diff');
    if (!el || !CS) return;
    const files = CS.getFiles();
    const snap = CS.getSavedSnapshot();
    const dirty = CS.getDirty();
    const changed = Object.keys(files).filter(f => dirty[f] || files[f] !== snap[f]);
    if (!changed.length) {
      el.innerHTML = '<p class="ide-diff-empty">No changes to show</p>';
      return;
    }
    el.innerHTML = changed.map(f => {
      const oldL = (snap[f] || '').split('\n');
      const newL = (files[f] || '').split('\n');
      const lines = [];
      const max = Math.max(oldL.length, newL.length);
      for (let i = 0; i < max && lines.length < 40; i++) {
        const o = oldL[i]; const n = newL[i];
        if (o === n) continue;
        if (o !== undefined) lines.push(`<div class="ide-diff-del">− ${esc(o)}</div>`);
        if (n !== undefined) lines.push(`<div class="ide-diff-add">+ ${esc(n)}</div>`);
      }
      return `<div class="ide-diff-file"><button type="button" class="ide-diff-head" data-file="${escAttr(f)}">${f}</button>${lines.join('') || '<div class="ide-diff-add">+ (modified)</div>'}</div>`;
    }).join('');
    el.querySelectorAll('.ide-diff-head').forEach(btn => {
      btn.addEventListener('click', () => CS.openFile(btn.dataset.file));
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

  function replaceInProject(find, replace, all) {
    if (!find) return 0;
    CS.syncEditor();
    const cur = CS.getCurrentFile();
    let total = 0;

    if (!all) {
      const ta = $('ide-textarea');
      if (ta && ta.value.includes(find)) {
        const idx = ta.value.indexOf(find);
        ta.value = ta.value.slice(0, idx) + replace + ta.value.slice(idx + find.length);
        ta.dispatchEvent(new Event('input'));
        return 1;
      }
      toast('No matches');
      return 0;
    }

    const files = CS.getFiles();
    Object.keys(files).forEach(name => {
      if (!files[name] || !files[name].includes(find)) return;
      const parts = files[name].split(find);
      total += parts.length - 1;
      CS.updateFile(name, parts.join(replace));
    });
    if (total) {
      CS.openFile(cur);
      toast('Replaced ' + total + ' occurrence(s)');
    } else {
      toast('No matches');
    }
    return total;
  }

  function openPalette(filter) {
    const pal = $('ide-cmd-palette');
    if (!pal) return;
    pal.classList.add('open');
    const inp = $('ide-cmd-input');
    if (inp) {
      inp.value = filter || '';
      renderPaletteList(inp.value);
      inp.focus();
    }
    paletteIdx = 0;
  }

  function closePalette() {
    $('ide-cmd-palette')?.classList.remove('open');
  }

  function renderPaletteList(q) {
    const list = $('ide-cmd-list');
    if (!list) return;
    const query = (q || '').toLowerCase();
    const hits = PALETTE_CMDS.filter(c => !query || c.label.toLowerCase().includes(query) || c.id.includes(query));
    list.innerHTML = hits.map((c, i) =>
      `<button type="button" class="ide-cmd-item${i === paletteIdx ? ' active' : ''}" data-idx="${i}">
        <i class="fas ${c.icon}"></i><span>${c.label}</span>${c.kbd ? '<kbd>' + c.kbd + '</kbd>' : ''}
      </button>`
    ).join('');
    list.querySelectorAll('.ide-cmd-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = hits[parseInt(btn.dataset.idx, 10)];
        closePalette();
        cmd?.run();
      });
    });
    list.dataset.hitCount = hits.length;
    window.__idePaletteHits = hits;
  }

  function runPaletteSelection() {
    const hits = window.__idePaletteHits || [];
    const cmd = hits[paletteIdx];
    if (cmd) { closePalette(); cmd.run(); }
  }

  function toggleZen() {
    zenMode = !zenMode;
    $('codespaceModal')?.classList.toggle('ide-zen-mode', zenMode);
    toast(zenMode ? 'Zen mode ON' : 'Zen mode OFF');
  }

  function aiQuick(action) {
    const sel = CS.getSelection();
    const file = CS.getCurrentFile();
    const code = sel.text || CS.getFiles()[file] || '';
    const prompts = {
      explain: `Explain this code from ${file} clearly:\n\`\`\`\n${code.slice(0, 1200)}\n\`\`\``,
      refactor: `Refactor this code from ${file} — cleaner, same behavior. Return // FILE: ${file} block:\n\`\`\`\n${code.slice(0, 1200)}\n\`\`\``,
      tests: `Write unit tests for ${file}. Return test file with // FILE: comment:\n\`\`\`\n${code.slice(0, 1000)}\n\`\`\``,
    };
    CS.askAi(prompts[action] || prompts.explain);
  }

  function crc32(str) {
    let c = ~0;
    for (let i = 0; i < str.length; i++) {
      c ^= str.charCodeAt(i);
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ ~0) >>> 0;
  }

  function exportZip() {
    CS.syncEditor();
    const files = CS.getFiles();
    const parts = [];
    let offset = 0;
    const chunks = [];

    function u16(n) { return [n & 255, (n >> 8) & 255]; }
    function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }

    Object.entries(files).forEach(([name, content]) => {
      const data = new TextEncoder().encode(content);
      const nameBytes = new TextEncoder().encode(name);
      const crc = crc32(content);
      const local = new Uint8Array(30 + nameBytes.length + data.length);
      local.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0], 0);
      local.set(u32(crc), 14);
      local.set(u32(data.length), 18);
      local.set(u32(data.length), 22);
      local.set(u16(nameBytes.length), 26);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      chunks.push(local);
      parts.push({ name, crc, size: data.length, offset });
      offset += local.length;
    });

    const centralStart = offset;
    Object.entries(files).forEach(([name, content], i) => {
      const nameBytes = new TextEncoder().encode(name);
      const p = parts[i];
      const cen = new Uint8Array(46 + nameBytes.length);
      cen.set([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0], 0);
      cen.set(u32(p.crc), 16);
      cen.set(u32(p.size), 20);
      cen.set(u32(p.size), 24);
      cen.set(u16(nameBytes.length), 28);
      cen.set(u32(p.offset), 42);
      cen.set(nameBytes, 46);
      chunks.push(cen);
      offset += cen.length;
    });

    const end = new Uint8Array(22);
    end.set([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0], 0);
    end.set(u16(Object.keys(files).length), 8);
    end.set(u16(Object.keys(files).length), 10);
    end.set(u32(offset - centralStart), 12);
    end.set(u32(centralStart), 16);
    chunks.push(end);

    const blob = new Blob(chunks, { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rebel-project.zip';
    a.click();
    toast('ZIP downloaded!');
  }

  function applyIdeTheme(name) {
    $('codespaceModal')?.setAttribute('data-ide-theme', name || 'rebel');
    localStorage.setItem('rebel_ide_theme', name || 'rebel');
  }

  function bindEvents() {
    $('ide-palette-btn')?.addEventListener('click', () => openPalette());
    $('ide-cmd-backdrop')?.addEventListener('click', closePalette);

    const cmdInp = $('ide-cmd-input');
    if (cmdInp) {
      cmdInp.addEventListener('input', () => { paletteIdx = 0; renderPaletteList(cmdInp.value); });
      cmdInp.addEventListener('keydown', e => {
        const n = parseInt($('ide-cmd-list')?.dataset.hitCount || '0', 10);
        if (e.key === 'ArrowDown') { e.preventDefault(); paletteIdx = Math.min(n - 1, paletteIdx + 1); renderPaletteList(cmdInp.value); }
        if (e.key === 'ArrowUp') { e.preventDefault(); paletteIdx = Math.max(0, paletteIdx - 1); renderPaletteList(cmdInp.value); }
        if (e.key === 'Enter') { e.preventDefault(); runPaletteSelection(); }
        if (e.key === 'Escape') closePalette();
      });
    }

    document.querySelectorAll('[data-ai-action]').forEach(btn => {
      btn.addEventListener('click', () => aiQuick(btn.dataset.aiAction));
    });

    $('ide-replace-btn')?.addEventListener('click', () => {
      replaceInProject($('ide-search-input')?.value, $('ide-replace-input')?.value, false);
    });
    $('ide-replace-all-btn')?.addEventListener('click', () => {
      replaceInProject($('ide-search-input')?.value, $('ide-replace-input')?.value, true);
    });

    $('ide-ide-theme')?.addEventListener('change', e => applyIdeTheme(e.target.value));

    $('ide-minimap')?.addEventListener('click', e => {
      const ta = $('ide-textarea');
      const map = $('ide-minimap');
      if (!ta || !map) return;
      const ratio = e.offsetY / map.clientHeight;
      ta.scrollTop = ratio * (ta.scrollHeight - ta.clientHeight);
    });

    const ta = $('ide-textarea');
    if (ta) {
      ta.addEventListener('input', () => { updateMinimap(); updateSelectionStatus(); });
      ta.addEventListener('scroll', updateMinimap);
      ta.addEventListener('keyup', updateSelectionStatus);
      ta.addEventListener('click', updateSelectionStatus);
    }

    document.addEventListener('keydown', e => {
      if (!$('codespaceModal')?.classList.contains('show')) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
        openPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        openPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        toggleZen();
      }
    });

    const gitBtn = $('ide-git-btn');
    if (gitBtn) gitBtn.addEventListener('click', () => setTimeout(renderGitDiff, 100));

    const origShowPanel = CS.showPanel;
    if (origShowPanel) {
      CS.showPanel = (name) => {
        origShowPanel(name);
        if (name === 'git') renderGitDiff();
      };
    }
  }

  function updateSelectionStatus() {
    const el = $('ide-sb-selection');
    const sel = CS?.getSelection();
    if (!el || !sel) return;
    if (!sel.text) { el.textContent = ''; return; }
    const lines = sel.text.split('\n').length;
    el.textContent = lines > 1 ? `${lines} lines selected` : `${sel.text.length} chars selected`;
  }

  function init() {
    CS = window.RebelCodespace;
    if (!CS) return;
    renderTemplates();
    applyIdeTheme(localStorage.getItem('rebel_ide_theme') || 'rebel');
    updateBreadcrumb();
    updateMinimap();
    bindEvents();

    const origOpen = CS.openFile;
    if (origOpen) {
      CS.openFile = (name) => { origOpen(name); updateBreadcrumb(); updateMinimap(); };
    }
  }

  document.addEventListener('rebel-codespace-ready', init);
  if (window.RebelCodespace) init();
})();
