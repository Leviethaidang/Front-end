const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";

const accessToken = localStorage.getItem("accessToken");
const editForm = document.getElementById("edit-form");

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

function showLoginRequired() {
    const content = document.querySelector(".profile-content");
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-user-lock" style="font-size: 64px; color: #E6E6E6; margin-bottom: 16px;"></i>
                <p style="font-size: 16px; color: #666666; margin-bottom: 24px;">Bạn chưa đăng nhập.</p>
                <a href="/login" style="display: inline-flex; align-items: center; gap: 10px; background: #8B5E3C; color: #FFFFFF; padding: 14px 32px; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none;">
                    <i class="fas fa-sign-in-alt"></i>
                    Đăng nhập ngay
                </a>
            </div>
        `;
    }
}

async function loadEditProfile() {
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

        const profile = data.profile;
        localStorage.setItem("fullName", profile.full_name || "");

        if (typeof renderNavbarAuthSection === "function") {
            renderNavbarAuthSection();
        }

        document.getElementById("edit-name").value = profile.full_name || "";
        document.getElementById("edit-phone").value = profile.phone_number || "";
        document.getElementById("edit-birthday").value = profile.birthday || "";
        document.getElementById("edit-gender").value = profile.gender || "";
        document.getElementById("edit-address").value = profile.default_shipping_address || "";

    } catch (error) {
        console.error("Lỗi load profile:", error);
        showError("Không thể kết nối User Service.");
    }
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
            window.location.href = "/login";
            return;
        }

        const button = editForm.querySelector(".btn-primary[type='submit']");
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
                window.location.href = "/login";
                return;
            }

            if (!response.ok) {
                alert(data.error || "Cập nhật thất bại.");
                return;
            }

            alert("Cập nhật hồ sơ thành công!");
            window.location.href = "/profile";

        } catch (error) {
            console.error("Lỗi cập nhật profile:", error);
            alert("Không thể kết nối User Service.");
        } finally {
            button.disabled = false;
            button.innerHTML = originalText;
        }
    });
}
