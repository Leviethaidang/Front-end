const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const profileFields = {
    name: document.getElementById("profile-name"),
    email: document.getElementById("profile-email"),
    fullName: document.getElementById("profile-full-name"),
    emailValue: document.getElementById("profile-email-value"),
    phone: document.getElementById("profile-phone"),
    address: document.getElementById("profile-address"),
    createdAt: document.getElementById("profile-created-at")
};

loadProfile();

function setText(element, value, fallback = "Chưa cập nhật") {
    if (!element) {
        return;
    }

    element.textContent = value || fallback;
}

function showLoginRequired() {
    setText(profileFields.name, "Bạn chưa đăng nhập", "");
    setText(profileFields.email, "Vui lòng đăng nhập để xem hồ sơ.", "");
}

async function fetchWithAuth(url, options = {}) {
    const accessToken = localStorage.getItem("accessToken");

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

async function loadProfile() {
    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET"
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setText(profileFields.name, data.error || "Không thể tải hồ sơ.", "");
            return;
        }

        const profile = data.profile || {};

        setText(profileFields.name, profile.full_name);
        setText(profileFields.email, profile.email);
        setText(profileFields.fullName, profile.full_name);
        setText(profileFields.emailValue, profile.email);
        setText(profileFields.phone, profile.phone_number);
        setText(profileFields.address, profile.default_shipping_address);
        setText(profileFields.createdAt, formatDate(profile.created_at));

        if (profile.full_name) {
            localStorage.setItem("fullName", profile.full_name);
        }

    } catch (error) {
        console.error("Lỗi load profile:", error);
        setText(profileFields.name, "Không thể kết nối User Service.", "");
    }
}

function formatDate(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return new Intl.DateTimeFormat("vi-VN").format(date);
}
