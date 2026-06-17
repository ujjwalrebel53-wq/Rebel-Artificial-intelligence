/* ═══════════════════════════════════════════════════════════
   REBEL AI — ADMIN CONTROL CENTER + PUBLIC GATES
   ═══════════════════════════════════════════════════════════ */
(function RebelAdminControl() {
  'use strict';

  let publicSettings = {
    maintenance: false,
    chat_enabled: true,
    codespace_enabled: true,
    voice_enabled: true,
    image_upload: true,
    ai_streaming: true,
    broadcast: '',
  };

  let adminToken = () => sessionStorage.getItem('rbl_admin_token');

  async function api(url, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    const t = adminToken();
    if (t) headers['x-admin-token'] = t;
    try {
      const r = await fetch(url, { ...opts, headers });
      return await r.json();
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function loadPublicSettings() {
    try {
      const data = await fetch('/api/public/settings').then(r => r.json());
      if (data.ok && data.settings) {
        publicSettings = { ...publicSettings, ...data.settings };
        applyPublicSettings();
      }
    } catch (e) {
      try {
        const local = JSON.parse(localStorage.getItem('rbl_public_settings') || '{}');
        publicSettings = { ...publicSettings, ...local };
        applyPublicSettings();
      } catch (err) {}
    }
  }

  function applyPublicSettings() {
    const banner = document.getElementById('broadcastBanner');
    if (banner && publicSettings.broadcast) {
      banner.style.display = 'block';
      banner.innerHTML = `<i class="fas fa-bullhorn"></i> ${publicSettings.broadcast} <button id="closeBroadcast" aria-label="Close">✕</button>`;
      document.body.classList.add('has-broadcast');
      document.getElementById('closeBroadcast')?.addEventListener('click', () => {
        banner.style.display = 'none';
        document.body.classList.remove('has-broadcast');
      });
    }

    if (publicSettings.maintenance && !adminToken()) {
      if (!document.getElementById('maintenanceOverlay')) {
        const ov = document.createElement('div');
        ov.id = 'maintenanceOverlay';
        ov.className = 'maintenance-overlay';
        ov.innerHTML = '<div><h2>Maintenance Mode</h2><p>Rebel AI is undergoing upgrades. Please check back soon.</p></div>';
        document.body.appendChild(ov);
      }
    } else {
      document.getElementById('maintenanceOverlay')?.remove();
    }

    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) uploadBtn.style.display = publicSettings.image_upload ? '' : 'none';
  }

  window.RebelControl = {
    settings: () => ({ ...publicSettings }),
    isEnabled(feature) {
      if (publicSettings.maintenance) return false;
      const map = { chat: 'chat_enabled', codespace: 'codespace_enabled', voice: 'voice_enabled' };
      const key = map[feature];
      return key ? publicSettings[key] !== false : true;
    },
    getDisabledMessage(feature) {
      if (publicSettings.maintenance) return 'Rebel AI is in maintenance mode.';
      return { chat: 'Chat is temporarily disabled by admin.', codespace: 'Codespace is disabled by admin.', voice: 'Voice AI is disabled by admin.' }[feature] || 'Feature disabled.';
    },
  };

  function gateFeature(btnId, feature) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      if (!window.RebelControl.isEnabled(feature)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        alert(window.RebelControl.getDisabledMessage(feature));
      }
    }, true);
  }

  async function loadControlPanel() {
    const data = await api('/api/control');
    if (!data.ok) return;

    const c = data.control;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    set('ctrl-maintenance', c.maintenance);
    set('ctrl-chat', c.chat_enabled);
    set('ctrl-codespace', c.codespace_enabled);
    set('ctrl-voice', c.voice_enabled);
    set('ctrl-image', c.image_upload);
    set('ctrl-streaming', c.ai_streaming);

    const bc = document.getElementById('broadcastMessage');
    if (bc) bc.value = c.broadcast_message || '';

    renderActivity(c.recent_logins || []);
    renderControlStats(c);
  }

  function renderActivity(logins) {
    const el = document.getElementById('controlActivity');
    if (!el) return;
    if (!logins.length) {
      el.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.25);">No recent activity</div>';
      return;
    }
    el.innerHTML = logins.map(u => {
      const t = u.last_login ? new Date(u.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      return `<div class="control-activity-item"><div class="avatar">${(u.name || '?')[0].toUpperCase()}</div><div class="info"><div class="name">${u.name}</div><div class="meta">${u.email || '—'} · ${u.device || 'Unknown'} · ${t}</div></div></div>`;
    }).join('');
  }

  function renderControlStats(c) {
    const el = document.getElementById('controlStatsRow');
    if (!el) return;
    el.innerHTML = `
      <div class="control-stat-mini"><div class="num">${c.total_users || 0}</div><div class="lbl">Total Users</div></div>
      <div class="control-stat-mini"><div class="num">${c.active_users || 0}</div><div class="lbl">Active</div></div>
      <div class="control-stat-mini"><div class="num">${c.total_messages || 0}</div><div class="lbl">Messages</div></div>`;
  }

  async function saveControls() {
    const body = {
      maintenance: document.getElementById('ctrl-maintenance')?.checked,
      chat_enabled: document.getElementById('ctrl-chat')?.checked,
      codespace_enabled: document.getElementById('ctrl-codespace')?.checked,
      voice_enabled: document.getElementById('ctrl-voice')?.checked,
      image_upload: document.getElementById('ctrl-image')?.checked,
      ai_streaming: document.getElementById('ctrl-streaming')?.checked,
    };
    const data = await api('/api/control', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const msg = document.getElementById('controlSaveMsg');
    if (data.ok) {
      Object.assign(publicSettings, body);
      localStorage.setItem('rbl_public_settings', JSON.stringify(publicSettings));
      applyPublicSettings();
      if (msg) { msg.textContent = 'Controls saved!'; msg.style.color = '#2ecc71'; msg.classList.add('show'); setTimeout(() => msg.classList.remove('show'), 3000); }
    } else if (msg) {
      Object.assign(publicSettings, body);
      localStorage.setItem('rbl_public_settings', JSON.stringify(publicSettings));
      applyPublicSettings();
      msg.textContent = 'Saved locally (backend offline).';
      msg.style.color = '#f1c40f';
      msg.classList.add('show');
      setTimeout(() => msg.classList.remove('show'), 3000);
    }
  }

  async function saveBroadcast() {
    const text = document.getElementById('broadcastMessage')?.value || '';
    await api('/api/control', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ broadcast_message: text }) });
    publicSettings.broadcast = text;
    const banner = document.getElementById('broadcastBanner');
    if (text && banner) {
      banner.style.display = 'block';
      banner.innerHTML = `<i class="fas fa-bullhorn"></i> ${text} <button id="closeBroadcast">✕</button>`;
      document.body.classList.add('has-broadcast');
    } else if (banner) {
      banner.style.display = 'none';
      document.body.classList.remove('has-broadcast');
    }
    alert(text ? 'Broadcast published!' : 'Broadcast cleared.');
  }

  async function exportUsersCSV() {
    const data = await api('/api/users/export');
    if (!data.ok || !data.users) { alert('Export failed — login as admin first.'); return; }
    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Joined', 'Messages', 'Device'];
    const rows = data.users.map(u => [u.id, u.name, u.email, u.role, u.status, u.joined, u.messages, u.device]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'rebel-users-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  }

  async function bulkUserStatus(status) {
    if (!confirm(`${status === 'active' ? 'Enable' : 'Disable'} ALL users?`)) return;
    const users = await api('/api/users');
    if (!users.ok) return;
    for (const u of users.users) {
      if (u.status !== status) {
        await api('/api/users/' + u.id + '/update', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      }
    }
    alert('Done!');
    loadControlPanel();
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadPublicSettings();
    setInterval(loadPublicSettings, 30000);

    gateFeature('accessRebelBtn', 'chat');
    gateFeature('accessChatBtn', 'chat');
    gateFeature('accessVoiceBtn', 'voice');
    gateFeature('codespaceBtn', 'codespace');
    gateFeature('ctaVoiceBtn', 'voice');

    document.getElementById('saveControlBtn')?.addEventListener('click', saveControls);
    document.getElementById('saveBroadcastBtn')?.addEventListener('click', saveBroadcast);
    document.getElementById('clearBroadcastBtn')?.addEventListener('click', () => {
      const bc = document.getElementById('broadcastMessage');
      if (bc) bc.value = '';
      saveBroadcast();
    });
    document.getElementById('refreshControlBtn')?.addEventListener('click', loadControlPanel);
    document.getElementById('exportUsersBtn')?.addEventListener('click', exportUsersCSV);
    document.getElementById('clearAllLogsBtn')?.addEventListener('click', async () => {
      if (!confirm('Clear all system logs?')) return;
      await api('/api/logs', { method: 'DELETE' });
      alert('Logs cleared.');
    });
    document.getElementById('disableAllUsersBtn')?.addEventListener('click', () => bulkUserStatus('inactive'));
    document.getElementById('enableAllUsersBtn')?.addEventListener('click', () => bulkUserStatus('active'));

    document.querySelectorAll('.admin-nav-item[data-tab="control"]').forEach(item => {
      item.addEventListener('click', () => {
        const title = document.getElementById('adminTabTitle');
        if (title) title.textContent = 'Control Center';
        loadControlPanel();
      });
    });
  });
})();
