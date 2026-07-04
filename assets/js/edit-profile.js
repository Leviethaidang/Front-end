const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const editForm = document.getElementById("edit-profile-form");
const messageBox = document.getElementById("edit-profile-message");
const saveButton = document.querySelector(".save-btn");

loadEditProfile();

if (editForm) {
    editForm.addEventListener("submit", updateProfile);
}

function setMessage(message, type = "success") {
    if (!messageBox) {
        return;
    }

    messageBox.className = `message ${type}`;
    messageBox.textContent = message;
}

function showLoginRequired() {
    setMessage("Bạn chưa đăng nhập. Vui lòng đăng nhập để chỉnh sửa hồ sơ.", "error");
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

async function loadEditProfile() {
    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET"
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải hồ sơ.", "error");
            return;
        }

        const profile = data.profile || {};

        setInputValue("edit-name", profile.full_name);
        setInputValue("edit-email", profile.email);
        setInputValue("edit-phone", profile.phone_number);
        setInputValue("edit-address", profile.default_shipping_address);

    } catch (error) {
        console.error("Lỗi load edit profile:", error);
        setMessage("Không thể kết nối User Service.", "error");
    }
}

async function updateProfile(event) {
    event.preventDefault();

    const fullName = getInputValue("edit-name");
    const email = getInputValue("edit-email");
    const phoneNumber = getInputValue("edit-phone");
    const defaultShippingAddress = getInputValue("edit-address");

    if (!fullName) {
        setMessage("Họ và tên không được để trống.", "error");
        return;
    }

    if (!email) {
        setMessage("Email không được để trống.", "error");
        return;
    }

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "error");
        return;
    }

    try {
        setSaving(true);

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "PUT",
            body: JSON.stringify({
                fullName,
                email,
                phoneNumber,
                defaultShippingAddress
            })
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật hồ sơ thất bại.", "error");
            return;
        }

        if (data.profile?.full_name) {
            localStorage.setItem("fullName", data.profile.full_name);

            if (typeof renderNavbarAuthSection === "function") {
                renderNavbarAuthSection();
            }
        }

        if (data.emailVerificationRequired) {
            setMessage(data.message || "Vui lòng xác minh email mới.", "warning");
            return;
        }

        setMessage(data.message || "Cập nhật hồ sơ thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1000);

    } catch (error) {
        console.error("Lỗi update profile:", error);
        setMessage("Không thể kết nối User Service.", "error");

    } finally {
        setSaving(false);
    }
}

function setInputValue(id, value) {
    const input = document.getElementById(id);

    if (input) {
        input.value = value || "";
    }
}

function getInputValue(id) {
    const input = document.getElementById(id);

    return input ? input.value.trim() : "";
}

function setSaving(isSaving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = isSaving;
    saveButton.textContent = isSaving ? "Đang lưu..." : "Lưu thay đổi";
}
