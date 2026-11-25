<?php
declare(strict_types=1);
require dirname(__DIR__) . '/lib/contact.php';

use function ZskiContact\{submit, validate, originAllowed, smtpMailer};

$directory = sys_get_temp_dir() . '/zski-test-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$config = ['state_dir' => $directory, 'secret' => str_repeat('test-key-', 8), 'origins' => ['https://example.test']];
$server = ['HTTP_ORIGIN' => 'https://example.test', 'REMOTE_ADDR' => '192.0.2.1'];
$base = ['name' => 'Тестовый посетитель', 'phone' => '+7 (999) 123-45-67', 'need' => 'Другое', 'msg' => 'Только подставной транспорт', 'request_id' => 'test-request-000001', 'company' => ''];
$count = 0;
$send = function ($fields, $reference) use (&$count) { $count++; };
function check(bool $ok, string $name): void {
    if (!$ok) throw new RuntimeException($name);
    echo "PASS " . $name . "\n";
}
try {
    $smtpConfig = ['smtp_host' => 'smtp.example.test', 'smtp_port' => 465,
        'smtp_username' => 'test', 'smtp_password' => 'test', 'smtp_encryption' => 'smtps',
        'from' => 'sender@example.test', 'to' => 'recipient@example.test'];
    $mailer = smtpMailer($smtpConfig);
    check($mailer->SMTPSecure === \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS &&
        $mailer->Port === 465 && $mailer->SMTPAuth && $mailer->SMTPOptions === [] &&
        $mailer->Timeout === 8 && $mailer->getSMTPInstance()->Timelimit === 10,
        'PHPMailer: SMTPS и стандартная проверка TLS');
    $mailer = smtpMailer(array_replace($smtpConfig, ['smtp_encryption' => 'tls', 'smtp_port' => 587]));
    check($mailer->SMTPSecure === \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS &&
        $mailer->Port === 587, 'PHPMailer: обязательный STARTTLS');
    $rejected = false;
    try { smtpMailer(array_replace($smtpConfig, ['smtp_encryption' => 'none'])); }
    catch (RuntimeException $error) { $rejected = true; }
    check($rejected, 'отказ от неизвестного или незашифрованного транспорта');
    check(validate(array_replace($base, ["msg" => str_repeat("😀", 3000)]))[1] === [], "Unicode на максимальной длине");
    check(submit($config, $server, $base, $send)['status'] === 200, 'приём транспортом');
    check(submit($config, $server, $base, $send)['status'] === 200 && $count === 1, 'повтор не отправляет письмо');
    check(submit($config, $server, array_replace($base, ['msg' => 'Другой текст']), $send)['status'] === 409, 'подмена тела повтора');
    foreach ([
        ['name' => '  '], ['phone' => ['nested']], ['phone' => '123'],
        ['name' => "Имя\r\nBcc: evil@example.test"], ['name' => str_repeat('Я', 101)],
        ['need' => "Другое\r\nBcc: evil@example.test"], ['msg' => str_repeat('я', 3001)],
        ['msg' => "\xC3\x28"], ['company' => 'bot'], ['to' => 'evil@example.test'],
        ['request_id' => 'short'], ['msg' => "\x00"]
    ] as $bad) {
        check(submit($config, $server, array_replace($base, $bad), $send)['status'] === 422, 'валидация ' . implode(',', array_keys($bad)));
    }
    check(submit($config, ['HTTP_ORIGIN' => 'https://evil.test'] + $server, $base, $send)['status'] === 403, 'другое происхождение');
    check(!originAllowed([], $config['origins']), 'нет Origin и Referer');
    check(originAllowed(['HTTP_REFERER' => 'https://example.test/contacts.html'], $config['origins']), 'браузер без Origin');
    $fail = array_replace($base, ['request_id' => 'test-request-000002']);
    $throws = function () { throw new RuntimeException('SMTP timeout (fake)'); };
    check(submit($config, $server, $fail, $throws)['status'] === 502, 'ошибка транспорта / таймаут');
    check(submit($config, $server, $fail, $send)['status'] === 409 && $count === 1, 'неоднозначная отправка не повторяется');
    check(submit($config, $server, array_replace($base, ['request_id' => 'test-request-000003']), $send)['status'] === 200, 'третья попытка');
    check(submit($config, $server, array_replace($base, ['request_id' => 'test-request-000004']), $send)['status'] === 429, 'серверный rate limit');
    $storage = file_get_contents($directory . '/contact.json');
    check(!str_contains($storage, $base['name']) && !str_contains($storage, $base['phone']) && !str_contains($storage, $base['msg']) && !str_contains($storage, $server['REMOTE_ADDR']), 'состояние без полей и открытого IP');

    $other = ['REMOTE_ADDR' => '192.0.2.2'] + $server;
    $noJs = array_replace($base, ['request_id' => '']);
    check(submit($config, $other, $noJs, $send)['status'] === 200 &&
        submit($config, $other, $noJs, $send)['status'] === 200 && $count === 3, 'повтор без JavaScript');
    $state = json_decode(file_get_contents($directory . '/contact.json'), true);
    $state['rates']['expired'] = [time() - 601];
    $state['requests']['expired'] = ['at' => time() - 3601];
    file_put_contents($directory . '/contact.json', json_encode($state));
    submit($config, $other, $noJs, $send);
    $state = json_decode(file_get_contents($directory . '/contact.json'), true);
    check(!isset($state['rates']['expired']) && !isset($state['requests']['expired']), 'очистка старых записей');

    // Два настоящих параллельных процесса обращаются с одним идентификатором.
    if (function_exists('pcntl_fork')) {
        $shared = array_replace($base, ['request_id' => 'parallel-request-0001']);
        $remote = ['REMOTE_ADDR' => '192.0.2.3'] + $server;
        $children = [];
        for ($i = 0; $i < 2; $i++) {
            $pid = pcntl_fork();
            if (!$pid) {
                $response = submit($config, $remote, $shared, function () use ($directory) {
                    file_put_contents($directory . '/sends', "one\n", FILE_APPEND | LOCK_EX);
                    usleep(200000);
                });
                exit(in_array($response['status'], [200, 409], true) ? 0 : 1);
            }
            $children[] = $pid;
        }
        foreach ($children as $pid) {
            pcntl_waitpid($pid, $status);
            check(pcntl_wexitstatus($status) === 0, 'параллельный запрос');
        }
        check(file_get_contents($directory . '/sends') === "one\n", 'конкурентная отправка ровно одна');
    }
} finally {
    foreach (glob($directory . '/*') as $file) unlink($file);
    rmdir($directory);
}
