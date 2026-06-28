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
        <div class="alert alert-danger">Bạn chưa đăng nhập.</div>
        <a href="/login" class="btn btn-outline-danger">Đăng nhập ngay</a>
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
                <div class="col-sm-4 text-muted fw-bold">Phương thức thanh toán mặc định:</div>
                <div class="col-sm-8 text-danger">${escapeHtml(data.error || "Không thể tải phương thức thanh toán.")}</div>
            `;
            return;
        }

        const defaultPaymentName = getDefaultPaymentDisplayName(data.paymentMethods);

        paymentMethodElement.innerHTML = `
            <div class="col-sm-4 text-muted fw-bold">Phương thức thanh toán mặc định:</div>
            <div class="col-sm-8">${escapeHtml(defaultPaymentName)}</div>
        `;

    } catch (error) {
        console.error("Lỗi load payment methods:", error);

        paymentMethodElement.innerHTML = `
            <div class="col-sm-4 text-muted fw-bold">Phương thức thanh toán mặc định:</div>
            <div class="col-sm-8 text-danger">Không thể kết nối Payment Service.</div>
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
                <div class="alert alert-danger">${escapeHtml(data.error || "Không thể tải profile.")}</div>
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
            <div class="row mb-3 border-bottom pb-3">
                <div class="col-sm-4 text-muted fw-bold">User ID:</div>
                <div class="col-sm-8 user-id">${escapeHtml(profile.user_id)}</div>
            </div>

            <div class="row mb-3 border-bottom pb-3">
                <div class="col-sm-4 text-muted fw-bold">Họ và tên:</div>
                <div class="col-sm-8">${escapeHtml(profile.full_name)}</div>
            </div>

            <div class="row mb-3 border-bottom pb-3">
                <div class="col-sm-4 text-muted fw-bold">Email:</div>
                <div class="col-sm-8">${escapeHtml(profile.email)}</div>
            </div>

            <div class="row mb-3 border-bottom pb-3">
                <div class="col-sm-4 text-muted fw-bold">Số điện thoại:</div>
                <div class="col-sm-8">${escapeHtml(profile.phone_number || "Chưa cập nhật")}</div>
            </div>

            <div class="row mb-3 border-bottom pb-3">
                <div class="col-sm-4 text-muted fw-bold">Địa chỉ giao hàng:</div>
                <div class="col-sm-8">${escapeHtml(profile.default_shipping_address || "Chưa cập nhật")}</div>
            </div>

            <div class="row mb-3" id="default-payment-method">
                <div class="col-sm-4 text-muted fw-bold">Phương thức thanh toán mặc định:</div>
                <div class="col-sm-8">Đang tải...</div>
            </div>
        `;

        editButton.style.display = "inline-block";

        await loadDefaultPaymentMethod();

    } catch (error) {
        console.error("Lỗi load profile:", error);

        profileContent.innerHTML = `
            <div class="alert alert-danger">Không thể kết nối User Service.</div>
        `;

        editButton.style.display = "none";
    }
}