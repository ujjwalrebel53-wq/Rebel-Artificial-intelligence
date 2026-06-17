/* ═══════════════════════════════════════════════════════════
   REBEL CODESPACE PRO — Fully Functional IDE
   ═══════════════════════════════════════════════════════════ */
(function RebelCodespacePro() {
  'use strict';

  const STORAGE_KEY = 'rbl_codespace_project_v2';
  const AI_BASE = 'https://api-rebix.vercel.app/api/gpt-5';

  const DEFAULT_FILES = {
    'app.js': `// Rebel Codespace — AI-powered editor\n// Ctrl+S save · F5 run · Ctrl+/ AI\n\nconst express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n  res.send('<h1>Hello from Rebel Codespace!</h1>');\n});\n\napp.listen(3000, () => {\n  console.log('Server running on port 3000');\n});`,
    'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>Rebel App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello Rebel!</h1>\n  <p>Edit me in Codespace and press F5 to preview.</p>\n  <script src="app.js"><\/script>\n</body>\n</html>`,
    'style.css': `body {\n  font-family: 'Roboto', sans-serif;\n  background: linear-gradient(135deg, #121212, #1a0a2e);\n  color: #fff;\n  margin: 0;\n  min-height: 100vh;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n}\nh1 { color: #8a2be2; font-size: 2.5rem; }`,
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
  let termPanel = 'terminal';
  let importInputBound = false;

  const $ = id => document.getElementById(id);

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        files = data.files || { ...DEFAULT_FILES };
        openTabs = data.openTabs || ['app.js', 'index.html', 'style.css'];
        currentFile = data.currentFile || 'app.js';
        return;
      }
    } catch (e) {}
    files = { ...DEFAULT_FILES };
    openTabs = ['app.js', 'index.html', 'style.css'];
    currentFile = 'app.js';
  }

  function saveProject() {
    syncEditorToFile();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ files, openTabs, currentFile, savedAt: Date.now() }));
    Object.keys(files).forEach(f => { savedSnapshot[f] = files[f]; dirty[f] = false; });
    setSaveStatus(true);
    termLog('Project saved to local storage.', 'out');
    trackCodespace('save');
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
    gutter.innerHTML = '';
    for (let i = 1; i <= lines; i++) {
      const s = document.createElement('span');
      s.textContent = i;
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
    setSaveStatus(!dirty[currentFile]);
    updateGitPanel();
    updateLangLabel();
    updateCursorPosition();
  }

  function setSaveStatus(saved) {
    const el = $('ide-save-status');
    if (!el) return;
    el.className = 'ide-save-status' + (saved ? '' : ' unsaved');
    el.innerHTML = saved ? '<i class="fas fa-check-circle"></i> Saved' : '<i class="fas fa-circle"></i> Unsaved';
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

  // ── Live Preview ──────────────────────────────────────────
  function runPreview() {
    syncEditorToFile();
    const html = files['index.html'] || '<h1>No index.html</h1>';
    const css = files['style.css'] || '';
    const js = files['app.js'] || '';
    const doc = html.includes('<html') ? html : `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
    const full = doc.replace('</head>', `<style>${css}</style></head>`).replace(/<script src="app\.js"><\/script>/, `<script>${js}<\/script>`);
    const frame = $('ide-preview-frame');
    const panel = $('ide-preview-panel');
    if (frame) { frame.srcdoc = full; }
    if (panel) { panel.style.display = 'flex'; $('ide-editor-area')?.classList.add('preview-open'); }
    $('ide-preview-btn')?.classList.add('active');
    termLog('Preview updated.', 'out');
    trackCodespace('preview');
    runLinter();
  }

  function closePreview() {
    $('ide-preview-panel').style.display = 'none';
    $('ide-editor-area')?.classList.remove('preview-open');
    $('ide-preview-btn')?.classList.remove('active');
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

  function runLinter() {
    syncEditorToFile();
    problemsList = [];
    Object.entries(files).forEach(([name, code]) => {
      const lines = code.split('\n');
      lines.forEach((line, i) => {
        if (name.endsWith('.js')) {
          if (line.includes('console.log') && !line.trim().startsWith('//')) problemsList.push({ file: name, line: i + 1, msg: 'Avoid console.log in production', sev: 'warn' });
          if ((line.match(/\(/g) || []).length !== (line.match(/\)/g) || []).length && line.includes('(')) problemsList.push({ file: name, line: i + 1, msg: 'Possible unbalanced parentheses', sev: 'error' });
        }
        if (line.includes('TODO') || line.includes('FIXME')) problemsList.push({ file: name, line: i + 1, msg: 'TODO/FIXME found', sev: 'info' });
      });
    });
    renderProblems();
    updateStatusBarCounts();
  }

  function renderProblems() {
    const el = $('ide-problems-body');
    const cnt = $('ide-problems-count');
    if (cnt) cnt.textContent = problemsList.length ? `(${problemsList.length})` : '';
    if (!el) return;
    el.innerHTML = problemsList.length ? problemsList.map(p =>
      `<div class="ide-problem ide-problem-${p.sev}" data-file="${p.file}" data-line="${p.line}"><i class="fas fa-${p.sev === 'error' ? 'times-circle' : p.sev === 'warn' ? 'exclamation-triangle' : 'info-circle'}"></i> <strong>${p.file}:${p.line}</strong> ${p.msg}</div>`
    ).join('') : '<div class="ide-no-problems"><i class="fas fa-check-circle"></i> No problems detected</div>';
    el.querySelectorAll('.ide-problem').forEach(row => {
      row.addEventListener('click', () => openFile(row.dataset.file));
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
      'save': saveProject,
      'import': () => $('ide-import-input')?.click(),
      'download': downloadProject,
      'export-file': exportCurrentFile,
      'close-ide': () => { syncEditorToFile(); saveProject(); $('codespaceModal')?.classList.remove('show'); document.body.style.overflow = ''; },
      'undo': undoEdit,
      'redo': redoEdit,
      'copy': () => { const ta = $('ide-textarea'); navigator.clipboard.writeText(ta?.value.slice(ta.selectionStart, ta.selectionEnd) || ta?.value || ''); toast('Copied'); },
      'paste': async () => { const ta = $('ide-textarea'); try { const t = await navigator.clipboard.readText(); if (ta) { pushUndo(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + t + ta.value.slice(ta.selectionEnd); ta.dispatchEvent(new Event('input')); } } catch(e) {} },
      'format': formatDocument,
      'find': () => { showPanel('search'); $('ide-search-input')?.focus(); },
      'preview': runPreview,
      'toggle-terminal': () => { const p = $('ide-terminal-panel'); p.style.display = p.style.display === 'none' ? '' : 'none'; },
      'explorer': () => showPanel('explorer'),
      'search-panel': () => showPanel('search'),
      'term-terminal': () => showTermPanel('terminal'),
      'term-problems': () => showTermPanel('problems'),
      'term-output': () => showTermPanel('output'),
      'term-clear': () => { $('ide-terminal-output').innerHTML = ''; termLog('', 'out'); },
      'shortcuts': () => alert('Ctrl+S Save · Ctrl+F Find · F5 Preview · Ctrl+Z Undo · Ctrl+Y Redo · Esc Close'),
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

  // ── Terminal ──────────────────────────────────────────────
  function termLog(text, type) {
    const out = $('ide-terminal-output');
    if (!out) return;
    const cursor = out.querySelector('.ide-tline:last-child');
    if (cursor) cursor.remove();
    const cls = type === 'out' ? 'ide-tout' : type === 'err' ? 'ide-terr' : 'ide-tline';
    const div = document.createElement('div');
    div.className = cls;
    div.innerHTML = type === 'cmd' ? `<span class="ide-tprompt">rebel@codespace:~$</span> <span class="ide-tcmd">${text}</span>` : text;
    out.appendChild(div);
    out.insertAdjacentHTML('beforeend', '<div class="ide-tline"><span class="ide-tprompt">rebel@codespace:~$</span> <span class="ide-tcursor">▌</span></div>');
    out.scrollTop = out.scrollHeight;
  }

  function runTerminalCmd(cmd) {
    const c = cmd.trim();
    const lc = c.toLowerCase();
    termLog(c, 'cmd');
    termHistory.push(c); termIdx = termHistory.length;

    if (lc === 'clear') { $('ide-terminal-output').innerHTML = ''; return; }
    if (lc === 'ls') { termLog(Object.keys(files).join('  '), 'out'); return; }
    if (lc === 'pwd') { termLog('/home/rebel/rebel-project', 'out'); return; }
    if (lc === 'whoami') { termLog('rebel', 'out'); return; }
    if (lc === 'date') { termLog(new Date().toString(), 'out'); return; }
    if (lc === 'git status') { updateGitPanel(); const ch = Object.keys(files).filter(f => dirty[f]); termLog('On branch main\n' + (ch.length ? 'Modified: ' + ch.join(', ') : 'nothing to commit, working tree clean'), 'out'); return; }
    if (lc === 'npm install') { npmInstalled = true; termLog('added 248 packages in 2.1s', 'out'); return; }
    if (lc === 'npm run dev' || lc === 'node app.js') {
      if (!npmInstalled) termLog('Run npm install first.', 'err');
      else { termLog('> rebel-project@1.0.0 dev\n> node app.js\n\nServer running on port 3000', 'out'); runPreview(); }
      return;
    }
    if (lc.startsWith('cat ')) { const f = c.slice(4).trim(); termLog(files[f] ? files[f].slice(0, 500) : 'No such file', files[f] ? 'out' : 'err'); return; }
    if (lc.startsWith('echo ')) { termLog(c.slice(5), 'out'); return; }
    if (lc === 'rebel help') { termLog('Commands: ls, cat, npm install, npm run dev, git status, clear, preview', 'out'); return; }
    if (lc === 'preview') { runPreview(); return; }
    if (lc === 'save') { saveProject(); return; }
    if (lc === 'format') { formatDocument(); return; }
    if (lc === 'git add .') { gitStageAll(); termLog('Staged all changes.', 'out'); return; }
    if (lc.startsWith('git commit')) { gitCommit(); return; }
    if (lc === 'npm run build') { logOutput('Build successful ✓', 'success'); termLog('Build completed.', 'out'); return; }
    termLog('bash: ' + c + ': command not found', 'err');
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
  function init() {
    loadProject();
    Object.keys(files).forEach(f => { savedSnapshot[f] = files[f]; });

    renderFileTree();
    renderTabs();
    refreshEditor();

    const ta = $('ide-textarea');
    if (ta) {
      let inputTimer;
      ta.addEventListener('input', () => {
        files[currentFile] = ta.value;
        dirty[currentFile] = true;
        $('ide-highlight-layer').innerHTML = highlight(ta.value, currentFile);
        updateGutter();
        setSaveStatus(false);
        renderTabs();
        renderFileTree();
        updateCursorPosition();
        clearTimeout(inputTimer);
        inputTimer = setTimeout(runLinter, 800);
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
    $('ide-save-btn')?.addEventListener('click', saveProject);
    $('ide-new-file-btn')?.addEventListener('click', newFile);
    $('ide-add-file-btn')?.addEventListener('click', newFile);
    $('ide-download-btn')?.addEventListener('click', downloadProject);
    $('ide-run-btn')?.addEventListener('click', runPreview);
    $('ide-preview-btn')?.addEventListener('click', runPreview);
    $('ide-preview-close')?.addEventListener('click', closePreview);
    $('ide-ai-send-btn')?.addEventListener('click', ideAiSend);
    $('ide-ai-input')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ideAiSend(); } });
    $('ide-search-input')?.addEventListener('input', e => searchFiles(e.target.value));
    $('ide-reset-project')?.addEventListener('click', () => { if (confirm('Reset project to defaults?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); } });

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
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
      if (e.key === 'F5') { e.preventDefault(); runPreview(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); showPanel('search'); $('ide-search-input')?.focus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); toggleLineComment(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateLine(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); goToLine(); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); pickSnippet(); }
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

  document.addEventListener('DOMContentLoaded', init);
  window.RebelCodespace = { saveProject, runPreview, getFiles: () => ({ ...files }) };
})();
