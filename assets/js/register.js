const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const registerForm = document.getElementById("register-form");
const registerButton = document.getElementById("register-button");
const message = document.getElementById("register-message");

registerForm.addEventListener("submit", register);
setupPasswordToggles();

function setMessage(text, type = "danger") {
    message.className = `message ${type}`;
    message.textContent = text;
}

function clearMessage() {
    setMessage("", "");
}

function setupPasswordToggles() {
    document.querySelectorAll(".password-toggle").forEach(toggle => {
        toggle.addEventListener("click", () => {
            const input = document.getElementById(toggle.dataset.target);
            if (!input) return;

            const showPassword = input.type === "password";
            input.type = showPassword ? "text" : "password";

            const eyeOff = toggle.querySelector(".eye-off");
            const eyeOn = toggle.querySelector(".eye-on");
            if (eyeOff) eyeOff.style.display = showPassword ? "none" : "";
            if (eyeOn) eyeOn.style.display = showPassword ? "" : "none";
        });
    });
}

async function register(event) {
    event.preventDefault();
    clearMessage();

    const fullName = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phoneNumber = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirmPassword = document.getElementById("reg-confirm-password").value;

    if (!fullName || !email || !phoneNumber || !password || !confirmPassword) {
        setMessage("Vui lòng nhập đầy đủ thông tin.", "danger");
        return;
    }

    if (!phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
        return;
    }

    if (password !== confirmPassword) {
        setMessage("Mật khẩu xác nhận không khớp.", "danger");
        return;
    }

    try {
        registerButton.disabled = true;
        registerButton.textContent = "Đang đăng ký...";

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fullName,
                email,
                phoneNumber,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Đăng ký thất bại.", "danger");
            return;
        }

        localStorage.setItem("registrationEmail", email);
        setMessage(data.message || "Đăng ký thành công. Vui lòng xác thực email.", "success");

        setTimeout(() => {
            window.location.href = "/verify-otp";
        }, 800);

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Đăng ký";
    }
}
