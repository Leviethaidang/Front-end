const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const accessToken = localStorage.getItem("accessToken");
const menuItems = document.querySelectorAll(".menu-item");
const tabContents = document.querySelectorAll(".tab-content");
const editForm = document.getElementById("edit-form");

let currentProfile = null;

initTabs();
loadProfile();

function initTabs() {
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            const tabId = item.dataset.tab;

            menuItems.forEach(i => i.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));

            item.classList.add("active");
            document.getElementById(`${tabId}-tab`).classList.add("active");
        });
    });
}

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

function formatGender(gender) {
    const map = {
        "male": "Nam",
        "female": "Nữ",
        "other": "Khác"
    };
    return map[gender] || "Chưa cập nhật";
}

function showLoginRequired() {
    const content = document.querySelector(".profile-content");
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-user-lock" style="font-size: 64px; color: #E6E6E6; margin-bottom: 16px;"></i>
                <p style="font-size: 16px; color: #666666; margin-bottom: 24px;">Bạn chưa đăng nhập.</p>
                <a href="login.html" style="display: inline-flex; align-items: center; gap: 10px; background: #8B5E3C; color: #FFFFFF; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    <i class="fas fa-sign-in-alt"></i>
                    Đăng nhập ngay
                </a>
            </div>
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
            showError(data.error || "Không thể tải hồ sơ.");
            return;
        }

        currentProfile = data.profile;
        localStorage.setItem("fullName", currentProfile.full_name || "");

        if (typeof renderNavbarAuthSection === "function") {
            renderNavbarAuthSection();
        }

        renderProfile(currentProfile);

    } catch (error) {
        console.error("Lỗi load profile:", error);
        showError("Không thể kết nối User Service.");
    }
}

function renderProfile(profile) {
    document.getElementById("profile-name").textContent = profile.full_name || "Chưa cập nhật";
    document.getElementById("profile-email").textContent = profile.email || "";

    document.getElementById("info-name").textContent = profile.full_name || "Chưa cập nhật";
    document.getElementById("info-email").textContent = profile.email || "";
    document.getElementById("info-phone").textContent = profile.phone_number || "Chưa cập nhật";
    document.getElementById("info-birthday").textContent = profile.birthday || "Chưa cập nhật";
    document.getElementById("info-gender").textContent = formatGender(profile.gender);
    document.getElementById("info-address").textContent = profile.default_shipping_address || "Chưa cập nhật";

    document.getElementById("edit-name").value = profile.full_name || "";
    document.getElementById("edit-phone").value = profile.phone_number || "";
    document.getElementById("edit-birthday").value = profile.birthday || "";
    document.getElementById("edit-gender").value = profile.gender || "";
    document.getElementById("edit-address").value = profile.default_shipping_address || "";
}

function showError(message) {
    const content = document.querySelector(".profile-content");
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-exclamation-circle" style="font-size: 64px; color: #DC2626; margin-bottom: 16px;"></i>
                <p style="font-size: 16px; color: #666666;">${escapeHtml(message)}</p>
            </div>
        `;
    }
}

if (editForm) {
    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!accessToken) {
            window.location.href = "login.html";
            return;
        }

        const button = editForm.querySelector(".btn-primary");
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

        try {
            const body = {
                full_name: document.getElementById("edit-name").value.trim(),
                phone_number: document.getElementById("edit-phone").value.trim(),
                birthday: document.getElementById("edit-birthday").value,
                gender: document.getElementById("edit-gender").value,
                default_shipping_address: document.getElementById("edit-address").value.trim()
            };

            const response = await fetch(`${USER_SERVICE_URL}/api/users/me`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.status === 401) {
                localStorage.removeItem("accessToken");
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) {
                alert(data.error || "Cập nhật thất bại.");
                return;
            }

            alert("Cập nhật hồ sơ thành công!");
            loadProfile();

        } catch (error) {
            console.error("Lỗi cập nhật profile:", error);
            alert("Không thể kết nối User Service.");
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    });
}
