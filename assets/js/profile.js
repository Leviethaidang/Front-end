const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";
const PAYMENT_SERVICE_URL = window.APP_CONFIG?.PAYMENT_SERVICE_URL || "";

const accessToken = localStorage.getItem("accessToken");
const profileContent = document.getElementById("profile-content");
const editButton = document.getElementById("edit-button");

loadProfile();

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

function showLoginRequired() {
    profileContent.innerHTML = `
        <p class="danger">Bạn chưa đăng nhập.</p>
        <a href="/login" class="login-link">Đăng nhập</a>
    `;

    editButton.style.display = "none";
}

function getDefaultPaymentDisplayName(paymentMethods) {
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        return "Chưa có phương thức thanh toán";
    }

    const defaultMethod = paymentMethods.find(method => Number(method.is_default) === 1);

    if (!defaultMethod) {
        return "Chưa có phương thức thanh toán mặc định";
    }

    return defaultMethod.display_name || "Chưa có tên phương thức thanh toán";
}

async function loadDefaultPaymentMethod() {
    const paymentMethodElement = document.getElementById("default-payment-method");

    if (!paymentMethodElement) {
        return;
    }

    try {
        const response = await fetch(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem("accessToken");
            showLoginRequired();
            return;
        }

        if (!response.ok) {
            paymentMethodElement.innerHTML = `
                <span class="profile-label">Phương thức thanh toán mặc định:</span>
                <span class="danger">${escapeHtml(data.error || "Không thể tải phương thức thanh toán.")}</span>
            `;
            return;
        }

        const defaultPaymentName = getDefaultPaymentDisplayName(data.paymentMethods);

        paymentMethodElement.innerHTML = `
            <span class="profile-label">Phương thức thanh toán mặc định:</span>
            ${escapeHtml(defaultPaymentName)}
        `;

    } catch (error) {
        console.error("Lỗi load payment methods:", error);

        paymentMethodElement.innerHTML = `
            <span class="profile-label">Phương thức thanh toán mặc định:</span>
            <span class="danger">Không thể kết nối Payment Service.</span>
        `;
    }
}

async function loadProfile() {
    if (!accessToken) {
        showLoginRequired();
        return;
    }

    try {
        const response = await fetch(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem("accessToken");
            showLoginRequired();
            return;
        }

        if (!response.ok) {
            profileContent.innerHTML = `
                <p class="danger">${escapeHtml(data.error || "Không thể tải profile.")}</p>
            `;

            editButton.style.display = "none";
            return;
        }

        const profile = data.profile;

        localStorage.setItem("fullName", profile.full_name || "");

        if (typeof renderNavbarAuthSection === "function") {
            renderNavbarAuthSection();
        }

        profileContent.innerHTML = `
            <p>
                <span class="profile-label">User ID:</span>
                <span class="user-id">${escapeHtml(profile.user_id)}</span>
            </p>

            <p>
                <span class="profile-label">Họ và tên:</span>
                ${escapeHtml(profile.full_name)}
            </p>

            <p>
                <span class="profile-label">Email:</span>
                ${escapeHtml(profile.email)}
            </p>

            <p>
                <span class="profile-label">Số điện thoại:</span>
                ${escapeHtml(profile.phone_number || "Chưa cập nhật")}
            </p>

            <p>
                <span class="profile-label">Địa chỉ giao hàng:</span>
                ${escapeHtml(profile.default_shipping_address || "Chưa cập nhật")}
            </p>

            <p id="default-payment-method">
                <span class="profile-label">Phương thức thanh toán mặc định:</span>
                Đang tải...
            </p>
        `;

        editButton.style.display = "inline-block";

        await loadDefaultPaymentMethod();

    } catch (error) {
        console.error("Lỗi load profile:", error);

        profileContent.innerHTML = `
            <p class="danger">Không thể kết nối User Service.</p>
        `;

        editButton.style.display = "none";
    }
}