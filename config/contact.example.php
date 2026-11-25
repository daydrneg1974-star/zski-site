<?php
// Установить вне public_html как zski-private/contact.php.
// Либо задать абсолютный путь в переменной окружения ZSKI_CONTACT_CONFIG.
// Файл с реальными значениями не копировать в репозиторий.
return [
    'smtp_host' => 'smtp.example.com',
    'smtp_port' => 465,
    'smtp_encryption' => 'smtps', // smtps для 465, tls для STARTTLS/587
    'smtp_username' => 'sender@example.com',
    'smtp_password' => '',
    'from' => 'sender@example.com',
    'to' => 'z_ski@mail.ru',
    'origins' => ['https://zski.ru'], // Дополнить точным адресом приёмки только при её развёртывании.
    'secret' => '', // php -r 'echo bin2hex(random_bytes(32)), PHP_EOL;'
    'state_dir' => __DIR__ . '/state',
];
