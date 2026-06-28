const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const INVENTORY_SERVICE_URL = window.APP_CONFIG?.INVENTORY_SERVICE_URL || "";

const productsContainer = document.getElementById("products-container");

let allProducts = [];
let currentCategory = "all";
let currentSort = "default";

loadProducts();

async function loadProducts() {
    showProductsStatus("loading", "⏳", "Đang tải sản phẩm...");

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải danh sách sản phẩm");
        }

        const products = data.products || [];

        if (products.length === 0) {
            showProductsStatus("empty", "🛍️", "Chưa có sản phẩm nào.");
            return;
        }

        const productIds = products
            .map(product => product.product_id)
            .filter(Boolean);

        const inventorySummaryMap = await loadInventorySummaries(productIds);

        allProducts = products.map(product => {
            const summary = inventorySummaryMap.get(Number(product.product_id));

            return {
                ...product,
                quantity_available: summary?.quantity_available ?? 0,
                quantity_sold: summary?.quantity_sold ?? 0
            };
        });

        setupFilters(allProducts);
        renderProducts(allProducts);

    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);
        showProductsStatus("error", "⚠️", error.message || "Lỗi không xác định");
    }
}

function showProductsStatus(type, icon, message) {
    const colorMap = { loading: "var(--text-2)", empty: "var(--text-2)", error: "#d70018" };
    productsContainer.innerHTML = `
        <div class="products-status" style="color: ${colorMap[type] || "var(--text-2)"}">
            <span class="status-icon">${icon}</span>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

async function loadInventorySummaries(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return new Map();
    }

    try {
        const response = await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/products/summary`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ productIds })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải tồn kho sản phẩm");
        }

        const summaries = data.summaries || [];
        const summaryMap = new Map();

        for (const summary of summaries) {
            summaryMap.set(Number(summary.product_id), {
                quantity_on_hand: Number(summary.quantity_on_hand) || 0,
                quantity_reserved: Number(summary.quantity_reserved) || 0,
                quantity_available: Number(summary.quantity_available) || 0,
                quantity_sold: Number(summary.quantity_sold) || 0
            });
        }

        return summaryMap;

    } catch (error) {
        console.error("Lỗi tải inventory summary:", error);
        return new Map();
    }
}

function setupFilters(products) {
    const filterBar = document.getElementById("filter-bar");
    const categoryTabs = document.getElementById("category-tabs");
    const sortSelect = document.getElementById("sort-select");

    if (!filterBar || !categoryTabs || !sortSelect) return;

    // Collect unique categories
    const categoriesSet = new Map();
    products.forEach(product => {
        const catName = product.category_name || product.categoryName;
        const catId = product.category_id || product.categoryId;
        if (catName && catId != null) {
            categoriesSet.set(String(catId), catName);
        }
    });

    // Build category tab buttons
    const allTab = `<button class="filter-tab active" data-category="all">Tất cả</button>`;
    const catTabs = Array.from(categoriesSet.entries()).map(([id, name]) =>
        `<button class="filter-tab" data-category="${escapeAttribute(id)}">${escapeHtml(name)}</button>`
    ).join("");

    categoryTabs.innerHTML = allTab + catTabs;

    // Only show filter bar if there are categories
    if (categoriesSet.size > 0) {
        filterBar.style.display = "";
    }

    // Category tab click
    categoryTabs.querySelectorAll(".filter-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            categoryTabs.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentCategory = btn.dataset.category;
            applyFiltersAndRender();
        });
    });

    // Sort change
    sortSelect.addEventListener("change", () => {
        currentSort = sortSelect.value;
        applyFiltersAndRender();
    });
}

function applyFiltersAndRender() {
    let filtered = [...allProducts];

    // Category filter
    if (currentCategory !== "all") {
        filtered = filtered.filter(p => {
            const catId = p.category_id ?? p.categoryId;
            return String(catId) === currentCategory;
        });
    }

    // Sort
    switch (currentSort) {
        case "price-asc":
            filtered.sort((a, b) => Number(a.price) - Number(b.price));
            break;
        case "price-desc":
            filtered.sort((a, b) => Number(b.price) - Number(a.price));
            break;
        case "sold-desc":
            filtered.sort((a, b) => Number(b.quantity_sold || 0) - Number(a.quantity_sold || 0));
            break;
        case "stock-asc":
            filtered.sort((a, b) => Number(a.quantity_available || 0) - Number(b.quantity_available || 0));
            break;
    }

    renderProducts(filtered);
}

function renderProducts(products) {
    if (products.length === 0) {
        showProductsStatus("empty", "🔍", "Không tìm thấy sản phẩm nào.");
        return;
    }

    productsContainer.innerHTML = products
        .map(product => createProductCard(product))
        .join("");
}

function createProductCard(product) {
    const productName = product.product_name || product.productName || "Không có tên";
    const categoryName = product.category_name || product.categoryName || "Chưa phân loại";
    const price = formatPrice(product.price);
    const soldQuantity = product.quantity_sold ?? product.quantitySold ?? 0;
    const availableQuantity = product.quantity_available ?? product.quantityAvailable ?? 0;
    const imageUrl = product.imageUrl || product.image_url || product.image_key;

    const imageHtml = imageUrl
        ? `<img class="product-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}" loading="lazy">`
        : `<span class="no-image">📦 Chưa có ảnh</span>`;

    const inStock = availableQuantity > 0;
    const stockText = inStock ? "Còn hàng" : "Hết hàng";
    const stockClass = inStock ? "in-stock" : "out-of-stock";

    return `
        <div class="col">
            <div class="card product-card border-0 shadow-sm h-100">
                <a href="/products/${escapeAttribute(product.product_id)}" id="product-${escapeAttribute(product.product_id)}">
                    ${imageHtml.replace('class="product-image"', 'class="card-img-top image-first p-3" style="object-fit: cover; height: 250px;"')}
                </a>
                <div class="card-body pt-2 pb-0 position-relative">
                    <span class="badge ${inStock ? 'bg-success' : 'bg-danger'} position-absolute" style="top: -240px; right: 15px;">${stockText}</span>
                </div>
                <div class="product-price px-3 pb-2">
                    <div class="text-muted small mb-1">${escapeHtml(categoryName)}</div>
                    <h5 class="card-title mb-1" style="font-size: 1.1rem; min-height: 2.6rem;">
                        <a href="/products/${escapeAttribute(product.product_id)}" class="text-dark text-decoration-none">
                            ${escapeHtml(productName)}
                        </a>
                    </h5>
                    <div class="mb-2 d-flex align-items-center">
                        <small class="text-warning">
                            <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i>
                        </small>
                        <small class="text-muted ms-2">Đã bán: ${escapeHtml(soldQuantity)}</small>
                    </div>
                    <div class="d-block mb-2">
                        <span class="sell-price fw-bold fs-5 text-success">${price}</span>
                    </div>
                </div>
                <div class="product-footer mt-auto">
                    <a href="/products/${escapeAttribute(product.product_id)}" class="d-block rounded py-2 text-center border mx-3 mb-3 btn-cart text-decoration-none">Xem chi tiết</a>
                </div>
            </div>
        </div>
    `;
}

function formatPrice(value) {
    const number = Number(value);

    if (Number.isNaN(number)) {
        return "Liên hệ";
    }

    return number.toLocaleString("vi-VN", {
        style: "currency",
        currency: "VND"
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

function escapeAttribute(value) {
    return escapeHtml(value);
}