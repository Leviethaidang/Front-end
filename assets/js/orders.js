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
        return "status-pending";
    }

    if (status === "CONFIRMED" || status === "PAID") {
        return "status-confirmed";
    }

    if (status === "SHIPPING") {
        return "status-shipping";
    }

    if (status === "COMPLETED") {
        return "status-completed";
    }

    if (status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "FAILED") {
        return "status-failed";
    }

    return "status-default";
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
    const paymentStatus = order.paymentStatus || order.payment_status;

    return `
        <div class="order-card">
            <div>
                <div class="order-title">
                    Đơn hàng #${escapeHtml(orderId)}
                </div>

                <div class="order-info">
                    <div>
                        <strong>Ngày đặt:</strong>
                        ${escapeHtml(formatDate(order.createdAt || order.created_at))}
                    </div>

                    <div>
                        <strong>Số lượng:</strong>
                        ${escapeHtml(order.totalQuantity || order.total_quantity || 0)}
                    </div>

                    <div>
                        <strong>Tổng tiền:</strong>
                        ${formatPrice(order.totalAmount || order.total_amount || 0)}
                    </div>

                    <div>
                        <strong>Trạng thái đơn:</strong>
                        <span class="status-badge ${getStatusClass(orderStatus)}">
                            ${escapeHtml(getOrderStatusText(orderStatus))}
                        </span>
                    </div>

                    <div>
                        <strong>Thanh toán:</strong>
                        <span class="status-badge ${getStatusClass(paymentStatus)}">
                            ${escapeHtml(getPaymentStatusText(paymentStatus))}
                        </span>
                    </div>
                </div>
            </div>

            <div class="order-actions">
                <a class="detail-btn" href="/orders/${escapeAttribute(orderId)}">
                    Xem chi tiết
                </a>
            </div>
        </div>
    `;
}