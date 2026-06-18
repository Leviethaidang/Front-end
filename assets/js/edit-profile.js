const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const accessToken = localStorage.getItem("accessToken");
const editContent = document.getElementById("edit-content");

loadEditProfile();

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function setMessage(message, type = "success") {
    const messageBox = document.getElementById("message-box");

    if (!messageBox) {
        return;
    }

    messageBox.className = `message ${type}`;
    messageBox.textContent = message;
}

function showLoginRequired() {
    editContent.innerHTML = `
        <p class="danger">Bạn chưa đăng nhập.</p>
        <a href="/login" class="login-link">Đăng nhập</a>
    `;
}

async function fetchWithAuth(url, options = {}) {
    if (!accessToken) {
        showLoginRequired();
        return null;
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        localStorage.removeItem("accessToken");
        showLoginRequired();
        return null;
    }

    return response;
}

async function loadEditProfile() {
    if (!accessToken) {
        showLoginRequired();
        return;
    }

    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            editContent.innerHTML = `
                <p class="danger">${escapeHtml(data.error || "Không thể tải profile.")}</p>
            `;
            return;
        }

        renderEditForm(data.profile);

    } catch (error) {
        console.error("Lỗi load edit profile:", error);

        editContent.innerHTML = `
            <p class="danger">Không thể kết nối User Service.</p>
        `;
    }
}

function renderEditForm(profile) {
    editContent.innerHTML = `
        <p>
            <strong>User ID:</strong>
            <span class="user-id">${escapeHtml(profile.user_id)}</span>
        </p>

        <label for="fullName">Họ và tên</label>
        <input
            id="fullName"
            value="${escapeAttribute(profile.full_name)}"
        >

        <label for="email">Email</label>
        <input
            id="email"
            type="email"
            value="${escapeAttribute(profile.email)}"
        >

        <label for="phoneNumber">Số điện thoại</label>
        <input
            id="phoneNumber"
            value="${escapeAttribute(profile.phone_number || "")}"
            placeholder="+84901234567"
        >

        <label for="defaultShippingAddress">Địa chỉ giao hàng mặc định</label>
        <textarea
            id="defaultShippingAddress"
            placeholder="Nhập địa chỉ giao hàng"
        >${escapeHtml(profile.default_shipping_address || "")}</textarea>

        <button id="updateProfileBtn" class="btn btn-green">
            Lưu thay đổi
        </button>

        <p id="message-box" class="message"></p>

        <div id="email-verify-box" class="section" style="display:none;">
            <h3>Xác minh email mới</h3>

            <p class="warning-text">
                Nếu bạn đổi email, hãy kiểm tra email mới để lấy mã xác minh.
            </p>

            <input
                id="emailVerifyCode"
                placeholder="Mã xác minh email"
            >

            <button id="verifyEmailBtn" class="btn btn-blue">
                Xác minh email
            </button>
        </div>
    `;

    document
        .getElementById("updateProfileBtn")
        .addEventListener("click", updateProfile);

    document
        .getElementById("verifyEmailBtn")
        .addEventListener("click", verifyNewEmail);
}

async function updateProfile() {
    const updateProfileBtn = document.getElementById("updateProfileBtn");

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const defaultShippingAddress = document
        .getElementById("defaultShippingAddress")
        .value
        .trim();

    if (!fullName) {
        setMessage("Họ và tên không được để trống.", "danger");
        return;
    }

    if (!email) {
        setMessage("Email không được để trống.", "danger");
        return;
    }

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
        return;
    }

    try {
        updateProfileBtn.disabled = true;
        updateProfileBtn.textContent = "Đang lưu...";

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "PUT",
            body: JSON.stringify({
                fullName,
                email,
                phoneNumber,
                defaultShippingAddress
            })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật thất bại.", "danger");
            return;
        }

        if (data.profile && data.profile.full_name) {
            localStorage.setItem("fullName", data.profile.full_name);

            if (typeof renderNavbarAuthSection === "function") {
                renderNavbarAuthSection();
            }
        }

        if (data.emailVerificationRequired) {
            setMessage(data.message || "Vui lòng xác minh email mới.", "warning");

            document.getElementById("email-verify-box").style.display = "block";
            return;
        }

        setMessage(data.message || "Cập nhật profile thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1200);

    } catch (error) {
        console.error("Lỗi update profile:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        updateProfileBtn.disabled = false;
        updateProfileBtn.textContent = "Lưu thay đổi";
    }
}

async function verifyNewEmail() {
    const verifyEmailBtn = document.getElementById("verifyEmailBtn");
    const code = document.getElementById("emailVerifyCode").value.trim();

    if (!code) {
        setMessage("Vui lòng nhập mã xác minh email.", "danger");
        return;
    }

    try {
        verifyEmailBtn.disabled = true;
        verifyEmailBtn.textContent = "Đang xác minh...";

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me/verify-email`, {
            method: "POST",
            body: JSON.stringify({ code })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xác minh email thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xác minh email mới thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1200);

    } catch (error) {
        console.error("Lỗi verify email:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        verifyEmailBtn.disabled = false;
        verifyEmailBtn.textContent = "Xác minh email";
    }
}