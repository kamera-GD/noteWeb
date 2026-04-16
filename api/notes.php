<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config/database.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Bạn chưa đăng nhập']);
    exit;
}

$userId = (int) $_SESSION['user_id'];

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS notes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT "",
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_updated (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

$columnStmt = $pdo->prepare(
    'SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = :table_name AND column_name = :column_name'
);
$columnStmt->execute(['table_name' => 'notes', 'column_name' => 'is_pinned']);
if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE notes ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0');
}
$columnStmt->execute(['table_name' => 'notes', 'column_name' => 'pinned_at']);
if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE notes ADD COLUMN pinned_at TIMESTAMP NULL DEFAULT NULL');
}
$columnStmt->execute(['table_name' => 'notes', 'column_name' => 'is_locked']);
if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE notes ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0');
}
$columnStmt->execute(['table_name' => 'notes', 'column_name' => 'note_password_hash']);
if ((int) $columnStmt->fetchColumn() === 0) {
    $pdo->exec('ALTER TABLE notes ADD COLUMN note_password_hash VARCHAR(255) NULL');
}
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS labels (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        name VARCHAR(120) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_label (user_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS note_labels (
        note_id INT UNSIGNED NOT NULL,
        label_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (note_id, label_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $labelStmt = $pdo->prepare(
        'SELECT id, name FROM labels WHERE user_id = :user_id ORDER BY name ASC'
    );
    $labelStmt->execute(['user_id' => $userId]);
    $labels = $labelStmt->fetchAll();

    $stmt = $pdo->prepare(
        'SELECT n.id, n.title, n.content, n.is_pinned, n.pinned_at, n.is_locked, n.created_at, n.updated_at,
                GROUP_CONCAT(l.name ORDER BY l.name SEPARATOR "||") AS label_names
         FROM notes n
         LEFT JOIN note_labels nl ON nl.note_id = n.id
         LEFT JOIN labels l ON l.id = nl.label_id
         WHERE n.user_id = :user_id
         GROUP BY n.id
         ORDER BY n.is_pinned DESC, n.pinned_at DESC, n.updated_at DESC'
    );
    $stmt->execute(['user_id' => $userId]);
    $rawNotes = $stmt->fetchAll();
    $notes = array_map(static function (array $note): array {
        $labels = [];
        if (!empty($note['label_names'])) {
            $labels = array_values(array_filter(explode('||', $note['label_names'])));
        }
        unset($note['label_names']);
        $note['labels'] = $labels;
        return $note;
    }, $rawNotes);

    echo json_encode([
        'success' => true,
        'data' => [
            'display_name' => $_SESSION['display_name'] ?? 'User',
            'labels' => $labels,
            'notes' => $notes
        ]
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Phương thức không hợp lệ']);
    exit;
}

$action = $_POST['action'] ?? '';

if ($action === 'create_label') {
    $name = trim($_POST['name'] ?? '');
    if ($name === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Tên nhãn không được để trống']);
        exit;
    }
    $stmt = $pdo->prepare('INSERT INTO labels (user_id, name) VALUES (:user_id, :name)');
    try {
        $stmt->execute(['user_id' => $userId, 'name' => $name]);
        echo json_encode(['success' => true, 'message' => 'Đã tạo nhãn']);
    } catch (PDOException $e) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Nhãn đã tồn tại']);
    }
    exit;
}

if ($action === 'rename_label') {
    $labelId = isset($_POST['label_id']) ? (int) $_POST['label_id'] : 0;
    $name = trim($_POST['name'] ?? '');
    if ($labelId <= 0 || $name === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ']);
        exit;
    }
    $stmt = $pdo->prepare('UPDATE labels SET name = :name WHERE id = :id AND user_id = :user_id');
    try {
        $stmt->execute(['name' => $name, 'id' => $labelId, 'user_id' => $userId]);
        echo json_encode(['success' => true, 'message' => 'Đã đổi tên nhãn']);
    } catch (PDOException $e) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Tên nhãn đã tồn tại']);
    }
    exit;
}

if ($action === 'delete_label') {
    $labelId = isset($_POST['label_id']) ? (int) $_POST['label_id'] : 0;
    if ($labelId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID nhãn không hợp lệ']);
        exit;
    }
    $pdo->beginTransaction();
    try {
        $delPivot = $pdo->prepare('DELETE nl FROM note_labels nl INNER JOIN labels l ON l.id = nl.label_id WHERE nl.label_id = :label_id AND l.user_id = :user_id');
        $delPivot->execute(['label_id' => $labelId, 'user_id' => $userId]);
        $delLabel = $pdo->prepare('DELETE FROM labels WHERE id = :id AND user_id = :user_id');
        $delLabel->execute(['id' => $labelId, 'user_id' => $userId]);
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Đã xóa nhãn']);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Không thể xóa nhãn']);
    }
    exit;
}

if ($action === 'save') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $title = trim($_POST['title'] ?? '');
    $content = trim($_POST['content'] ?? '');
    $labelsInput = json_decode((string) ($_POST['labels'] ?? '[]'), true);
    $notePassword = (string) ($_POST['note_password'] ?? '');
    $labelsInput = is_array($labelsInput) ? $labelsInput : [];
    $cleanLabelNames = [];
    foreach ($labelsInput as $labelName) {
        $name = trim((string) $labelName);
        if ($name !== '' && !in_array($name, $cleanLabelNames, true)) {
            $cleanLabelNames[] = $name;
        }
    }

    if ($title === '' && $content === '') {
        echo json_encode(['success' => false, 'message' => 'Ghi chú trống']);
        exit;
    }

    $pdo->beginTransaction();
    try {
        if ($noteId > 0) {
            $checkStmt = $pdo->prepare('SELECT is_locked, note_password_hash FROM notes WHERE id = :id AND user_id = :user_id LIMIT 1');
            $checkStmt->execute(['id' => $noteId, 'user_id' => $userId]);
            $currentNote = $checkStmt->fetch();
            if (!$currentNote) {
                throw new RuntimeException('Không tìm thấy ghi chú');
            }
            if ((int) $currentNote['is_locked'] === 1 && !password_verify($notePassword, (string) $currentNote['note_password_hash'])) {
                http_response_code(403);
                echo json_encode(['success' => false, 'message' => 'Mật khẩu ghi chú không đúng']);
                $pdo->rollBack();
                exit;
            }
            $updateStmt = $pdo->prepare(
                'UPDATE notes SET title = :title, content = :content WHERE id = :id AND user_id = :user_id'
            );
            $updateStmt->execute([
                'title' => $title,
                'content' => $content,
                'id' => $noteId,
                'user_id' => $userId
            ]);
        } else {
            $insertStmt = $pdo->prepare(
                'INSERT INTO notes (user_id, title, content) VALUES (:user_id, :title, :content)'
            );
            $insertStmt->execute([
                'user_id' => $userId,
                'title' => $title,
                'content' => $content
            ]);
            $noteId = (int) $pdo->lastInsertId();
        }

        $deletePivot = $pdo->prepare('DELETE FROM note_labels WHERE note_id = :note_id');
        $deletePivot->execute(['note_id' => $noteId]);

        if (count($cleanLabelNames) > 0) {
            $insertLabelStmt = $pdo->prepare('INSERT INTO labels (user_id, name) VALUES (:user_id, :name)');
            $getLabelIdStmt = $pdo->prepare('SELECT id FROM labels WHERE user_id = :user_id AND name = :name LIMIT 1');
            $insertPivotStmt = $pdo->prepare('INSERT INTO note_labels (note_id, label_id) VALUES (:note_id, :label_id)');
            foreach ($cleanLabelNames as $name) {
                try {
                    $insertLabelStmt->execute(['user_id' => $userId, 'name' => $name]);
                    $labelId = (int) $pdo->lastInsertId();
                } catch (PDOException $e) {
                    $getLabelIdStmt->execute(['user_id' => $userId, 'name' => $name]);
                    $label = $getLabelIdStmt->fetch();
                    $labelId = $label ? (int) $label['id'] : 0;
                }
                if ($labelId > 0) {
                    $insertPivotStmt->execute(['note_id' => $noteId, 'label_id' => $labelId]);
                }
            }
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Đã lưu ghi chú', 'data' => ['note_id' => $noteId]]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Không thể lưu ghi chú']);
    }
    exit;
}

if ($action === 'toggle_pin') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $pinned = isset($_POST['pinned']) ? (int) $_POST['pinned'] : 0;
    if ($noteId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID ghi chú không hợp lệ']);
        exit;
    }

    if ($pinned === 1) {
        $stmt = $pdo->prepare(
            'UPDATE notes
             SET is_pinned = 1, pinned_at = CURRENT_TIMESTAMP
             WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute(['id' => $noteId, 'user_id' => $userId]);
        echo json_encode(['success' => true, 'message' => 'Đã ghim ghi chú']);
        exit;
    }

    $stmt = $pdo->prepare(
        'UPDATE notes
         SET is_pinned = 0, pinned_at = NULL
         WHERE id = :id AND user_id = :user_id'
    );
    $stmt->execute(['id' => $noteId, 'user_id' => $userId]);
    echo json_encode(['success' => true, 'message' => 'Đã bỏ ghim ghi chú']);
    exit;
}

if ($action === 'verify_note_password') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $password = (string) ($_POST['password'] ?? '');
    if ($noteId <= 0 || $password === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ']);
        exit;
    }
    $stmt = $pdo->prepare('SELECT is_locked, note_password_hash FROM notes WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute(['id' => $noteId, 'user_id' => $userId]);
    $note = $stmt->fetch();
    if (!$note) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy ghi chú']);
        exit;
    }
    if ((int) $note['is_locked'] !== 1) {
        echo json_encode(['success' => true, 'message' => 'Ghi chú không khóa']);
        exit;
    }
    if (!password_verify($password, (string) $note['note_password_hash'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu không đúng']);
        exit;
    }
    echo json_encode(['success' => true, 'message' => 'Mật khẩu hợp lệ']);
    exit;
}

if ($action === 'set_note_password') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $newPassword = (string) ($_POST['new_password'] ?? '');
    $confirmPassword = (string) ($_POST['confirm_password'] ?? '');
    $currentPassword = (string) ($_POST['current_password'] ?? '');
    if ($noteId <= 0 || $newPassword === '' || $confirmPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ']);
        exit;
    }
    if ($newPassword !== $confirmPassword) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu xác nhận không khớp']);
        exit;
    }
    $stmt = $pdo->prepare('SELECT is_locked, note_password_hash FROM notes WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute(['id' => $noteId, 'user_id' => $userId]);
    $note = $stmt->fetch();
    if (!$note) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy ghi chú']);
        exit;
    }
    if ((int) $note['is_locked'] === 1 && !password_verify($currentPassword, (string) $note['note_password_hash'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu hiện tại không đúng']);
        exit;
    }
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $updateStmt = $pdo->prepare(
        'UPDATE notes SET is_locked = 1, note_password_hash = :hash WHERE id = :id AND user_id = :user_id'
    );
    $updateStmt->execute(['hash' => $hash, 'id' => $noteId, 'user_id' => $userId]);
    echo json_encode(['success' => true, 'message' => 'Đã cập nhật mật khẩu ghi chú']);
    exit;
}

if ($action === 'disable_note_password') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $currentPassword = (string) ($_POST['current_password'] ?? '');
    if ($noteId <= 0 || $currentPassword === '') {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'Dữ liệu không hợp lệ']);
        exit;
    }
    $stmt = $pdo->prepare('SELECT is_locked, note_password_hash FROM notes WHERE id = :id AND user_id = :user_id LIMIT 1');
    $stmt->execute(['id' => $noteId, 'user_id' => $userId]);
    $note = $stmt->fetch();
    if (!$note) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy ghi chú']);
        exit;
    }
    if ((int) $note['is_locked'] !== 1 || !password_verify($currentPassword, (string) $note['note_password_hash'])) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Mật khẩu hiện tại không đúng']);
        exit;
    }
    $updateStmt = $pdo->prepare(
        'UPDATE notes SET is_locked = 0, note_password_hash = NULL WHERE id = :id AND user_id = :user_id'
    );
    $updateStmt->execute(['id' => $noteId, 'user_id' => $userId]);
    echo json_encode(['success' => true, 'message' => 'Đã tắt khóa ghi chú']);
    exit;
}

if ($action === 'delete') {
    $noteId = isset($_POST['note_id']) ? (int) $_POST['note_id'] : 0;
    $notePassword = (string) ($_POST['note_password'] ?? '');
    if ($noteId <= 0) {
        http_response_code(422);
        echo json_encode(['success' => false, 'message' => 'ID ghi chú không hợp lệ']);
        exit;
    }
    $pdo->beginTransaction();
    try {
        $checkStmt = $pdo->prepare('SELECT is_locked, note_password_hash FROM notes WHERE id = :id AND user_id = :user_id LIMIT 1');
        $checkStmt->execute(['id' => $noteId, 'user_id' => $userId]);
        $currentNote = $checkStmt->fetch();
        if (!$currentNote) {
            throw new RuntimeException('Không tìm thấy ghi chú');
        }
        if ((int) $currentNote['is_locked'] === 1 && !password_verify($notePassword, (string) $currentNote['note_password_hash'])) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Mật khẩu ghi chú không đúng']);
            $pdo->rollBack();
            exit;
        }
        $deletePivot = $pdo->prepare('DELETE FROM note_labels WHERE note_id = :note_id');
        $deletePivot->execute(['note_id' => $noteId]);
        $deleteStmt = $pdo->prepare('DELETE FROM notes WHERE id = :id AND user_id = :user_id');
        $deleteStmt->execute(['id' => $noteId, 'user_id' => $userId]);
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Đã xóa ghi chú']);
    } catch (Throwable $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Không thể xóa ghi chú']);
    }
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
