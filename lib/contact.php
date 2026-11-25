<?php
declare(strict_types=1);

namespace ZskiContact;

const TOPICS = ['Прокат горных лыж', 'Прокат сноуборда', 'SKI-сервис', 'Хранение / консервация', 'Другое'];
const MAX_BYTES = 65536;
const STATE_TTL = 3600;

function configuration(): array
{
    $path = getenv('ZSKI_CONTACT_CONFIG') ?: dirname(__DIR__, 2) . '/zski-private/contact.php';
    $real = realpath($path);
    $public = realpath(dirname(__DIR__)) . DIRECTORY_SEPARATOR;
    if (!$real || str_starts_with($real, $public)) {
        throw new \RuntimeException('configuration');
    }
    $config = require $real;
    if (!is_array($config)) {
        throw new \RuntimeException('configuration');
    }
    foreach (['smtp_host', 'smtp_username', 'smtp_password', 'from', 'to', 'secret', 'state_dir'] as $key) {
        if (!is_string($config[$key] ?? null) || trim($config[$key]) === '') {
            throw new \RuntimeException('configuration');
        }
    }
    if (strlen($config['secret']) < 32 ||
        !filter_var($config['from'], FILTER_VALIDATE_EMAIL) ||
        !filter_var($config['to'], FILTER_VALIDATE_EMAIL) ||
        !in_array($config['smtp_encryption'] ?? '', ['smtps', 'tls'], true) ||
        !is_int($config['smtp_port'] ?? null) ||
        $config['smtp_port'] < 1 || $config['smtp_port'] > 65535 ||
        !preg_match('/\A[a-zA-Z0-9.-]+\z/D', $config['smtp_host']) ||
        !is_array($config['origins'] ?? null) || !$config['origins']) {
        throw new \RuntimeException('configuration');
    }
    foreach ($config['origins'] as $origin) {
        if (!is_string($origin) || !preg_match('~\Ahttps?://[^/?#]+\z~D', $origin)) {
            throw new \RuntimeException('configuration');
        }
    }
    if (!is_dir($config['state_dir']) && !mkdir($config['state_dir'], 0700, true) && !is_dir($config['state_dir'])) {
        throw new \RuntimeException('storage');
    }
    $state = realpath($config['state_dir']);
    if (!$state || str_starts_with($state . DIRECTORY_SEPARATOR, $public)) {
        throw new \RuntimeException('storage');
    }
    $config['state_dir'] = $state;
    return $config;
}

function originAllowed(array $server, array $allowed): bool
{
    if (($server['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        return false;
    }
    $origin = $server['HTTP_ORIGIN'] ?? '';
    if (!$origin && isset($server['HTTP_REFERER'])) {
        $parts = parse_url($server['HTTP_REFERER']);
        if (is_array($parts) && isset($parts['scheme'], $parts['host'])) {
            $origin = $parts['scheme'] . '://' . $parts['host'];
            if (isset($parts['port'])) {
                $origin .= ':' . $parts['port'];
            }
        }
    }
    return in_array($origin, $allowed, true);
}

function validate(array $data): array
{
    $errors = [];
    $fields = [];
    foreach (['name' => 100, 'phone' => 30, 'need' => 60, 'msg' => 3000, 'company' => 200, 'request_id' => 80] as $key => $max) {
        $value = $data[$key] ?? '';
        if (!is_string($value) || !preg_match('//u', $value) ||
            preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', $value) ||
            preg_match_all('/./us', $value) > $max) {
            $errors[$key] = 'Проверьте значение и длину поля.';
            $fields[$key] = '';
        } else {
            $fields[$key] = preg_replace('/\A\s+|\s+\z/u', '', $value);
        }
    }
    if ($fields['name'] === '' || preg_match('/[\r\n]/', $fields['name'])) {
        $errors['name'] = 'Укажите имя одной строкой, до 100 символов.';
    }
    if (!preg_match('/\A\+?(?:[ ()-]*[0-9]){7,15}[ ()-]*\z/D', $fields['phone'])) {
        $errors['phone'] = 'Укажите телефон от 7 до 15 цифр.';
    }
    if (!in_array($fields['need'], TOPICS, true)) {
        $errors['need'] = 'Выберите тему из списка.';
    }
    if ($fields['request_id'] !== '' && !preg_match('/\A[a-zA-Z0-9_-]{16,80}\z/D', $fields['request_id'])) {
        $errors['request_id'] = 'Обновите страницу формы.';
    }
    if ($fields['company'] !== '') {
        $errors['company'] = 'Отправка не подтверждена. Позвоните в прокат.';
    }
    if (array_diff(array_keys($data), array_keys($fields))) {
        $errors['form'] = 'Обнаружены лишние поля. Обновите страницу.';
    }
    return [$fields, $errors];
}

function locked(array $config, callable $operation): mixed
{
    $handle = fopen($config['state_dir'] . '/contact.lock', 'c');
    if (!$handle || !flock($handle, LOCK_EX)) {
        throw new \RuntimeException('storage');
    }
    try {
        $path = $config['state_dir'] . '/contact.json';
        $state = ['requests' => [], 'rates' => []];
        if (is_file($path)) {
            $state = json_decode((string)file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
            if (!is_array($state['requests'] ?? null) || !is_array($state['rates'] ?? null)) {
                throw new \RuntimeException('storage');
            }
        }
        $now = time();
        $state['requests'] = array_filter($state['requests'], fn($r) => $r['at'] > $now - STATE_TTL);
        foreach ($state['rates'] as $key => $times) {
            $state['rates'][$key] = array_values(array_filter($times, fn($t) => $t > $now - 600));
            if (!$state['rates'][$key]) {
                unset($state['rates'][$key]);
            }
        }
        $result = $operation($state);
        $temp = tempnam($config['state_dir'], 'contact-');
        if (!$temp || file_put_contents($temp, json_encode($state, JSON_THROW_ON_ERROR)) === false ||
            !chmod($temp, 0600) || !rename($temp, $path)) {
            throw new \RuntimeException('storage');
        }
        return $result;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function result(int $status, string $message, array $extra = []): array
{
    return ['status' => $status, 'message' => $message] + $extra;
}

function submit(array $config, array $server, array $data, callable $send): array
{
    if (!originAllowed($server, $config['origins'])) {
        return result(403, 'Откройте форму с сайта ZSKI и повторите отправку.');
    }
    [$fields, $errors] = validate($data);
    if ($errors) {
        return result(422, 'Проверьте заполненные поля.', ['errors' => $errors, 'fields' => $fields]);
    }
    $payload = json_encode(array_intersect_key($fields, array_flip(['name', 'phone', 'need', 'msg'])), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $fingerprint = hash_hmac('sha256', $payload, $config['secret']);
    $client = hash_hmac('sha256', $server['REMOTE_ADDR'] ?? '', $config['secret']);
    // Одинаковые POST без JS также получают один ключ. Контакты и текст в состоянии не сохраняются.
    $key = hash_hmac('sha256', $fields['request_id'] ?: $client . $fingerprint, $config['secret']);
    $reserved = locked($config, function (&$state) use ($key, $client, $fingerprint) {
        $previous = $state['requests'][$key] ?? null;
        if ($previous) {
            if (!hash_equals($previous['payload'], $fingerprint)) {
                return result(409, 'Этот запрос уже использован. Обновите страницу формы.');
            }
            if ($previous['state'] === 'accepted') {
                return result(200, 'Почтовый сервер принял сообщение. В прокате свяжутся с вами.', ['reference' => $previous['reference']]);
            }
            return result(409, 'Отправка уже началась. Её результат пока не подтверждён. Позвоните в прокат.', ['reference' => $previous['reference']]);
        }
        if (count($state['rates'][$client] ?? []) >= 3 || count($state['rates']['global'] ?? []) >= 30) {
            return result(429, 'Слишком много отправок. Повторите через 10 минут или позвоните в прокат.');
        }
        $reference = bin2hex(random_bytes(12));
        $state['requests'][$key] = ['state' => 'pending', 'payload' => $fingerprint, 'reference' => $reference, 'at' => time()];
        $state['rates'][$client][] = time();
        $state['rates']['global'][] = time();
        return ['reserved' => true, 'reference' => $reference];
    });
    if (!isset($reserved['reserved'])) {
        return $reserved;
    }
    $accepted = false;
    try {
        $send($fields, $reserved['reference']);
        $accepted = true;
    } catch (\Throwable $error) {
        // Только код и случайный номер. Ни SMTP-ответ, ни поля, ни IP в лог не попадают.
        error_log('ZSKI contact transport ' . $reserved['reference']);
    }
    locked($config, function (&$state) use ($key, $accepted) {
        $state['requests'][$key]['state'] = $accepted ? 'accepted' : 'uncertain';
    });
    return $accepted
        ? result(200, 'Почтовый сервер принял сообщение. В прокате свяжутся с вами.', ['reference' => $reserved['reference']])
        : result(502, 'Отправка не подтверждена. Сохраните номер обращения и свяжитесь с прокатом по телефону.', ['reference' => $reserved['reference']]);
}

function smtpMailer(array $config): \PHPMailer\PHPMailer\PHPMailer
{
    require_once __DIR__ . '/phpmailer/Exception.php';
    require_once __DIR__ . '/phpmailer/PHPMailer.php';
    require_once __DIR__ . '/phpmailer/SMTP.php';
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = $config['smtp_port'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['smtp_username'];
    $mail->Password = $config['smtp_password'];
    $mail->SMTPSecure = match ($config['smtp_encryption']) {
        'smtps' => \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS,
        'tls' => \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS,
        default => throw new \RuntimeException('configuration'),
    };
    $mail->Timeout = 8;
    $mail->getSMTPInstance()->Timelimit = 10;
    $mail->SMTPDebug = 0;
    $mail->CharSet = 'UTF-8';
    $mail->setFrom($config['from'], 'ZSKI');
    $mail->addAddress($config['to']);
    return $mail;
}

function sendSmtp(array $config, array $fields, string $reference): void
{
    $mail = smtpMailer($config);
    $mail->Subject = 'Вопрос с сайта ZSKI — ' . $fields['need'];
    $mail->Body = "Обращение " . $reference . "\nИмя: " . $fields['name'] .
        "\nТелефон: " . $fields['phone'] . "\nТема: " . $fields['need'] . "\n\n" . ($fields['msg'] ?: 'Без сообщения');
    $mail->send();
}
