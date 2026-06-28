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
        setupNavbarScroll();
        setupMobileMenu();

    } catch (error) {
        console.error("Lỗi load navbar:", error);
    }
}

function renderNavbarAuthSection() {
    const authSection = document.getElementById("navbar-auth-section");
    const mobileAuthSection = document.getElementById("mobile-auth-section");

    const accessToken = localStorage.getItem("accessToken");
    const fullName = localStorage.getItem("fullName") || "Thành viên";

    // Desktop auth section
    if (authSection) {
        if (!accessToken) {
            authSection.innerHTML = `
                <a class="cart-link" href="/cart">🛒 Giỏ hàng</a>
                <a href="/login" class="btn-ghost">Đăng nhập</a>
            `;
        } else {
            const payload = getTokenPayload(accessToken);
            const groups = payload["cognito:groups"] || [];
            const isAdmin = groups.includes("Admin");

            authSection.innerHTML = `
                <a class="cart-link" href="/cart">🛒 Giỏ hàng</a>

                <div class="dropdown" onclick="toggleNavbarDropdown(event)">
                    <span style="color: var(--text-2); font-weight: 500; padding: 9px 20px; border-radius: 100px;">Xin chào, ${escapeHtml(fullName)} ▼</span>

                    <div id="navbar-dropdown-menu" class="dropdown-content">
                        <a href="/profile">Profile</a>
                        <a href="/orders">Đơn của tôi</a>
                        ${isAdmin ? '<a href="/admin/users">Quản lý users</a>' : ''}
                        ${isAdmin ? '<a href="/admin/products">Quản lý sản phẩm</a>' : ''}
                        ${isAdmin ? '<a href="/admin/categories">Quản lý danh mục</a>' : ''}
                        ${isAdmin ? '<a href="/admin/orders">Quản lý đơn hàng</a>' : ''}
                        <a href="#" onclick="logout(event)">Đăng xuất</a>
                    </div>
                </div>
            `;
        }
    }

    // Mobile auth section
    if (mobileAuthSection) {
        if (!accessToken) {
            mobileAuthSection.innerHTML = `
                <a href="/cart">🛒 Giỏ hàng</a>
                <a href="/login" class="mobile-cta">Đăng nhập</a>
            `;
        } else {
            const payload = getTokenPayload(accessToken);
            const groups = payload["cognito:groups"] || [];
            const isAdmin = groups.includes("Admin");

            mobileAuthSection.innerHTML = `
                <a href="/cart">🛒 Giỏ hàng</a>
                <a href="/profile">Profile</a>
                <a href="/orders">Đơn của tôi</a>
                ${isAdmin ? '<a href="/admin/users">Quản lý users</a>' : ''}
                ${isAdmin ? '<a href="/admin/products">Quản lý sản phẩm</a>' : ''}
                ${isAdmin ? '<a href="/admin/categories">Quản lý danh mục</a>' : ''}
                ${isAdmin ? '<a href="/admin/orders">Quản lý đơn hàng</a>' : ''}
                <a href="#" onclick="logout(event)" class="mobile-cta">Đăng xuất</a>
            `;
        }
    }
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

function setupNavbarScroll() {
    const nav = document.getElementById("mainNav");
    if (!nav) return;

    window.addEventListener("scroll", () => {
        nav.classList.toggle("scrolled", window.scrollY > 40);
    }, { passive: true });
}

function setupMobileMenu() {
    const hamburger = document.getElementById("hamburger");
    const mobileMenu = document.getElementById("mobileMenu");

    if (!hamburger || !mobileMenu) return;

    function openMobileMenu() {
        hamburger.classList.add("open");
        mobileMenu.classList.add("open");
        hamburger.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    function closeMobileMenu() {
        hamburger.classList.remove("open");
        mobileMenu.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
    }

    hamburger.addEventListener("click", () => {
        mobileMenu.classList.contains("open") ? closeMobileMenu() : openMobileMenu();
    });

    document.addEventListener("keydown", e => { if (e.key === "Escape") closeMobileMenu(); });

    mobileMenu.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => closeMobileMenu());
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
