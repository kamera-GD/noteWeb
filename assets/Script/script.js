const loginFormBox = document.getElementById('login-form');
const registerFormBox = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const authAlert = document.getElementById('authAlert');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

const showAlert = (message, type = 'danger') => {
    authAlert.className = `alert alert-${type} mb-3`;
    authAlert.textContent = message;
};

const hideAlert = () => {
    authAlert.className = 'alert d-none mb-3';
    authAlert.textContent = '';
};

showRegisterLink.addEventListener('click', function (e) {
    e.preventDefault();
    hideAlert();
    loginFormBox.style.display = 'none';
    registerFormBox.style.display = 'block';
});

showLoginLink.addEventListener('click', function (e) {
    e.preventDefault();
    hideAlert();
    registerFormBox.style.display = 'none';
    loginFormBox.style.display = 'block';
});

const setSubmitting = (button, submitting, text) => {
    button.disabled = submitting;
    button.textContent = submitting ? 'Đang xử lý...' : text;
};

const postAuth = async (formData) => {
    const response = await fetch('api/auth.php', {
        method: 'POST',
        body: formData
    });
    return response.json();
};

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();
    setSubmitting(loginSubmitBtn, true, 'Đăng Nhập');

    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('email', document.getElementById('loginEmail').value.trim());
    formData.append('password', document.getElementById('loginPassword').value);

    try {
        const result = await postAuth(formData);
        if (!result.success) {
            showAlert(result.message || 'Đăng nhập thất bại');
            return;
        }
        showAlert('Đăng nhập thành công, đang chuyển trang...', 'success');
        window.location.href = 'page/dashboard.html';
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(loginSubmitBtn, false, 'Đăng Nhập');
    }
});

registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideAlert();
    setSubmitting(registerSubmitBtn, true, 'Đăng Ký');

    const formData = new FormData();
    formData.append('action', 'register');
    formData.append('email', document.getElementById('regEmail').value.trim());
    formData.append('display_name', document.getElementById('regName').value.trim());
    formData.append('password', document.getElementById('regPassword').value);
    formData.append('confirm_password', document.getElementById('regPasswordConfirm').value);

    try {
        const result = await postAuth(formData);
        if (!result.success) {
            showAlert(result.message || 'Đăng ký thất bại');
            return;
        }
        showAlert('Đăng ký thành công, đang chuyển trang...', 'success');
        window.location.href = 'page/dashboard.html';
    } catch (error) {
        showAlert('Không thể kết nối máy chủ');
    } finally {
        setSubmitting(registerSubmitBtn, false, 'Đăng Ký');
    }
});