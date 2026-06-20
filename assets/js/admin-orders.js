const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const content = document.getElementById("admin-orders-content");
const messageBox = document.getElementById("message");

loadAdminOrders();

function getAccessToken() {
    return localStorage.getItem("accessToken");
}

function redirectToLogin() {
    window.location.href = "/login";
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

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

function showMessage(message, type = "success") {
    messageBox.className = `message ${type}`;
    messageBox.textContent = message;

    setTimeout(() => {
        messageBox.className = "message";
        messageBox.textContent = "";
    }, 3000);
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

function getOrderStatusText(status) {
    const map = {
        PENDING_PAYMENT: "Chờ thanh toán",
        CONFIRMED: "Đã xác nhận",
        SHIPPING: "Đang giao hàng",
        COMPLETED: "Hoàn thành",
        CANCELLED: "Đã hủy",
        PAYMENT_FAILED: "Thanh toán thất bại"
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

async function loadAdminOrders() {
    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/admin/orders`);

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải danh sách đơn hàng.");
        }

        renderOrders(data.orders || []);

    } catch (error) {
        console.error("Lỗi tải admin orders:", error);

        content.className = "error";
        content.textContent = error.message || "Không thể tải danh sách đơn hàng.";
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        content.className = "empty-orders";
        content.innerHTML = "Chưa có đơn hàng nào.";
        return;
    }

    const rowsHtml = orders.map(renderOrderRow).join("");

    content.className = "table-card";
    content.innerHTML = `
        <table class="orders-table">
            <thead>
                <tr>
                    <th>Mã đơn</th>
                    <th>Ngày đặt</th>
                    <th>Người nhận</th>
                    <th>Phương thức thanh toán</th>
                    <th>Thanh toán</th>
                    <th>Số lượng</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái đơn</th>
                    <th>Cập nhật</th>
                </tr>
            </thead>

            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;

    bindUpdateButtons();
}

function renderOrderRow(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const paymentStatus = order.paymentStatus || order.payment_status;

    const receiverName = order.receiverName || order.receiver_name || "";
    const receiverPhone = order.receiverPhone || order.receiver_phone || "";
    const shippingAddress = order.shippingAddress || order.shipping_address || "";

    const paymentMethodType = order.paymentMethodType || order.payment_method_type || "";
    const paymentMethodDisplayName =
        order.paymentMethodDisplayName || order.payment_method_display_name || "";

    return `
        <tr>
            <td>
                <div class="order-id">#${escapeHtml(orderId)}</div>
                <div class="small-text">${escapeHtml(order.sourceType || order.source_type || "")}</div>
            </td>

            <td>
                ${escapeHtml(formatDate(order.createdAt || order.created_at))}
            </td>

            <td>
                <strong>${escapeHtml(receiverName)}</strong>
                <div class="small-text">${escapeHtml(receiverPhone)}</div>
                <div class="small-text">${escapeHtml(shippingAddress)}</div>
            </td>

            <td>
                <strong>${escapeHtml(paymentMethodType)}</strong>
                <div class="small-text">${escapeHtml(paymentMethodDisplayName)}</div>
            </td>

            <td>
                <span class="status-badge ${getStatusClass(paymentStatus)}">
                    ${escapeHtml(getPaymentStatusText(paymentStatus))}
                </span>
            </td>

            <td>
                ${escapeHtml(order.totalQuantity || order.total_quantity || 0)}
            </td>

            <td>
                <span class="money">
                    ${formatPrice(order.totalAmount || order.total_amount || 0)}
                </span>
            </td>

            <td>
                <span class="status-badge ${getStatusClass(orderStatus)}">
                    ${escapeHtml(getOrderStatusText(orderStatus))}
                </span>
            </td>

            <td>
                <select
                    class="status-select"
                    id="status-select-${escapeAttribute(orderId)}"
                    data-current-status="${escapeAttribute(orderStatus)}"
                >
                    ${renderStatusOptions(orderStatus)}
                </select>

                <br>

                <button
                    class="save-btn update-status-btn"
                    data-order-id="${escapeAttribute(orderId)}"
                >
                    Lưu trạng thái
                </button>
            </td>
        </tr>
    `;
}

function renderStatusOptions(currentStatus) {
    const statuses = [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "SHIPPING",
        "COMPLETED",
        "CANCELLED"
    ];

    return statuses.map(status => {
        const selected = status === currentStatus ? "selected" : "";

        return `
            <option value="${escapeAttribute(status)}" ${selected}>
                ${escapeHtml(getOrderStatusText(status))}
            </option>
        `;
    }).join("");
}

function bindUpdateButtons() {
    const buttons = document.querySelectorAll(".update-status-btn");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            updateOrderStatus(button.dataset.orderId);
        });
    });
}

async function updateOrderStatus(orderId) {
    const select = document.getElementById(`status-select-${orderId}`);

    if (!select) return;

    const currentStatus = select.dataset.currentStatus;
    const nextStatus = select.value;

    if (nextStatus === currentStatus) {
        showMessage("Trạng thái đơn hàng chưa thay đổi.", "error");
        return;
    }

    const confirmed = confirm(
        `Bạn muốn đổi trạng thái đơn #${orderId} từ ${getOrderStatusText(currentStatus)} sang ${getOrderStatusText(nextStatus)}?`
    );

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/admin/orders/${orderId}/status`, {
            method: "PUT",
            body: JSON.stringify({
                orderStatus: nextStatus
            })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể cập nhật trạng thái đơn hàng.");
        }

        showMessage(`Đã cập nhật đơn #${orderId} sang ${getOrderStatusText(nextStatus)}.`, "success");

        await loadAdminOrders();

    } catch (error) {
        console.error("Lỗi cập nhật trạng thái đơn:", error);
        showMessage(error.message || "Không thể cập nhật trạng thái đơn hàng.", "error");
    }
}