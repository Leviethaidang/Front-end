function findNavbarStylesheet(href) {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .find(link => {
            const currentHref = link.getAttribute("href") || "";
            return currentHref === href || currentHref.endsWith(href);
        });
}

function ensureNavbarStylesheet(id, href, beforeElement = null) {
    const existingById = document.getElementById(id);
    const existingByHref = findNavbarStylesheet(href);
    const existing = existingById || existingByHref;

    if (existing) {
        existing.id = existing.id || id;
        return existing;
    }

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;

    if (beforeElement && beforeElement.parentNode) {
        beforeElement.parentNode.insertBefore(link, beforeElement);
    } else {
        document.head.appendChild(link);
    }

    return link;
}

function ensureNavbarScript(id, src) {
    if (window.bootstrap || document.getElementById(id)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.id = id;
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

async function ensureNavbarAssets() {
    const navbarCss = findNavbarStylesheet("/assets/css/navbar.css");

    ensureNavbarStylesheet("hashop-bootstrap-css", "/assets/css/bootstrap.min.css", navbarCss);
    ensureNavbarStylesheet("hashop-bootstrap-icons-css", "/assets/font/bootstrap-icons-1.11.3/font/bootstrap-icons.min.css", navbarCss);
    ensureNavbarStylesheet("hashop-navbar-css", "/assets/css/navbar.css");

    await ensureNavbarScript("hashop-bootstrap-js", "/assets/js/bootstrap.bundle.min.js");
}

async function loadNavbar() {
    const placeholder = document.getElementById("navbar-placeholder");

    if (!placeholder) {
        return;
    }

    try {
        await ensureNavbarAssets();

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
        loadAndRenderCategories();
        setupSearch();

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
                <div class="list-inline-item me-4">
                    <a class="text-muted position-relative" href="/cart" title="Giỏ hàng">
                        <i class="bi bi-cart"></i>
                    </a>
                </div>
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

    setupAuthDropdownFallback();
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

function setupAuthDropdownFallback() {
    if (window.bootstrap?.Dropdown) {
        return;
    }

    const toggles = document.querySelectorAll('.navigation [data-bs-toggle="dropdown"]');

    toggles.forEach(toggle => {
        if (toggle.dataset.hashopDropdownBound === "true") {
            return;
        }

        toggle.dataset.hashopDropdownBound = "true";
        toggle.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            const menu = toggle.parentElement?.querySelector(".dropdown-menu");
            if (!menu) {
                return;
            }

            const isOpen = menu.classList.toggle("show");
            toggle.setAttribute("aria-expanded", String(isOpen));
        });
    });

    if (document.body.dataset.hashopDropdownCloseBound === "true") {
        return;
    }

    document.body.dataset.hashopDropdownCloseBound = "true";
    document.addEventListener("click", () => {
        document.querySelectorAll(".navigation .dropdown-menu.show").forEach(menu => {
            menu.classList.remove("show");
        });

        document.querySelectorAll('.navigation [data-bs-toggle="dropdown"][aria-expanded="true"]').forEach(toggle => {
            toggle.setAttribute("aria-expanded", "false");
        });
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

async function loadAndRenderCategories() {
    const container = document.getElementById('dynamic-category-menu');
    if (!container) return;

    if (!document.getElementById('navbar-custom-css')) {
        const style = document.createElement('style');
        style.id = 'navbar-custom-css';
        style.innerHTML = `
            .category-item .category-link:hover {
                background-color: #FAF6F1 !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 10px rgba(139, 94, 60, 0.08);
                color: #8B5E3C !important;
            }
        `;
        document.head.appendChild(style);
    }

    const fixedGroups = [
        { name: "Áo", icon: "bi-stars text-warning", group: "áo" },
        { name: "Quần", icon: "bi-layers text-primary", group: "quần" },
        { name: "Giày dép", icon: "bi-bag text-info", group: "giày" },
        { name: "Phụ kiện", icon: "bi-smartwatch text-dark", group: "phụ kiện" }
    ];

    let html = '';

    fixedGroups.forEach((cat) => {
        html += `
            <li class="nav-item category-item w-100 w-lg-auto me-3">
                <a class="nav-link category-link d-flex align-items-center fw-medium" href="/index.html?group=${encodeURIComponent(cat.group)}" style="transition: 0.3s; padding: 10px 15px; border-radius: 8px;">
                    <i class="bi ${cat.icon} me-2" style="font-size: 1.1rem;"></i> 
                    ${escapeHtml(cat.name)}
                </a>
            </li>
        `;
    });

    container.innerHTML = html;
}

// ==========================
// SEARCH FUNCTIONALITY
// ==========================
let navbarProductsCache = null;

async function fetchProductsForSearch() {
    if (navbarProductsCache) return navbarProductsCache;
    try {
        const url = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
        const res = await fetch(`${url}/api/products`);
        if (!res.ok) return [];
        const data = await res.json();
        navbarProductsCache = data.products || [];
        return navbarProductsCache;
    } catch (e) {
        console.error("Lỗi fetch search products:", e);
        return [];
    }
}

function setupSearch() {
    const searchInputs = [
        { 
            input: document.getElementById('searchInput'), 
            btn: document.getElementById('btnSearch'), 
            dropdown: document.getElementById('search-suggestions') 
        },
        { 
            input: document.getElementById('searchInputMobile'), 
            btn: document.getElementById('btnSearchMobile'), 
            dropdown: document.getElementById('search-suggestions-mobile') 
        }
    ];
    
    searchInputs.forEach(({input, btn, dropdown}) => {
        if (!input || !dropdown) return;
        
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim().toLowerCase();
            
            if (query.length === 0) {
                dropdown.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(async () => {
                const products = await fetchProductsForSearch();
                const matched = products.filter(p => {
                    const name = (p.product_name || p.productName || "").toLowerCase();
                    return name.includes(query);
                });
                
                renderSuggestions(matched, dropdown, input);
            }, 300);
        });
        
        const executeSearch = () => {
            const query = input.value.trim();
            if (query) {
                // Navigate to index.html with search query
                window.location.href = `/?search=${encodeURIComponent(query)}`;
            }
        };
        
        if (btn) btn.addEventListener('click', executeSearch);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch();
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    });
}

function renderSuggestions(products, dropdown, inputElement) {
    if (products.length === 0) {
        dropdown.innerHTML = `
            <div class="p-3 text-center text-muted">
                <p class="mb-0 small">Không tìm thấy sản phẩm đúng ý bạn, hãy xem thêm các sản phẩm ở bên dưới.</p>
            </div>
        `;
        dropdown.style.display = 'block';
        return;
    }
    
    const maxItems = 5;
    const sliced = products.slice(0, maxItems);
    
    let html = '';
    sliced.forEach(p => {
        const id = p.product_id;
        const name = p.product_name || p.productName || "Không có tên";
        const price = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price || 0);
        const imageUrl = p.imageUrl || p.image_url || p.image_key;
        
        // Use escapeHtml from common.js if available, otherwise just use the raw string (assuming trusted DB data for names)
        const safeName = typeof escapeHtml === 'function' ? escapeHtml(name) : name;
        
        const imgHtml = imageUrl 
            ? `<img src="${imageUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" class="me-3">` 
            : `<div class="bg-light me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px; border-radius: 4px;"><i class="bi bi-image text-muted"></i></div>`;
        
        html += `
            <a href="/products/${id}" class="dropdown-item d-flex align-items-center py-2 border-bottom text-wrap" style="white-space: normal; padding-left: 10px; padding-right: 10px;">
                ${imgHtml}
                <div>
                    <div class="fw-bold fs-6 text-dark" style="line-height: 1.2;">${safeName}</div>
                    <div class="text-danger fw-bold mt-1" style="font-size: 0.9rem;">${price}</div>
                </div>
            </a>
        `;
    });
    
    if (products.length > maxItems) {
        html += `
            <div class="p-2 text-center bg-light">
                <button type="button" class="btn btn-link text-primary p-0 text-decoration-none fw-bold" onclick="event.preventDefault(); document.getElementById('${inputElement.id}').nextElementSibling.click();">
                    Xem tất cả ${products.length} kết quả...
                </button>
            </div>
        `;
    }
    
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}
