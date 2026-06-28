const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const INVENTORY_SERVICE_URL = window.APP_CONFIG?.INVENTORY_SERVICE_URL || "";

const productsContainer = document.getElementById("products-container");

loadProducts();

async function loadProducts() {
    productsContainer.innerHTML = `
        <div class="loading" style="grid-column: 1 / -1;">
            Đang tải sản phẩm...
        </div>
    `;

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải danh sách sản phẩm");
        }

        const products = data.products || [];

        if (products.length === 0) {
            productsContainer.innerHTML = `
                <div class="empty" style="grid-column: 1 / -1;">
                    Chưa có sản phẩm nào.
                </div>
            `;
            return;
        }

        const productIds = products
            .map(product => product.product_id)
            .filter(Boolean);

        const inventorySummaryMap = await loadInventorySummaries(productIds);

        const mergedProducts = products.map(product => {
            const summary = inventorySummaryMap.get(Number(product.product_id));

            return {
                ...product,
                quantity_available: summary?.quantity_available ?? 0,
                quantity_sold: summary?.quantity_sold ?? 0
            };
        });

        productsContainer.innerHTML = mergedProducts
            .map(product => createProductCard(product))
            .join("");

    } catch (error) {
        console.error("Lỗi tải sản phẩm:", error);

        productsContainer.innerHTML = `
            <div class="error" style="grid-column: 1 / -1;">
                ${escapeHtml(error.message || "Lỗi không xác định")}
            </div>
        `;
    }
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

        // Trang chủ vẫn hiển thị catalog nếu Inventory tạm thời lỗi.
        // Khi đó sản phẩm được xem như chưa có tồn kho khả dụng.
        return new Map();
    }
}

function createProductCard(product) {
    const productName = product.product_name || product.productName || "Không có tên";
    const categoryName = product.category_name || product.categoryName || "Chưa phân loại";
    const price = formatPrice(product.price);
    const soldQuantity = product.quantity_sold ?? product.quantitySold ?? 0;
    const availableQuantity = product.quantity_available ?? product.quantityAvailable ?? 0;
    const imageUrl = product.imageUrl || product.image_url || product.image_key;

    const imageHtml = imageUrl
        ? `<img class="product-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : `<span class="no-image">Không có ảnh</span>`;

    const stockText = availableQuantity > 0
        ? `Còn hàng`
        : `Hết hàng`;

    const stockClass = availableQuantity > 0
        ? "in-stock"
        : "out-of-stock";

    return `
        <a class="product-link" href="/products/${escapeAttribute(product.product_id)}">
            <div class="product-card">
                <div class="product-image-wrap">
                    ${imageHtml}
                </div>

                <div class="product-info">
                    <div class="product-name">${escapeHtml(productName)}</div>
                    <div class="product-category">${escapeHtml(categoryName)}</div>
                    <div class="product-price">${price}</div>

                    <div class="product-meta">
                        <span class="product-sold">Đã bán: ${escapeHtml(soldQuantity)}</span>
                        <span class="product-stock ${stockClass}">${escapeHtml(stockText)}</span>
                    </div>
                </div>
            </div>
        </a>
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