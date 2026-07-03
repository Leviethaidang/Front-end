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
    const headerHtml = `
        <div class="row mb-4">
            <div class="col-12">
                <ul class="nav nav-pills justify-content-center" id="order-tabs">
                    <li class="nav-item">
                        <button class="nav-link active order-tab" data-tab="all">Tất cả (${orders.length})</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link order-tab" data-tab="PENDING_PAYMENT">Chờ TT (${orders.filter(o => (o.orderStatus || o.order_status) === "PENDING_PAYMENT").length})</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link order-tab" data-tab="CONFIRMED">Xác nhận (${orders.filter(o => (o.orderStatus || o.order_status) === "CONFIRMED").length})</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link order-tab" data-tab="SHIPPING">Đang giao (${orders.filter(o => (o.orderStatus || o.order_status) === "SHIPPING").length})</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link order-tab" data-tab="COMPLETED">Hoàn thành (${orders.filter(o => (o.orderStatus || o.order_status) === "COMPLETED").length})</button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link order-tab" data-tab="CANCELLED">Đã hủy (${orders.filter(o => ["CANCELLED","PAYMENT_FAILED"].includes(o.orderStatus || o.order_status)).length})</button>
                    </li>
                </ul>
            </div>
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
            <div class="text-center py-5 bg-light rounded">
                <div class="fs-1 mb-3">📋</div>
                <h5 class="text-muted">Không có đơn hàng nào trong mục này.</h5>
                <a href="/" class="btn btn-outline-primary mt-3">Tiếp tục mua sắm</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="row">
            <div class="col-12">
                ${filtered.map(order => renderOrderCard(order)).join("")}
            </div>
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
        <div class="modern-card mb-4" id="order-card-${escapeAttribute(orderId)}">
            <div class="card-header bg-white p-4 border-bottom d-flex justify-content-between align-items-center flex-wrap">
                <div>
                    <h5 class="mb-1 fw-bold">Đơn #${escapeHtml(orderId)}</h5>
                    <div class="text-muted small">
                        <i class="bi bi-clock"></i> ${escapeHtml(formatDate(order.createdAt || order.created_at))}
                        ${sourceLabel ? `<span class="badge bg-light text-dark ms-2 border">${sourceLabel}</span>` : ""}
                    </div>
                </div>
                <div class="mt-2 mt-md-0">
                    <span class="badge ${orderStatusClass === 'pending' ? 'bg-warning text-dark' : orderStatusClass === 'processing' ? 'bg-info text-dark' : orderStatusClass === 'shipped' ? 'bg-primary' : orderStatusClass === 'delivered' ? 'bg-success' : 'bg-danger'}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
                    <span class="badge bg-secondary ms-1">💳 ${escapeHtml(getPaymentStatusText(paymentStatus))}</span>
                </div>
            </div>

            <div class="card-body p-0">
                ${itemsHtml.replaceAll('class="order-item-row"', 'class="d-flex align-items-center p-3 border-bottom"')
                           .replaceAll('class="order-item-img"', 'class="me-3"')
                           .replaceAll('class="order-item-img-placeholder"', 'class="d-flex align-items-center justify-content-center bg-light text-muted rounded" style="width:60px; height:60px; font-size:24px;"')
                           .replaceAll('<img src', '<img style="width:60px; height:60px; object-fit:cover;" class="rounded" src')
                           .replaceAll('class="order-item-info"', 'class="flex-grow-1"')
                           .replaceAll('class="order-item-name"', 'class="fw-bold"')
                           .replaceAll('class="order-item-variant"', 'class="small text-muted"')
                           .replaceAll('class="order-item-qty"', 'class="px-3 fw-bold text-muted"')
                           .replaceAll('class="order-item-price"', 'class="fw-bold ms-3"')}
                ${moreItemsHtml ? `<div class="p-3 text-center text-muted small bg-light">${moreItemsHtml.replace('class="order-items-more"', '')}</div>` : ""}
            </div>

            <div class="card-footer bg-white p-4 d-flex justify-content-between align-items-center flex-wrap">
                <div>
                    <div class="small text-muted mb-1">
                        ${getPaymentMethodTypeLabel(paymentMethodType)}
                        ${paymentMethodDisplay ? `• ${escapeHtml(paymentMethodDisplay)}` : ""}
                    </div>
                    <div class="fs-5">Tổng: <strong class="text-success">${formatPrice(order.totalAmount || order.total_amount || 0)}</strong></div>
                </div>
                <a class="btn btn-outline-brand hover-lift mt-3 mt-md-0" href="/orders/${escapeAttribute(orderId)}" id="view-order-${escapeAttribute(orderId)}">
                    Xem chi tiết
                </a>
            </div>
        </div>
    `;
}