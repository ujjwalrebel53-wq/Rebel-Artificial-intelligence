<?php
// ============================================================
//  REBEL AI — PHP CONFIG & HELPERS
//  Converted from Node.js/Express by Claude
// ============================================================

define('DATA_DIR', __DIR__ . '/../data');
define('ADMIN_TOKEN_EXPIRY', 2 * 60 * 60); // 2 hours in seconds
define('RATE_LIMIT_WINDOW', 60);  // seconds
define('RATE_LIMIT_MAX',    60);  // max requests per window
define('SALT', 'rebel_ai_salt_2026');

// ── JSON File Paths ──────────────────────────────────────────
define('FILE_USERS',    DATA_DIR . '/users.json');
define('FILE_SESSIONS', DATA_DIR . '/sessions.json');
define('FILE_MESSAGES', DATA_DIR . '/messages.json');
define('FILE_API_CALLS',DATA_DIR . '/api_calls.json');
define('FILE_LOGS',     DATA_DIR . '/system_logs.json');
define('FILE_API_KEYS', DATA_DIR . '/api_keys.json');
define('FILE_SETTINGS', DATA_DIR . '/settings.json');
define('FILE_RATE',     DATA_DIR . '/rate_limit.json');
define('FILE_ADMIN_TOKEN', DATA_DIR . '/admin_token.json');

// ── Security Headers ─────────────────────────────────────────
function setSecurityHeaders() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net cdnjs.cloudflare.com fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com cdnjs.cloudflare.com fonts.gstatic.com; img-src * data: blob:; font-src * data:; connect-src *; media-src *;");
}

// ── CORS ─────────────────────────────────────────────────────
function setCors() {
    $allowed = getenv('ALLOWED_ORIGIN') ?: null;
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!$origin || !$allowed || $origin === $allowed) {
        if ($origin) header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, x-admin-token');
    }
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ── Response helpers ─────────────────────────────────────────
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// ── Input sanitize ───────────────────────────────────────────
function sanitize($str, $maxLen = 200) {
    if (!is_string($str)) return '';
    $str = preg_replace('/[<>"\'`]/', '', $str);
    return substr(trim($str), 0, $maxLen);
}

// ── Password hash (SHA-256 + salt, same as Node version) ─────
function hashPassword($pass) {
    return hash('sha256', SALT . $pass);
}

// ── Random API key ───────────────────────────────────────────
function rndKey() {
    return strtoupper(bin2hex(random_bytes(8)));
}

// ── Client IP ────────────────────────────────────────────────
function getIP() {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '—';
    return substr(explode(',', $ip)[0], 0, 45);
}

// ── Path traversal guard ─────────────────────────────────────
function safeFilePath($file) {
    $resolved    = realpath($file) ?: $file;
    $dataResolved= realpath(DATA_DIR) ?: DATA_DIR;
    return str_starts_with($resolved, $dataResolved);
}

// ── Read JSON file ───────────────────────────────────────────
function readJSON($file, $default = []) {
    if (!safeFilePath($file)) {
        error_log("Path traversal attempt: $file");
        return $default;
    }
    if (!file_exists($file)) return $default;
    $raw = file_get_contents($file);
    $decoded = json_decode($raw, true);
    return ($decoded !== null) ? $decoded : $default;
}

// ── Write JSON file ──────────────────────────────────────────
function writeJSON($file, $data) {
    if (!safeFilePath($file)) {
        error_log("Path traversal write attempt: $file");
        return;
    }
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
}

// ── Strip password from user object ─────────────────────────
function safeUser($u) {
    if (!$u) return null;
    unset($u['password']);
    return $u;
}

// ── DB Log ───────────────────────────────────────────────────
function dbLog($level, $msg) {
    $logs   = readJSON(FILE_LOGS, []);
    $logs[] = ['id' => time() * 1000 + rand(0,999), 'level' => $level, 'msg' => sanitize($msg, 500), 'created_at' => time() * 1000];
    if (count($logs) > 500) $logs = array_slice($logs, -500);
    writeJSON(FILE_LOGS, $logs);
}

// ── Ensure data dir ──────────────────────────────────────────
function ensureDataDir() {
    if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);
}

// ── Rate Limiter (file-based) ────────────────────────────────
function rateLimit() {
    $ip  = getIP();
    $now = time();
    $map = readJSON(FILE_RATE, []);

    // Cleanup old entries
    foreach ($map as $k => $v) {
        if ($now - $v['start'] > RATE_LIMIT_WINDOW * 2) unset($map[$k]);
    }

    $rec = $map[$ip] ?? ['count' => 0, 'start' => $now];
    if ($now - $rec['start'] > RATE_LIMIT_WINDOW) {
        $rec = ['count' => 0, 'start' => $now];
    }
    $rec['count']++;
    $map[$ip] = $rec;
    writeJSON(FILE_RATE, $map);

    if ($rec['count'] > RATE_LIMIT_MAX) {
        jsonResponse(['ok' => false, 'error' => 'Too many requests. Slow down.'], 429);
    }
}

// ── Admin Token: Save / Load / Validate ─────────────────────
function saveAdminToken($token) {
    writeJSON(FILE_ADMIN_TOKEN, [
        'token'  => $token,
        'expiry' => time() + ADMIN_TOKEN_EXPIRY
    ]);
}

function clearAdminToken() {
    writeJSON(FILE_ADMIN_TOKEN, ['token' => null, 'expiry' => 0]);
}

function getAdminToken() {
    return readJSON(FILE_ADMIN_TOKEN, ['token' => null, 'expiry' => 0]);
}

function requireAdmin() {
    $headers = getallheaders();
    $token   = $headers['X-Admin-Token']
            ?? $headers['x-admin-token']
            ?? (getRequestBody()['admin_token'] ?? '');

    $stored  = getAdminToken();
    if (!$stored['token'] || !$token || $token !== $stored['token'] || time() > $stored['expiry']) {
        jsonResponse(['ok' => false, 'error' => 'Unauthorized. Admin access required.'], 401);
    }
}

// ── Parse request body ───────────────────────────────────────
function getRequestBody() {
    static $body = null;
    if ($body === null) {
        $raw  = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? [];
    }
    return $body;
}

// ── Seed default data ────────────────────────────────────────
function seedDefaults() {
    ensureDataDir();

    // Users
    $users = readJSON(FILE_USERS, []);
    if (empty($users)) {
        $users = [[
            'id'          => 1,
            'name'        => 'Rebel Bhaiya',
            'email'       => 'admin@rebel.ai',
            'password'    => hashPassword('rebel@admin123'),
            'ip'          => '127.0.0.1',
            'role'        => 'Admin',
            'status'      => 'active',
            'joined'      => date('Y-m-d'),
            'messages'    => 0,
            'device'      => 'Desktop',
            'last_login'  => date('c'),
            'login_count' => 1
        ]];
        writeJSON(FILE_USERS, $users);
    }

    // API Keys
    $apiKeys = readJSON(FILE_API_KEYS, []);
    if (empty($apiKeys)) {
        $apiKeys = [
            ['id' => 1, 'name' => 'Primary GPT-5',  'key_value' => 'rbx-' . rndKey(), 'perms' => 'Read, Write', 'usage' => 0, 'max_limit' => 5000, 'status' => 'active',   'created' => date('Y-m-d')],
            ['id' => 2, 'name' => 'Image API Key',  'key_value' => 'rbx-' . rndKey(), 'perms' => 'Read Only',   'usage' => 0, 'max_limit' => 2000, 'status' => 'active',   'created' => date('Y-m-d')],
            ['id' => 3, 'name' => 'Dev Test Key',   'key_value' => 'rbx-' . rndKey(), 'perms' => 'Read, Write', 'usage' => 0, 'max_limit' => 500,  'status' => 'inactive', 'created' => date('Y-m-d')],
        ];
        writeJSON(FILE_API_KEYS, $apiKeys);
    }

    // Settings
    $settings = readJSON(FILE_SETTINGS, []);
    if (empty($settings)) {
        $settings = [
            'admin_pass'    => hashPassword('rebel@admin123'),
            'system_prompt' => 'You are Rebel Gpt, an advanced AI assistant created by Rebel bhaiya.',
            'ai_streaming'  => 'true',
            'image_upload'  => 'true',
            'maintenance'   => 'false',
            'analytics'     => 'true'
        ];
        writeJSON(FILE_SETTINGS, $settings);
    } elseif (!empty($settings['admin_pass']) && strlen($settings['admin_pass']) < 50) {
        $settings['admin_pass'] = hashPassword($settings['admin_pass']);
        writeJSON(FILE_SETTINGS, $settings);
    }

    foreach ([FILE_SESSIONS, FILE_MESSAGES, FILE_API_CALLS, FILE_LOGS] as $f) {
        if (!file_exists($f)) writeJSON($f, []);
    }
    if (!file_exists(FILE_ADMIN_TOKEN)) clearAdminToken();
}
