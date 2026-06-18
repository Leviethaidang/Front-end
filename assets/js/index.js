const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
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

        productsContainer.innerHTML = products
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

function createProductCard(product) {
    const productName = product.product_name || "Không có tên";
    const categoryName = product.category_name || "Chưa phân loại";
    const price = formatPrice(product.price);
    const soldQuantity = product.sold_quantity ?? 0;
    const imageUrl = product.imageUrl;

    const imageHtml = imageUrl
        ? `<img class="product-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : `<span class="no-image">Không có ảnh</span>`;

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
                    <div class="product-sold">Đã bán: ${escapeHtml(soldQuantity)}</div>
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
