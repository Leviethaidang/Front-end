const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const loginForm = document.getElementById("login-form");
const loginButton = document.querySelector(".auth-btn");
const message = document.getElementById("login-message");
const togglePasswordBtn = document.getElementById("toggle-password");
const passwordInput = document.getElementById("login-password");

loginForm.addEventListener("submit", login);

togglePasswordBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordBtn.innerHTML = type === "password" ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

function setMessage(text, type = "danger") {
    message.className = type === "success" ? "message success" : "message";
    message.textContent = text;
}

function parseJwtPayload(token) {
    try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");

        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map(character => {
                    return "%" + ("00" + character.charCodeAt(0).toString(16)).slice(-2);
                })
                .join("")
        );

        return JSON.parse(jsonPayload);

    } catch {
        return {};
    }
}

async function login(event) {
    event.preventDefault();

    const body = {
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value
    };

    setMessage("");

    if (!body.email || !body.password) {
        setMessage("Vui lòng nhập email và mật khẩu.");
        return;
    }

    try {
        loginButton.disabled = true;
        loginButton.textContent = "Đang đăng nhập...";

        const response = await fetch(`${USER_SERVICE_URL}/api/users/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Đăng nhập thất bại.");
            return;
        }

        localStorage.setItem("accessToken", data.tokens.AccessToken);
        localStorage.setItem("idToken", data.tokens.IdToken);

        if (data.tokens.RefreshToken) {
            localStorage.setItem("refreshToken", data.tokens.RefreshToken);
        }

        localStorage.setItem("email", body.email);

        const idPayload = parseJwtPayload(data.tokens.IdToken);
        localStorage.setItem("fullName", idPayload.name || "Thành viên");

        setMessage("Đăng nhập thành công. Đang chuyển hướng...", "success");

        setTimeout(() => {
            window.location.href = "index.html";
        }, 500);

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        setMessage("Không thể kết nối User Service.");

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Đăng nhập";
    }
}