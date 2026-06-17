/* Rebel Codespace v5 — Monaco, devices, agent, snapshots, split, inline AI */
(function RebelCodespaceV5() {
  'use strict';

  const $ = id => document.getElementById(id);
  let CS = null;
  let monacoMain = null;
  let monacoSplit = null;
  let splitFile = null;
  let agentMode = false;
  let pendingDiff = null;

  const SNIPPETS = {
    useState: "const [state, setState] = useState(initial);\n",
    useEffect: "useEffect(() => {\n  \n  return () => {};\n}, []);\n",
    fetch: "const res = await fetch(url);\nconst data = await res.json();\n",
    component: "function Component() {\n  return (\n    <div></div>\n  );\n}\n",
    api: "app.get('/api', (req, res) => {\n  res.json({ ok: true });\n});\n",
  };

  const EXTRA_TEMPLATES = {
    blog: { name: 'Blog', icon: 'fa-newspaper', desc: 'Blog layout', files: {
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebel Blog</title><link rel="stylesheet" href="style.css"></head>\n<body><header><h1>Rebel Blog</h1></header><main id="posts"></main><script src="app.js"><\/script></body></html>`,
      'style.css': `body{font-family:Georgia,serif;background:#fafafa;color:#222;margin:0;padding:24px;max-width:680px;margin:0 auto}article{margin:24px 0;padding:16px;background:#fff;border-radius:8px}`,
      'app.js': `document.getElementById('posts').innerHTML=['Hello Rebel','Codespace v5'].map(t=>'<article><h2>'+t+'</h2></article>').join('');`,
    }},
    login: { name: 'Login', icon: 'fa-sign-in-alt', desc: 'Auth form', files: {
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Login</title><link rel="stylesheet" href="style.css"></head>\n<body><form class="login" id="f"><h1>Sign in</h1><input type="email" placeholder="Email" required><input type="password" placeholder="Password" required><button>Login</button></form><script src="app.js"><\/script></body></html>`,
      'style.css': `body{min-height:100vh;display:grid;place-items:center;background:#1a0a2e;margin:0;font-family:system-ui}.login{background:#fff;padding:32px;border-radius:16px;width:min(360px,92vw)}input{width:100%;padding:12px;margin:8px 0;border:1px solid #ddd;border-radius:8px}button{width:100%;padding:12px;background:#8a2be2;color:#fff;border:none;border-radius:8px}`,
      'app.js': `document.getElementById('f').onsubmit=e=>{e.preventDefault();alert('Logged in!');};`,
    }},
    shop: { name: 'Shop', icon: 'fa-shopping-cart', desc: 'Product grid', files: {
      'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop</title><link rel="stylesheet" href="style.css"></head>\n<body><h1>Rebel Shop</h1><div class="grid" id="grid"></div><script src="app.js"><\/script></body></html>`,
      'style.css': `body{font-family:system-ui;background:#111;color:#fff;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}.card{background:#222;padding:16px;border-radius:12px}`,
      'app.js': `const g=document.getElementById('grid');[{n:'Hoodie',p:49},{n:'Cap',p:29}].forEach(i=>{g.innerHTML+='<div class="card"><strong>'+i.n+'</strong><p>$'+i.p+'</p></div>'});`,
    }},
  };

  function toast(msg) {
    let t = document.querySelector('.ide-toast');
    if (!t) { t = document.createElement('div'); t.className = 'ide-toast'; $('codespaceModal')?.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
  }

  function getOwnerPayload() {
    try {
      const u = JSON.parse(localStorage.getItem('rbl_current_user'));
      if (u?.email) return { email: u.email };
    } catch (e) {}
    return { guest_id: localStorage.getItem('rbl_codespace_guest_id') || 'guest' };
  }

  function langForFile(name) {
    const ext = (name || '').split('.').pop();
    return { js: 'javascript', ts: 'typescript', html: 'html', css: 'css', md: 'markdown', json: 'json' }[ext] || 'plaintext';
  }

  function setPreviewDevice(device) {
    const stage = $('ide-preview-stage');
    if (!stage) return;
    stage.className = 'ide-preview-stage device-' + device;
    document.querySelectorAll('.ide-device-btn').forEach(b => b.classList.toggle('active', b.dataset.device === device));
    localStorage.setItem('rebel_preview_device', device);
    const iframe = $('ide-preview-frame');
    const targets = {
      macbook: $('device-macbook-screen'),
      iphone17: $('device-iphone-screen'),
      full: $('device-full-screen'),
    };
    const target = targets[device] || targets.macbook;
    if (iframe && target) {
      iframe.style.display = 'block';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      target.appendChild(iframe);
    }
    const labels = { iphone17: 'iPhone 17 Pro Max', macbook: 'MacBook', full: 'Full width' };
    toast(labels[device] + ' preview');
  }

  function initDevicePreview() {
    document.querySelectorAll('.ide-device-btn').forEach(btn => {
      btn.addEventListener('click', () => setPreviewDevice(btn.dataset.device));
    });
    setPreviewDevice(localStorage.getItem('rebel_preview_device') || 'macbook');
  }

  function initMonaco() {
    if (typeof require === 'undefined') return;
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
    require(['vs/editor/editor.main'], () => {
      const root = document.createElement('div');
      root.id = 'ide-monaco-root';
      $('ide-editor-wrap')?.appendChild(root);
      $('ide-editor')?.classList.add('monaco-active');
      monacoMain = monaco.editor.create(root, {
        value: CS.getEditorText() || '',
        language: langForFile(CS.getCurrentFile()),
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: true },
        wordWrap: 'on',
        automaticLayout: true,
        bracketPairColorization: { enabled: true },
        folding: true,
        multiCursorModifier: 'alt',
        quickSuggestions: true,
      });
      monacoMain.onDidChangeModelContent(() => {
        const ta = $('ide-textarea');
        if (ta) { ta.value = monacoMain.getValue(); ta.dispatchEvent(new Event('input')); }
      });
      monacoMain.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => openInlineAi());
      document.addEventListener('rebel-editor-refresh', e => {
        const { file, content } = e.detail || {};
        if (!monacoMain) return;
        if (monacoMain.getValue() !== content) monacoMain.setValue(content || '');
        monaco.editor.setModelLanguage(monacoMain.getModel(), langForFile(file));
      });
    });
  }

  function loadMonacoScript() {
    if (window.require) { initMonaco(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
    s.onload = initMonaco;
    document.head.appendChild(s);
  }

  function toggleSplit() {
    $('ide-editor-area')?.classList.toggle('split-open');
    if ($('ide-editor-area')?.classList.contains('split-open') && !monacoSplit && window.monaco) {
      splitFile = CS.getCurrentFile();
      monacoSplit = monaco.editor.create($('ide-monaco-split'), {
        value: CS.getFiles()[splitFile] || '',
        language: langForFile(splitFile),
        theme: 'vs-dark',
        automaticLayout: true,
        wordWrap: 'on',
      });
      monacoSplit.onDidChangeModelContent(() => CS.updateFile(splitFile, monacoSplit.getValue()));
    }
    toast($('ide-editor-area')?.classList.contains('split-open') ? 'Split ON' : 'Split OFF');
  }

  function openInlineAi() {
    const sel = monacoMain ? monacoMain.getModel().getValueInRange(monacoMain.getSelection()) : (CS.getSelection?.()?.text || '');
    $('ide-inline-ai')?.classList.add('open');
    const inp = $('ide-inline-ai-input');
    if (inp) { inp.value = sel ? 'Improve:\n' + sel : ''; inp.focus(); }
  }

  async function runInlineAi() {
    const prompt = $('ide-inline-ai-input')?.value?.trim();
    if (!prompt) return;
    $('ide-inline-ai')?.classList.remove('open');
    await CS.askAi(prompt + '\nReturn // FILE: ' + CS.getCurrentFile());
  }

  function interceptAiApply() {
    const orig = CS.askAi;
    if (!orig || CS._v5Ai) return;
    CS._v5Ai = true;
    CS.askAi = async (prompt) => {
      if (agentMode) prompt = 'AGENT MODE — edit all needed files with // FILE: headers. Task: ' + prompt;
      return orig(prompt);
    };
  }

  async function saveSnapshot() {
    CS.syncEditor();
    const name = prompt('Snapshot name:', 'Snapshot ' + new Date().toLocaleString());
    if (!name) return;
    const payload = { ...getOwnerPayload(), name, files: CS.getFiles(), openTabs: Object.keys(CS.getFiles()).slice(0, 8), currentFile: CS.getCurrentFile(), savedAt: Date.now() };
    try {
      const r = await fetch('/api/codespace/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if ((await r.json()).ok) toast('Snapshot saved!');
    } catch (e) { toast('Saved locally'); }
    saveLocalSnapshot(name);
    renderSnapshots();
  }

  function saveLocalSnapshot(name) {
    const key = 'rebel_snapshots_v5';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    list.unshift({ name, savedAt: Date.now(), files: CS.getFiles(), currentFile: CS.getCurrentFile() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 15)));
  }

  async function renderSnapshots() {
    const el = $('ide-snapshots-list');
    if (!el) return;
    let items = JSON.parse(localStorage.getItem('rebel_snapshots_v5') || '[]').map((s, i) => ({ id: 'local_' + i, name: s.name, savedAt: s.savedAt, local: s }));
    try {
      const q = new URLSearchParams(getOwnerPayload()).toString();
      const r = await fetch('/api/codespace/snapshots?' + q);
      const d = await r.json();
      if (d.ok && d.snapshots?.length) items = d.snapshots.map(s => ({ ...s, local: null }));
    } catch (e) {}
    el.innerHTML = items.length ? items.map(s =>
      `<button type="button" class="ide-snapshot-item" data-idx="${s.id}">${s.name}<br><small>${new Date(s.savedAt).toLocaleString()}</small></button>`
    ).join('') : '<p style="opacity:0.4;font-size:0.75rem;padding:8px">No snapshots</p>';
    el.querySelectorAll('.ide-snapshot-item').forEach((btn, i) => {
      btn.onclick = () => {
        const snap = items[i]?.local || items[i];
        if (snap?.files) { CS.setFiles(snap.files); CS.openFile(snap.currentFile || 'app.js'); toast('Restored!'); }
      };
    });
  }

  function renderSnippets() {
    const el = $('ide-snippets-list');
    if (!el) return;
    el.innerHTML = Object.entries(SNIPPETS).map(([k, code]) =>
      `<button type="button" class="ide-snippet-item" data-k="${k}"><strong>${k}</strong></button>`
    ).join('');
    el.querySelectorAll('.ide-snippet-item').forEach(btn => {
      btn.onclick = () => {
        const code = SNIPPETS[btn.dataset.k];
        if (monacoMain) monacoMain.trigger('keyboard', 'type', { text: code });
        else CS.setEditorText(CS.getEditorText() + code);
        toast('Snippet added');
      };
    });
  }

  function injectExtraTemplates() {
    const list = $('ide-templates-list');
    if (!list) return;
    Object.entries(EXTRA_TEMPLATES).forEach(([key, t]) => {
      if (list.querySelector(`[data-template="${key}"]`)) return;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'ide-template-card'; btn.dataset.template = key;
      btn.innerHTML = `<i class="fas ${t.icon}"></i><strong>${t.name}</strong><span>${t.desc}</span>`;
      btn.onclick = () => { if (confirm('Load ' + t.name + '?')) CS.applyTemplate(t.files); };
      list.appendChild(btn);
    });
  }

  function deploySingleHtml() {
    CS.syncEditor();
    const files = CS.getFiles();
    let html = files['index.html'] || '';
    if (!html) { toast('No index.html'); return; }
    html = html.replace(/<link[^>]*style\.css[^>]*>/i, `<style>${files['style.css'] || ''}</style>`);
    html = html.replace(/<script[^>]*app\.js[^>]*><\/script>/i, `<script>${files['app.js'] || ''}<\/script>`);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'rebel-deploy.html';
    a.click();
    toast('Deploy HTML ready!');
  }

  const ONBOARD = [
    { t: 'Codespace v5!', p: 'Monaco editor, MacBook & iPhone 17 Pro Max preview, Agent AI, snapshots.' },
    { t: 'Device Preview', p: 'MacBook ya iPhone 17 Pro Max frame — Live Preview toolbar mein.' },
    { t: 'Ctrl+K', p: 'Inline AI — code select karke turant edit.' },
    { t: 'Agent Mode', p: 'AI panel mein Agent ON — poora feature auto-build.' },
    { t: 'Ready!', p: 'Ctrl+Shift+P palette · Ctrl+\\ split editor.' },
  ];
  let obStep = 0;

  function showOnboard() {
    if (localStorage.getItem('rebel_v5_onboard')) return;
    obStep = 0; renderOb(); $('ide-onboard')?.classList.add('open');
  }
  function renderOb() {
    $('ide-onboard-title').textContent = ONBOARD[obStep].t;
    $('ide-onboard-text').textContent = ONBOARD[obStep].p;
    $('ide-onboard-next').textContent = obStep < ONBOARD.length - 1 ? 'Next →' : 'Start!';
  }

  function init() {
    CS = window.RebelCodespace;
    if (!CS) return;
    initDevicePreview();
    loadMonacoScript();
    renderSnippets();
    renderSnapshots();
    injectExtraTemplates();
    interceptAiApply();

    const agentEl = $('ide-agent-mode');
    if (agentEl) agentEl.addEventListener('change', e => { agentMode = e.target.checked; toast(agentMode ? 'Agent ON' : 'Agent OFF'); });
    $('ide-inline-ai-run')?.addEventListener('click', runInlineAi);
    $('ide-inline-ai-cancel')?.addEventListener('click', () => $('ide-inline-ai')?.classList.remove('open'));
    $('ide-save-snapshot-btn')?.addEventListener('click', saveSnapshot);
    $('ide-deploy-html-btn')?.addEventListener('click', deploySingleHtml);
    $('ide-split-btn')?.addEventListener('click', toggleSplit);
    $('ide-onboard-next')?.addEventListener('click', () => { obStep++; if (obStep >= ONBOARD.length) { $('ide-onboard')?.classList.remove('open'); localStorage.setItem('rebel_v5_onboard', '1'); } else renderOb(); });
    $('ide-onboard-skip')?.addEventListener('click', () => { $('ide-onboard')?.classList.remove('open'); localStorage.setItem('rebel_v5_onboard', '1'); });

    const origSave = CS.saveProject;
    CS.saveProject = opts => {
      if ($('ide-format-on-save')?.checked) $('ide-format-btn')?.click();
      return origSave(opts || {});
    };

    document.addEventListener('keydown', e => {
      if (!$('codespaceModal')?.classList.contains('show')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); openInlineAi(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); toggleSplit(); }
    });

    const origRun = CS.runPreview;
    CS.runPreview = () => { origRun(); setTimeout(() => setPreviewDevice(localStorage.getItem('rebel_preview_device') || 'macbook'), 50); };

    $('codespaceBtn')?.addEventListener('click', () => setTimeout(showOnboard, 900));
  }

  document.addEventListener('rebel-codespace-ready', init);
  if (window.RebelCodespace) init();
})();
