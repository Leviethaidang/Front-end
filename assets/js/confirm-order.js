const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";
const CART_SERVICE_URL = window.APP_CONFIG?.CART_SERVICE_URL || "";
const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const PAYMENT_SERVICE_URL = window.APP_CONFIG?.PAYMENT_SERVICE_URL || "";
const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const content = document.getElementById("confirm-order-content");
const messageBox = document.getElementById("message");

const state = {
    mode: "CART",
    productId: null,
    quantity: 1,
    profile: null,
    paymentMethods: [],
    items: [],
    totalQuantity: 0,
    totalAmount: 0
};

initConfirmOrderPage();

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

function normalizeMethodType(value) {
    return String(value || "").trim().toUpperCase();
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

    if (type === "error") {
        setTimeout(() => {
            messageBox.className = "message";
            messageBox.textContent = "";
        }, 3500);
    }
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

function detectMode() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path.includes("/buy-now") || params.get("mode") === "buy-now") {
        state.mode = "BUY_NOW";
        state.productId = Number(params.get("productId"));
        state.quantity = Number(params.get("quantity") || 1);

        if (!Number.isInteger(state.productId) || state.productId <= 0) {
            throw new Error("Thiếu productId hợp lệ cho mua ngay.");
        }

        if (!Number.isInteger(state.quantity) || state.quantity <= 0) {
            state.quantity = 1;
        }

        return;
    }

    state.mode = "CART";
}

async function initConfirmOrderPage() {
    try {
        detectMode();

        const [profile, paymentMethods] = await Promise.all([
            loadUserProfile(),
            loadPaymentMethods()
        ]);

        state.profile = profile;
        state.paymentMethods = paymentMethods;

        if (state.mode === "CART") {
            await loadCartCheckoutItems();
        } else {
            await loadBuyNowCheckoutItems();
        }

        renderConfirmOrderPage();

    } catch (error) {
        console.error("Lỗi tải trang xác nhận đơn hàng:", error);

        content.className = "error";
        content.innerHTML = `
            <p>${escapeHtml(error.message || "Không thể tải trang xác nhận đơn hàng.")}</p>
            <p><a href="/cart">Quay lại giỏ hàng</a></p>
        `;
    }
}

async function loadUserProfile() {
    const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`);

    if (!response) return null;

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Không thể lấy thông tin người dùng.");
    }

    return data.profile;
}

async function loadPaymentMethods() {
    const response = await fetchWithAuth(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`);

    if (!response) return [];

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Không thể lấy phương thức thanh toán.");
    }

    return data.paymentMethods || [];
}

async function loadCartCheckoutItems() {
    const response = await fetchWithAuth(`${CART_SERVICE_URL}/api/cart`);

    if (!response) return;

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Không thể lấy giỏ hàng.");
    }

    const cart = data.cart;

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        throw new Error("Giỏ hàng đang trống.");
    }

    const invalidItem = cart.items.find(item => item.productDeleted || !item.product);

    if (invalidItem) {
        throw new Error("Giỏ hàng có sản phẩm đã bị xóa. Vui lòng quay lại giỏ hàng để xóa sản phẩm lỗi.");
    }

    state.items = cart.items.map(item => {
        const product = item.product;

        return {
            productId: item.productId,
            productName: product.productName,
            categoryName: product.categoryName || "Chưa phân loại",
            imageUrl: product.imageUrl || "",
            unitPrice: Number(product.price),
            quantity: Number(item.quantity),
            subtotal: Number(item.subtotal)
        };
    });

    state.totalQuantity = Number(cart.totalQuantity || 0);
    state.totalAmount = Number(cart.totalAmount || 0);
}

async function loadBuyNowCheckoutItems() {
    const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products/${state.productId}`);

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Không thể lấy sản phẩm.");
    }

    const product = data.product;

    if (!product) {
        throw new Error("Sản phẩm không tồn tại.");
    }

    const stockQuantity = Number(product.stock_quantity || 0);
    const unitPrice = Number(product.price);

    if (stockQuantity <= 0) {
        throw new Error("Sản phẩm đã hết hàng.");
    }

    if (state.quantity > stockQuantity) {
        throw new Error(`Số lượng mua vượt quá tồn kho. Tồn kho hiện tại: ${stockQuantity}`);
    }

    const subtotal = unitPrice * state.quantity;

    state.items = [
        {
            productId: product.product_id,
            productName: product.product_name,
            categoryName: product.category_name || "Chưa phân loại",
            imageUrl: product.imageUrl || "",
            unitPrice,
            quantity: state.quantity,
            subtotal
        }
    ];

    state.totalQuantity = state.quantity;
    state.totalAmount = subtotal;
}

function getSupportedPaymentMethods() {
    return state.paymentMethods.filter(method => {
        const methodType = normalizeMethodType(method.method_type);
        return methodType === "MOMO" || methodType === "BANK";
    });
}

function getDefaultSupportedPaymentMethodId(methods) {
    const defaultMethod = methods.find(method => Boolean(method.is_default));

    if (defaultMethod) {
        return String(defaultMethod.payment_method_id);
    }

    return methods.length > 0 ? String(methods[0].payment_method_id) : "";
}

function renderConfirmOrderPage() {
    const profile = state.profile || {};
    const supportedPaymentMethods = getSupportedPaymentMethods();
    const defaultPaymentMethodId = getDefaultSupportedPaymentMethodId(supportedPaymentMethods);

    const itemsHtml = state.items
        .map(item => renderOrderItem(item))
        .join("");

    const paymentMethodsHtml = supportedPaymentMethods.length > 0
        ? supportedPaymentMethods
            .map(method => renderPaymentMethod(method, defaultPaymentMethodId))
            .join("")
        : `
            <div class="no-payment-method">
                Hiện checkout chỉ hỗ trợ MoMo hoặc Bank. 
                Bạn chưa có phương thức MoMo/Bank nào, vui lòng thêm phương thức thanh toán trước.
            </div>
        `;

    content.className = "confirm-layout";
    content.innerHTML = `
        <div class="confirm-main">
            <div class="section">
                <div class="section-title">Thông tin nhận hàng</div>

                <div class="form-group">
                    <label for="receiver-name">Họ và tên người nhận</label>
                    <input
                        id="receiver-name"
                        type="text"
                        value="${escapeAttribute(profile.full_name || "")}"
                        placeholder="Nhập họ và tên người nhận"
                    >
                </div>

                <div class="form-group">
                    <label for="receiver-phone">Số điện thoại</label>
                    <input
                        id="receiver-phone"
                        type="text"
                        value="${escapeAttribute(profile.phone_number || "")}"
                        placeholder="Ví dụ: +84901234567"
                    >
                </div>

                <div class="form-group">
                    <label for="shipping-address">Địa chỉ giao hàng</label>
                    <textarea
                        id="shipping-address"
                        placeholder="Nhập địa chỉ giao hàng"
                    >${escapeHtml(profile.default_shipping_address || "")}</textarea>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Sản phẩm</div>
                ${itemsHtml}
            </div>

            <div class="section">
                <div class="section-title">Phương thức thanh toán</div>
                <div class="payment-method-list">
                    ${paymentMethodsHtml}
                </div>
            </div>
        </div>

        <div class="confirm-summary">
            <div class="summary-title">Tóm tắt đơn hàng</div>

            <div class="summary-row">
                <span>Loại đơn</span>
                <strong>${state.mode === "CART" ? "Giỏ hàng" : "Mua ngay"}</strong>
            </div>

            <div class="summary-row">
                <span>Tổng số lượng</span>
                <strong>${escapeHtml(state.totalQuantity)}</strong>
            </div>

            <div class="summary-row summary-total">
                <span>Tổng tiền</span>
                <span>${formatPrice(state.totalAmount)}</span>
            </div>

            <button
                class="place-order-btn"
                id="place-order-btn"
                ${supportedPaymentMethods.length === 0 ? "disabled" : ""}
            >
                Đặt hàng / Thanh toán
            </button>

            <a class="back-link" href="${state.mode === "CART" ? "/cart" : `/products/${state.productId}`}">
                Quay lại
            </a>
        </div>
    `;

    bindPlaceOrderButton();
}

function renderOrderItem(item) {
    const imageHtml = item.imageUrl
        ? `<img class="order-image" src="${escapeAttribute(item.imageUrl)}" alt="${escapeAttribute(item.productName)}">`
        : "Không có ảnh";

    return `
        <div class="order-item">
            <div class="order-image-wrap">
                ${imageHtml}
            </div>

            <div>
                <div class="order-product-name">
                    ${escapeHtml(item.productName)}
                </div>

                <div class="order-product-meta">
                    ${escapeHtml(item.categoryName)}
                </div>

                <div class="order-product-meta">
                    Số lượng: ${escapeHtml(item.quantity)}
                </div>

                <div class="order-product-price">
                    ${formatPrice(item.unitPrice)}
                </div>

                <div class="order-product-meta">
                    Tạm tính: ${formatPrice(item.subtotal)}
                </div>
            </div>
        </div>
    `;
}

function renderPaymentMethod(method, defaultPaymentMethodId) {
    const paymentMethodId = String(method.payment_method_id);
    const checked = paymentMethodId === defaultPaymentMethodId ? "checked" : "";
    const methodType = normalizeMethodType(method.method_type);

    return `
        <label class="payment-method-card">
            <input
                type="radio"
                name="payment-method"
                value="${escapeAttribute(paymentMethodId)}"
                ${checked}
            >

            <div>
                <div class="payment-method-name">
                    ${escapeHtml(method.display_name || "Phương thức thanh toán")}
                </div>

                <div class="payment-method-type">
                    ${escapeHtml(methodType)}
                    ${method.is_default ? " • Mặc định" : ""}
                </div>
            </div>
        </label>
    `;
}

function bindPlaceOrderButton() {
    const button = document.getElementById("place-order-btn");

    if (!button) return;

    button.addEventListener("click", submitOrder);
}

function getSelectedPaymentMethodId() {
    const selected = document.querySelector('input[name="payment-method"]:checked');
    return selected ? selected.value : "";
}

async function submitOrder() {
    const button = document.getElementById("place-order-btn");

    const receiverName = document.getElementById("receiver-name").value.trim();
    const receiverPhone = document.getElementById("receiver-phone").value.trim();
    const shippingAddress = document.getElementById("shipping-address").value.trim();
    const paymentMethodId = getSelectedPaymentMethodId();

    if (!receiverName) {
        showMessage("Vui lòng nhập họ tên người nhận.", "error");
        return;
    }

    if (!receiverPhone) {
        showMessage("Vui lòng nhập số điện thoại người nhận.", "error");
        return;
    }

    if (!shippingAddress) {
        showMessage("Vui lòng nhập địa chỉ giao hàng.", "error");
        return;
    }

    if (!paymentMethodId) {
        showMessage("Vui lòng chọn phương thức thanh toán.", "error");
        return;
    }

    const payload = {
        sourceType: state.mode,
        receiverName,
        receiverPhone,
        shippingAddress,
        paymentMethodId
    };

    if (state.mode === "BUY_NOW") {
        payload.productId = state.productId;
        payload.quantity = state.quantity;
    }

    try {
        button.disabled = true;
        button.textContent = "Đang tạo đơn hàng...";

        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/checkout`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tạo đơn hàng.");
        }

        const orderId = data.order?.orderId || data.order?.order_id || "";

        showMessage(
            orderId
                ? `Đặt hàng thành công! Mã đơn hàng: ${orderId}. Đơn hàng đang chờ thanh toán.`
                : "Đặt hàng thành công! Đơn hàng đang chờ thanh toán.",
            "success"
        );

        button.textContent = "Đã đặt hàng";
        button.disabled = true;

        setTimeout(() => {
            if (orderId) {
                sessionStorage.setItem(
                    `pendingPaymentOrder:${orderId}`,
                    JSON.stringify({
                        orderId,
                        createdAt: Date.now()
                    })
                );

                window.location.href = `/orders/${encodeURIComponent(orderId)}`;
            } else {
                window.location.href = "/orders";
            }
        }, 1000);
        
    } catch (error) {
        console.error("Lỗi đặt hàng:", error);

        showMessage(error.message || "Không thể tạo đơn hàng.", "error");

        button.disabled = false;
        button.textContent = "Đặt hàng / Thanh toán";
    }
}