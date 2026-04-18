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
    $activationToken = '123456';

    $insertStmt = $pdo->prepare(
        'INSERT INTO users (email, display_name, password_hash, avatar_url, activation_token, is_activated) VALUES (:email, :display_name, :password_hash, :avatar_url, :activation_token, 0)'
    );
    $insertStmt->execute([
        'email' => $email,
        'display_name' => $displayName,
        'password_hash' => $passwordHash,
        'avatar_url' => null,
        'activation_token' => $activationToken
    ]);

    $userId = (int) $pdo->lastInsertId();
    $_SESSION['pending_verification_email'] = $email;
    $_SESSION['pending_verification_user_id'] = $userId;

    echo json_encode([
        'success' => true,
        'message' => 'Đăng ký thành công. Mã xác thực đã được gửi qua email',
        'data' => [
            'user_id' => $userId,
            'display_name' => $displayName,
            'email' => $email,
            'avatar_url' => '',
            'is_activated' => false,
            'verification_code' => '123456'
        ]
    ]);
    exit;
}

if ($action === 'verify_email') {
    $email = trim($_POST['email'] ?? '');
    $code = trim($_POST['code'] ?? '');

    if ($email === '' || $code === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập email và mã xác thực']);
        exit;
    }

    if ($code !== '123456') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Mã xác thực không đúng']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id, is_activated FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        exit;
    }

    if ((int) $user['is_activated'] === 1) {
        echo json_encode(['success' => true, 'message' => 'Tài khoản đã được xác thực']);
        exit;
    }

    $updateStmt = $pdo->prepare('UPDATE users SET is_activated = 1, activation_token = NULL WHERE email = :email');
    $updateStmt->execute(['email' => $email]);

    unset($_SESSION['pending_verification_email'], $_SESSION['pending_verification_user_id']);

    echo json_encode([
        'success' => true,
        'message' => 'Xác thực email thành công',
        'data' => [
            'email' => $email,
            'is_activated' => true
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
        'SELECT id, email, display_name, avatar_url, password_hash, is_activated FROM users WHERE email = :email LIMIT 1'
    );
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Email hoặc mật khẩu không đúng']);
        exit;
    }

    if ((int) $user['is_activated'] !== 1) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Tài khoản chưa được xác thực email',
            'data' => [
                'email' => $user['email'],
                'is_activated' => false
            ]
        ]);
        exit;
    }

    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['display_name'] = $user['display_name'];
    $_SESSION['email'] = $user['email'];
    $_SESSION['avatar_url'] = $user['avatar_url'] ?: '';

    echo json_encode([
        'success' => true,
        'message' => 'Đăng nhập thành công',
        'data' => [
            'user_id' => (int) $user['id'],
            'display_name' => $user['display_name'],
            'email' => $user['email'],
            'avatar_url' => $user['avatar_url'] ?: '',
            'is_activated' => (bool) $user['is_activated']
        ]
    ]);
    exit;
}

if ($action === 'delete_pending_account') {
    $email = trim($_POST['email'] ?? '');

    if ($email === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Thiếu email để xóa tài khoản']);
        exit;
    }

    $deleteStmt = $pdo->prepare('DELETE FROM users WHERE email = :email AND is_activated = 0');
    $deleteStmt->execute(['email' => $email]);

    echo json_encode(['success' => true, 'message' => 'Đã xóa tài khoản chưa xác thực']);
    exit;
}

if ($action === 'request_forgot_password') {
    $email = trim($_POST['email'] ?? '');

    if ($email === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập email']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id, is_activated FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        exit;
    }

    if ((int) $user['is_activated'] !== 1) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Tài khoản chưa được xác thực email']);
        exit;
    }

    $_SESSION['forgot_password_email'] = $email;
    $_SESSION['forgot_password_otp'] = '456789';

    echo json_encode([
        'success' => true,
        'message' => 'OTP đã được gửi',
        'data' => [
            'email' => $email,
            'otp' => '456789'
        ]
    ]);
    exit;
}

if ($action === 'verify_forgot_password_otp') {
    $email = trim($_POST['email'] ?? '');
    $otp = trim($_POST['otp'] ?? '');

    if ($email === '' || $otp === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if ($otp !== '456789') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'OTP không đúng']);
        exit;
    }

    if (($_SESSION['forgot_password_email'] ?? '') !== $email) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Phiên xác thực không hợp lệ']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Xác thực OTP thành công']);
    exit;
}

if ($action === 'get_profile') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Chưa đăng nhập']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id, email, display_name, avatar_url FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy người dùng']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'user_id' => (int) $user['id'],
            'display_name' => $user['display_name'],
            'email' => $user['email'],
            'avatar_url' => $user['avatar_url'] ?: ''
        ]
    ]);
    exit;
}

if ($action === 'update_profile') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Chưa đăng nhập']);
        exit;
    }

    $displayName = trim($_POST['display_name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $avatarUrl = trim($_POST['avatar_url'] ?? '');

    if ($displayName === '' || $email === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
        exit;
    }

    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
    $checkStmt->execute(['email' => $email, 'id' => (int) $_SESSION['user_id']]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email đã được sử dụng']);
        exit;
    }

    $updateStmt = $pdo->prepare('UPDATE users SET display_name = :display_name, email = :email, avatar_url = :avatar_url WHERE id = :id');
    $updateStmt->execute([
        'display_name' => $displayName,
        'email' => $email,
        'avatar_url' => $avatarUrl !== '' ? $avatarUrl : null,
        'id' => (int) $_SESSION['user_id']
    ]);

    $_SESSION['display_name'] = $displayName;
    $_SESSION['email'] = $email;
    $_SESSION['avatar_url'] = $avatarUrl;

    echo json_encode([
        'success' => true,
        'message' => 'Cập nhật profile thành công',
        'data' => [
            'display_name' => $displayName,
            'email' => $email,
            'avatar_url' => $avatarUrl
        ]
    ]);
    exit;
}

if ($action === 'change_password') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Chưa đăng nhập']);
        exit;
    }

    $currentPassword = $_POST['current_password'] ?? '';
    $newPassword = $_POST['new_password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if ($newPassword !== $confirmPassword) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu xác nhận không khớp']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu hiện tại không đúng']);
        exit;
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $updateStmt = $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE id = :id');
    $updateStmt->execute([
        'password_hash' => $newHash,
        'id' => (int) $_SESSION['user_id']
    ]);

    echo json_encode(['success' => true, 'message' => 'Đổi mật khẩu thành công']);
    exit;
}

if ($action === 'change_email') {    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Chưa đăng nhập']);
        exit;
    }

    $currentPassword = $_POST['current_password'] ?? '';
    $newEmail = trim($_POST['new_email'] ?? '');
    $confirmEmail = trim($_POST['confirm_email'] ?? '');

    if ($currentPassword === '' || $newEmail === '' || $confirmEmail === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if ($newEmail !== $confirmEmail) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Email xác nhận không khớp']);
        exit;
    }

    if (!filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Email không hợp lệ']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $_SESSION['user_id']]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu hiện tại không đúng']);
        exit;
    }

    $checkStmt = $pdo->prepare('SELECT id FROM users WHERE email = :email AND id <> :id LIMIT 1');
    $checkStmt->execute(['email' => $newEmail, 'id' => (int) $_SESSION['user_id']]);
    if ($checkStmt->fetch()) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Email đã được sử dụng']);
        exit;
    }

    $updateStmt = $pdo->prepare('UPDATE users SET email = :email WHERE id = :id');
    $updateStmt->execute([
        'email' => $newEmail,
        'id' => (int) $_SESSION['user_id']
    ]);

    $_SESSION['email'] = $newEmail;

    echo json_encode([
        'success' => true,
        'message' => 'Cập nhật email thành công',
        'data' => ['email' => $newEmail]
    ]);
    exit;
}

if ($action === 'reset_password') {
    $email = trim($_POST['email'] ?? '');
    $newPassword = $_POST['new_password'] ?? '';
    $confirmNewPassword = $_POST['confirm_new_password'] ?? '';

    if ($email === '' || $newPassword === '' || $confirmNewPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Vui lòng nhập đầy đủ thông tin']);
        exit;
    }

    if ($newPassword !== $confirmNewPassword) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu xác nhận không khớp']);
        exit;
    }

    if (($_SESSION['forgot_password_email'] ?? '') !== $email) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Phiên đặt lại mật khẩu không hợp lệ']);
        exit;
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy tài khoản']);
        exit;
    }

    $passwordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $updateStmt = $pdo->prepare('UPDATE users SET password_hash = :password_hash WHERE email = :email');
    $updateStmt->execute([
        'password_hash' => $passwordHash,
        'email' => $email
    ]);

    unset($_SESSION['forgot_password_email'], $_SESSION['forgot_password_otp']);

    echo json_encode(['success' => true, 'message' => 'Đặt lại mật khẩu thành công']);
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
