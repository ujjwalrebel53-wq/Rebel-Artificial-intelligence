<?php
// ============================================================
//  REBEL AI — PHP BACKEND API ROUTER
//  Converted from Node.js/Express (server.js)
//  Usage: All requests go through api/index.php via .htaccess
// ============================================================

require_once __DIR__ . '/../includes/config.php';

setSecurityHeaders();
setCors();
seedDefaults();
rateLimit();

// Parse the route from query string (set by .htaccess rewrite)
$method = $_SERVER['REQUEST_METHOD'];
$route  = $_GET['route'] ?? '';
$route  = '/' . trim($route, '/');
$body   = getRequestBody();

// ── Router ───────────────────────────────────────────────────

// AUTH
if ($route === '/api/auth/verify' && $method === 'POST') {
    $pass = sanitize($body['password'] ?? '', 128);
    if (!$pass) jsonResponse(['ok' => false], 400);

    $settings   = readJSON(FILE_SETTINGS, []);
    $storedHash = $settings['admin_pass'] ?? hashPassword('rebel@admin123');
    $inputHash  = hashPassword($pass);

    if ($inputHash !== $storedHash) {
        dbLog('warn', 'Failed admin login from IP: ' . getIP());
        jsonResponse(['ok' => false]);
    }

    $token = bin2hex(random_bytes(32));
    saveAdminToken($token);
    dbLog('info', 'Admin logged in from IP: ' . getIP());
    jsonResponse(['ok' => true, 'token' => $token]);
}

elseif ($route === '/api/auth/logout' && $method === 'POST') {
    requireAdmin();
    clearAdminToken();
    dbLog('warn', 'Admin logged out.');
    jsonResponse(['ok' => true]);
}

// STATS
elseif ($route === '/api/stats' && $method === 'GET') {
    requireAdmin();
    jsonResponse(getStats());
}

// SESSIONS
elseif ($route === '/api/session/ping' && $method === 'POST') {
    $session_key = sanitize($body['session_key'] ?? '', 64);
    if (!$session_key) jsonResponse(['ok' => false], 400);

    $now      = time() * 1000;
    $sessions = readJSON(FILE_SESSIONS, []);
    $found    = false;
    foreach ($sessions as &$s) {
        if ($s['session_key'] === $session_key) {
            $s['last_seen'] = $now;
            $found = true;
            break;
        }
    }
    if (!$found) {
        if (count($sessions) > 10000) $sessions = array_slice($sessions, -10000);
        $sessions[] = ['id' => $now, 'session_key' => $session_key, 'started_at' => $now, 'last_seen' => $now];
    }
    writeJSON(FILE_SESSIONS, $sessions);
    jsonResponse(['ok' => true]);
}

// USERS - list
elseif ($route === '/api/users' && $method === 'GET') {
    requireAdmin();
    $users = array_map('safeUser', readJSON(FILE_USERS, []));
    jsonResponse(['ok' => true, 'users' => $users]);
}

// USERS - register/login
elseif ($route === '/api/users/register' && $method === 'POST') {
    $name   = sanitize($body['name']     ?? '', 50);
    $email  = sanitize($body['email']    ?? '', 100);
    $pass   = sanitize($body['password'] ?? '', 128);
    $device = sanitize($body['device']   ?? 'Unknown', 20);
    $ip     = getIP();

    if (!$name || !$email) jsonResponse(['ok' => false, 'error' => 'Name and email required'], 400);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) jsonResponse(['ok' => false, 'error' => 'Invalid email'], 400);

    $now   = date('c');
    $users = readJSON(FILE_USERS, []);
    $found = false;
    foreach ($users as &$u) {
        if (strtolower($u['email'] ?? '') === strtolower($email)) {
            $u['last_login']  = $now;
            $u['login_count'] = ($u['login_count'] ?? 0) + 1;
            if ($pass && empty($u['password'])) $u['password'] = hashPassword($pass);
            $found = $u;
            break;
        }
    }
    if ($found) {
        writeJSON(FILE_USERS, $users);
        dbLog('info', "Returning user login: {$found['name']} ($email)");
        jsonResponse(['ok' => true, 'user' => safeUser($found)]);
    }

    $newUser = [
        'id'          => time() * 1000 + rand(0,999),
        'name'        => $name,
        'email'       => $email,
        'password'    => $pass ? hashPassword($pass) : '',
        'ip'          => $ip,
        'role'        => 'User',
        'status'      => 'active',
        'joined'      => date('Y-m-d'),
        'messages'    => 0,
        'device'      => $device,
        'last_login'  => $now,
        'login_count' => 1
    ];
    $users[] = $newUser;
    writeJSON(FILE_USERS, $users);
    dbLog('info', "New user registered: $name ($email) from $ip");
    jsonResponse(['ok' => true, 'user' => safeUser($newUser)]);
}

// USERS - add manually (admin)
elseif ($route === '/api/users/add' && $method === 'POST') {
    requireAdmin();
    $name  = sanitize($body['name']  ?? '', 50);
    $email = sanitize($body['email'] ?? '', 100);
    $role  = sanitize($body['role']  ?? 'User', 20);
    if (!$name) jsonResponse(['ok' => false, 'error' => 'Name required'], 400);

    $now   = date('c');
    $newUser = [
        'id'          => time() * 1000 + rand(0,999),
        'name'        => $name,
        'email'       => $email ?: '—',
        'ip'          => '0.0.0.0',
        'role'        => $role,
        'status'      => 'active',
        'joined'      => date('Y-m-d'),
        'messages'    => 0,
        'device'      => 'Unknown',
        'last_login'  => $now,
        'login_count' => 0
    ];
    $users   = readJSON(FILE_USERS, []);
    $users[] = $newUser;
    writeJSON(FILE_USERS, $users);
    dbLog('info', "Admin added user: $name");
    jsonResponse(['ok' => true, 'user' => safeUser($newUser)]);
}

// USERS - toggle status
elseif (preg_match('#^/api/users/(\d+)/toggle$#', $route, $m) && $method === 'PUT') {
    requireAdmin();
    $id    = (int)$m[1];
    $users = readJSON(FILE_USERS, []);
    foreach ($users as &$u) {
        if ($u['id'] == $id) {
            $u['status'] = $u['status'] === 'active' ? 'inactive' : 'active';
            writeJSON(FILE_USERS, $users);
            dbLog('warn', "User #{$u['id']} \"{$u['name']}\" → {$u['status']}");
            jsonResponse(['ok' => true, 'status' => $u['status']]);
        }
    }
    jsonResponse(['ok' => false], 404);
}

// USERS - delete
elseif (preg_match('#^/api/users/(\d+)$#', $route, $m) && $method === 'DELETE') {
    requireAdmin();
    $id    = (int)$m[1];
    $users = readJSON(FILE_USERS, []);
    foreach ($users as $idx => $u) {
        if ($u['id'] == $id) {
            array_splice($users, $idx, 1);
            writeJSON(FILE_USERS, $users);
            dbLog('warn', "User #{$u['id']} deleted");
            jsonResponse(['ok' => true]);
        }
    }
    jsonResponse(['ok' => false], 404);
}

// TRACKING - message
elseif ($route === '/api/track/message' && $method === 'POST') {
    $user_email  = sanitize($body['user_email']  ?? '', 100);
    $type        = sanitize($body['type']        ?? 'text', 20);
    $response_ms = min(abs((int)($body['response_ms'] ?? 0)), 999999);

    $messages   = readJSON(FILE_MESSAGES, []);
    $messages[] = ['id' => time()*1000+rand(0,999), 'user_email' => $user_email ?: null, 'type' => $type, 'response_ms' => $response_ms, 'created_at' => time()*1000];
    if (count($messages) > 1000) $messages = array_slice($messages, -1000);
    writeJSON(FILE_MESSAGES, $messages);

    if ($user_email) {
        $users = readJSON(FILE_USERS, []);
        foreach ($users as &$u) {
            if (strtolower($u['email'] ?? '') === strtolower($user_email)) {
                $u['messages'] = ($u['messages'] ?? 0) + 1;
                break;
            }
        }
        writeJSON(FILE_USERS, $users);
    }
    jsonResponse(['ok' => true]);
}

// TRACKING - api call
elseif ($route === '/api/track/api-call' && $method === 'POST') {
    $response_ms = min(abs((int)($body['response_ms'] ?? 0)), 999999);
    $success     = !empty($body['success']) ? 1 : 0;
    $apiCalls    = readJSON(FILE_API_CALLS, []);
    $apiCalls[]  = ['id' => time()*1000+rand(0,999), 'response_ms' => $response_ms, 'success' => $success, 'created_at' => time()*1000];
    if (count($apiCalls) > 500) $apiCalls = array_slice($apiCalls, -500);
    writeJSON(FILE_API_CALLS, $apiCalls);
    jsonResponse(['ok' => true]);
}

// LOGS - get
elseif ($route === '/api/logs' && $method === 'GET') {
    requireAdmin();
    $filter = sanitize($_GET['filter'] ?? 'all', 20);
    $logs   = readJSON(FILE_LOGS, []);
    if ($filter !== 'all') $logs = array_values(array_filter($logs, fn($l) => $l['level'] === $filter));
    $logs = array_reverse(array_slice($logs, -120));
    jsonResponse(['ok' => true, 'logs' => $logs]);
}

// LOGS - add
elseif ($route === '/api/logs/add' && $method === 'POST') {
    $level = sanitize($body['level'] ?? 'info', 10);
    $msg   = sanitize($body['msg']   ?? '', 500);
    dbLog($level, $msg);
    jsonResponse(['ok' => true]);
}

// LOGS - delete
elseif ($route === '/api/logs' && $method === 'DELETE') {
    requireAdmin();
    writeJSON(FILE_LOGS, []);
    jsonResponse(['ok' => true]);
}

// API KEYS - list
elseif ($route === '/api/keys' && $method === 'GET') {
    requireAdmin();
    jsonResponse(['ok' => true, 'keys' => readJSON(FILE_API_KEYS, [])]);
}

// API KEYS - generate
elseif ($route === '/api/keys/generate' && $method === 'POST') {
    requireAdmin();
    $name  = sanitize($body['name']  ?? '', 50);
    $limit = min(abs((int)($body['limit'] ?? 1000)), 100000);
    if (!$name) jsonResponse(['ok' => false, 'error' => 'Name required'], 400);

    $keys   = readJSON(FILE_API_KEYS, []);
    $newKey = [
        'id'        => time()*1000+rand(0,999),
        'name'      => $name,
        'key_value' => 'rbx-' . rndKey(),
        'perms'     => 'Read, Write',
        'usage'     => 0,
        'max_limit' => $limit,
        'status'    => 'active',
        'created'   => date('Y-m-d')
    ];
    $keys[] = $newKey;
    writeJSON(FILE_API_KEYS, $keys);
    dbLog('info', "New API key generated: $name");
    jsonResponse(['ok' => true, 'key' => $newKey]);
}

// API KEYS - toggle
elseif (preg_match('#^/api/keys/(\d+)/toggle$#', $route, $m) && $method === 'PUT') {
    requireAdmin();
    $id   = (int)$m[1];
    $keys = readJSON(FILE_API_KEYS, []);
    foreach ($keys as &$k) {
        if ($k['id'] == $id) {
            $k['status'] = $k['status'] === 'active' ? 'inactive' : 'active';
            writeJSON(FILE_API_KEYS, $keys);
            dbLog('warn', "API key #{$k['id']} toggled to {$k['status']}");
            jsonResponse(['ok' => true, 'status' => $k['status']]);
        }
    }
    jsonResponse(['ok' => false], 404);
}

// API KEYS - delete
elseif (preg_match('#^/api/keys/(\d+)$#', $route, $m) && $method === 'DELETE') {
    requireAdmin();
    $id   = (int)$m[1];
    $keys = readJSON(FILE_API_KEYS, []);
    foreach ($keys as $idx => $k) {
        if ($k['id'] == $id) {
            array_splice($keys, $idx, 1);
            writeJSON(FILE_API_KEYS, $keys);
            dbLog('warn', "API key #{$id} deleted");
            jsonResponse(['ok' => true]);
        }
    }
    jsonResponse(['ok' => false], 404);
}

// API KEYS - increment usage
elseif (preg_match('#^/api/keys/(\d+)/usage$#', $route, $m) && $method === 'PUT') {
    requireAdmin();
    $id   = (int)$m[1];
    $keys = readJSON(FILE_API_KEYS, []);
    foreach ($keys as &$k) {
        if ($k['id'] == $id) {
            $k['usage'] = ($k['usage'] ?? 0) + 1;
            writeJSON(FILE_API_KEYS, $keys);
            break;
        }
    }
    jsonResponse(['ok' => true]);
}

// SETTINGS - get
elseif ($route === '/api/settings' && $method === 'GET') {
    requireAdmin();
    $settings = readJSON(FILE_SETTINGS, []);
    unset($settings['admin_pass']);
    jsonResponse(['ok' => true, 'settings' => $settings]);
}

// SETTINGS - update key
elseif ($route === '/api/settings' && $method === 'PUT') {
    requireAdmin();
    $key = sanitize($body['key'] ?? '', 50);
    $val = sanitize($body['val'] ?? '', 2000);
    if (!$key || $key === 'admin_pass') jsonResponse(['ok' => false, 'error' => 'Invalid key'], 400);
    $settings      = readJSON(FILE_SETTINGS, []);
    $settings[$key]= $val;
    writeJSON(FILE_SETTINGS, $settings);
    dbLog('info', "Setting updated: $key");
    jsonResponse(['ok' => true]);
}

// SETTINGS - change password
elseif ($route === '/api/settings/password' && $method === 'PUT') {
    requireAdmin();
    $new_pass = sanitize($body['new_pass'] ?? '', 128);
    if (!$new_pass || strlen($new_pass) < 6) jsonResponse(['ok' => false, 'error' => 'Min 6 chars'], 400);
    $settings               = readJSON(FILE_SETTINGS, []);
    $settings['admin_pass'] = hashPassword($new_pass);
    clearAdminToken();
    writeJSON(FILE_SETTINGS, $settings);
    dbLog('warn', 'Admin password changed — all sessions invalidated.');
    jsonResponse(['ok' => true]);
}

// REAL-TIME STATS POLL (replaces Socket.io — client polls every 3s)
elseif ($route === '/api/stats/poll' && $method === 'GET') {
    requireAdmin();
    jsonResponse(getStats());
}

// 404
else {
    jsonResponse(['ok' => false, 'error' => 'Not found'], 404);
}

// ── Stats builder ────────────────────────────────────────────
function getStats() {
    $messages = readJSON(FILE_MESSAGES, []);
    $sessions = readJSON(FILE_SESSIONS, []);
    $users    = readJSON(FILE_USERS,    []);
    $apiKeys  = readJSON(FILE_API_KEYS, []);
    $apiCalls = readJSON(FILE_API_CALLS,[]);

    $totalMessages = count($messages);
    $totalSessions = count($sessions);
    $totalUsers    = count($users);
    $activeKeys    = count(array_filter($apiKeys, fn($k) => $k['status'] === 'active'));

    $recentCalls   = array_slice($apiCalls, -60);
    $avgMs         = count($recentCalls)
        ? (int)round(array_sum(array_column($recentCalls, 'response_ms')) / count($recentCalls))
        : 0;
    $successRate   = count($recentCalls)
        ? (int)round(count(array_filter($recentCalls, fn($a) => $a['success'])) / count($recentCalls) * 100)
        : 100;

    $last7 = [];
    for ($i = 6; $i >= 0; $i--) {
        $d        = new DateTime("-$i days");
        $dayStr   = $d->format('Y-m-d');
        $dayStart = strtotime($dayStr . ' 00:00:00') * 1000;
        $dayEnd   = strtotime($dayStr . ' 23:59:59') * 1000;
        $count    = count(array_filter($messages, fn($m) => $m['created_at'] >= $dayStart && $m['created_at'] <= $dayEnd));
        $last7[]  = ['date' => $dayStr, 'count' => $count, 'label' => $d->format('D')];
    }

    $now         = time() * 1000;
    $onlineCount = count(array_filter($sessions, fn($s) => $s['last_seen'] > $now - 30000));

    return compact('totalMessages','totalSessions','totalUsers','activeKeys','avgMs','successRate','last7','onlineCount') + ['ok' => true];
}
