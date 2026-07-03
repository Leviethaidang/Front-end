const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const INVENTORY_SERVICE_URL = window.APP_CONFIG?.INVENTORY_SERVICE_URL || "";

const productsContainer = document.getElementById("products-container");

let allProducts = [];
let allCategories = [];
let currentCategory = "all";
let currentPriceRange = "all";
let currentStockStatus = "all";
let currentSort = "default";
let currentSearch = "";
let currentGroup = "";
let currentPage = 1;
const itemsPerPage = 20;

loadProducts();
setupBannerClicks();

function setupBannerClicks() {
    document.querySelectorAll('.banner-slide').forEach(slide => {
        slide.addEventListener('click', () => {
            const filter = slide.dataset.filter;
            const productSection = document.querySelector('.product');

            if (filter === 'sale') {
                // Sale banner: just scroll down to products, no filter
                if (productSection) {
                    productSection.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }

            // Just scroll, or navigate? Let's just scroll since we removed the filters
            currentPage = 1;
            currentCategory = "all";

            applyFiltersAndRender();

            // Scroll to product section
            if (productSection) {
                setTimeout(() => {
                    productSection.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        });
    });
}

async function loadProducts() {
    showProductsStatus("loading", "⏳", "Đang tải sản phẩm...");

    try {
        // Fetch products and categories concurrently
        const [prodRes, catRes] = await Promise.all([
            fetch(`${PRODUCT_SERVICE_URL}/api/products`),
            fetch(`${PRODUCT_SERVICE_URL}/api/categories`)
        ]);

        if (!prodRes.ok) {
            throw new Error(`HTTP error! status: ${prodRes.status}`);
        }
        
        const data = await prodRes.json();
        allProducts = data.products || [];
        
        if (catRes.ok) {
            const catData = await catRes.json();
            allCategories = catData.categories || [];
        }

        if (allProducts.length === 0) {
            showProductsStatus("empty", "🛍️", "Chưa có sản phẩm nào.");
            return;
        }

        const productIds = allProducts
            .map(product => product.product_id)
            .filter(Boolean);

        const inventorySummaryMap = await loadInventorySummaries(productIds);

        allProducts = allProducts.map(product => {
            const summary = inventorySummaryMap.get(Number(product.product_id));

            return {
                ...product,
                quantity_available: summary?.quantity_available ?? 0,
                quantity_sold: summary?.quantity_sold ?? 0
            };
        });

        setupFilters(allProducts);
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        const groupParam = urlParams.get('group');
        
        if (searchParam) {
            currentSearch = searchParam.trim().toLowerCase();
            
            setTimeout(() => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput) searchInput.value = searchParam;
                
                const searchInputMobile = document.getElementById('searchInputMobile');
                if (searchInputMobile) searchInputMobile.value = searchParam;
            }, 500);
            
            const productSection = document.querySelector('.product');
            if(productSection) productSection.scrollIntoView({ behavior: 'smooth' });
        } else if (groupParam) {
            currentGroup = groupParam.trim().toLowerCase();
            const productSection = document.querySelector('.product');
            if(productSection) productSection.scrollIntoView({ behavior: 'smooth' });
        }
        
        applyFiltersAndRender();

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
    const sortSelect = document.getElementById("sort-select");

    if (!sortSelect) return;

    // Populate category filter
    const catSelect = document.getElementById("category-filter-select");
    if (catSelect) {
        const categories = new Map();
        products.forEach(p => {
            const catId = p.category_id ?? p.categoryId;
            const catName = p.category_name || p.categoryName || "Khác";
            if (catId) categories.set(catId, catName);
        });
        
        let optionsHtml = '<option value="all">Tất cả danh mục</option>';
        categories.forEach((name, id) => {
            optionsHtml += `<option value="${escapeAttribute(id)}">${escapeHtml(name)}</option>`;
        });
        catSelect.innerHTML = optionsHtml;
        
        // Ensure currentCategory matches the select if we came from URL
        if (currentCategory !== "all") {
            catSelect.value = currentCategory;
        }
        
        // Update nice-select UI if plugin is loaded
        if (window.jQuery && window.jQuery().niceSelect) {
            window.jQuery(catSelect).niceSelect('update');
        }
    }

    // Reset Filters click
    const btnResetFilters = document.getElementById("btn-reset-filters");
    if (btnResetFilters) {
        btnResetFilters.addEventListener("click", () => {
            currentCategory = "all";
            currentPriceRange = "all";
            currentStockStatus = "all";
            currentSort = "default";
            currentSearch = "";
            currentGroup = "";
            currentPage = 1;
            
            const url = new URL(window.location);
            url.searchParams.delete('categoryId');
            url.searchParams.delete('search');
            url.searchParams.delete('group');
            window.history.pushState({}, '', url);

            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = "";
            const searchInputMobile = document.getElementById('searchInputMobile');
            if (searchInputMobile) searchInputMobile.value = "";

            const selects = ["price-select", "stock-select", "category-filter-select", "sort-select"];
            selects.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = (id === "sort-select") ? "default" : "all";
                    if (window.jQuery && window.jQuery().niceSelect) {
                        window.jQuery(el).niceSelect('update');
                    }
                }
            });

            applyFiltersAndRender();
        });
    }

    // Apply Filter click
    const btnApplyFilter = document.getElementById("btn-apply-filter");
    if (btnApplyFilter) {
        btnApplyFilter.addEventListener("click", () => {
            const priceSelect = document.getElementById("price-select");
            const stockSelect = document.getElementById("stock-select");
            const categorySelect = document.getElementById("category-filter-select");
            
            if (priceSelect) {
                currentPriceRange = priceSelect.value;
                if (stockSelect) currentStockStatus = stockSelect.value;
                
                if (categorySelect && categorySelect.value !== currentCategory) {
                    currentCategory = categorySelect.value;
                    const url = new URL(window.location);
                    if (currentCategory !== "all") {
                        url.searchParams.set('categoryId', currentCategory);
                    } else {
                        url.searchParams.delete('categoryId');
                    }
                    window.history.pushState({}, '', url);
                }
                
                currentPage = 1;
                applyFiltersAndRender();
            }
        });
    }

    // Sort change
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            currentSort = sortSelect.value;
            currentPage = 1;
            applyFiltersAndRender();
        });
    }

    // Back button
    const btnBackHome = document.getElementById("btn-back-home");
    if (btnBackHome) {
        btnBackHome.addEventListener("click", () => {
            currentCategory = "all";
            currentPage = 1;
            // Remove categoryId from URL without reloading the page
            const url = new URL(window.location);
            url.searchParams.delete('categoryId');
            window.history.pushState({}, '', url);
            applyFiltersAndRender();
        });
    }

    // Check URL for categoryId
    const urlParams = new URLSearchParams(window.location.search);
    const categoryId = urlParams.get('categoryId');
    if (categoryId) {
        currentCategory = categoryId;
        // Scroll to product section smoothly
        const productSection = document.querySelector('.product');
        if(productSection) productSection.scrollIntoView({ behavior: 'smooth' });
        applyFiltersAndRender();
    }
}

function applyFiltersAndRender() {
    const mainTitle = document.getElementById("main-title");
    const clearFilterContainer = document.getElementById("clear-filter-container");
    const sortContainer = document.getElementById("sort-container");
    const btnBackHome = document.getElementById("btn-back-home");

    if (currentCategory === "all") {
        // --- Grouped Home View (Canifa Style) ---
        if (sortContainer) sortContainer.style.setProperty("display", "none", "important");
        if (btnBackHome) btnBackHome.style.setProperty("display", "none", "important");
        
        // Ensure category select says "all"
        const categorySelect = document.getElementById("category-filter-select");
        if (categorySelect) {
            categorySelect.value = "all";
            if (window.jQuery && window.jQuery().niceSelect) {
                window.jQuery(categorySelect).niceSelect('update');
            }
        }

        let productsToShow = [...allProducts];

        // Apply Price, Stock, Sales filter
        productsToShow = applyPriceFilter(productsToShow, currentPriceRange);
        productsToShow = applyOtherFilters(productsToShow);

        if (mainTitle) {
            if (currentSearch) {
                mainTitle.style.display = "block";
                mainTitle.innerHTML = `KẾT QUẢ TÌM KIẾM CHO "${escapeHtml(currentSearch)}"`;
            } else if (currentGroup) {
                mainTitle.style.display = "block";
                mainTitle.innerHTML = `DANH MỤC: ${escapeHtml(currentGroup).toUpperCase()}`;
            } else {
                mainTitle.style.display = "none";
            }
        }
        if (clearFilterContainer) clearFilterContainer.innerHTML = "";

        // Group products by category
        const groups = new Map();
        productsToShow.forEach(p => {
            const catId = p.category_id ?? p.categoryId;
            const catName = p.category_name || p.categoryName || "Khác";
            if (!groups.has(catId)) {
                groups.set(catId, { id: catId, name: catName, products: [] });
            }
            groups.get(catId).products.push(p);
        });

        renderGroupedProducts(Array.from(groups.values()));
    } else {
        // --- Single Category List View ---
        if (clearFilterContainer) clearFilterContainer.innerHTML = "";
        if (mainTitle) mainTitle.style.display = "block";
        if (sortContainer) sortContainer.style.setProperty("display", "flex", "important");
        if (btnBackHome) btnBackHome.style.setProperty("display", "block", "important");
        
        // Update category select to match current Category
        const categorySelect = document.getElementById("category-filter-select");
        if (categorySelect) {
            categorySelect.value = currentCategory;
            if (window.jQuery && window.jQuery().niceSelect) {
                window.jQuery(categorySelect).niceSelect('update');
            }
        }

        let filtered = [...allProducts];

        // Category filter
        if (currentCategory !== "all") {
            const targetCategoryIds = [String(currentCategory)];

            filtered = filtered.filter(p => {
                const catId = p.category_id ?? p.categoryId;
                return targetCategoryIds.includes(String(catId));
            });
        }

        // Price, Stock, Sales filters
        filtered = applyPriceFilter(filtered, currentPriceRange);
        filtered = applyOtherFilters(filtered);

        let actualCatName = "SẢN PHẨM";
        if (currentCategory !== "all" && allCategories.length > 0) {
            const catObj = allCategories.find(c => String(c.category_id) === String(currentCategory));
            if (catObj) actualCatName = catObj.category_name;
        } else if (filtered.length > 0) {
            actualCatName = filtered[0].category_name || filtered[0].categoryName || "SẢN PHẨM";
        }

        // Set Main Title
        if (currentSearch) {
            mainTitle.innerHTML = `<span style="color: #8B5E3C; font-weight: 800; border-bottom: 3px solid #8B5E3C; padding-bottom: 5px; text-transform: uppercase; display: inline-block;">KẾT QUẢ TÌM KIẾM CHO "${escapeHtml(currentSearch)}"</span>`;
            mainTitle.style.display = "block";
        } else {
            mainTitle.innerHTML = `<span style="color: #8B5E3C; font-weight: 800; border-bottom: 3px solid #8B5E3C; padding-bottom: 5px; text-transform: uppercase; display: inline-block;">${escapeHtml(actualCatName)}</span>`;
            mainTitle.style.display = "block";
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

        // Render as flat list
        if (sortContainer) sortContainer.style.setProperty("display", "flex", "important");
        if (btnBackHome) btnBackHome.style.setProperty("display", "inline-block", "important");

        // Pagination logic
        const totalItems = filtered.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = filtered.slice(startIndex, endIndex);

        renderProductsList(paginatedItems, totalPages, currentPage);
    }
}

function getCategorySubtitle(categoryName) {
    const nameStr = categoryName.toLowerCase();
    if (nameStr.includes("áo thun")) {
        return "Năng động, trẻ trung và thoải mái cho mọi hoạt động hàng ngày.";
    } else if (nameStr.includes("áo sơ mi")) {
        return "Thanh lịch, trang nhã và chuyên nghiệp cho môi trường công sở.";
    } else if (nameStr.includes("áo khoác")) {
        return "Bảo vệ bạn khỏi thời tiết nhưng vẫn giữ nét thời thượng, phong cách.";
    } else if (nameStr.includes("quần") || nameStr.includes("jean")) {
        return "Dễ dàng phối đồ, tôn dáng và mang lại sự tự tin trên từng bước đi.";
    } else if (nameStr.includes("váy") || nameStr.includes("đầm")) {
        return "Ngọt ngào, nữ tính và cuốn hút ánh nhìn trong mọi sự kiện.";
    } else if (nameStr.includes("phụ kiện")) {
        return "Những điểm nhấn tinh tế giúp hoàn thiện bộ trang phục của bạn hoàn hảo.";
    } else {
        const defaultSubtitles = [
            `Khám phá bộ sưu tập ${nameStr} mới nhất của chúng tôi.`,
            `Làm mới phong cách của bạn với những thiết kế ${nameStr} nổi bật.`,
            `Bộ sưu tập ${nameStr} mang đậm dấu ấn xu hướng thời trang năm nay.`,
            `Thể hiện cá tính riêng cùng những mẫu ${nameStr} được yêu thích nhất.`
        ];
        const index = categoryName.length % defaultSubtitles.length;
        return defaultSubtitles[index];
    }
}

function renderGroupedProducts(groups) {
    if (groups.length === 0) {
        showProductsStatus("empty", "🔍", "Chưa có sản phẩm nào.");
        return;
    }

    let html = "";
    groups.forEach(group => {
        if (group.products.length === 0) return;
        
        // Take up to 4 newest products
        const topProducts = group.products.slice(0, 4);
        const subtitle = getCategorySubtitle(group.name);
        
        html += `
            <section class="category-section mb-5 reveal-on-scroll" style="background: #fff; border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.06); padding: 30px; border: 1px solid #eee; position: relative;">
                <div class="category-header d-flex justify-content-between align-items-end mb-4 sticky-top" style="top: 80px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); z-index: 10; margin: -30px -30px 25px -30px; padding: 25px 30px 15px 30px; border-bottom: 1px solid #f0f0f0;">
                    <div class="text-center text-md-start w-100">
                        <h2 class="fw-bold m-0" style="color: #8B5E3C; letter-spacing: 2px; font-size: 1.5rem;">${escapeHtml(group.name).toUpperCase()}</h2>
                        <p class="text-muted small mt-2 mb-0">${escapeHtml(subtitle)}</p>
                    </div>
                    <a href="/index.html?categoryId=${escapeAttribute(group.id)}" class="btn btn-sm d-none d-md-inline-block text-nowrap px-4 ms-3 fw-bold shadow-sm" style="background: #8B5E3C; color: #fff; border-radius: 20px; transition: 0.3s; opacity: 0.9;">
                        Xem tất cả <i class="bi bi-arrow-right"></i>
                    </a>
                </div>
                <div class="row g-4 row-cols-xl-4 row-cols-lg-3 row-cols-2 row-cols-sm-2 row-cols-md-2" style="position: relative; z-index: 1;">
                    ${topProducts.map(p => createProductCard(p)).join("")}
                </div>
                <div class="text-center mt-4 d-md-none">
                     <a href="/index.html?categoryId=${escapeAttribute(group.id)}" class="btn w-100 fw-bold shadow-sm" style="background: #8B5E3C; color: #fff; border-radius: 20px;">
                        Xem tất cả
                     </a>
                </div>
            </section>
        `;
    });

    productsContainer.innerHTML = html;

    // Inject animation CSS if not present
    if (!document.getElementById('reveal-css')) {
        const style = document.createElement('style');
        style.id = 'reveal-css';
        style.innerHTML = `
            .reveal-on-scroll {
                opacity: 0;
                transform: translateY(40px);
                transition: all 0.7s cubic-bezier(0.1, 0, 0.1, 1);
            }
            .reveal-on-scroll.revealed {
                opacity: 1;
                transform: translateY(0);
            }
            /* Add hover effect to the Xem tất cả button */
            .category-header .btn:hover {
                opacity: 1 !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(139, 94, 60, 0.3) !important;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Setup intersection observer for scroll animations
    setTimeout(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    // Optional: observer.unobserve(entry.target); 
                }
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });
        
        document.querySelectorAll('.reveal-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }, 100);
}

function renderProductsList(products, totalPages = 1, current = 1) {
    if (products.length === 0) {
        showProductsStatus("empty", "🔍", "Không tìm thấy sản phẩm nào.");
        return;
    }

    let html = `
        <div class="row g-4 row-cols-xl-4 row-cols-lg-3 row-cols-2 row-cols-sm-2 row-cols-md-2">
            ${products.map(product => createProductCard(product)).join("")}
        </div>
    `;

    // Add Pagination HTML if totalPages > 1
    if (totalPages > 1) {
        html += `
            <nav aria-label="Page navigation" class="mt-5">
                <ul class="pagination justify-content-center custom-pagination">
                    <li class="page-item ${current === 1 ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changePage(${current - 1}); return false;" aria-label="Previous">
                            <span aria-hidden="true">&laquo; Trang trước</span>
                        </a>
                    </li>
        `;

        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            // Simple logic: show all pages (or logic could be added to truncate if many pages)
            html += `
                <li class="page-item ${current === i ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="changePage(${i}); return false;">${i}</a>
                </li>
            `;
        }

        html += `
                    <li class="page-item ${current === totalPages ? 'disabled' : ''}">
                        <a class="page-link" href="#" onclick="changePage(${current + 1}); return false;" aria-label="Next">
                            <span aria-hidden="true">Trang sau &raquo;</span>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
    }

    productsContainer.innerHTML = html;
}

// Global function for pagination click
window.changePage = function(pageNumber) {
    currentPage = pageNumber;
    applyFiltersAndRender();
    // Scroll smoothly to top of products list
    const productSection = document.querySelector('.product');
    if(productSection) productSection.scrollIntoView({ behavior: 'smooth' });
};

function applyPriceFilter(products, priceRange) {
    if (priceRange === "all") return products;
    
    return products.filter(p => {
        const price = Number(p.price) || 0;
        switch (priceRange) {
            case "under-200":
                return price < 200000;
            case "200-500":
                return price >= 200000 && price <= 500000;
            case "500-1000":
                return price > 500000 && price <= 1000000;
            case "over-1000":
                return price > 1000000;
            default:
                return true;
        }
    });
}

function applyOtherFilters(products) {
    return products.filter(p => {
        const availableQty = p.quantity_available || 0;
        
        // Search filter
        if (currentSearch) {
            const name = (p.product_name || p.productName || "").toLowerCase();
            if (!name.includes(currentSearch)) return false;
        }
        
        // Group filter
        if (currentGroup) {
            const catName = (p.category_name || p.categoryName || "").toLowerCase();
            if (currentGroup === "phụ kiện") {
                if (catName.includes("áo") || catName.includes("quần") || catName.includes("giày") || catName.includes("dép")) return false;
            } else {
                if (!catName.includes(currentGroup)) return false;
            }
        }
        
        // Stock status
        if (currentStockStatus === "in-stock" && availableQty <= 0) return false;
        if (currentStockStatus === "out-of-stock" && availableQty > 0) return false;
        
        return true;
    });
}

function createProductCard(product) {
    const productName = product.product_name || product.productName || "Không có tên";
    const categoryName = product.category_name || product.categoryName || "";
    const price = formatPrice(product.price);
    const soldQuantity = product.quantity_sold ?? product.quantitySold ?? 0;
    const availableQuantity = product.quantity_available ?? product.quantityAvailable ?? 0;
    const imageUrl = product.imageUrl || product.image_url || product.image_key;

    // Use empty string instead of loading style since we handle CSS globally
    const imageHtml = imageUrl
        ? `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}" loading="lazy">`
        : `<span class="no-image w-100">📦 Chưa có ảnh</span>`;

    const inStock = availableQuantity > 0;
    const stockText = inStock ? "Còn hàng" : "Hết hàng";
    const stockClass = inStock ? "bg-dark" : "bg-danger";

    return `
        <div class="col mb-4">
            <div class="card product-card h-100">
                <div class="product-image-wrapper">
                    <span class="badge stock-badge ${stockClass}">${stockText}</span>
                    <a href="/products/${escapeAttribute(product.product_id)}" id="product-${escapeAttribute(product.product_id)}" class="d-block">
                        ${imageHtml}
                    </a>
                    <a href="/products/${escapeAttribute(product.product_id)}" class="btn-cart-overlay">
                        XEM CHI TIẾT
                    </a>
                </div>
                <div class="card-body p-0 pt-2">
                    <div class="text-muted small mb-1 fw-medium">${escapeHtml(categoryName)} </div>
                    <h5 class="card-title mb-2">
                        <a href="/products/${escapeAttribute(product.product_id)}" class="text-decoration-none">
                            ${escapeHtml(productName)}
                        </a>
                    </h5>
                    <div class="d-flex align-items-center justify-content-between">
                        <span class="sell-price">${price}</span>
                        ${soldQuantity > 0 ? `<small class="text-muted">Đã bán ${soldQuantity}</small>` : ''}
                    </div>
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