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
    if (item.productDeleted || item.product_deleted || !item.product) {
        return true;
    }

    if (item.variantDeleted || item.variant_deleted || !item.variant) {
        return true;
    }

    if (item.inventoryMissing || item.inventory_missing) {
        return true;
    }

    const quantity = Number(item.quantity || 0);
    const availableQuantity = Number(item.variant.quantityAvailable || item.variant.quantity_available || 0);

    if (availableQuantity <= 0) {
        return true;
    }

    if (quantity > availableQuantity) {
        return true;
    }

    return false;
}

function renderCart(cart) {
    const items = cart.items || [];

    if (items.length === 0) {
        cartContent.className = "empty-cart";
        cartContent.innerHTML = `
            <span class="empty-icon">🛒</span>
            <p style="font-size: 1.125rem; font-weight: 600; color: var(--text-1);">Giỏ hàng của bạn đang trống</p>
            <p>Hãy khám phá các sản phẩm và thêm vào giỏ hàng nhé!</p>
            <p style="margin-top: 16px;">
                <a href="/" class="btn-primary-lg" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
                    🛍️ Mua sắm ngay
                </a>
            </p>
        `;
        return;
    }

    const validItems = items.filter(item => !isInvalidCartItem(item));
    const invalidItems = items.filter(item => isInvalidCartItem(item));
    const hasInvalidItem = invalidItems.length > 0;

    const itemsHtml = items
        .map(item => renderCartItem(item))
        .join("");

    cartContent.innerHTML = `
        <div class="row">
            <div class="col-lg-8">
                <div class="modern-card mb-4">
                    <div class="card-header bg-white py-3 border-bottom-0">
                        <h5 class="mb-0">🛒 Sản phẩm trong giỏ (${items.length} sản phẩm)</h5>
                    </div>
                    <div class="card-body p-0">
                        ${itemsHtml}
                    </div>
                </div>
            </div>

            <div class="col-lg-4">
                <div class="modern-card">
                    <div class="card-header bg-white py-3 border-bottom-0">
                        <h5 class="mb-0">Tóm tắt đơn hàng</h5>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Số loại sản phẩm</span>
                            <strong>${escapeHtml(items.length)}</strong>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span>Tổng số lượng</span>
                            <strong>${escapeHtml(cart.totalQuantity || 0)}</strong>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between mb-3">
                            <span class="fs-5 fw-bold">Tổng tiền</span>
                            <span class="fs-5 fw-bold text-success">${formatPrice(cart.totalAmount || 0)}</span>
                        </div>

                        ${hasInvalidItem ? `
                            <div class="alert alert-warning py-2 mb-3 small">
                                ⚠️ Có ${invalidItems.length} sản phẩm không hợp lệ. Vui lòng xóa hoặc điều chỉnh trước khi thanh toán.
                            </div>
                        ` : ""}

                        <button class="btn btn-brand-gradient hover-lift w-100 py-2 mb-3" id="go-checkout-btn">
                            ${hasInvalidItem ? "⚠️ Vui lòng xử lý sản phẩm lỗi" : "✅ Thanh toán ngay"}
                        </button>

                        <a class="text-center d-block text-decoration-none" href="/">← Tiếp tục mua sắm</a>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindCartActionButtons();
    bindCheckoutButton(items);
}

function renderDeletedProductItem(item) {
    const cartItemId = Number(item.cartItemId || item.cart_item_id);

    return `
        <div class="d-flex align-items-center p-3 border-bottom bg-light">
            <div class="me-3 fs-1">📦</div>
            <div class="flex-grow-1">
                <div class="text-danger fw-bold small mb-1">⚠️ Sản phẩm này đã bị xóa khỏi hệ thống</div>
                <div class="small text-muted mb-2">Số lượng trong giỏ: ${escapeHtml(item.quantity)}</div>
            </div>
            <div class="ms-3">
                <button class="btn btn-sm btn-outline-danger remove-item-btn" data-cart-item-id="${escapeAttribute(cartItemId)}">
                    🗑 Xóa
                </button>
            </div>
        </div>
    `;
}

function renderDeletedVariantItem(item) {
    const product = item.product;
    const cartItemId = Number(item.cartItemId || item.cart_item_id);
    const productId = Number(item.productId || item.product_id);

    const imageHtml = product?.imageUrl || product?.image_url
        ? `<img class="cart-image" src="${escapeAttribute(product.imageUrl || product.image_url)}" alt="${escapeAttribute(product.productName || product.product_name)}">`
        : "📦";

    return `
        <div class="d-flex align-items-center p-3 border-bottom bg-light">
            <div class="me-3">
                ${imageHtml.replace('class="cart-image"', 'class="cart-item-img"')}
            </div>
            <div class="flex-grow-1">
                <a class="text-dark fw-bold text-decoration-none" href="/products/${escapeAttribute(productId)}">
                    ${escapeHtml(product?.productName || product?.product_name || "Sản phẩm")}
                </a>
                <div class="text-danger fw-bold small mt-1 mb-2">
                    ⚠️ Biến thể size/màu này không còn tồn tại hoặc đã bị ngừng bán.
                </div>
                <div class="small text-muted">Số lượng trong giỏ: ${escapeHtml(item.quantity)}</div>
            </div>
            <div class="ms-3">
                <button class="btn btn-sm btn-outline-danger remove-item-btn" data-cart-item-id="${escapeAttribute(cartItemId)}">
                    🗑 Xóa
                </button>
            </div>
        </div>
    `;
}

function renderCartItem(item) {
    if (item.productDeleted || item.product_deleted || !item.product) {
        return renderDeletedProductItem(item);
    }

    if (item.variantDeleted || item.variant_deleted || !item.variant) {
        return renderDeletedVariantItem(item);
    }

    const product = item.product;
    const variant = item.variant;

    const cartItemId = Number(item.cartItemId || item.cart_item_id);
    const productId = Number(item.productId || item.product_id);
    const quantity = Number(item.quantity || 1);

    const availableQuantity = Number(variant.quantityAvailable || variant.quantity_available || 0);

    const isQuantityInvalid =
        item.inventoryMissing || item.inventory_missing || availableQuantity <= 0 || quantity > availableQuantity;

    const imageHtml = product.imageUrl || product.image_url
        ? `<img class="cart-image" src="${escapeAttribute(product.imageUrl || product.image_url)}" alt="${escapeAttribute(product.productName || product.product_name)}">`
        : "📦";

    const colorDotHtml = variant.colorCode || variant.color_code
        ? `<span class="color-dot" style="background: ${escapeAttribute(variant.colorCode || variant.color_code)};"></span>`
        : "";

    return `
        <div class="d-flex align-items-center p-3 border-bottom ${isQuantityInvalid ? "bg-light" : ""}">
            <div class="me-3">
                ${imageHtml.replace('class="cart-image"', 'class="cart-item-img"')}
            </div>
            <div class="flex-grow-1">
                <a class="text-dark fw-bold text-decoration-none" href="/products/${escapeAttribute(productId)}">
                    ${escapeHtml(product.productName || product.product_name)}
                </a>
                <div class="small text-muted mb-1">
                    ${escapeHtml(product.categoryName || product.category_name || "Chưa phân loại")}
                </div>
                <div class="small mb-1">
                    <span class="badge bg-secondary me-1">Size: ${escapeHtml(variant.sizeName || variant.size_name || "Không rõ")}</span>
                    <span class="badge bg-secondary">
                        ${colorDotHtml.replace('class="color-dot"', 'style="display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; border:1px solid #ddd; background:' + escapeAttribute(variant.colorCode || variant.color_code) + ';"')}
                        ${escapeHtml(variant.colorName || variant.color_name || "Không rõ")}
                    </span>
                </div>
                
                ${isQuantityInvalid ? `<div class="small text-danger mb-1">⚠️ Sản phẩm không hợp lệ hoặc vượt quá số lượng tồn kho</div>` : ''}

                <div class="d-flex align-items-center mt-2">
                    <span class="fw-bold text-success me-3">${formatPrice(product.price)}</span>
                    
                    <div class="input-group input-group-sm" style="width: 100px;">
                        <button class="btn btn-outline-secondary decrease-qty-btn" 
                                data-cart-item-id="${escapeAttribute(cartItemId)}"
                                data-current-quantity="${escapeAttribute(quantity)}"
                                ${quantity <= 1 ? "disabled" : ""}>−</button>
                        <div class="form-control text-center px-1">${escapeHtml(quantity)}</div>
                        <button class="btn btn-outline-secondary increase-qty-btn"
                                data-cart-item-id="${escapeAttribute(cartItemId)}"
                                data-current-quantity="${escapeAttribute(quantity)}"
                                data-available-quantity="${escapeAttribute(availableQuantity)}"
                                ${quantity >= availableQuantity ? "disabled" : ""}>+</button>
                    </div>
                    
                    <div class="ms-auto fw-bold text-dark">
                        ${formatPrice(item.subtotal || 0)}
                    </div>
                </div>
            </div>
            <div class="ms-3">
                <button class="btn btn-sm btn-outline-danger remove-item-btn" data-cart-item-id="${escapeAttribute(cartItemId)}">
                    <i class="bi bi-trash"></i>
                </button>
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
                button.dataset.availableQuantity
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

function increaseQuantity(cartItemId, currentQuantity, availableQuantity) {
    const nextQuantity = Number(currentQuantity) + 1;

    if (nextQuantity > Number(availableQuantity)) {
        showMessage("Số lượng đã đạt tối đa số lượng còn lại của biến thể này.", "error");
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
        return;
    }

    checkoutButton.addEventListener("click", () => {
        window.location.href = "/confirm-order/cart";
    });
}