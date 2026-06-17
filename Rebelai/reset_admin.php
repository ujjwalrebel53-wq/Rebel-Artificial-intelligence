<?php
/**
 * One-time admin password reset.
 * Visit: reset_admin.php?key=rebel_reset_2026
 * DELETE this file after use!
 */
require_once __DIR__ . '/includes/config.php';

$key = $_GET['key'] ?? '';
if ($key !== 'rebel_reset_2026') {
    http_response_code(403);
    die('Forbidden');
}

$newPass = 'rebel@admin123';
$settings = readJSON(FILE_SETTINGS, []);
$settings['admin_pass'] = hashPassword($newPass);
writeJSON(FILE_SETTINGS, $settings);
clearAdminToken();

header('Content-Type: text/plain');
echo "Admin password reset to: {$newPass}\n";
echo "DELETE reset_admin.php now!\n";
