<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/contact.php';

use function ZskiContact\{configuration, locked, result, submit, sendSmtp};

header('Cache-Control: no-store, private, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'");
set_time_limit(20);
ini_set('display_errors', '0');
$json = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
$config = null;
$response = result(503, 'Форма временно недоступна. Позвоните +7 (991) 937-77-44 или напишите на z_ski@mail.ru.');
$fields = [];
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' &&
    (int)($_SERVER['CONTENT_LENGTH'] ?? 0) <= \ZskiContact\MAX_BYTES &&
    preg_match('~\Aapplication/x-www-form-urlencoded(?:;|$)~i', $_SERVER['CONTENT_TYPE'] ?? '')) {
    $input = file_get_contents('php://input', false, null, 0, \ZskiContact\MAX_BYTES + 1);
    if (is_string($input) && strlen($input) <= \ZskiContact\MAX_BYTES) parse_str($input, $fields);
}

try {
    $config = configuration();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (isset($_GET['status'])) {
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['available' => true]);
            exit;
        }
        $receipt = $_GET['receipt'] ?? '';
        $accepted = is_string($receipt) && preg_match('/\A[a-f0-9]{24}\z/D', $receipt) &&
            locked($config, fn(&$state) => count(array_filter($state['requests'], fn($r) => $r['reference'] === $receipt && $r['state'] === 'accepted')) > 0);
        $response = $accepted ? result(200, 'Почтовый сервер принял сообщение. В прокате свяжутся с вами.', ['reference' => $receipt]) : result(404, 'Подтверждение отправки не найдено.');
    } elseif ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: GET, POST');
        $response = result(405, 'Используйте форму на странице контактов.');
    } elseif ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > \ZskiContact\MAX_BYTES) {
        $response = result(413, 'Сообщение слишком большое. Сократите его и повторите отправку.');
    } elseif (!preg_match('~\Aapplication/x-www-form-urlencoded(?:;|$)~i', $_SERVER['CONTENT_TYPE'] ?? '')) {
        $response = result(415, 'Неподдерживаемый формат запроса.');
    } else {
        $raw = file_get_contents('php://input', false, null, 0, \ZskiContact\MAX_BYTES + 1);
        if ($raw === false || strlen($raw) > \ZskiContact\MAX_BYTES) {
            $response = result(413, 'Сообщение слишком большое.');
        } else {
            parse_str($raw, $fields);
            $response = submit($config, $_SERVER, $fields, fn($data, $id) => sendSmtp($config, $data, $id));
        }
    }
} catch (\Throwable $error) {
    error_log('ZSKI contact unavailable');
}
if (!$json && $_SERVER['REQUEST_METHOD'] === 'POST' && $response['status'] === 200) {
    header('Location: contact.php?receipt=' . rawurlencode($response['reference']), true, 303);
    exit;
}
http_response_code($response['status']);
if ($response['status'] === 429) {
    header('Retry-After: 600');
}
if ($json) {
    header('Content-Type: application/json; charset=utf-8');
    unset($response['fields']);
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}
header('Content-Type: text/html; charset=utf-8');
function esc(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Обращение в ZSKI</title>
<link rel="stylesheet" href="../fonts/fonts.css"><link rel="stylesheet" href="../css/style.css">
</head><body><main class="wrap section">
<h1>Обращение в ZSKI</h1><p role="status"><?= esc($response['message']) ?></p>
<?php if (isset($response['reference'])): ?><p>Номер обращения <?= esc($response['reference']) ?></p><?php endif ?>
<?php if ($response['status'] !== 200 && $_SERVER['REQUEST_METHOD'] === 'POST'): ?>
<p>Введённые данные сохранены ниже, их можно скопировать.</p>
<?php foreach (['name' => 'Имя', 'phone' => 'Телефон', 'need' => 'Тема', 'msg' => 'Сообщение'] as $key => $label): ?>
<p><strong><?= $label ?></strong><br><?= nl2br(esc(is_string($fields[$key] ?? null) ? $fields[$key] : '')) ?></p>
<?php endforeach ?>
<?php endif ?>
<p><a class="btn btn-primary" href="tel:+79919377744">Позвонить</a> <a href="mailto:z_ski@mail.ru">Написать на почту</a></p>
<p><a href="../contacts.html">Вернуться к контактам</a></p></main></body></html>
