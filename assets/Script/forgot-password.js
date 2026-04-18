const forgotAlert = document.getElementById('forgotAlert');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');

const showAlert = (message, type = 'danger') => {
    forgotAlert.className = `alert alert-${type} mb-3`;
    forgotAlert.textContent = message;
};

const hideAlert = () => {
    forgotAlert.className = 'alert d-none mb-3';
    forgotAlert.textContent = '';
};

const setSubmitting = (submitting) => {
    forgotSubmitBtn.disabled = submitting;
    forgotSubmitBtn.textContent = submitting ? 'Đang xử lý...' : 'Gửi OTP';
};

forgotPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    setSubmitting(true);

    const email = document.getElementById('forgotEmail').value.trim();

    try {
        const formData = new FormData();
        formData.append('action', 'request_forgot_password');
        formData.append('email', email);

        const response = await fetch('../api/auth.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (!result.success) {
            showAlert(result.message || 'Không thể gửi OTP');
            return;
        }

        window.location.href = `verify-otp.html?email=${encodeURIComponent(email)}`;
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(false);
    }
});