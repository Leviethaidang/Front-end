const CART_SERVICE_URL = window.APP_CONFIG?.CART_SERVICE_URL || "";

const cartContent = document.getElementById("cart-content");
const messageBox = document.getElementById("message");

loadCart();

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

function showMessage(message, type = "success") {
    messageBox.className = `message ${type}`;
    messageBox.textContent = message;

    setTimeout(() => {
        messageBox.className = "message";
        messageBox.textContent = "";
    }, 2500);
}

async function fetchWithAuth(url, options = {}) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        redirectToLogin();
        return null;
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            ...(options.headers || {})
        }
    });

    if (response.status === 401) {
        localStorage.removeItem("accessToken");
        redirectToLogin();
        return null;
    }

    return response;
}

async function loadCart() {
    try {
        const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart`);

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải giỏ hàng.");
        }

        renderCart(data.cart);

    } catch (error) {
        console.error("Lỗi tải giỏ hàng:", error);

        cartContent.className = "error";
        cartContent.textContent = error.message || "Không thể tải giỏ hàng.";
    }
}

function isInvalidCartItem(item) {
    if (item.productDeleted || !item.product) {
        return true;
    }

    if (item.variantDeleted || !item.variant) {
        return true;
    }

    const quantity = Number(item.quantity || 0);
    const stockQuantity = Number(item.variant.stockQuantity || 0);

    if (stockQuantity <= 0) {
        return true;
    }

    if (quantity > stockQuantity) {
        return true;
    }

    return false;
}

function renderCart(cart) {
    const items = cart.items || [];

    if (items.length === 0) {
        cartContent.className = "empty-cart";
        cartContent.innerHTML = `
            <p>Giỏ hàng của bạn đang trống.</p>
            <p><a href="/">Tiếp tục mua sắm</a></p>
        `;
        return;
    }

    const itemsHtml = items
        .map(item => renderCartItem(item))
        .join("");

    const hasInvalidItem = items.some(item => isInvalidCartItem(item));

    cartContent.className = "cart-layout";
    cartContent.innerHTML = `
        <div class="cart-list">
            ${itemsHtml}
        </div>

        <div class="cart-summary">
            <div class="summary-title">Tóm tắt đơn hàng</div>

            <div class="summary-row">
                <span>Tổng số lượng hợp lệ</span>
                <strong>${escapeHtml(cart.totalQuantity || 0)}</strong>
            </div>

            <div class="summary-row summary-total">
                <span>Tổng tiền</span>
                <span>${formatPrice(cart.totalAmount || 0)}</span>
            </div>

            ${hasInvalidItem ? `
                <div class="variant-warning">
                    Có sản phẩm hoặc biến thể không hợp lệ. Vui lòng xóa hoặc điều chỉnh trước khi thanh toán.
                </div>
            ` : ""}

            <button class="checkout-btn" id="go-checkout-btn">
                Thanh toán
            </button>
        </div>
    `;

    bindCartActionButtons();
    bindCheckoutButton(items);
}

function renderDeletedProductItem(item) {
    const cartItemId = Number(item.cartItemId);

    return `
        <div class="cart-item invalid-item">
            <div class="cart-image-wrap">
                Không có ảnh
            </div>

            <div class="cart-info">
                <div class="deleted-product">
                    Sản phẩm này đã bị xóa khỏi hệ thống
                </div>

                <div>Số lượng trong giỏ: ${escapeHtml(item.quantity)}</div>

                <div class="item-actions">
                    <button
                        class="remove-btn remove-item-btn"
                        data-cart-item-id="${escapeAttribute(cartItemId)}"
                    >
                        Xóa khỏi giỏ
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderDeletedVariantItem(item) {
    const product = item.product;
    const cartItemId = Number(item.cartItemId);
    const productId = Number(item.productId);

    const imageHtml = product?.imageUrl
        ? `<img class="cart-image" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.productName)}">`
        : "Không có ảnh";

    return `
        <div class="cart-item invalid-item">
            <div class="cart-image-wrap">
                ${imageHtml}
            </div>

            <div class="cart-info">
                <a class="product-name" href="/products/${escapeAttribute(productId)}">
                    ${escapeHtml(product?.productName || "Sản phẩm")}
                </a>

                <div class="variant-warning">
                    Biến thể size/màu này không còn tồn tại hoặc đã bị ngừng bán.
                </div>

                <div>Số lượng trong giỏ: ${escapeHtml(item.quantity)}</div>

                <div class="item-actions">
                    <button
                        class="remove-btn remove-item-btn"
                        data-cart-item-id="${escapeAttribute(cartItemId)}"
                    >
                        Xóa khỏi giỏ
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCartItem(item) {
    if (item.productDeleted || !item.product) {
        return renderDeletedProductItem(item);
    }

    if (item.variantDeleted || !item.variant) {
        return renderDeletedVariantItem(item);
    }

    const product = item.product;
    const variant = item.variant;

    const cartItemId = Number(item.cartItemId);
    const productId = Number(item.productId);
    const quantity = Number(item.quantity || 1);
    const stockQuantity = Number(variant.stockQuantity || 0);

    const isStockInvalid = stockQuantity <= 0 || quantity > stockQuantity;

    const imageHtml = product.imageUrl
        ? `<img class="cart-image" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.productName)}">`
        : "Không có ảnh";

    const colorDotHtml = variant.colorCode
        ? `<span class="color-dot" style="background: ${escapeAttribute(variant.colorCode)};"></span>`
        : "";

    return `
        <div class="cart-item ${isStockInvalid ? "invalid-item" : ""}">
            <div class="cart-image-wrap">
                ${imageHtml}
            </div>

            <div class="cart-info">
                <a class="product-name" href="/products/${escapeAttribute(productId)}">
                    ${escapeHtml(product.productName)}
                </a>

                <div class="product-category">
                    ${escapeHtml(product.categoryName || "Chưa phân loại")}
                </div>

                <div class="variant-info">
                    <span class="variant-badge">
                        Size: ${escapeHtml(variant.sizeName || "Không rõ")}
                    </span>

                    <span class="variant-badge">
                        ${colorDotHtml}
                        Màu: ${escapeHtml(variant.colorName || "Không rõ")}
                    </span>
                </div>

                <div class="product-price">
                    ${formatPrice(product.price)}
                </div>

                <div class="stock-info ${isStockInvalid ? "warning" : ""}">
                    Còn lại biến thể này: ${escapeHtml(stockQuantity)}
                </div>

                ${quantity > stockQuantity ? `
                    <div class="variant-warning">
                        Số lượng trong giỏ đang vượt quá tồn kho hiện tại.
                    </div>
                ` : ""}

                <div class="item-actions">
                    <div class="quantity-control">
                        <button
                            class="qty-btn decrease-qty-btn"
                            data-cart-item-id="${escapeAttribute(cartItemId)}"
                            data-current-quantity="${escapeAttribute(quantity)}"
                            ${quantity <= 1 ? "disabled" : ""}
                        >
                            −
                        </button>

                        <div class="qty-value">${escapeHtml(quantity)}</div>

                        <button
                            class="qty-btn increase-qty-btn"
                            data-cart-item-id="${escapeAttribute(cartItemId)}"
                            data-current-quantity="${escapeAttribute(quantity)}"
                            data-stock-quantity="${escapeAttribute(stockQuantity)}"
                            ${quantity >= stockQuantity ? "disabled" : ""}
                        >
                            +
                        </button>
                    </div>

                    <button
                        class="remove-btn remove-item-btn"
                        data-cart-item-id="${escapeAttribute(cartItemId)}"
                    >
                        Xóa
                    </button>
                </div>

                <div class="subtotal">
                    Tạm tính: ${formatPrice(item.subtotal || 0)}
                </div>
            </div>
        </div>
    `;
}

function bindCartActionButtons() {
    const increaseButtons = document.querySelectorAll(".increase-qty-btn");
    const decreaseButtons = document.querySelectorAll(".decrease-qty-btn");
    const removeButtons = document.querySelectorAll(".remove-item-btn");

    increaseButtons.forEach(button => {
        button.addEventListener("click", () => {
            increaseQuantity(
                button.dataset.cartItemId,
                button.dataset.currentQuantity,
                button.dataset.stockQuantity
            );
        });
    });

    decreaseButtons.forEach(button => {
        button.addEventListener("click", () => {
            decreaseQuantity(
                button.dataset.cartItemId,
                button.dataset.currentQuantity
            );
        });
    });

    removeButtons.forEach(button => {
        button.addEventListener("click", () => {
            removeItem(button.dataset.cartItemId);
        });
    });
}

async function updateQuantity(cartItemId, quantity) {
    try {
        const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart/items/${cartItemId}`, {
            method: "PUT",
            body: JSON.stringify({
                quantity
            })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể cập nhật số lượng.");
        }

        await loadCart();

    } catch (error) {
        console.error("Lỗi cập nhật số lượng:", error);
        showMessage(error.message || "Không thể cập nhật số lượng.", "error");
    }
}

function increaseQuantity(cartItemId, currentQuantity, stockQuantity) {
    const nextQuantity = Number(currentQuantity) + 1;

    if (nextQuantity > Number(stockQuantity)) {
        showMessage("Số lượng đã đạt tối đa tồn kho của biến thể này.", "error");
        return;
    }

    updateQuantity(cartItemId, nextQuantity);
}

function decreaseQuantity(cartItemId, currentQuantity) {
    const nextQuantity = Number(currentQuantity) - 1;

    if (nextQuantity < 1) {
        showMessage("Số lượng tối thiểu là 1. Bạn có thể bấm Xóa để bỏ sản phẩm.", "error");
        return;
    }

    updateQuantity(cartItemId, nextQuantity);
}

async function removeItem(cartItemId) {
    const confirmed = confirm("Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?");

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart/items/${cartItemId}`, {
            method: "DELETE"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể xóa sản phẩm.");
        }

        showMessage("Đã xóa sản phẩm khỏi giỏ hàng.", "success");

        await loadCart();

    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);
        showMessage(error.message || "Không thể xóa sản phẩm.", "error");
    }
}

function bindCheckoutButton(items) {
    const checkoutButton = document.getElementById("go-checkout-btn");

    if (!checkoutButton) return;

    const hasInvalidItem = items.some(item => isInvalidCartItem(item));

    if (hasInvalidItem) {
        checkoutButton.disabled = true;
        checkoutButton.textContent = "Vui lòng xử lý sản phẩm lỗi trước";
        return;
    }

    checkoutButton.addEventListener("click", () => {
        window.location.href = "/confirm-order/cart";
    });
}