<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Phương thức không hợp lệ']);
    exit;
}

$action = $_POST['action'] ?? '';

if ($action === 'register') {
    $email = trim($_POST['email'] ?? '');
    $displayName = trim($_POST['display_name'] ?? '');
    $password = $_POST['password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if ($email === '' || $displayName === '' || $password === '' || $confirmPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
        exit;
    }

    if ($password !== $confirmPassword) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu xác nhận không khớp']);
        exit;
    }

    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $checkStmt->execute(['email' => $email]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email đã được sử dụng']);
        exit;
    }

    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $activationToken = bin2hex(random_bytes(16));

    $insertStmt = $pdo->prepare(
        'INSERT INTO users (email, display_name, password_hash, activation_token) VALUES (:email, :display_name, :password_hash, :activation_token)'
    );
    $insertStmt->execute([
        'email' => $email,
        'display_name' => $displayName,
        'password_hash' => $passwordHash,
        'activation_token' => $activationToken
    ]);

    $userId = (int) $pdo->lastInsertId();
    $_SESSION['user_id'] = $userId;
    $_SESSION['display_name'] = $displayName;
    $_SESSION['email'] = $email;

    echo json_encode([
        'success' => true,
        'message' => 'Đăng ký thành công, tài khoản đang ở trạng thái chưa kích hoạt',
        'data' => [
            'user_id' => $userId,
            'display_name' => $displayName,
            'email' => $email,
            'is_activated' => false
        ]
    ]);
    exit;
}

if ($action === 'login') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập email và mật khẩu']);
        exit;
    }

    $stmt = $pdo->prepare(
        'SELECT id, email, display_name, password_hash, is_activated FROM users WHERE email = :email LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email hoặc mật khẩu không đúng']);
        exit;
    }

    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['display_name'] = $user['display_name'];
    $_SESSION['email'] = $user['email'];

    echo json_encode([
        'success' => true,
        'message' => 'Đăng nhập thành công',
        'data' => [
            'user_id' => (int) $user['id'],
            'display_name' => $user['display_name'],
            'email' => $user['email'],
            'is_activated' => (bool) $user['is_activated']
        ]
    ]);
    exit;
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Đăng xuất thành công']);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Action không hợp lệ']);
