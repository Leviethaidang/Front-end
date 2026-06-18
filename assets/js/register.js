const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const registerForm = document.getElementById("register-form");
const confirmForm = document.getElementById("confirm-form");

const registerButton = document.getElementById("register-button");
const confirmButton = document.getElementById("confirm-button");

const otpBox = document.getElementById("otp-box");
const message = document.getElementById("register-message");

registerForm.addEventListener("submit", register);
confirmForm.addEventListener("submit", confirmRegister);

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

    const body = {
        fullName: document.getElementById("reg-name").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        phoneNumber: document.getElementById("reg-phone").value.trim(),
        password: document.getElementById("reg-password").value
    };

    if (!body.fullName || !body.email || !body.phoneNumber || !body.password) {
        setMessage("Vui lòng nhập đầy đủ thông tin.", "danger");
        return;
    }

    if (!body.phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
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
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Đăng ký thất bại.", "danger");
            return;
        }

        setMessage(
            data.message || "Đăng ký thành công. Vui lòng nhập mã xác nhận.",
            "success"
        );

        otpBox.style.display = "block";

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = "Đăng ký";
    }
}

async function confirmRegister(event) {
    event.preventDefault();

    clearMessage();

    const body = {
        email: document.getElementById("reg-email").value.trim(),
        code: document.getElementById("otp-code").value.trim()
    };

    if (!body.email || !body.code) {
        setMessage("Vui lòng nhập email và mã xác nhận.", "danger");
        return;
    }

    try {
        confirmButton.disabled = true;
        confirmButton.textContent = "Đang xác nhận...";

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/confirm-register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xác nhận thất bại.", "danger");
            return;
        }

        setMessage(
            data.message || "Xác nhận thành công! Đang chuyển sang trang đăng nhập...",
            "success"
        );

        setTimeout(() => {
            window.location.href = "/login";
        }, 1500);

    } catch (error) {
        console.error("Lỗi xác nhận tài khoản:", error);
        setMessage("Không thể xác nhận tài khoản.", "danger");

    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = "Xác nhận tài khoản";
    }
}