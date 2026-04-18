const otpAlert = document.getElementById('otpAlert');
const verifyOtpForm = document.getElementById('verifyOtpForm');
const otpSubmitBtn = document.getElementById('otpSubmitBtn');

const showAlert = (message, type = 'danger') => {
    otpAlert.className = `alert alert-${type} mb-3`;
    otpAlert.textContent = message;
};

const hideAlert = () => {
    otpAlert.className = 'alert d-none mb-3';
    otpAlert.textContent = '';
};

const setSubmitting = (submitting) => {
    otpSubmitBtn.disabled = submitting;
    otpSubmitBtn.textContent = submitting ? 'Đang xử lý...' : 'Xác nhận OTP';
};

const params = new URLSearchParams(window.location.search);
const email = params.get('email') || '';

verifyOtpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    setSubmitting(true);

    try {
        const formData = new FormData();
        formData.append('action', 'verify_forgot_password_otp');
        formData.append('email', email);
        formData.append('otp', document.getElementById('otpCode').value.trim());

        const response = await fetch('../api/auth.php', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (!result.success) {
            showAlert(result.message || 'OTP không đúng');
            return;
        }

        window.location.href = `reset-password.html?email=${encodeURIComponent(email)}`;
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(false);
    }
});