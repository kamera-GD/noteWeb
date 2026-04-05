// Lắng nghe sự kiện click vào nút "Đăng ký ngay"
document.getElementById('show-register').addEventListener('click', function(e) {
    e.preventDefault(); // Ngăn chặn hành vi load lại trang mặc định của thẻ <a>
    document.getElementById('login-form').style.display = 'none'; // Ẩn form đăng nhập
    document.getElementById('register-form').style.display = 'block'; // Hiện form đăng ký
});

// Lắng nghe sự kiện click vào nút "Đăng nhập"
document.getElementById('show-login').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('register-form').style.display = 'none'; // Ẩn form đăng ký
    document.getElementById('login-form').style.display = 'block'; // Hiện form đăng nhập
});