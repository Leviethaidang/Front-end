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

    cartContent.className = "cart-layout";
    cartContent.innerHTML = `
        <div class="cart-list">
            ${itemsHtml}
        </div>

        <div class="cart-summary">
            <div class="summary-title">Tóm tắt đơn hàng</div>

            <div class="summary-row">
                <span>Tổng số lượng</span>
                <strong>${escapeHtml(cart.totalQuantity || 0)}</strong>
            </div>

            <div class="summary-row summary-total">
                <span>Tổng tiền</span>
                <span>${formatPrice(cart.totalAmount || 0)}</span>
            </div>

            <button class="checkout-btn" id="go-checkout-btn">
                Thanh toán
            </button>

            <p class="checkout-note">
                Chức năng thanh toán sẽ làm ở Order Service / Payment Service.
            </p>
        </div>
    `;

    bindCartActionButtons();
    bindCheckoutButton(items);
}

function renderCartItem(item) {
    if (item.productDeleted || !item.product) {
        return `
            <div class="cart-item">
                <div class="cart-image-wrap">
                    Không có ảnh
                </div>

                <div class="cart-info">
                    <div class="deleted-product">Sản phẩm này đã bị xóa khỏi hệ thống</div>

                    <div>Số lượng trong giỏ: ${escapeHtml(item.quantity)}</div>

                    <div class="item-actions">
                        <button
                            class="remove-btn remove-item-btn"
                            data-product-id="${escapeAttribute(item.productId)}"
                        >
                            Xóa khỏi giỏ
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    const product = item.product;
    const stockQuantity = Number(product.stockQuantity || 0);
    const quantity = Number(item.quantity || 1);
    const productId = Number(item.productId);

    const imageHtml = product.imageUrl
        ? `<img class="cart-image" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.productName)}">`
        : "Không có ảnh";

    return `
        <div class="cart-item">
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

                <div class="product-price">
                    ${formatPrice(product.price)}
                </div>

                <div class="stock-info">
                    Còn lại: ${escapeHtml(stockQuantity)}
                </div>

                <div class="item-actions">
                    <div class="quantity-control">
                        <button
                            class="qty-btn decrease-qty-btn"
                            data-product-id="${escapeAttribute(productId)}"
                            data-current-quantity="${escapeAttribute(quantity)}"
                            ${quantity <= 1 ? "disabled" : ""}
                        >
                            −
                        </button>

                        <div class="qty-value">${escapeHtml(quantity)}</div>

                        <button
                            class="qty-btn increase-qty-btn"
                            data-product-id="${escapeAttribute(productId)}"
                            data-current-quantity="${escapeAttribute(quantity)}"
                            data-stock-quantity="${escapeAttribute(stockQuantity)}"
                            ${quantity >= stockQuantity ? "disabled" : ""}
                        >
                            +
                        </button>
                    </div>

                    <button
                        class="remove-btn remove-item-btn"
                        data-product-id="${escapeAttribute(productId)}"
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
                button.dataset.productId,
                button.dataset.currentQuantity,
                button.dataset.stockQuantity
            );
        });
    });

    decreaseButtons.forEach(button => {
        button.addEventListener("click", () => {
            decreaseQuantity(
                button.dataset.productId,
                button.dataset.currentQuantity
            );
        });
    });

    removeButtons.forEach(button => {
        button.addEventListener("click", () => {
            removeItem(button.dataset.productId);
        });
    });
}

async function updateQuantity(productId, quantity) {
    try {
        const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart/items/${productId}`, {
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

function increaseQuantity(productId, currentQuantity, stockQuantity) {
    const nextQuantity = Number(currentQuantity) + 1;

    if (nextQuantity > Number(stockQuantity)) {
        showMessage("Số lượng đã đạt tối đa tồn kho.", "error");
        return;
    }

    updateQuantity(productId, nextQuantity);
}

function decreaseQuantity(productId, currentQuantity) {
    const nextQuantity = Number(currentQuantity) - 1;

    if (nextQuantity < 1) {
        showMessage("Số lượng tối thiểu là 1. Bạn có thể bấm Xóa để bỏ sản phẩm.", "error");
        return;
    }

    updateQuantity(productId, nextQuantity);
}

async function removeItem(productId) {
    const confirmed = confirm("Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?");

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart/items/${productId}`, {
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

    function bindCheckoutButton(items) {
        const checkoutButton = document.getElementById("go-checkout-btn");

        if (!checkoutButton) return;

        const hasInvalidItem = items.some(item => item.productDeleted || !item.product);

        if (hasInvalidItem) {
            checkoutButton.disabled = true;
            checkoutButton.textContent = "Vui lòng xóa sản phẩm lỗi trước";
            return;
        }

        checkoutButton.addEventListener("click", () => {
            window.location.href = "/confirm-order/cart";
        });
    }
    
}