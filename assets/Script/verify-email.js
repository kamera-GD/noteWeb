const verifyAlert = document.getElementById('verifyAlert');
const verifyEmailForm = document.getElementById('verifyEmailForm');
const verifySubmitBtn = document.getElementById('verifySubmitBtn');
const cancelVerifyBtn = document.getElementById('cancelVerifyBtn');
const urlParams = new URLSearchParams(window.location.search);
const pendingEmail = urlParams.get('email');

const showAlert = (message, type = 'danger') => {
    verifyAlert.className = `alert alert-${type} mb-3`;
    verifyAlert.textContent = message;
};

const hideAlert = () => {
    verifyAlert.className = 'alert d-none mb-3';
    verifyAlert.textContent = '';
};

const setSubmitting = (submitting) => {
    verifySubmitBtn.disabled = submitting;
    verifySubmitBtn.textContent = submitting ? 'Đang xử lý...' : 'Xác thực';
};

const postAuth = async (formData) => {
    const response = await fetch('../api/auth.php', {
        method: 'POST',
        body: formData
    });
    return response.json();
};

if (pendingEmail) {
    // email chỉ dùng để theo dõi trạng thái đăng ký, không hiển thị trên giao diện
}

const clearPendingAccount = async () => {
    if (!pendingEmail) {
        return;
    }

    const formData = new FormData();
    formData.append('action', 'delete_pending_account');
    formData.append('email', pendingEmail);

    try {
        await postAuth(formData);
    } catch (error) {
        // bỏ qua lỗi để vẫn cho phép quay lại trang đăng nhập
    }
};

verifyEmailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    setSubmitting(true);

    const formData = new FormData();
    formData.append('action', 'verify_email');
    formData.append('email', pendingEmail || '');
    formData.append('code', document.getElementById('verifyCode').value.trim());

    try {
        const result = await postAuth(formData);
        if (!result.success) {
            showAlert(result.message || 'Xác thực thất bại');
            return;
        }

        showAlert('Xác thực thành công, đang chuyển về trang đăng nhập...', 'success');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1200);
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(false);
    }
});

cancelVerifyBtn?.addEventListener('click', async () => {
    await clearPendingAccount();
    window.location.href = '../index.html';
});