const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const ordersContent = document.getElementById("orders-content");
const messageBox = document.getElementById("message");

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
        PENDING: "Chờ xử lý",
        PAID: "Đã thanh toán",
        FAILED: "Thất bại",
        UNPAID: "Chưa thanh toán"
    };

    return map[status] || status || "Không rõ";
}

function getStatusClass(status) {
    if (status === "PENDING_PAYMENT" || status === "PENDING") {
        return "pending";
    }

    if (status === "CONFIRMED" || status === "PAID") {
        return "processing";
    }

    if (status === "SHIPPING") {
        return "shipped";
    }

    if (status === "COMPLETED") {
        return "delivered";
    }

    if (status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "FAILED") {
        return "cancelled";
    }

    return "pending";
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

        renderOrders(data.orders || []);

    } catch (error) {
        console.error("Lỗi tải danh sách đơn hàng:", error);

        ordersContent.className = "error";
        ordersContent.textContent = error.message || "Không thể tải danh sách đơn hàng.";
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        ordersContent.className = "empty-orders";
        ordersContent.innerHTML = `
            <p>Bạn chưa có đơn hàng nào.</p>
            <p><a href="/">Tiếp tục mua sắm</a></p>
        `;
        return;
    }

    const ordersHtml = orders
        .map(order => renderOrderCard(order))
        .join("");

    ordersContent.className = "orders-list";
    ordersContent.innerHTML = ordersHtml;
}

function renderOrderCard(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const items = order.items || [];

    const itemsHtml = items.slice(0, 2).map(item => `
        <div class="order-item">
            <div class="item-name">
                ${escapeHtml(item.productName || item.product_name)}
            </div>
            <div class="item-quantity">
                x${escapeHtml(item.quantity)}
            </div>
            <div class="item-price">
                ${formatPrice(item.unitPrice || item.unit_price || 0)}
            </div>
        </div>
    `).join("");

    return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">Đơn hàng #${escapeHtml(orderId)}</div>
                <div class="order-date">${escapeHtml(formatDate(order.createdAt || order.created_at))}</div>
                <span class="order-status ${getStatusClass(orderStatus)}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
            </div>

            <div class="order-items">
                ${itemsHtml}
                ${items.length > 2 ? `<div style="color: var(--text-3);">Và ${items.length - 2} sản phẩm khác...</div>` : ""}
            </div>

            <div class="order-footer">
                <div class="order-total">Tổng tiền: <strong>${formatPrice(order.totalAmount || order.total_amount || 0)}</strong></div>
                <a class="view-detail-btn" href="/orders/${escapeAttribute(orderId)}">Xem chi tiết</a>
            </div>
        </div>
    `;
}