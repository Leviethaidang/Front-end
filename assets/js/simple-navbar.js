function getSimpleNavbarTokenPayload(token) {
    try {
        const base64Payload = token.split(".")[1];
        const jsonPayload = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(jsonPayload);
    } catch {
        return {};
    }
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

function logout(event) {
    event.preventDefault();
    localStorage.clear();
    window.location.href = "/";
}

function getSimpleNavbarAuthAction() {
    const placeholder = document.getElementById("simple-navbar-placeholder")
        || document.getElementById("navbar-placeholder");

    if (placeholder?.dataset.authAction) {
        return placeholder.dataset.authAction;
    }

    if (window.location.pathname.includes("login")) {
        return "register";
    }

    return "login";
}

function getSimpleNavbarAuthHtml() {
    const accessToken = localStorage.getItem("accessToken");
    const fullName = localStorage.getItem("fullName") || "Thành viên";

    if (!accessToken) {
        const action = getSimpleNavbarAuthAction();
        const href = action === "register" ? "/register" : "/login";
        const label = action === "register" ? "Đăng ký" : "Đăng nhập";

        return `<a href="${href}" class="simple-navbar-button">${label}</a>`;
    }

    const payload = getSimpleNavbarTokenPayload(accessToken);
    const groups = payload["cognito:groups"] || [];
    const isAdmin = groups.includes("Admin");

    return `
        <div class="simple-navbar-user">
            <button type="button" class="simple-navbar-user-button" id="simple-navbar-user-button" aria-expanded="false" aria-controls="simple-navbar-menu">
                <span class="simple-navbar-user-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </span>
                <span>Xin chào, ${escapeHtml(fullName)}</span>
                <span class="simple-navbar-chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="simple-navbar-menu" id="simple-navbar-menu">
                <a href="/profile">Profile</a>
                <a href="/orders">Đơn của tôi</a>
                ${isAdmin ? '<a href="/admin/users">Quản lý users</a>' : ''}
                ${isAdmin ? '<a href="/admin/products">Quản lý sản phẩm</a>' : ''}
                ${isAdmin ? '<a href="/admin/categories">Quản lý danh mục</a>' : ''}
                ${isAdmin ? '<a href="/admin/orders">Quản lý đơn hàng</a>' : ''}
                <hr>
                <a href="#" onclick="logout(event)">Đăng xuất</a>
            </div>
        </div>
    `;
}

function renderNavbarAuthSection() {
    const authSection = document.getElementById("simple-navbar-auth");

    if (authSection) {
        authSection.innerHTML = getSimpleNavbarAuthHtml();
        setupSimpleNavbarDropdown();
    }
}

function setupSimpleNavbarDropdown() {
    const button = document.getElementById("simple-navbar-user-button");
    const menu = document.getElementById("simple-navbar-menu");

    if (!button || !menu || button.dataset.bound === "true") {
        return;
    }

    button.dataset.bound = "true";
    button.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();

        const isOpen = menu.classList.toggle("show");
        button.setAttribute("aria-expanded", String(isOpen));
    });
}

function setupSimpleNavbarGlobalClose() {
    if (document.body.dataset.simpleNavbarCloseBound === "true") {
        return;
    }

    document.body.dataset.simpleNavbarCloseBound = "true";
    document.addEventListener("click", () => {
        const menu = document.getElementById("simple-navbar-menu");
        const button = document.getElementById("simple-navbar-user-button");

        if (menu) menu.classList.remove("show");
        if (button) button.setAttribute("aria-expanded", "false");
    });
}

function loadSimpleNavbar() {
    const placeholder = document.getElementById("simple-navbar-placeholder")
        || document.getElementById("navbar-placeholder");

    if (!placeholder) {
        return;
    }

    placeholder.innerHTML = `
        <header class="simple-navbar">
            <div class="simple-navbar-container">
                <a class="simple-navbar-logo" href="/">HASHOP</a>
                <nav class="simple-navbar-actions" id="simple-navbar-auth" aria-label="Tài khoản"></nav>
            </div>
        </header>
    `;

    renderNavbarAuthSection();
    setupSimpleNavbarGlobalClose();
}

loadSimpleNavbar();
