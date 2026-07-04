const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const registerForm = document.getElementById("register-form");
const registerButton = document.getElementById("register-button");
const message = document.getElementById("register-message");

// Password toggle functionality
document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const targetId = this.getAttribute('data-target');
        const input = document.getElementById(targetId);
        const eyeOff = this.querySelector('.eye-off');
        const eyeOn = this.querySelector('.eye-on');
        
        if (input.type === 'password') {
            input.type = 'text';
            eyeOff.style.display = 'none';
            eyeOn.style.display = 'block';
        } else {
            input.type = 'password';
            eyeOff.style.display = 'block';
            eyeOn.style.display = 'none';
        }
    });
});

registerForm.addEventListener("submit", register);

function setMessage(text, type = "danger") {
    message.className = `message ${type}`;
    message.textContent = text;
}

function clearMessage() {
    message.className = "message";
    message.textContent = "";
}

async function register(event) {
    event.preventDefault();

    clearMessage();

    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirmPassword = document.getElementById("reg-confirm-password").value;

    if (!name || !email || !phone || !password || !confirmPassword) {
        setMessage("Vui lòng nhập đầy đủ thông tin.", "danger");
        return;
    }

    if (password !== confirmPassword) {
        setMessage("Mật khẩu xác nhận không khớp.", "danger");
        return;
    }

    try {
        registerButton.disabled = true;
        registerButton.textContent = "Đang đăng ký...";

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Store email in localStorage for OTP page
        localStorage.setItem('registrationEmail', email);

        setMessage(
            "Đăng ký thành công. Đang chuyển đến trang xác thực...",
            "success"
        );

        // Redirect to OTP page
        setTimeout(() => {
            window.location.href = "/verify-otp.html";
        }, 1000);

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Đăng ký";
    }
}
