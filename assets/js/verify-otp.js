const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const otpInputs = Array.from(document.querySelectorAll(".otp-input"));
const otpForm = document.getElementById("otp-form");
const otpMessage = document.getElementById("otp-message");
const verifyButton = document.getElementById("verify-button");
const resendLink = document.getElementById("resend-link");
const resendTimer = document.getElementById("resend-timer");

setupOtpInputs();
setupResendHint();
otpForm.addEventListener("submit", confirmRegister);

function setMessage(text, type = "danger") {
    otpMessage.className = `message ${type}`;
    otpMessage.textContent = text;
}

function getOtpCode() {
    return otpInputs.map(input => input.value.trim()).join("");
}

function clearOtpInputs() {
    otpInputs.forEach(input => {
        input.value = "";
    });
    otpInputs[0]?.focus();
    updateVerifyState();
}

function updateVerifyState() {
    verifyButton.disabled = getOtpCode().length !== otpInputs.length;
}

function setupOtpInputs() {
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", event => {
            event.target.value = event.target.value.replace(/\D/g, "").slice(0, 1);

            if (event.target.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }

            updateVerifyState();
        });

        input.addEventListener("keydown", event => {
            if (event.key === "Backspace" && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        input.addEventListener("paste", event => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpInputs.length);
            pasted.split("").forEach((character, pastedIndex) => {
                if (otpInputs[pastedIndex]) otpInputs[pastedIndex].value = character;
            });
            updateVerifyState();
        });
    });

    otpInputs[0]?.focus();
    updateVerifyState();
}

function setupResendHint() {
    if (!resendLink) return;

    resendLink.addEventListener("click", event => {
        event.preventDefault();
        setMessage("Nếu chưa nhận được mã, vui lòng đăng ký lại để hệ thống gửi mã mới.", "success");
        if (resendTimer) resendTimer.textContent = "";
    });
}

async function confirmRegister(event) {
    event.preventDefault();

    const email = localStorage.getItem("registrationEmail") || "";
    const code = getOtpCode();

    if (!email) {
        setMessage("Không tìm thấy email đăng ký. Vui lòng quay lại trang đăng ký.", "danger");
        return;
    }

    if (code.length !== otpInputs.length) {
        setMessage("Vui lòng nhập đủ mã xác thực.", "danger");
        return;
    }

    try {
        verifyButton.disabled = true;
        verifyButton.textContent = "Đang xác thực...";

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/confirm-register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, code })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xác thực thất bại.", "danger");
            clearOtpInputs();
            return;
        }

        localStorage.removeItem("registrationEmail");
        setMessage(data.message || "Xác thực thành công! Đang chuyển sang trang đăng nhập...", "success");

        setTimeout(() => {
            window.location.href = "/login";
        }, 1200);

    } catch (error) {
        console.error("Lỗi xác thực tài khoản:", error);
        setMessage("Không thể xác thực tài khoản.", "danger");

    } finally {
        verifyButton.textContent = "Xác thực";
        updateVerifyState();
    }
}
