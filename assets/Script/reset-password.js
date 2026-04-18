const resetAlert = document.getElementById('resetAlert');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const resetSubmitBtn = document.getElementById('resetSubmitBtn');

const showAlert = (message, type = 'danger') => {
    resetAlert.className = `alert alert-${type} mb-3`;
    resetAlert.textContent = message;
};

const hideAlert = () => {
    resetAlert.className = 'alert d-none mb-3';
    resetAlert.textContent = '';
};

const setSubmitting = (submitting) => {
    resetSubmitBtn.disabled = submitting;
    resetSubmitBtn.textContent = submitting ? 'Đang xử lý...' : 'Lưu mật khẩu mới';
};

const params = new URLSearchParams(window.location.search);
const email = params.get('email') || '';

resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    setSubmitting(true);

    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        showAlert('Mật khẩu xác nhận không khớp');
        setSubmitting(false);
        return;
    }

    try {
        const formData = new FormData();
        formData.append('action', 'reset_password');
        formData.append('email', email);
        formData.append('new_password', newPassword);
        formData.append('confirm_new_password', confirmNewPassword);

        const response = await fetch('../api/auth.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (!result.success) {
            showAlert(result.message || 'Không thể đặt lại mật khẩu');
            return;
        }

        window.location.href = '../index.html';
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(false);
    }
});