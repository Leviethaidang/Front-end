const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const registerForm = document.getElementById("register-form");
const registerButton = document.querySelector(".auth-btn");
const message = document.getElementById("register-message");

const togglePassword1 = document.getElementById("toggle-password1");
const togglePassword2 = document.getElementById("toggle-password2");
const password1 = document.getElementById("reg-password");
const password2 = document.getElementById("reg-confirm-password");

registerForm.addEventListener("submit", register);

togglePassword1.addEventListener("click", () => {
    const type = password1.type === "password" ? "text" : "password";
    password1.type = type;
    togglePassword1.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

togglePassword2.addEventListener("click", () => {
    const type = password2.type === "password" ? "text" : "password";
    password2.type = type;
    togglePassword2.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

function setMessage(text, type = "danger") {
    message.className = type === "success" ? "message success" : "message error";
    message.textContent = text;
}

function clearMessage() {
    message.className = "message";
    message.textContent = "";
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
        setMessage("Vui lòng nhập đầy đủ thông tin.");
        return;
    }

    if (password !== confirmPassword) {
        setMessage("Mật khẩu xác nhận không khớp.");
        return;
    }

    try {
        registerButton.disabled = true;
        registerButton.textContent = "Đang đăng ký...";

        const body = {
            fullName,
            email,
            phoneNumber,
            password
        };

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Đăng ký thất bại.");
            return;
        }

        localStorage.setItem("registerEmail", email);
        window.location.href = "verify-otp.html";

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        setMessage("Không thể kết nối User Service.");

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Đăng ký";
    }
}
