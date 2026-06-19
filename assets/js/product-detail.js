const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const CART_SERVICE_URL = window.APP_CONFIG?.CART_SERVICE_URL || "";

const detailContainer = document.getElementById("product-detail");

loadProductDetail();

function getProductIdFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);

    return parts[1];
}

function getAccessToken() {
    return localStorage.getItem("accessToken");
}

function redirectToLogin() {
    window.location.href = "/login";
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

function showCartMessage(message, type = "success") {
    const messageElement = document.getElementById("cart-message");

    if (!messageElement) {
        return;
    }

    messageElement.className = `cart-message ${type}`;
    messageElement.textContent = message;
}

async function loadProductDetail() {
    const productId = getProductIdFromUrl();

    if (!productId) {
        detailContainer.className = "error";
        detailContainer.innerHTML = `
            Không tìm thấy mã sản phẩm trên URL.
            <br>
            <a class="back-link" href="/">← Quay về trang chủ</a>
        `;
        return;
    }

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải chi tiết sản phẩm.");
        }

        renderProductDetail(data.product);

    } catch (error) {
        console.error("Lỗi tải chi tiết sản phẩm:", error);

        detailContainer.className = "error";
        detailContainer.innerHTML = `
            ${escapeHtml(error.message || "Không thể tải chi tiết sản phẩm.")}
            <br>
            <a class="back-link" href="/">← Quay về trang chủ</a>
        `;
    }
}

function renderProductDetail(product) {
    const stockQuantity = Number(product.stock_quantity || 0);
    const isOutOfStock = stockQuantity <= 0;

    const imageHtml = product.imageUrl
        ? `<img class="product-image" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.product_name)}">`
        : `<span class="no-image">Không có ảnh</span>`;

    detailContainer.className = "detail-card";

    detailContainer.innerHTML = `
        <div class="product-image-wrap">
            ${imageHtml}
        </div>

        <div>
            <div class="product-name">
                ${escapeHtml(product.product_name)}
            </div>

            <div class="product-category">
                ${escapeHtml(product.category_name || "Chưa phân loại")}
            </div>

            <div class="product-description">
                ${escapeHtml(product.description || "Chưa có mô tả cho sản phẩm này.")}
            </div>

            <div class="product-price">
                ${formatPrice(product.price)}
            </div>

            <div class="product-meta">
                <strong>Đã bán:</strong>
                ${escapeHtml(product.sold_quantity ?? 0)}
            </div>

            <div class="product-meta">
                <strong>Còn lại:</strong>
                ${escapeHtml(product.stock_quantity ?? 0)}
            </div>

            <div class="action-area">
                <div class="quantity-row">
                    <label for="cart-quantity">Số lượng:</label>

                    <input
                        id="cart-quantity"
                        class="quantity-input"
                        type="number"
                        min="1"
                        max="${escapeAttribute(stockQuantity)}"
                        value="${isOutOfStock ? 0 : 1}"
                        ${isOutOfStock ? "disabled" : ""}
                    >
                </div>

                <div class="product-action-buttons">
                    <button
                        id="add-to-cart-btn"
                        class="add-to-cart-btn"
                        ${isOutOfStock ? "disabled" : ""}
                    >
                        ${isOutOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
                    </button>

                    <button
                        id="buy-now-btn"
                        class="buy-now-btn"
                        ${isOutOfStock ? "disabled" : ""}
                    >
                        Mua ngay
                    </button>
                </div>

                <div id="cart-message" class="cart-message"></div>
            </div>
        </div>
    `;

    const addToCartButton = document.getElementById("add-to-cart-btn");
    const buyNowButton = document.getElementById("buy-now-btn");

    if (addToCartButton && !isOutOfStock) {
        addToCartButton.addEventListener("click", () => {
            addToCart(product.product_id);
        });
    }

        if (buyNowButton && !isOutOfStock) {
        buyNowButton.addEventListener("click", () => {
            buyNow(product.product_id);
        });
    }

}

async function addToCart(productId) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        redirectToLogin();
        return;
    }

    const addButton = document.getElementById("add-to-cart-btn");
    const quantity = getValidSelectedQuantity();

    if (!quantity) {
        return;
    }

    try {
        addButton.disabled = true;
        addButton.textContent = "Đang thêm...";

        const response = await fetch(`${CART_SERVICE_URL}/api/cart/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                productId: Number(productId),
                quantity
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem("accessToken");
            redirectToLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || "Không thể thêm sản phẩm vào giỏ hàng.");
        }

        showCartMessage("Đã thêm sản phẩm vào giỏ hàng!", "success");

    } catch (error) {
        console.error("Lỗi thêm vào giỏ hàng:", error);

        showCartMessage(
            error.message || "Không thể thêm sản phẩm vào giỏ hàng.",
            "error"
        );

    } finally {
        addButton.disabled = false;
        addButton.textContent = "Thêm vào giỏ hàng";
    }

    function getValidSelectedQuantity() {
        const quantityInput = document.getElementById("cart-quantity");

        if (!quantityInput) {
            return null;
        }

        const quantity = Number(quantityInput.value);
        const maxQuantity = Number(quantityInput.max);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            showCartMessage("Số lượng phải là số nguyên lớn hơn 0.", "error");
            return null;
        }

        if (quantity > maxQuantity) {
            showCartMessage("Số lượng không được vượt quá tồn kho.", "error");
            return null;
        }

        return quantity;
    }

    function buyNow(productId) {
        const accessToken = getAccessToken();

        if (!accessToken) {
            redirectToLogin();
            return;
        }

        const quantity = getValidSelectedQuantity();

        if (!quantity) {
            return;
        }

        window.location.href = `/confirm-order/buy-now?productId=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(quantity)}`;
    }

}