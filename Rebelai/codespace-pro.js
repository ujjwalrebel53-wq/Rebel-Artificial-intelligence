/* ═══════════════════════════════════════════════════════════
   REBEL CODESPACE PRO — Fully Functional IDE
   ═══════════════════════════════════════════════════════════ */
(function RebelCodespacePro() {
  'use strict';

  const STORAGE_LEGACY = 'rbl_codespace_project_v2';
  const AI_BASE = 'https://api-rebix.vercel.app/api/gpt-5';

  const DEFAULT_FILES = {
    'app.js': `// Rebel Codespace — runs in Live Preview (browser)\n// Press F5 or enable Live toggle to refresh\n\ndocument.addEventListener('DOMContentLoaded', () => {\n  console.log('%c Rebel Preview Active ', 'background:#8a2be2;color:#fff;padding:4px 8px;border-radius:4px');\n\n  const btn = document.getElementById('demoBtn');\n  if (btn) {\n    btn.addEventListener('click', () => {\n      const out = document.getElementById('demoOutput');\n      if (out) out.textContent = 'Preview working! Edited at ' + new Date().toLocaleTimeString();\n      btn.textContent = 'Clicked ✓';\n    });\n  }\n\n  document.querySelectorAll('.feature-chip').forEach(chip => {\n    chip.addEventListener('click', () => chip.classList.toggle('active'));\n  });\n});`,
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Rebel App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main class="app">\n    <h1>Hello Rebel!</h1>\n    <p>Edit HTML, CSS &amp; JS — press <strong>F5</strong> for live preview.</p>\n    <button id="demoBtn" type="button">Test Preview</button>\n    <p id="demoOutput" class="demo-output"></p>\n    <div class="chips">\n      <span class="feature-chip">Chat AI</span>\n      <span class="feature-chip">Voice</span>\n      <span class="feature-chip">Codespace</span>\n    </div>\n  </main>\n  <script src="app.js"><\/script>\n</body>\n</html>`,
    'style.css': `* { box-sizing: border-box; }\nbody {\n  font-family: 'Roboto', sans-serif;\n  background: linear-gradient(135deg, #121212, #1a0a2e);\n  color: #fff;\n  margin: 0;\n  min-height: 100vh;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.app {\n  text-align: center;\n  padding: 32px 24px;\n  max-width: 480px;\n}\nh1 { color: #8a2be2; font-size: 2.5rem; margin: 0 0 12px; }\np { color: rgba(255,255,255,0.75); line-height: 1.6; }\n#demoBtn {\n  margin-top: 20px;\n  padding: 12px 28px;\n  border: none;\n  border-radius: 10px;\n  background: linear-gradient(135deg, #8a2be2, #00ced1);\n  color: #fff;\n  font-size: 1rem;\n  font-weight: 600;\n  cursor: pointer;\n  transition: transform 0.15s, box-shadow 0.15s;\n}\n#demoBtn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(138,43,226,0.4); }\n.demo-output { min-height: 1.4em; color: #00ced1; font-size: 0.9rem; margin-top: 12px; }\n.chips { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 24px; }\n.feature-chip {\n  padding: 6px 14px;\n  border-radius: 999px;\n  border: 1px solid rgba(138,43,226,0.4);\n  background: rgba(138,43,226,0.12);\n  font-size: 0.82rem;\n  cursor: pointer;\n  transition: background 0.2s, border-color 0.2s;\n}\n.feature-chip.active, .feature-chip:hover {\n  background: rgba(0,206,209,0.2);\n  border-color: rgba(0,206,209,0.5);\n}`,
    'README.md': `# Rebel Codespace\n\n- **Ctrl+S** Save\n- **F5** Run Preview\n- **Ctrl+F** Search\n\nAsk Rebel AI in the right panel for help!`,
  };

  let files = {};
  let openTabs = [];
  let currentFile = 'app.js';
  let dirty = {};
  let savedSnapshot = {};
  let aiHistory = [];
  let termHistory = [];
  let termIdx = -1;
  let npmInstalled = false;
  let undoStack = [];
  let redoStack = [];
  let outputLog = [];
  let gitStaged = [];
  let problemsList = [];
  let previewErrors = [];
  let selectedProblemId = null;
  let termPanel = 'terminal';
  let importInputBound = false;
  let previewLive = true;
  let previewOpen = false;
  let previewDebounce = null;
  let previewBlobUrl = null;
  let autoSaveTimer = null;
  let cloudSaveTimer = null;
  let cloudSynced = false;
  let projectSavedAt = 0;

  const $ = id => document.getElementById(id);

  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('rbl_current_user')); } catch (e) { return null; }
  }

  function getGuestId() {
    let id = localStorage.getItem('rbl_codespace_guest_id');
    if (!id) {
      id = 'g_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('rbl_codespace_guest_id', id);
    }
    return id;
  }

  function getStorageKey() {
    const user = getCurrentUser();
    const owner = user?.email ? 'user_' + user.email.toLowerCase() : 'guest_' + getGuestId();
    return 'rbl_codespace_v3_' + owner.replace(/[^a-z0-9@._-]/gi, '_');
  }

  function getOwnerPayload() {
    const user = getCurrentUser();
    return user?.email ? { email: user.email } : { guest_id: getGuestId() };
  }

  function getTermUser() {
    const u = getCurrentUser();
    if (u?.name) return u.name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'rebel';
    return 'rebel';
  }

  function termPrompt() {
    return getTermUser() + '@rebel-private:~/rebel-project$';
  }

  function migrateLegacyStorage() {
    const key = getStorageKey();
    if (localStorage.getItem(key)) return;
    const legacy = localStorage.getItem(STORAGE_LEGACY);
    if (legacy) localStorage.setItem(key, legacy);
  }

  function applyProjectData(data) {
    files = data.files || { ...DEFAULT_FILES };
    openTabs = data.openTabs || ['app.js', 'index.html', 'style.css'];
    currentFile = data.currentFile || 'app.js';
    projectSavedAt = data.savedAt || 0;
    if (data.terminal?.history?.length) {
      termHistory = data.terminal.history.slice(-100);
      termIdx = termHistory.length;
    }
  }

  async function loadProject() {
    migrateLegacyStorage();
    const key = getStorageKey();
    let local = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) local = JSON.parse(raw);
    } catch (e) {}

    let server = null;
    try {
      const q = new URLSearchParams(getOwnerPayload()).toString();
      const resp = await fetch('/api/codespace/project?' + q);
      if (resp.ok) {
        const data = await resp.json();
        if (data.ok && data.project) server = data.project;
      }
    } catch (e) {}

    if (server && local) {
      applyProjectData((server.savedAt || 0) >= (local.savedAt || 0) ? server : local);
      cloudSynced = (server.savedAt || 0) >= (local.savedAt || 0);
    } else if (server) {
      applyProjectData(server);
      cloudSynced = true;
    } else if (local) {
      applyProjectData(local);
      cloudSynced = false;
    } else {
      applyProjectData({ files: { ...DEFAULT_FILES } });
      cloudSynced = false;
    }
  }

  function buildProjectPayload() {
    syncEditorToFile();
    return {
      files,
      openTabs,
      currentFile,
      savedAt: Date.now(),
      terminal: { history: termHistory.slice(-100) },
    };
  }

  function saveProject(opts = {}) {
    const payload = buildProjectPayload();
    projectSavedAt = payload.savedAt;
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    Object.keys(files).forEach(f => { savedSnapshot[f] = files[f]; dirty[f] = false; });
    setSaveStatus(true, cloudSynced);
    if (opts.manual) {
      termLog('Project saved locally.', 'out');
      toast('Saved!');
    }
    if (!opts.skipCloud) scheduleCloudSave();
    trackCodespace(opts.manual ? 'save' : 'autosave');
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveProject({ silent: true }), 1500);
    setSaveStatus(false, cloudSynced);
  }

  function scheduleCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(saveProjectToCloud, 2000);
  }

  async function saveProjectToCloud() {
    const payload = buildProjectPayload();
    try {
      const resp = await fetch('/api/codespace/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...getOwnerPayload(), ...payload }),
      });
      const data = await resp.json();
      if (data.ok) {
        cloudSynced = true;
        projectSavedAt = data.savedAt || payload.savedAt;
        setSaveStatus(true, true);
      } else {
        cloudSynced = false;
        setSaveStatus(true, false);
      }
    } catch (e) {
      cloudSynced = false;
      setSaveStatus(true, false);
    }
  }

  function writeFileFromTerminal(name, content, append) {
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      termLog('Invalid filename', 'err');
      return false;
    }
    syncEditorToFile();
    files[name] = append ? ((files[name] || '') + content) : content;
    dirty[name] = true;
    if (!openTabs.includes(name)) openTabs.push(name);
    renderFileTree();
    renderTabs();
    if (currentFile === name) refreshEditor();
    scheduleAutoSave();
    runLinter();
    return true;
  }

  function trackCodespace(action) {
    fetch('/api/logs/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'info', msg: 'Codespace: ' + action }) }).catch(() => {});
  }

  function highlight(code, filename) {
    if (window.RebelSyntax && window.RebelSyntax.highlightCode) {
      return window.RebelSyntax.highlightCode(code, filename) + '\n';
    }
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc(code) + '\n';
  }

  function syncEditorToFile() {
    const ta = $('ide-textarea');
    if (ta && currentFile && files[currentFile] !== undefined) {
      files[currentFile] = ta.value;
      dirty[currentFile] = ta.value !== (savedSnapshot[currentFile] ?? files[currentFile]);
    }
  }

  function updateGutter() {
    const gutter = $('ide-gutter');
    const ta = $('ide-textarea');
    if (!gutter || !ta) return;
    const lines = (ta.value.match(/\n/g) || []).length + 1;
    const fileProblems = problemsList.filter(p => p.file === currentFile);
    const errorLines = new Set(fileProblems.filter(p => p.sev === 'error').map(p => p.line));
    const warnLines = new Set(fileProblems.filter(p => p.sev === 'warn').map(p => p.line));
    gutter.innerHTML = '';
    for (let i = 1; i <= lines; i++) {
      const s = document.createElement('span');
      s.textContent = i;
      if (errorLines.has(i)) s.className = 'gutter-error';
      else if (warnLines.has(i)) s.className = 'gutter-warn';
      gutter.appendChild(s);
    }
  }

  function refreshEditor() {
    const ta = $('ide-textarea');
    const hl = $('ide-highlight-layer');
    if (!ta || !currentFile) return;
    ta.value = files[currentFile] ?? '';
    if (hl) hl.innerHTML = highlight(ta.value, currentFile);
    updateGutter();
    setSaveStatus(!dirty[currentFile], cloudSynced);
    updateGitPanel();
    updateLangLabel();
    updateCursorPosition();
  }

  function setSaveStatus(saved, synced) {
    const el = $('ide-save-status');
    if (!el) return;
    el.className = 'ide-save-status' + (saved ? '' : ' unsaved') + (synced ? ' synced' : '');
    if (!saved) {
      el.innerHTML = '<i class="fas fa-circle"></i> Unsaved';
    } else if (synced) {
      el.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Saved &amp; synced';
    } else {
      el.innerHTML = '<i class="fas fa-check-circle"></i> Saved locally';
    }
  }

  function fileIcon(name) {
    const ext = name.split('.').pop();
    const colors = { js: '#f0db4f', html: '#e44d26', css: '#264de4', md: '#519aba' };
    return `<i class="fas fa-file-code" style="color:${colors[ext] || '#aaa'};font-size:0.65rem;"></i>`;
  }

  function renderFileTree() {
    const tree = $('ide-file-tree');
    if (!tree) return;
    tree.innerHTML = `<div class="ide-tree-folder open"><i class="fas fa-chevron-down ide-chevron"></i><i class="fas fa-folder-open ide-folder-icon"></i><span>rebel-project</span></div>`;
    Object.keys(files).sort().forEach(name => {
      const el = document.createElement('div');
      el.className = 'ide-tree-file' + (name === currentFile ? ' active' : '');
      el.dataset.file = name;
      el.innerHTML = `${fileIcon(name)} <span>${name}</span>${dirty[name] ? '<span style="color:#f1c40f;margin-left:4px;">●</span>' : ''}<span class="file-delete" title="Delete"><i class="fas fa-times"></i></span>`;
      el.querySelector('.file-delete')?.addEventListener('click', e => { e.stopPropagation(); deleteFile(name); });
      el.addEventListener('click', () => openFile(name));
      tree.appendChild(el);
    });
  }

  function renderTabs() {
    const bar = $('ide-tabbar');
    if (!bar) return;
    bar.innerHTML = '';
    openTabs.forEach(name => {
      if (!files[name]) return;
      const tab = document.createElement('div');
      tab.className = 'ide-tab' + (name === currentFile ? ' active' : '') + (dirty[name] ? ' dirty' : '');
      tab.dataset.file = name;
      tab.innerHTML = `${fileIcon(name)} <span class="tab-name">${name}</span><span class="ide-tab-close">×</span>`;
      tab.addEventListener('click', e => {
        if (e.target.classList.contains('ide-tab-close')) { closeTab(name); return; }
        openFile(name);
      });
      bar.appendChild(tab);
    });
  }

  function openFile(name) {
    if (!files[name]) return;
    syncEditorToFile();
    currentFile = name;
    if (!openTabs.includes(name)) openTabs.push(name);
    renderTabs();
    renderFileTree();
    refreshEditor();
    updateStatusBar();
  }

  function closeTab(name) {
    if (openTabs.length <= 1) return;
    openTabs = openTabs.filter(t => t !== name);
    if (currentFile === name) openFile(openTabs[openTabs.length - 1]);
    else renderTabs();
  }

  function newFile() {
    const name = prompt('File name (e.g. utils.js):');
    if (!name || files[name]) { if (files[name]) alert('File exists!'); return; }
    files[name] = '// New file\n';
    dirty[name] = true;
    openFile(name);
    saveProject();
  }

  function deleteFile(name) {
    if (Object.keys(files).length <= 1) { alert('Cannot delete last file.'); return; }
    if (!confirm('Delete ' + name + '?')) return;
    delete files[name]; delete dirty[name];
    openTabs = openTabs.filter(t => t !== name);
    if (currentFile === name) openFile(openTabs[0]);
    renderFileTree(); renderTabs(); saveProject();
  }

  function updateStatusBar() {
    const ext = (currentFile || '').split('.').pop();
    document.querySelectorAll('.ide-sb-item').forEach(el => {
      if (el.textContent.match(/JavaScript|HTML|CSS|Markdown/)) el.textContent = { js: 'JavaScript', html: 'HTML', css: 'CSS', md: 'Markdown' }[ext] || ext.toUpperCase();
    });
  }

  function updateGitPanel() {
    const el = $('ide-git-changes');
    if (!el) return;
    const changes = Object.keys(files).filter(f => dirty[f] || files[f] !== savedSnapshot[f]);
    el.innerHTML = changes.length ? changes.map(f => `<div class="ide-git-change modified"><i class="fas fa-pen"></i> ${f}</div>`).join('') : '<div style="padding:12px;color:rgba(255,255,255,0.3);font-size:0.75rem;">No changes</div>';
  }

  // ── Live Preview (full browser bundle) ────────────────────
  function normalizeAssetPath(href) {
    if (!href || /^https?:\/\//i.test(href) || /^\/\//.test(href) || /^data:/i.test(href)) return null;
    return href.replace(/^\.\//, '').split('?')[0].split('#')[0];
  }

  function extractTagAttr(tag, attr) {
    const m = tag.match(new RegExp('\\b' + attr + '\\s*=\\s*["\\\']([^"\\\']+)["\\\']', 'i'));
    return m ? m[1] : null;
  }

  function findHtmlEntry() {
    if (files['index.html']) return 'index.html';
    if (files['index.htm']) return 'index.htm';
    return Object.keys(files).find(f => /\.html?$/i.test(f)) || null;
  }

  function setPreviewStatus(text, type) {
    const el = $('ide-preview-status');
    if (!el) return;
    el.textContent = text;
    el.className = 'ide-preview-status' + (type ? ' ' + type : '');
  }

  function buildPreviewDocument() {
    syncEditorToFile();
    const entry = findHtmlEntry();

    if (!entry) {
      return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:system-ui;background:#111;color:#fff;padding:24px}code{color:#00ced1}</style></head><body><h1>No HTML file</h1><p>Create <code>index.html</code> in your project to use Live Preview.</p></body></html>';
    }

    let html = files[entry];
    const cssFiles = new Set();
    const jsFiles = new Set();

    function queueCss(file) {
      if (file && files[file] && !cssFiles.has(file)) cssFiles.add(file);
    }
    function queueJs(file) {
      if (file && files[file] && !jsFiles.has(file)) jsFiles.add(file);
    }

    html = html.replace(/<link\b[^>]*>/gi, tag => {
      const rel = (extractTagAttr(tag, 'rel') || '').toLowerCase();
      if (!rel.includes('stylesheet')) return tag;
      const href = extractTagAttr(tag, 'href');
      const file = normalizeAssetPath(href);
      if (file && files[file]) { queueCss(file); return ''; }
      return tag;
    });

    html = html.replace(/<script\b[^>]*\ssrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src) => {
      const file = normalizeAssetPath(src);
      if (file && files[file]) { queueJs(file); return ''; }
      return tag;
    });

    html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*\/>/gi, (tag, src) => {
      const file = normalizeAssetPath(src);
      if (file && files[file]) { queueJs(file); return ''; }
      return tag;
    });

    html = html.replace(/<base\b[^>]*>/gi, '');

    if (cssFiles.size === 0 && files['style.css']) queueCss('style.css');
    if (jsFiles.size === 0 && files['app.js'] && /<\/body>/i.test(html)) queueJs('app.js');

    const cssBundle = [...cssFiles].map(f => `/* ${f} */\n${files[f]}`).join('\n\n');
    const jsBundle = [...jsFiles].map(f => `/* ${f} */\n${files[f]}`).join('\n\n');

    const previewHead = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style id="rebel-preview-base">
  #rebel-preview-error-bar{display:none;position:fixed;bottom:0;left:0;right:0;background:#1a0a0a;color:#ff7676;padding:10px 14px;font:12px/1.45 monospace;z-index:2147483647;border-top:2px solid #e74c3c;max-height:35vh;overflow:auto;white-space:pre-wrap}
  #rebel-preview-error-bar.show{display:block}
</style>
${cssBundle ? `<style id="rebel-inlined-css">\n${cssBundle}\n</style>` : ''}
<script id="rebel-preview-shim">
(function(){
  if(typeof module==='undefined')window.module={exports:{}};
  if(typeof exports==='undefined')window.exports=module.exports;
  if(typeof require==='undefined'){
    window.require=function(n){console.warn('[Preview] Node module unavailable in browser:',n);return {};};
  }
  window.process=window.process||{env:{NODE_ENV:'preview'}};
  window.addEventListener('error',function(e){
    var b=document.getElementById('rebel-preview-error-bar');
    if(!b){b=document.createElement('div');b.id='rebel-preview-error-bar';document.body.appendChild(b);}
    b.className='show';
    b.textContent='Error: '+(e.message||'Unknown')+(e.filename?'\\n@ '+e.filename+(e.lineno?':'+e.lineno:''):'');
    window.parent.postMessage({type:'rebel-preview-error',message:e.message||String(e),line:e.lineno||1,col:e.colno||1,sourceFile:''},'*');
  });
  window.addEventListener('unhandledrejection',function(e){
    var b=document.getElementById('rebel-preview-error-bar');
    if(!b){b=document.createElement('div');b.id='rebel-preview-error-bar';document.body.appendChild(b);}
    b.className='show';
    var msg='Promise Error: '+(e.reason&&(e.reason.message||e.reason)||'Unknown');
    b.textContent=msg;
    window.parent.postMessage({type:'rebel-preview-error',message:msg,line:1,col:1,sourceFile:''},'*');
  });
  window.addEventListener('load',function(){
    window.parent.postMessage({type:'rebel-preview-ready'},'*');
  });
})();
<\/script>`;

    const previewJs = jsBundle
      ? `<script id="rebel-inlined-js">\n${jsBundle}\n<\/script>`
      : '';

    const isFullDoc = /<html[\s>]/i.test(html);

    if (isFullDoc) {
      if (/<head[\s>]/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, '<head$1>' + previewHead);
      } else {
        html = html.replace(/<html([^>]*)>/i, '<html$1><head>' + previewHead + '</head>');
      }
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, previewJs + '</body>');
      } else {
        html += previewJs;
      }
    } else {
      html = `<!DOCTYPE html><html lang="en"><head>${previewHead}</head><body>${html}${previewJs}</body></html>`;
    }

    return html;
  }

  function applyPreviewToFrame() {
    const frame = $('ide-preview-frame');
    if (!frame) return;
    previewErrors = [];
    const doc = buildPreviewDocument();
    setPreviewStatus('Loading…', 'loading');
    frame.srcdoc = doc;
    logOutput('Live preview updated.', 'info');
    runLinter();
  }

  function runPreview() {
    syncEditorToFile();
    const panel = $('ide-preview-panel');
    previewOpen = true;
    if (panel) {
      panel.style.display = 'flex';
      $('ide-editor-area')?.classList.add('preview-open');
    }
    $('ide-preview-btn')?.classList.add('active');
    $('ide-run-btn')?.classList.add('active');
    applyPreviewToFrame();
    termLog('Live preview opened.', 'out');
    trackCodespace('preview');
    runLinter();
  }

  function schedulePreviewRefresh() {
    if (!previewOpen || !previewLive) return;
    clearTimeout(previewDebounce);
    previewDebounce = setTimeout(applyPreviewToFrame, 500);
  }

  function closePreview() {
    previewOpen = false;
    $('ide-preview-panel').style.display = 'none';
    $('ide-editor-area')?.classList.remove('preview-open');
    $('ide-preview-btn')?.classList.remove('active');
    $('ide-run-btn')?.classList.remove('active');
    clearTimeout(previewDebounce);
  }

  function openPreviewNewTab() {
    syncEditorToFile();
    const doc = buildPreviewDocument();
    if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    previewBlobUrl = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
    window.open(previewBlobUrl, '_blank', 'noopener');
    toast('Opened in new tab');
  }

  function downloadProject() {
    syncEditorToFile();
    const blob = new Blob([JSON.stringify({ name: 'rebel-project', files, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rebel-codespace-project.json';
    a.click();
    termLog('Project downloaded.', 'out');
  }

  function logOutput(msg, type) {
    outputLog.push({ msg, type, ts: new Date().toLocaleTimeString() });
    const el = $('ide-output-body');
    if (el) {
      el.innerHTML = outputLog.map(o => `<div class="ide-output-line ${o.type || ''}"><span class="ide-output-ts">[${o.ts}]</span> ${o.msg}</div>`).join('');
      el.scrollTop = el.scrollHeight;
    }
  }

  function pushUndo() {
    const ta = $('ide-textarea');
    if (!ta) return;
    undoStack.push({ file: currentFile, value: ta.value });
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }

  function undoEdit() {
    if (!undoStack.length) return;
    const ta = $('ide-textarea');
    redoStack.push({ file: currentFile, value: ta.value });
    const prev = undoStack.pop();
    if (prev.file !== currentFile) openFile(prev.file);
    ta.value = prev.value;
    ta.dispatchEvent(new Event('input'));
    toast('Undo');
  }

  function redoEdit() {
    if (!redoStack.length) return;
    const ta = $('ide-textarea');
    undoStack.push({ file: currentFile, value: ta.value });
    const next = redoStack.pop();
    if (next.file !== currentFile) openFile(next.file);
    ta.value = next.value;
    ta.dispatchEvent(new Event('input'));
    toast('Redo');
  }

  function formatDocument() {
    const ta = $('ide-textarea');
    if (!ta) return;
    pushUndo();
    let code = ta.value;
    const ext = (currentFile || '').split('.').pop();
    if (ext === 'js') {
      code = code.replace(/\s*\{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n').replace(/\n\s*\n/g, '\n');
    } else if (ext === 'css') {
      code = code.replace(/\{\s*/g, ' {\n  ').replace(/;\s*/g, ';\n').replace(/\}\s*/g, '\n}\n');
    } else if (ext === 'html') {
      code = code.replace(/>\s*</g, '>\n<');
    }
    ta.value = code.trim() + '\n';
    ta.dispatchEvent(new Event('input'));
    logOutput('Formatted ' + currentFile, 'info');
    toast('Formatted!');
  }

  function exportCurrentFile() {
    syncEditorToFile();
    const blob = new Blob([files[currentFile] || ''], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = currentFile;
    a.click();
    logOutput('Exported ' + currentFile, 'info');
  }

  function importProject(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.files) {
          files = data.files;
          openTabs = Object.keys(files).slice(0, 5);
          currentFile = openTabs[0];
          Object.keys(files).forEach(f => { dirty[f] = true; savedSnapshot[f] = ''; });
          renderFileTree(); renderTabs(); refreshEditor();
          saveProject();
          logOutput('Project imported: ' + (data.name || 'unknown'), 'success');
          toast('Project imported!');
        }
      } catch (err) { alert('Invalid project file'); }
    };
    reader.readAsText(file);
  }

  function goToLineInFile(name, line) {
    const n = parseInt(line, 10) || 1;
    if (name && name !== 'preview' && files[name]) {
      if (name !== currentFile) openFile(name);
    }
    const ta = $('ide-textarea');
    if (!ta) return;
    const lines = ta.value.split('\n');
    if (n > lines.length) return;
    let pos = 0;
    for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    const lh = parseInt(getComputedStyle(ta).lineHeight, 10) || 18;
    ta.scrollTop = Math.max(0, (n - 4) * lh);
    updateCursorPosition();
  }

  function mapPreviewError(data) {
    const msg = data.message || 'Preview runtime error';
    let line = data.line || 1;

    const bundled = msg.match(/rebel-inlined-js:(\d+)/i) || msg.match(/:(\d+):(\d+)/);
    if (bundled) line = parseInt(bundled[1], 10) || line;

    if (data.sourceFile && files[data.sourceFile]) {
      return { file: data.sourceFile, line, msg: 'Preview: ' + msg };
    }

    const jsFiles = [];
    const entry = findHtmlEntry();
    if (entry && files[entry]) {
      const html = files[entry];
      html.replace(/<script\b[^>]*\ssrc=["']([^"']+)["']/gi, (_, src) => {
        const f = normalizeAssetPath(src);
        if (f && files[f] && !jsFiles.includes(f)) jsFiles.push(f);
        return '';
      });
    }
    if (!jsFiles.length && files['app.js']) jsFiles.push('app.js');
    Object.keys(files).filter(f => f.endsWith('.js') && !jsFiles.includes(f)).forEach(f => jsFiles.push(f));

    let offset = 1;
    for (const f of jsFiles) {
      const blockLines = (`/* ${f} */\n${files[f] || ''}`).split('\n').length;
      if (line <= offset + blockLines - 1) {
        return { file: f, line: Math.max(1, line - offset + 1), msg: 'Preview: ' + msg };
      }
      offset += blockLines + 1;
    }

    return { file: jsFiles[0] || 'app.js', line, msg: 'Preview: ' + msg };
  }

  function runLinter() {
    syncEditorToFile();
    if (window.RebelDiagnostics && window.RebelDiagnostics.analyze) {
      problemsList = window.RebelDiagnostics.analyze(files, previewErrors);
    } else {
      problemsList = [];
      Object.entries(files).forEach(([name, code]) => {
        code.split('\n').forEach((line, i) => {
          if (name.endsWith('.js') && line.includes('console.log') && !line.trim().startsWith('//')) {
            problemsList.push({ file: name, line: i + 1, msg: 'Unexpected console statement', sev: 'info', fixable: true, rule: 'console-log', id: name + ':' + (i + 1) + ':console-log' });
          }
        });
      });
    }
    renderProblems();
    updateStatusBarCounts();
    updateGutter();
  }

  function getProblemById(id) {
    return problemsList.find(p => p.id === id);
  }

  function applyQuickFixForProblem(problem) {
    if (!problem || !files[problem.file]) return false;
    if (!window.RebelDiagnostics || !window.RebelDiagnostics.applyQuickFix) return false;
    pushUndo();
    const fixed = window.RebelDiagnostics.applyQuickFix(problem, files[problem.file]);
    if (fixed === null) return false;
    files[problem.file] = fixed;
    dirty[problem.file] = true;
    if (problem.file === currentFile) {
      const ta = $('ide-textarea');
      if (ta) {
        ta.value = fixed;
        ta.dispatchEvent(new Event('input'));
      }
    } else {
      renderFileTree();
      renderTabs();
      refreshEditor();
    }
    logOutput('Quick fix: ' + problem.file + ':' + problem.line + ' — ' + problem.msg, 'success');
    toast('Fixed!');
    runLinter();
    schedulePreviewRefresh();
    return true;
  }

  function fixAllQuick() {
    const fixable = problemsList.filter(p => p.fixable);
    if (!fixable.length) {
      toast('No quick fixes — try AI Fix All');
      return;
    }
    pushUndo();
    const byFile = {};
    fixable.forEach(p => { (byFile[p.file] = byFile[p.file] || []).push(p); });
    let count = 0;
    Object.entries(byFile).forEach(([file, probs]) => {
      probs.sort((a, b) => b.line - a.line);
      probs.forEach(p => {
        const fixed = window.RebelDiagnostics.applyQuickFix(p, files[file]);
        if (fixed !== null) { files[file] = fixed; count++; }
      });
      dirty[file] = true;
    });
    refreshEditor();
    runLinter();
    schedulePreviewRefresh();
    logOutput('Applied ' + count + ' quick fix(es)', 'success');
    toast('Applied ' + count + ' quick fix(es)');
  }

  async function fixWithAi(problems) {
    const list = problems && problems.length ? problems : problemsList.filter(p => p.sev === 'error' || p.fixable);
    if (!list.length) {
      toast('No problems to fix');
      return;
    }
    syncEditorToFile();
    showTermPanel('problems');
    const btn = $('ide-fix-all-ai-btn');
    if (btn) btn.disabled = true;

    const problemText = list.map(p => `- ${p.file}:${p.line} [${p.sev}] ${p.msg}`).join('\n');
    const fileSnippets = [...new Set(list.map(p => p.file))].map(f =>
      `// FILE: ${f}\n${(files[f] || '').slice(0, 2500)}`
    ).join('\n\n');

    const prompt = `${IDE_AI_SYSTEM}

Fix ALL of these code problems. Return corrected full files using fenced blocks with // FILE: filename on the first line.

PROBLEMS:
${problemText}

CURRENT FILES:
${fileSnippets}

User: Fix every problem listed above with working code.
Rebel AI:`;

    ideAddAiMsg('Fix these problems:\n' + problemText, 'user');
    const typing = document.createElement('div');
    typing.className = 'ide-ai-msg bot';
    typing.id = 'ide-ai-typing-indicator';
    typing.innerHTML = '<div class="ide-ai-avatar"><i class="fas fa-robot"></i></div><div class="ide-ai-typing"><span></span><span></span><span></span> Fixing errors…</div>';
    $('ide-ai-messages')?.appendChild(typing);

    try {
      const resp = await fetch(AI_BASE + '?q=' + encodeURIComponent(prompt));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const reply = data.results || data.result || 'No response';
      typing.remove();
      ideAddAiMsg(reply, 'bot');
      extractBlocks(reply).forEach(b => {
        files[b.file] = b.code;
        dirty[b.file] = true;
        if (!openTabs.includes(b.file)) openTabs.push(b.file);
      });
      renderFileTree();
      renderTabs();
      refreshEditor();
      previewErrors = [];
      runLinter();
      if (previewOpen) schedulePreviewRefresh();
      logOutput('AI fixed ' + list.length + ' problem(s)', 'success');
      toast('AI fixes applied!');
      trackCodespace('ai-fix');
    } catch (err) {
      typing.remove();
      ideAddAiMsg('Fix failed: ' + err.message, 'bot');
      toast('AI fix failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function quickFixAtCursor() {
    const ta = $('ide-textarea');
    if (!ta) return;
    const lineNum = ta.value.slice(0, ta.selectionStart).split('\n').length;
    const onLine = problemsList.filter(p => p.file === currentFile && p.line === lineNum);
    const problem = onLine.find(p => p.fixable) || onLine[0];
    if (!problem) {
      toast('No fix at this line');
      return;
    }
    if (problem.fixable && applyQuickFixForProblem(problem)) return;
    fixWithAi([problem]);
  }

  function renderProblems() {
    const el = $('ide-problems-body');
    const cnt = $('ide-problems-count');
    if (cnt) cnt.textContent = problemsList.length ? `(${problemsList.length})` : '';
    if (!el) return;

    if (!problemsList.length) {
      el.innerHTML = '<div class="ide-no-problems"><i class="fas fa-check-circle"></i> No problems detected — code looks clean!</div>';
      return;
    }

    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    el.innerHTML = problemsList.map(p => {
      const icon = p.sev === 'error' ? 'times-circle' : p.sev === 'warn' ? 'exclamation-triangle' : 'info-circle';
      const sel = p.id === selectedProblemId ? ' selected' : '';
      return `<div class="ide-problem ide-problem-${p.sev}${sel}" data-id="${p.id}" data-file="${p.file}" data-line="${p.line}">
        <i class="fas fa-${icon}"></i>
        <div class="ide-problem-main">
          <strong>${esc(p.file)}:${p.line}</strong>
          <span class="ide-problem-msg">${esc(p.msg)}</span>
          ${p.source ? `<span class="ide-problem-src">${esc(p.source)}</span>` : ''}
        </div>
        <div class="ide-problem-actions">
          ${p.fixable ? `<button type="button" class="ide-problem-fix" data-id="${p.id}" title="Quick fix">Fix</button>` : ''}
          <button type="button" class="ide-problem-ai" data-id="${p.id}" title="AI fix">AI</button>
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.ide-problem').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('.ide-problem-actions')) return;
        selectedProblemId = row.dataset.id;
        renderProblems();
        goToLineInFile(row.dataset.file, row.dataset.line);
      });
    });
    el.querySelectorAll('.ide-problem-fix').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = getProblemById(btn.dataset.id);
        if (p) applyQuickFixForProblem(p);
      });
    });
    el.querySelectorAll('.ide-problem-ai').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const p = getProblemById(btn.dataset.id);
        if (p) fixWithAi([p]);
      });
    });
  }

  function updateStatusBarCounts() {
    const errs = problemsList.filter(p => p.sev === 'error').length;
    const warns = problemsList.filter(p => p.sev === 'warn').length;
    const errEl = $('ide-sb-errors');
    const warnEl = $('ide-sb-warnings');
    if (errEl) errEl.innerHTML = `<i class="fas fa-${errs ? 'times-circle' : 'check-circle'}"></i> ${errs} errors`;
    if (warnEl) warnEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${warns} warnings`;
  }

  function updateCursorPosition() {
    const ta = $('ide-textarea');
    const el = $('ide-sb-position');
    if (!ta || !el) return;
    const before = ta.value.slice(0, ta.selectionStart);
    const lines = before.split('\n');
    el.textContent = `Ln ${lines.length}, Col ${(lines[lines.length - 1].length) + 1}`;
  }

  function updateLangLabel() {
    const el = $('ide-sb-lang');
    if (!el || !currentFile) return;
    const ext = currentFile.split('.').pop();
    const names = { js: 'JavaScript', html: 'HTML', css: 'CSS', md: 'Markdown', ts: 'TypeScript', json: 'JSON' };
    el.textContent = names[ext] || ext.toUpperCase();
  }

  function toggleLineComment() {
    const ta = $('ide-textarea');
    if (!ta) return;
    pushUndo();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const lineEndIdx = val.indexOf('\n', end);
    const block = val.slice(lineStart, lineEndIdx === -1 ? val.length : lineEndIdx);
    const lines = block.split('\n');
    const allCommented = lines.every(l => /^\s*\/\//.test(l));
    const newLines = lines.map(l => {
      if (allCommented) return l.replace(/^(\s*)\/\/ ?/, '$1');
      return /^\s*\/\//.test(l) ? l : l.replace(/^(\s*)/, '$1// ');
    });
    ta.value = val.slice(0, lineStart) + newLines.join('\n') + val.slice(lineEndIdx === -1 ? val.length : lineEndIdx);
    ta.dispatchEvent(new Event('input'));
  }

  function duplicateLine() {
    const ta = $('ide-textarea');
    if (!ta) return;
    pushUndo();
    const pos = ta.selectionStart;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd = val.indexOf('\n', pos);
    const line = val.slice(lineStart, lineEnd === -1 ? val.length : lineEnd);
    const at = lineEnd === -1 ? val.length : lineEnd;
    ta.value = val.slice(0, at) + (lineEnd === -1 ? '\n' : '') + line + val.slice(at);
    ta.dispatchEvent(new Event('input'));
  }

  function goToLine() {
    const ta = $('ide-textarea');
    if (!ta) return;
    const n = parseInt(prompt('Go to line number:'), 10);
    if (!n || n < 1) return;
    const lines = ta.value.split('\n');
    if (n > lines.length) return;
    let pos = 0;
    for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(pos, pos);
    updateCursorPosition();
  }

  const SNIPPETS = {
    log: "console.log('');\n",
    fn: "function name() {\n  \n}\n",
    fetch: "const res = await fetch(url);\nconst data = await res.json();\n",
    html5: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>\n",
  };

  function insertSnippet(key) {
    const ta = $('ide-textarea');
    const snippet = SNIPPETS[key];
    if (!ta || !snippet) return;
    pushUndo();
    const s = ta.selectionStart;
    ta.value = ta.value.slice(0, s) + snippet + ta.value.slice(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = s + snippet.length;
    ta.dispatchEvent(new Event('input'));
  }

  function pickSnippet() {
    const choice = prompt('Snippet: log, fn, fetch, html5');
    if (choice && SNIPPETS[choice.trim().toLowerCase()]) insertSnippet(choice.trim().toLowerCase());
  }

  function showTermPanel(name) {
    termPanel = name;
    document.querySelectorAll('.ide-term-tab').forEach(t => t.classList.toggle('active', t.dataset.term === name));
    document.querySelectorAll('.ide-term-panel').forEach(p => p.classList.remove('active'));
    $('ide-term-panel-' + name)?.classList.add('active');
    $('ide-terminal-panel').style.display = '';
    if (name === 'problems') runLinter();
  }

  function gitStageAll() {
    gitStaged = Object.keys(files).filter(f => dirty[f] || files[f] !== savedSnapshot[f]);
    updateGitPanel();
    logOutput('Staged: ' + (gitStaged.join(', ') || 'nothing'), 'info');
    toast('Staged ' + gitStaged.length + ' file(s)');
  }

  function gitCommit() {
    if (!gitStaged.length) gitStaged = Object.keys(files).filter(f => dirty[f]);
    if (!gitStaged.length) { toast('Nothing to commit'); return; }
    const msg = prompt('Commit message:', 'Update ' + gitStaged.join(', '));
    if (!msg) return;
    gitStaged.forEach(f => { savedSnapshot[f] = files[f]; dirty[f] = false; });
    gitStaged = [];
    saveProject();
    updateGitPanel();
    termLog('[' + new Date().toLocaleTimeString() + '] Committed: ' + msg, 'out');
    logOutput('Git commit: ' + msg, 'success');
    toast('Committed!');
  }

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

  function toggleDropdown(menuId) {
    document.querySelectorAll('.ide-dropdown').forEach(d => {
      if (d.id !== menuId) d.classList.remove('open');
    });
    $(menuId)?.classList.toggle('open');
  }

  function closeDropdowns() {
    document.querySelectorAll('.ide-dropdown').forEach(d => d.classList.remove('open'));
  }

  function handleMenuAction(action) {
    closeDropdowns();
    const map = {
      'new-file': newFile,
      'save': () => saveProject({ manual: true }),
      'import': () => $('ide-import-input')?.click(),
      'download': downloadProject,
      'export-file': exportCurrentFile,
      'close-ide': () => { syncEditorToFile(); saveProject({ manual: true }); $('codespaceModal')?.classList.remove('show'); document.body.style.overflow = ''; },
      'undo': undoEdit,
      'redo': redoEdit,
      'copy': () => { const ta = $('ide-textarea'); navigator.clipboard.writeText(ta?.value.slice(ta.selectionStart, ta.selectionEnd) || ta?.value || ''); toast('Copied'); },
      'paste': async () => { const ta = $('ide-textarea'); try { const t = await navigator.clipboard.readText(); if (ta) { pushUndo(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + t + ta.value.slice(ta.selectionEnd); ta.dispatchEvent(new Event('input')); } } catch(e) {} },
      'format': formatDocument,
      'fix-all': fixAllQuick,
      'fix-all-ai': () => fixWithAi(),
      'find': () => { showPanel('search'); $('ide-search-input')?.focus(); },
      'preview': runPreview,
      'toggle-terminal': () => { const p = $('ide-terminal-panel'); p.style.display = p.style.display === 'none' ? '' : 'none'; },
      'explorer': () => showPanel('explorer'),
      'search-panel': () => showPanel('search'),
      'term-terminal': () => showTermPanel('terminal'),
      'term-problems': () => showTermPanel('problems'),
      'term-output': () => showTermPanel('output'),
      'term-clear': () => { $('ide-terminal-output').innerHTML = ''; termLog('', 'out'); },
      'shortcuts': () => alert('Ctrl+S Save · Ctrl+F Find · F5 Preview · Ctrl+. Quick Fix · Ctrl+Z Undo · Ctrl+Y Redo · Esc Close'),
      'docs': () => { openFile('README.md'); showPanel('explorer'); },
      'ai-help': () => { $('ide-ai-input').value = 'Explain this project and how to run it'; $('ide-ai-input')?.focus(); },
    };
    map[action]?.();
  }

  function minimizeIDE() {
    const shell = document.querySelector('.ide-shell');
    shell?.classList.toggle('ide-minimized');
    toast(shell?.classList.contains('ide-minimized') ? 'Minimized' : 'Restored');
  }

  function clearAiChat() {
    const msgs = $('ide-ai-messages');
    if (msgs) msgs.innerHTML = '<div class="ide-ai-msg bot"><div class="ide-ai-avatar"><i class="fas fa-robot"></i></div><div class="ide-ai-bubble">Chat cleared. How can I help?</div></div>';
    aiHistory = [];
    toast('AI chat cleared');
  }

  // ── Private Terminal (virtual shell on saved project) ─────
  function termLog(text, type) {
    const out = $('ide-terminal-output');
    if (!out) return;
    const cursor = out.querySelector('.ide-tline:last-child');
    if (cursor) cursor.remove();
    const cls = type === 'out' ? 'ide-tout' : type === 'err' ? 'ide-terr' : 'ide-tline';
    const div = document.createElement('div');
    div.className = cls;
    const prompt = termPrompt();
    div.innerHTML = type === 'cmd'
      ? `<span class="ide-tprompt">${prompt}</span> <span class="ide-tcmd">${String(text).replace(/</g, '&lt;')}</span>`
      : String(text).replace(/</g, '&lt;');
    out.appendChild(div);
    out.insertAdjacentHTML('beforeend', `<div class="ide-tline"><span class="ide-tprompt">${prompt}</span> <span class="ide-tcursor">▌</span></div>`);
    out.scrollTop = out.scrollHeight;
  }

  function termHelp() {
    termLog([
      'Private Terminal — changes auto-save to your project:',
      '  ls [-la]  cat  touch  rm  mv  cp  edit/code',
      '  echo text > file   echo text >> file',
      '  grep  save  preview  lint  history  clear',
    ].join('\n'), 'out');
  }

  function runTerminalCmd(cmd) {
    const c = cmd.trim();
    if (!c) return;
    const lc = c.toLowerCase();
    termLog(c, 'cmd');
    termHistory.push(c);
    termIdx = termHistory.length;

    if (lc === 'clear') { $('ide-terminal-output').innerHTML = ''; termLog('Private terminal ready.', 'out'); return; }
    if (lc === 'help' || lc === 'rebel help') { termHelp(); return; }
    if (lc === 'history') { termLog(termHistory.slice(-20).map((h, i) => `${i + 1}  ${h}`).join('\n') || '(empty)', 'out'); return; }
    if (lc === 'ls' || lc === 'ls -la') {
      const rows = Object.keys(files).sort().map(f => {
        const sz = (files[f] || '').length;
        const mark = dirty[f] ? '*' : ' ';
        return lc.includes('-la') ? `${mark}${f} (${sz}b)` : f;
      });
      termLog(rows.join('  ') || '(empty)', 'out');
      return;
    }
    if (lc === 'pwd') { termLog('/home/rebel/rebel-project', 'out'); return; }
    if (lc === 'whoami') { termLog(getTermUser(), 'out'); return; }
    if (lc === 'date') { termLog(new Date().toString(), 'out'); return; }
    if (lc.startsWith('cat ')) {
      const f = c.slice(4).trim();
      termLog(files[f] !== undefined ? files[f] : 'cat: ' + f + ': No such file', files[f] !== undefined ? 'out' : 'err');
      return;
    }
    if (lc.startsWith('grep ')) {
      const m = c.match(/^grep\s+(\S+)\s+(\S+)$/i);
      if (!m) { termLog('Usage: grep <word> <file>', 'err'); return; }
      const [, word, f] = m;
      if (files[f] === undefined) { termLog('grep: ' + f + ': No such file', 'err'); return; }
      const hits = files[f].split('\n').map((line, i) => ({ line, n: i + 1 })).filter(x => x.line.includes(word));
      termLog(hits.length ? hits.map(h => `${f}:${h.n}:${h.line}`).join('\n') : '(no matches)', 'out');
      return;
    }
    if (lc.startsWith('touch ')) {
      const f = c.slice(6).trim();
      if (!f) { termLog('touch: missing file', 'err'); return; }
      if (files[f] === undefined) writeFileFromTerminal(f, '// ' + f + '\n', false);
      termLog('Touched ' + f, 'out');
      return;
    }
    if (lc.startsWith('rm ')) {
      const f = c.slice(3).trim();
      if (!files[f]) { termLog('rm: ' + f + ': No such file', 'err'); return; }
      if (Object.keys(files).length <= 1) { termLog('rm: cannot delete last file', 'err'); return; }
      delete files[f]; delete dirty[f];
      openTabs = openTabs.filter(t => t !== f);
      if (currentFile === f) currentFile = openTabs[0] || Object.keys(files)[0];
      renderFileTree(); renderTabs(); refreshEditor();
      scheduleAutoSave(); runLinter();
      termLog('Removed ' + f, 'out');
      return;
    }
    if (lc.startsWith('mv ')) {
      const parts = c.slice(3).trim().split(/\s+/);
      if (parts.length < 2) { termLog('Usage: mv <from> <to>', 'err'); return; }
      const [from, to] = parts;
      if (files[from] === undefined) { termLog('mv: ' + from + ': No such file', 'err'); return; }
      files[to] = files[from]; dirty[to] = true;
      delete files[from]; delete dirty[from];
      openTabs = openTabs.map(t => t === from ? to : t);
      if (currentFile === from) currentFile = to;
      renderFileTree(); renderTabs(); refreshEditor();
      scheduleAutoSave();
      termLog('Renamed ' + from + ' → ' + to, 'out');
      return;
    }
    if (lc.startsWith('cp ')) {
      const parts = c.slice(3).trim().split(/\s+/);
      if (parts.length < 2) { termLog('Usage: cp <from> <to>', 'err'); return; }
      const [from, to] = parts;
      if (files[from] === undefined) { termLog('cp: ' + from + ': No such file', 'err'); return; }
      writeFileFromTerminal(to, files[from], false);
      termLog('Copied ' + from + ' → ' + to, 'out');
      return;
    }
    if (/^echo\s+.+\s>>\s*\S+/.test(c)) {
      const m = c.match(/^echo\s+(.+)\s>>\s*(\S+)\s*$/);
      if (m) {
        const text = m[1].replace(/^["']|["']$/g, '');
        writeFileFromTerminal(m[2], text + '\n', true);
        termLog('Appended to ' + m[2], 'out');
      }
      return;
    }
    if (/^echo\s+.+\s>\s*\S+/.test(c)) {
      const m = c.match(/^echo\s+(.+)\s>\s*(\S+)\s*$/);
      if (m) {
        const text = m[1].replace(/^["']|["']$/g, '');
        writeFileFromTerminal(m[2], text + '\n', false);
        termLog('Written to ' + m[2], 'out');
      }
      return;
    }
    if (lc.startsWith('edit ') || lc.startsWith('code ') || lc.startsWith('nano ')) {
      const f = c.split(/\s+/)[1];
      if (!files[f]) { termLog('No such file: ' + f, 'err'); return; }
      openFile(f);
      termLog('Opened ' + f + ' in editor', 'out');
      return;
    }
    if (lc === 'git status') { updateGitPanel(); const ch = Object.keys(files).filter(f => dirty[f]); termLog('On branch main\n' + (ch.length ? 'Modified: ' + ch.join(', ') : 'nothing to commit, working tree clean'), 'out'); return; }
    if (lc === 'npm install') { npmInstalled = true; termLog('added 248 packages in 2.1s', 'out'); return; }
    if (lc === 'npm run dev' || lc === 'node app.js' || lc === 'npm start') {
      termLog('Starting browser live preview…', 'out');
      runPreview();
      return;
    }
    if (lc.startsWith('echo ')) { termLog(c.slice(5), 'out'); return; }
    if (lc === 'preview') { runPreview(); return; }
    if (lc === 'lint' || lc === 'diagnostics') { runLinter(); showTermPanel('problems'); termLog('Found ' + problemsList.length + ' problem(s)', 'out'); return; }
    if (lc === 'save') { saveProject({ manual: true }); return; }
    if (lc === 'format') { formatDocument(); return; }
    if (lc === 'git add .') { gitStageAll(); termLog('Staged all changes.', 'out'); return; }
    if (lc.startsWith('git commit')) { gitCommit(); return; }
    if (lc === 'npm run build') { logOutput('Build successful ✓', 'success'); termLog('Build completed.', 'out'); return; }
    termLog('bash: ' + c + ': command not found (type help)', 'err');
  }

  // ── Search ────────────────────────────────────────────────
  function searchFiles(query) {
    const results = $('ide-search-results');
    if (!results) return;
    if (!query.trim()) { results.innerHTML = ''; return; }
    const q = query.toLowerCase();
    const hits = [];
    Object.entries(files).forEach(([name, content]) => {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.toLowerCase().includes(q)) hits.push({ name, line: i + 1, text: line.trim().slice(0, 80) });
      });
    });
    results.innerHTML = hits.length ? hits.slice(0, 30).map(h =>
      `<div class="ide-search-hit" data-file="${h.name}" data-line="${h.line}"><strong>${h.name}:${h.line}</strong><span>${h.text}</span></div>`
    ).join('') : '<div style="padding:12px;color:rgba(255,255,255,0.3);font-size:0.75rem;">No results</div>';
    results.querySelectorAll('.ide-search-hit').forEach(el => {
      el.addEventListener('click', () => openFile(el.dataset.file));
    });
  }

  // ── AI Panel ────────────────────────────────────────────
  const IDE_AI_SYSTEM = `You are Rebel AI inside Rebel Codespace IDE. When writing code use fenced blocks with // FILE: filename.ext on first line. Files: app.js, index.html, style.css, README.md. Be concise.`;

  function extractBlocks(text) {
    const blocks = [];
    const re = /```([a-zA-Z0-9_.+-]*)\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      let code = m[2];
      let file = null;
      const fc = code.match(/^(?:\/\/|#|<!--)\s*FILE:\s*([^\s\n>]+)/);
      if (fc) { file = fc[1].trim(); code = code.replace(fc[0], '').replace(/^\n/, ''); }
      else file = { js: 'app.js', javascript: 'app.js', html: 'index.html', css: 'style.css', md: 'README.md' }[m[1].toLowerCase()] || 'app.js';
      blocks.push({ file, code: code.trimEnd() });
    }
    return blocks;
  }

  function ideAddAiMsg(text, role) {
    const msgs = $('ide-ai-messages');
    if (!msgs) return;
    const wrap = document.createElement('div');
    wrap.className = 'ide-ai-msg ' + (role === 'user' ? 'user' : 'bot');
    const safe = text.replace(/```[\s\S]*?```/g, m => {
      const f = m.match(/FILE:\s*([^\s\n>]+)/);
      return `<span class="ide-code-pill"><i class="fas fa-file-code"></i> ${f ? f[1] : 'code'} → editor</span>`;
    }).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/ide-code-pill&gt;/g, 'ide-code-pill>')
      .replace(/&lt;span class="ide-code-pill"&gt;(.*?)&lt;\/span&gt;/g, '<span class="ide-code-pill">$1</span>')
      .replace(/\n/g, '<br>');
    wrap.innerHTML = `<div class="${role === 'user' ? 'ide-ai-user-avatar' : 'ide-ai-avatar'}"><i class="fas fa-${role === 'user' ? 'user' : 'robot'}"></i></div><div class="ide-ai-bubble">${safe}</div>`;
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function ideAiSend() {
    const input = $('ide-ai-input');
    const btn = $('ide-ai-send-btn');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = ''; input.style.height = 'auto';
    if (btn) btn.disabled = true;
    syncEditorToFile();
    ideAddAiMsg(msg, 'user');
    aiHistory.push({ role: 'user', content: msg });

    const typing = document.createElement('div');
    typing.className = 'ide-ai-msg bot'; typing.id = 'ide-ai-typing-indicator';
    typing.innerHTML = '<div class="ide-ai-avatar"><i class="fas fa-robot"></i></div><div class="ide-ai-typing"><span></span><span></span><span></span> Thinking…</div>';
    $('ide-ai-messages')?.appendChild(typing);

    try {
      let prompt = IDE_AI_SYSTEM + '\n\nCURRENT FILE: ' + currentFile + '\n```\n' + (files[currentFile] || '').slice(0, 900) + '\n```\n\n';
      aiHistory.slice(-6).forEach(m => { prompt += (m.role === 'user' ? 'User' : 'AI') + ': ' + m.content.slice(0, 200) + '\n'; });
      prompt += 'User: ' + msg + '\nRebel AI:';
      const resp = await fetch(AI_BASE + '?q=' + encodeURIComponent(prompt));
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const reply = data.results || data.result || 'No response';
      aiHistory.push({ role: 'assistant', content: reply });
      typing.remove();
      ideAddAiMsg(reply, 'bot');
      extractBlocks(reply).forEach(b => {
        files[b.file] = b.code;
        dirty[b.file] = true;
        if (!openTabs.includes(b.file)) openTabs.push(b.file);
      });
      renderFileTree(); renderTabs(); refreshEditor();
      scheduleAutoSave();
      if (previewOpen) schedulePreviewRefresh();
      trackCodespace('ai-write');
    } catch (err) {
      typing.remove();
      ideAddAiMsg('Error: ' + err.message, 'bot');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ── Sidebar panels ────────────────────────────────────────
  function showPanel(name) {
    document.querySelectorAll('.ide-sidebar-panel').forEach(p => { p.style.display = 'none'; });
    const explorer = $('ide-sidebar-explorer');
    if (explorer) explorer.style.display = 'none';
    document.querySelectorAll('.ide-act-btn').forEach(b => b.classList.remove('active'));
    if (name === 'explorer') {
      if (explorer) explorer.style.display = '';
    } else if (name === 'preview') {
      runPreview();
      return;
    } else {
      const p = $('ide-sidebar-' + name);
      if (p) { p.style.display = 'flex'; }
    }
    document.querySelector(`.ide-act-btn[data-panel="${name}"]`)?.classList.add('active');
  }

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    await loadProject();
    Object.keys(files).forEach(f => { savedSnapshot[f] = files[f]; });

    renderFileTree();
    renderTabs();
    refreshEditor();

    const termOut = $('ide-terminal-output');
    if (termOut && !termOut.querySelector('.ide-tout')) {
      termOut.innerHTML = '';
      termLog('Welcome to your Private Terminal — type help for commands.', 'out');
    }

    const ta = $('ide-textarea');
    if (ta) {
      let inputTimer;
      ta.addEventListener('input', () => {
        files[currentFile] = ta.value;
        dirty[currentFile] = true;
        $('ide-highlight-layer').innerHTML = highlight(ta.value, currentFile);
        updateGutter();
        setSaveStatus(false, cloudSynced);
        renderTabs();
        renderFileTree();
        updateCursorPosition();
        clearTimeout(inputTimer);
        inputTimer = setTimeout(runLinter, 800);
        scheduleAutoSave();
        schedulePreviewRefresh();
      });
      ta.addEventListener('click', updateCursorPosition);
      ta.addEventListener('keyup', updateCursorPosition);
      ta.addEventListener('scroll', () => {
        const hl = $('ide-highlight-layer');
        if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
        $('ide-gutter').scrollTop = ta.scrollTop;
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); pushUndo(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; ta.dispatchEvent(new Event('input')); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undoEdit(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redoEdit(); }
      });
    }

    $('ide-format-btn')?.addEventListener('click', formatDocument);
    $('ide-import-btn')?.addEventListener('click', () => $('ide-import-input')?.click());
    if (!importInputBound) {
      $('ide-import-input')?.addEventListener('change', e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });
      importInputBound = true;
    }
    $('ide-git-add')?.addEventListener('click', gitStageAll);
    $('ide-git-commit')?.addEventListener('click', gitCommit);
    $('ide-ai-clear-btn')?.addEventListener('click', clearAiChat);
    $('ide-minimize-btn')?.addEventListener('click', minimizeIDE);
    $('ide-maximize-btn')?.addEventListener('click', () => { showTermPanel('terminal'); $('ide-terminal-panel').style.height = '45%'; toast('Terminal expanded'); });

    document.querySelectorAll('.ide-menu-wrap .ide-menu-item').forEach(item => {
      item.addEventListener('click', e => {
        e.stopPropagation();
        const menu = item.dataset.menu || item.id?.replace('ide-toggle-', '').replace('-menu', '');
        const id = 'ide-menu-' + (menu === 'terminal' ? 'terminal' : menu);
        if ($(id)) toggleDropdown(id);
        else if (item.id === 'ide-toggle-preview-menu') handleMenuAction('preview');
        else if (item.id === 'ide-toggle-terminal-menu') showTermPanel('terminal');
      });
    });
    document.querySelectorAll('.ide-dropdown button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => handleMenuAction(btn.dataset.action));
    });
    document.addEventListener('click', closeDropdowns);
    $('codespaceModal')?.addEventListener('click', e => { if (e.target === $('codespaceModal')) closeDropdowns(); });

    document.querySelectorAll('.ide-term-tab[data-term]').forEach(tab => {
      tab.addEventListener('click', () => showTermPanel(tab.dataset.term));
    });

    $('ide-toggle-preview-menu')?.addEventListener('click', e => { e.stopPropagation(); toggleDropdown('ide-menu-view'); });
    $('ide-toggle-terminal-menu')?.addEventListener('click', e => { e.stopPropagation(); toggleDropdown('ide-menu-terminal'); });

    logOutput('Rebel Codespace Pro ready.', 'info');
    runLinter();
    $('ide-save-btn')?.addEventListener('click', () => saveProject({ manual: true }));
    $('ide-new-file-btn')?.addEventListener('click', newFile);
    $('ide-add-file-btn')?.addEventListener('click', newFile);
    $('ide-download-btn')?.addEventListener('click', downloadProject);
    $('ide-run-btn')?.addEventListener('click', runPreview);
    $('ide-preview-btn')?.addEventListener('click', runPreview);
    $('ide-preview-close')?.addEventListener('click', closePreview);
    $('ide-preview-refresh')?.addEventListener('click', () => { applyPreviewToFrame(); toast('Preview refreshed'); });
    $('ide-preview-newtab')?.addEventListener('click', openPreviewNewTab);
    $('ide-preview-live')?.addEventListener('change', e => {
      previewLive = e.target.checked;
      toast(previewLive ? 'Live preview ON' : 'Live preview paused');
      if (previewLive && previewOpen) schedulePreviewRefresh();
    });

    window.addEventListener('message', e => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'rebel-preview-ready') setPreviewStatus('Ready', 'ready');
      if (e.data.type === 'rebel-preview-error') {
        setPreviewStatus('Error', 'error');
        const mapped = mapPreviewError(e.data);
        const dup = previewErrors.some(p => p.msg === mapped.msg && p.line === mapped.line);
        if (!dup) {
          previewErrors.push(mapped);
          runLinter();
          showTermPanel('problems');
          logOutput('Preview error: ' + mapped.msg, 'info');
        }
      }
    });

    $('ide-preview-frame')?.addEventListener('load', () => {
      if (previewOpen) setPreviewStatus('Ready', 'ready');
    });
    $('ide-ai-send-btn')?.addEventListener('click', ideAiSend);
    $('ide-ai-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ideAiSend(); } });
    $('ide-search-input')?.addEventListener('input', e => searchFiles(e.target.value));
    $('ide-reset-project')?.addEventListener('click', () => {
      if (confirm('Reset project to defaults? Your saved code will be cleared.')) {
        localStorage.removeItem(getStorageKey());
        location.reload();
      }
    });

    document.querySelectorAll('.ide-act-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => showPanel(btn.dataset.panel));
    });

    const termInput = $('ide-terminal-input');
    if (termInput) {
      termInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { runTerminalCmd(termInput.value); termInput.value = ''; }
        else if (e.key === 'ArrowUp') { termIdx = Math.max(0, termIdx - 1); termInput.value = termHistory[termIdx] || ''; }
        else if (e.key === 'ArrowDown') { termIdx = Math.min(termHistory.length, termIdx + 1); termInput.value = termHistory[termIdx] || ''; }
      });
    }

    $('ide-fix-all-btn')?.addEventListener('click', fixAllQuick);
    $('ide-fix-all-ai-btn')?.addEventListener('click', () => fixWithAi());
    $('ide-refresh-diagnostics-btn')?.addEventListener('click', () => { previewErrors = []; runLinter(); toast('Re-scanned'); });
    $('ide-sb-errors')?.addEventListener('click', () => showTermPanel('problems'));
    $('ide-sb-warnings')?.addEventListener('click', () => showTermPanel('problems'));
    $('ide-term-close')?.addEventListener('click', () => { $('ide-terminal-panel').style.display = $('ide-terminal-panel').style.display === 'none' ? '' : 'none'; });
    $('ide-git-btn')?.addEventListener('click', () => showPanel('git'));

    const openModal = () => {
      if (window.RebelControl && !window.RebelControl.isEnabled('codespace')) {
        alert(window.RebelControl.getDisabledMessage('codespace'));
        return;
      }
      $('codespaceModal')?.classList.add('show');
      document.body.style.overflow = 'hidden';
      refreshEditor();
      trackCodespace('open');
    };
    const closeModal = () => { syncEditorToFile(); saveProject(); $('codespaceModal')?.classList.remove('show'); document.body.style.overflow = ''; };

    $('codespaceBtn')?.addEventListener('click', e => { e.preventDefault(); openModal(); });
    $('terminalCodespaceBtn')?.addEventListener('click', e => { e.preventDefault(); openModal(); });
    ['closeCodespaceModal', 'closeCodespaceModal2'].forEach(id => $(id)?.addEventListener('click', closeModal));

    document.addEventListener('keydown', e => {
      if (!$('codespaceModal')?.classList.contains('show')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject({ manual: true }); }
      if (e.key === 'F5') { e.preventDefault(); runPreview(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); showPanel('search'); $('ide-search-input')?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleLineComment(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateLine(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); goToLine(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); pickSnippet(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); quickFixAtCursor(); }
      if (e.key === 'Escape') closeModal();
    });

    const fontSize = $('ide-font-size');
    if (fontSize) fontSize.addEventListener('input', () => {
      const sz = fontSize.value + 'px';
      if (ta) ta.style.fontSize = sz;
      $('ide-highlight-layer').style.fontSize = sz;
    });
    $('ide-word-wrap')?.addEventListener('change', e => {
      if (ta) { ta.style.whiteSpace = e.target.checked ? 'pre-wrap' : 'pre'; ta.style.wordWrap = e.target.checked ? 'break-word' : 'normal'; }
    });
    $('ide-tab-size')?.addEventListener('change', e => {
      if (ta) ta.style.tabSize = e.target.value;
    });
  }

  document.addEventListener('DOMContentLoaded', () => { init().catch(() => {}); });
  window.RebelCodespace = { saveProject, runPreview, getFiles: () => ({ ...files }) };
})();
