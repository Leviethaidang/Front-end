const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const ordersContent = document.getElementById("orders-content");
const messageBox = document.getElementById("message");

let allOrders = [];
let activeTab = "all";

loadOrders();

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

function formatDate(value) {
    if (!value) return "Không rõ";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Không rõ";
    }

    return date.toLocaleString("vi-VN");
}

function getOrderStatusText(status) {
    const map = {
        PENDING_PAYMENT: "Chờ thanh toán",
        CONFIRMED: "Đã xác nhận",
        PAYMENT_FAILED: "Thanh toán thất bại",
        SHIPPING: "Đang giao hàng",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy"
    };

    return map[status] || status || "Không rõ";
}

function getPaymentStatusText(status) {
    const map = {
        PENDING: "Chờ thanh toán",
        PAID: "Đã thanh toán",
        FAILED: "Thanh toán thất bại",
        UNPAID: "Chưa thanh toán"
    };

    return map[status] || status || "Không rõ";
}

function getOrderStatusClass(status) {
    if (status === "PENDING_PAYMENT") return "pending";
    if (status === "CONFIRMED") return "processing";
    if (status === "SHIPPING") return "shipped";
    if (status === "COMPLETED") return "delivered";
    if (status === "CANCELLED" || status === "PAYMENT_FAILED") return "cancelled";
    return "pending";
}

function getPaymentStatusClass(status) {
    if (status === "PAID") return "payment-paid";
    if (status === "FAILED") return "payment-failed";
    if (status === "PENDING" || status === "UNPAID") return "payment-pending";
    return "payment-pending";
}

function getPaymentMethodTypeLabel(type) {
    const map = {
        COD: "💵 COD",
        MOMO: "📱 MoMo",
        BANK: "🏦 Ngân hàng"
    };
    return map[(type || "").toUpperCase()] || type || "Không rõ";
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

async function loadOrders() {
    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/me`);

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải danh sách đơn hàng.");
        }

        allOrders = data.orders || [];
        renderOrdersWithTabs(allOrders);

    } catch (error) {
        console.error("Lỗi tải danh sách đơn hàng:", error);

        ordersContent.className = "error";
        ordersContent.textContent = error.message || "Không thể tải danh sách đơn hàng.";
    }
}

function renderOrdersWithTabs(orders) {
    // Build page header + tabs
    const headerHtml = `
        <div class="page-header">
            <h1 class="page-title" style="display:none"></h1>
        </div>
        <div class="order-tabs" id="order-tabs">
            <button class="order-tab active" data-tab="all">Tất cả (${orders.length})</button>
            <button class="order-tab" data-tab="PENDING_PAYMENT">Chờ TT (${orders.filter(o => (o.orderStatus || o.order_status) === "PENDING_PAYMENT").length})</button>
            <button class="order-tab" data-tab="CONFIRMED">Xác nhận (${orders.filter(o => (o.orderStatus || o.order_status) === "CONFIRMED").length})</button>
            <button class="order-tab" data-tab="SHIPPING">Đang giao (${orders.filter(o => (o.orderStatus || o.order_status) === "SHIPPING").length})</button>
            <button class="order-tab" data-tab="COMPLETED">Hoàn thành (${orders.filter(o => (o.orderStatus || o.order_status) === "COMPLETED").length})</button>
            <button class="order-tab" data-tab="CANCELLED">Đã hủy (${orders.filter(o => ["CANCELLED","PAYMENT_FAILED"].includes(o.orderStatus || o.order_status)).length})</button>
        </div>
        <div id="orders-list-container"></div>
    `;

    ordersContent.className = "";
    ordersContent.innerHTML = headerHtml;

    // Bind tab clicks
    const tabs = document.querySelectorAll(".order-tab");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            activeTab = tab.dataset.tab;
            renderFilteredOrders(orders);
        });
    });

    renderFilteredOrders(orders);
}

function renderFilteredOrders(orders) {
    const container = document.getElementById("orders-list-container");
    if (!container) return;

    let filtered = orders;
    if (activeTab !== "all") {
        if (activeTab === "CANCELLED") {
            filtered = orders.filter(o => ["CANCELLED", "PAYMENT_FAILED"].includes(o.orderStatus || o.order_status));
        } else {
            filtered = orders.filter(o => (o.orderStatus || o.order_status) === activeTab);
        }
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <span class="empty-icon">📋</span>
                <p>Không có đơn hàng nào trong mục này.</p>
                <p><a href="/">Tiếp tục mua sắm</a></p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="orders-list">
            ${filtered.map(order => renderOrderCard(order)).join("")}
        </div>
    `;
}

function renderOrderCard(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const paymentStatus = order.paymentStatus || order.payment_status;
    const paymentMethodType = order.paymentMethodType || order.payment_method_type;
    const paymentMethodDisplay = order.paymentMethodDisplayName || order.payment_method_display_name || "";
    const sourceType = order.sourceType || order.source_type || "";
    const items = order.items || [];

    const orderStatusClass = getOrderStatusClass(orderStatus);
    const paymentStatusClass = getPaymentStatusClass(paymentStatus);

    // Items preview
    const previewItems = items.slice(0, 3);
    const itemsHtml = previewItems.map(item => {
        const imageUrl = item.imageUrl || item.image_url;
        const sizeName = item.sizeName || item.size_name || "";
        const colorName = item.colorName || item.color_name || "";
        const variantText = [sizeName, colorName].filter(Boolean).join(" / ");

        return `
            <div class="order-item-row">
                <div class="order-item-img">
                    ${imageUrl
                        ? `<img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(item.productName || item.product_name)}">`
                        : `<div class="order-item-img-placeholder">📦</div>`
                    }
                </div>
                <div class="order-item-info">
                    <div class="order-item-name">${escapeHtml(item.productName || item.product_name)}</div>
                    ${variantText ? `<div class="order-item-variant">${escapeHtml(variantText)}</div>` : ""}
                </div>
                <div class="order-item-qty">x${escapeHtml(item.quantity)}</div>
                <div class="order-item-price">${formatPrice(item.unitPrice || item.unit_price || 0)}</div>
            </div>
        `;
    }).join("");

    const moreItemsHtml = items.length > 3
        ? `<div class="order-items-more">+ ${items.length - 3} sản phẩm khác...</div>`
        : "";

    const sourceLabel = sourceType === "CART" ? "🛒 Giỏ hàng" : sourceType === "BUY_NOW" ? "⚡ Mua ngay" : "";

    return `
        <div class="order-card" id="order-card-${escapeAttribute(orderId)}">
            <div class="order-header">
                <div class="order-header-left">
                    <div class="order-id">Đơn #${escapeHtml(orderId)}</div>
                    <div class="order-date">
                        🕐 ${escapeHtml(formatDate(order.createdAt || order.created_at))}
                        ${sourceLabel ? `<span class="order-source">${sourceLabel}</span>` : ""}
                    </div>
                </div>
                <div class="order-header-right">
                    <div class="order-statuses">
                        <span class="status-badge ${orderStatusClass}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
                        <span class="status-badge ${paymentStatusClass}">💳 ${escapeHtml(getPaymentStatusText(paymentStatus))}</span>
                    </div>
                </div>
            </div>

            <div class="order-body">
                <div class="order-items-preview">
                    ${itemsHtml}
                    ${moreItemsHtml}
                </div>
            </div>

            <div class="order-footer">
                <div class="order-payment-info">
                    <div class="order-payment-method">
                        ${getPaymentMethodTypeLabel(paymentMethodType)}
                        ${paymentMethodDisplay ? `• ${escapeHtml(paymentMethodDisplay)}` : ""}
                    </div>
                    <div class="order-total">Tổng: <strong>${formatPrice(order.totalAmount || order.total_amount || 0)}</strong></div>
                </div>
                <a class="view-detail-btn" href="/orders/${escapeAttribute(orderId)}" id="view-order-${escapeAttribute(orderId)}">
                    Xem chi tiết →
                </a>
            </div>
        </div>
    `;
}