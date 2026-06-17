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
    const ext = (filename || '').split('.').pop();
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let h = esc(code);
    if (ext === 'js') {
      h = h.replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>')
        .replace(/\b(const|let|var|function|return|async|await|if|else|for|while|require)\b/g, '<span class="tok-kw">$1</span>')
        .replace(/\b(\d+)\b/g, '<span class="tok-num">$1</span>')
        .replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g, '<span class="tok-str">$1</span>');
    } else if (ext === 'html') {
      h = h.replace(/(&lt;\/?[a-zA-Z][^&]*&gt;)/g, '<span class="tok-fn">$1</span>')
        .replace(/("(?:[^"]*)")/g, '<span class="tok-str">$1</span>');
    } else if (ext === 'css') {
      h = h.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
        .replace(/([.#]?[\w-]+)\s*\{/g, '<span class="tok-var">$1</span> {');
    } else if (ext === 'md') {
      h = h.replace(/(#{1,6} .+)/g, '<span class="tok-comment">$1</span>');
    }
    return h + '\n';
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
      ta.addEventListener('input', () => {
        files[currentFile] = ta.value;
        dirty[currentFile] = true;
        $('ide-highlight-layer').innerHTML = highlight(ta.value, currentFile);
        updateGutter();
        setSaveStatus(false);
        renderTabs();
        renderFileTree();
        ta.parentElement.scrollTop = ta.scrollTop;
        ta.parentElement.scrollLeft = ta.scrollLeft;
      });
      ta.addEventListener('scroll', () => {
        const hl = $('ide-highlight-layer');
        if (hl) { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; }
        $('ide-gutter').scrollTop = ta.scrollTop;
      });
      ta.addEventListener('keydown', e => {
        if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; ta.dispatchEvent(new Event('input')); }
      });
    }

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
      if (e.key === 'Escape') closeModal();
    });

    const fontSize = $('ide-font-size');
    if (fontSize) fontSize.addEventListener('input', () => {
      const sz = fontSize.value + 'px';
      ta.style.fontSize = sz;
      $('ide-highlight-layer').style.fontSize = sz;
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.RebelCodespace = { saveProject, runPreview, getFiles: () => ({ ...files }) };
})();
