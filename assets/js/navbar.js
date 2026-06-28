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
                <div class="list-inline-item me-4">
                    <a href="/login" class="text-muted" title="Đăng nhập">
                        <i class="bi bi-person"></i>
                    </a>
                </div>
                <div class="list-inline-item me-4">
                    <a class="text-muted position-relative" href="/cart" title="Giỏ hàng">
                        <i class="bi bi-cart"></i>
                    </a>
                </div>
            `;
        } else {
            const payload = getTokenPayload(accessToken);
            const groups = payload["cognito:groups"] || [];
            const isAdmin = groups.includes("Admin");

            authSection.innerHTML = `
                <div class="list-inline-item me-4 dropdown">
                    <a href="#" class="text-muted dropdown-toggle" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="text-decoration: none;">
                        <i class="bi bi-person-check"></i> Xin chào, ${escapeHtml(fullName)}
                    </a>
                    <ul class="dropdown-menu">
                        <li><a class="dropdown-item" href="/profile">Profile</a></li>
                        <li><a class="dropdown-item" href="/orders">Đơn của tôi</a></li>
                        ${isAdmin ? '<li><a class="dropdown-item" href="/admin/users">Quản lý users</a></li>' : ''}
                        ${isAdmin ? '<li><a class="dropdown-item" href="/admin/products">Quản lý sản phẩm</a></li>' : ''}
                        ${isAdmin ? '<li><a class="dropdown-item" href="/admin/categories">Quản lý danh mục</a></li>' : ''}
                        ${isAdmin ? '<li><a class="dropdown-item" href="/admin/orders">Quản lý đơn hàng</a></li>' : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item" href="#" onclick="logout(event)">Đăng xuất</a></li>
                    </ul>
                </div>
                <div class="list-inline-item me-4">
                    <a class="text-muted position-relative" href="/cart" title="Giỏ hàng">
                        <i class="bi bi-cart"></i>
                    </a>
                </div>
            `;
        }
    }

    // Mobile auth section
    if (mobileAuthSection) {
        if (!accessToken) {
            mobileAuthSection.innerHTML = `
                <ul class="navbar-nav align-items-center">
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/cart">🛒 Giỏ hàng</a></li>
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/login">Đăng nhập</a></li>
                </ul>
            `;
        } else {
            const payload = getTokenPayload(accessToken);
            const groups = payload["cognito:groups"] || [];
            const isAdmin = groups.includes("Admin");

            mobileAuthSection.innerHTML = `
                <ul class="navbar-nav align-items-center">
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/cart">🛒 Giỏ hàng</a></li>
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/profile">Profile</a></li>
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/orders">Đơn của tôi</a></li>
                    ${isAdmin ? '<li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/admin/users">Quản lý users</a></li>' : ''}
                    ${isAdmin ? '<li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/admin/products">Quản lý sản phẩm</a></li>' : ''}
                    ${isAdmin ? '<li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/admin/categories">Quản lý danh mục</a></li>' : ''}
                    ${isAdmin ? '<li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="/admin/orders">Quản lý đơn hàng</a></li>' : ''}
                    <li class="nav-item w-100 w-lg-auto"><a class="nav-link" href="#" onclick="logout(event)">Đăng xuất</a></li>
                </ul>
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
