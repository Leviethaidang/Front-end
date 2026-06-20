async function loadNavbar() {
    const placeholder = document.getElementById("navbar-placeholder");

    if (!placeholder) {
        return;
    }

    try {
        const response = await fetch("/navbar.html");

        if (!response.ok) {
            throw new Error("Không thể load navbar.html");
        }

        const navbarHtml = await response.text();
        placeholder.innerHTML = navbarHtml;

        renderNavbarAuthSection();
        setupNavbarClickOutside();

    } catch (error) {
        console.error("Lỗi load navbar:", error);
    }
}

function renderNavbarAuthSection() {
    const authSection = document.getElementById("navbar-auth-section");

    if (!authSection) {
        return;
    }

    const accessToken = localStorage.getItem("accessToken");
    const fullName = localStorage.getItem("fullName") || "Thành viên";

    if (!accessToken) {
        authSection.innerHTML = `
            <a class="cart-link" href="/cart">🛒 Giỏ hàng</a>
            <a href="/login">Đăng nhập</a>
        `;
        return;
    }

    const payload = getTokenPayload(accessToken);
    const groups = payload["cognito:groups"] || [];
    const isAdmin = groups.includes("Admin");

    authSection.innerHTML = `
        <a class="cart-link" href="/cart">🛒 Giỏ hàng</a>

        <div class="dropdown" onclick="toggleNavbarDropdown(event)">
            <span>Xin chào, ${escapeHtml(fullName)} ▼</span>

            <div id="navbar-dropdown-menu" class="dropdown-content">
                <a href="/profile">Profile</a>
                <a href="/orders">Đơn của tôi</a>
                ${isAdmin ? '<a href="/admin/users">Quản lý users</a>' : ''}
                ${isAdmin ? '<a href="/admin/products">Quản lý sản phẩm</a>' : ''}
                ${isAdmin ? '<a href="/admin/categories">Quản lý danh mục</a>' : ''}
                <a href="#" onclick="logout(event)">Đăng xuất</a>
            </div>
        </div>
    `;
}

function getTokenPayload(token) {
    try {
        const base64Payload = token.split(".")[1];
        const jsonPayload = atob(
            base64Payload.replace(/-/g, "+").replace(/_/g, "/")
        );
        return JSON.parse(jsonPayload);
    } catch {
        return {};
    }
}

function toggleNavbarDropdown(event) {
    event.stopPropagation();

    const menu = document.getElementById("navbar-dropdown-menu");

    if (menu) {
        menu.classList.toggle("show");
    }
}

function setupNavbarClickOutside() {
    window.addEventListener("click", () => {
        const menu = document.getElementById("navbar-dropdown-menu");

        if (menu) {
            menu.classList.remove("show");
        }
    });
}

function logout(event) {
    event.preventDefault();
    localStorage.clear();
    window.location.href = "/";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

loadNavbar();