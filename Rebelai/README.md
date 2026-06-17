# 🤖 Rebel AI — PHP Backend

Node.js/Express se PHP mein convert kiya gaya (by Claude).

## 📁 File Structure

```
rebel-ai-php/
├── index.html          # Frontend (same)
├── main.js             # Frontend JS (Socket.io → polling)
├── style.css           # CSS (same)
├── .htaccess           # Apache URL routing
├── includes/
│   └── config.php      # Helpers, config, seedDefaults
├── api/
│   └── index.php       # All API endpoints (replaces server.js)
└── data/               # JSON files (auto-created)
    ├── .htaccess       # Blocks direct browser access
    ├── users.json
    ├── sessions.json
    ├── messages.json
    ├── api_calls.json
    ├── system_logs.json
    ├── api_keys.json
    ├── settings.json
    ├── rate_limit.json
    └── admin_token.json
```

## 🚀 Setup (cPanel / Apache)

1. Saari files public_html/ ya subdomain folder mein upload karo
2. PHP 8.0+ hona chahiye
3. Apache mod_rewrite ON hona chahiye
4. data/ folder ke permissions: `755`
5. Browser mein open karo — bas itna hi!

## 🔑 Default Admin Password
```
rebel@admin123
```

## ⚡ Kya Badla?

| Node.js          | PHP               |
|------------------|-------------------|
| server.js        | api/index.php     |
| Express router   | Manual routing    |
| Socket.io (WS)   | HTTP Polling (3s) |
| crypto module    | random_bytes()    |
| fs module        | file_get_contents |
| npm/node_modules | Kuch nahi chahiye |

## 📋 API Endpoints (same as before)

| Endpoint                  | Method | Auth  |
|---------------------------|--------|-------|
| /api/auth/verify          | POST   | No    |
| /api/auth/logout          | POST   | Admin |
| /api/stats                | GET    | Admin |
| /api/stats/poll           | GET    | Admin |
| /api/session/ping         | POST   | No    |
| /api/users                | GET    | Admin |
| /api/users/register       | POST   | No    |
| /api/users/add            | POST   | Admin |
| /api/users/:id/toggle     | PUT    | Admin |
| /api/users/:id            | DELETE | Admin |
| /api/track/message        | POST   | No    |
| /api/track/api-call       | POST   | No    |
| /api/logs                 | GET    | Admin |
| /api/logs/add             | POST   | No    |
| /api/logs                 | DELETE | Admin |
| /api/keys                 | GET    | Admin |
| /api/keys/generate        | POST   | Admin |
| /api/keys/:id/toggle      | PUT    | Admin |
| /api/keys/:id             | DELETE | Admin |
| /api/keys/:id/usage       | PUT    | Admin |
| /api/settings             | GET    | Admin |
| /api/settings             | PUT    | Admin |
| /api/settings/password    | PUT    | Admin |
