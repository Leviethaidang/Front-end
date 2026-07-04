const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const otpForm = document.getElementById("otp-form");
const otpButton = document.querySelector(".auth-btn");
const message = document.getElementById("otp-message");
const resendBtn = document.getElementById("resend-btn");

otpForm.addEventListener("submit", confirmRegister);
resendBtn.addEventListener("click", resendCode);

function setMessage(text, type = "danger") {
    message.className = type === "success" ? "message success" : "message error";
    message.textContent = text;
}

function clearMessage() {
    message.className = "message";
    message.textContent = "";
}

async function confirmRegister(event) {
    event.preventDefault();

    clearMessage();

    const email = localStorage.getItem("registerEmail");
    const code = document.getElementById("otp-code").value.trim();

    if (!email) {
        window.location.href = "register.html";
        return;
    }

    if (!code) {
        setMessage("Vui lòng nhập mã xác nhận.");
        return;
    }

    try {
        otpButton.disabled = true;
        otpButton.textContent = "Đang xác nhận...";

        const body = {
            email,
            code
        };

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/confirm-register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xác nhận thất bại.");
            return;
        }

        setMessage("Xác nhận thành công! Đang chuyển sang trang đăng nhập...", "success");
        localStorage.removeItem("registerEmail");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {
        console.error("Lỗi xác nhận tài khoản:", error);
        setMessage("Không thể xác nhận tài khoản.");

    } finally {
        otpButton.disabled = false;
        otpButton.textContent = "Xác nhận";
    }
}

async function resendCode(event) {
    event.preventDefault();

    clearMessage();

    const email = localStorage.getItem("registerEmail");

    if (!email) {
        window.location.href = "register.html";
        return;
    }

    try {
        resendBtn.textContent = "Đang gửi lại...";
        resendBtn.style.pointerEvents = "none";

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/resend-code`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Gửi lại mã thất bại.");
            return;
        }

        setMessage("Mã xác nhận đã được gửi lại!", "success");

    } catch (error) {
        console.error("Lỗi gửi lại mã:", error);
        setMessage("Không thể gửi lại mã.");

    } finally {
        resendBtn.textContent = "Gửi lại";
        resendBtn.style.pointerEvents = "auto";
    }
}
