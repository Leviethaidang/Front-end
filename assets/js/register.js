const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const registerForm = document.getElementById("register-form");
const otpForm = document.getElementById("otp-form");
const registerButton = document.getElementById("register-button");
const verifyButton = document.getElementById("verify-button");
const backToRegisterButton = document.getElementById("back-to-register");
const message = document.getElementById("register-message");
const formTitle = document.querySelector(".form-title");
const formSubtitle = document.querySelector(".form-subtitle");
const smallText = document.querySelector(".small-text");
const otpInputs = Array.from(document.querySelectorAll(".otp-input"));

let registrationEmail = localStorage.getItem("registrationEmail") || "";

registerForm.addEventListener("submit", register);
otpForm.addEventListener("submit", confirmRegister);
backToRegisterButton.addEventListener("click", showRegisterForm);

setupPasswordToggles();
setupOtpInputs();

if (registrationEmail) {
    showOtpForm(registrationEmail);
    setMessage("Vui lòng nhập mã OTP đã được gửi tới email đăng ký.", "success");
}

function setMessage(text, type = "danger") {
    message.className = `message ${type}`;
    message.textContent = text;
}

function clearMessage() {
    setMessage("", "");
}

function setRegisterLoading(isLoading) {
    registerButton.disabled = isLoading;
    registerButton.textContent = isLoading ? "Đang đăng ký..." : "Đăng ký";
}

function setVerifyLoading(isLoading) {
    verifyButton.disabled = isLoading || getOtpCode().length !== otpInputs.length;
    verifyButton.textContent = isLoading ? "Đang xác thực..." : "Xác thực";
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
                if (otpInputs[pastedIndex]) {
                    otpInputs[pastedIndex].value = character;
                }
            });

            updateVerifyState();
        });
    });

    updateVerifyState();
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

function showOtpForm(email) {
    registrationEmail = email;
    localStorage.setItem("registrationEmail", email);

    registerForm.hidden = true;
    otpForm.hidden = false;

    if (formTitle) formTitle.textContent = "Xác thực email";
    if (formSubtitle) formSubtitle.textContent = `Nhập mã OTP đã được gửi tới ${email}.`;
    if (smallText) smallText.style.display = "none";

    clearOtpInputs();
}

function showRegisterForm() {
    registrationEmail = "";
    localStorage.removeItem("registrationEmail");

    otpForm.hidden = true;
    registerForm.hidden = false;

    if (formTitle) formTitle.textContent = "Tạo tài khoản";
    if (formSubtitle) formSubtitle.textContent = "Đăng ký để bắt đầu mua sắm tại HaShop.";
    if (smallText) smallText.style.display = "";

    clearMessage();
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
        setRegisterLoading(true);

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

        showOtpForm(email);
        setMessage(data.message || "Đăng ký thành công. Vui lòng xác thực email.", "success");

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        setRegisterLoading(false);
    }
}

async function confirmRegister(event) {
    event.preventDefault();
    clearMessage();

    const email = registrationEmail || localStorage.getItem("registrationEmail") || "";
    const code = getOtpCode();

    if (!email) {
        setMessage("Không tìm thấy email đăng ký. Vui lòng nhập lại thông tin đăng ký.", "danger");
        showRegisterForm();
        return;
    }

    if (code.length !== otpInputs.length) {
        setMessage("Vui lòng nhập đủ mã xác thực.", "danger");
        return;
    }

    try {
        setVerifyLoading(true);

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
        setMessage(data.message || "Xác thực thành công. Đang chuyển sang trang đăng nhập...", "success");

        setTimeout(() => {
            window.location.href = "/login";
        }, 1200);

    } catch (error) {
        console.error("Lỗi xác thực tài khoản:", error);
        setMessage("Không thể xác thực tài khoản.", "danger");

    } finally {
        setVerifyLoading(false);
    }
}
