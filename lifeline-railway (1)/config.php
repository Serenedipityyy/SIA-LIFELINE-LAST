<?php
// Cloud & Local Config Auto-Detect
return [
    'db_host'    => getenv('MYSQLHOST') ?: getenv('DB_HOST') ?: '127.0.0.1',
    'db_port'    => getenv('MYSQLPORT') ?: getenv('DB_PORT') ?: '3306',
    'db_name'    => getenv('MYSQLDATABASE') ?: getenv('DB_NAME') ?: 'lifeline',
    'db_user'    => getenv('MYSQLUSER') ?: getenv('DB_USER') ?: 'lifeline_app',
    'db_pass'    => getenv('MYSQLPASSWORD') ?: getenv('DB_PASS') ?: 'ChangeThisPassword!',
    'db_charset' => 'utf8mb4',

    'timezone_offset'         => '+08:00',
    'alert_cooldown_sec'      => 180,
    'max_active_per_reporter' => 3,
    'max_login_attempts'      => 5,
    'lockout_sec'             => 60,
];
