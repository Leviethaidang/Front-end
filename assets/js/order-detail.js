const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const detailContent = document.getElementById("order-detail-content");
const messageBox = document.getElementById("message");

loadOrderDetail();

function getAccessToken() {
    return localStorage.getItem("accessToken");
}

function redirectToLogin() {
    window.location.href = "/login";
}

function getOrderIdFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[1];
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

function showMessage(message, type = "success") {
    messageBox.className = `message ${type}`;
    messageBox.textContent = message;

    setTimeout(() => {
        messageBox.className = "message";
        messageBox.textContent = "";
    }, 3000);
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

async function loadOrderDetail() {
    const orderId = getOrderIdFromUrl();

    if (!orderId) {
        detailContent.className = "error";
        detailContent.innerHTML = `
            Không tìm thấy mã đơn hàng trên URL.
            <br>
            <a class="back-link" href="/orders">← Quay lại danh sách đơn hàng</a>
        `;
        return;
    }

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/me/${orderId}`);

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải chi tiết đơn hàng.");
        }

        renderOrderDetail(data.order);

    } catch (error) {
        console.error("Lỗi tải chi tiết đơn hàng:", error);

        detailContent.className = "error";
        detailContent.innerHTML = `
            ${escapeHtml(error.message || "Không thể tải chi tiết đơn hàng.")}
            <br>
            <a class="back-link" href="/orders">← Quay lại danh sách đơn hàng</a>
        `;
    }
}

function renderOrderDetail(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const paymentStatus = order.paymentStatus || order.payment_status;
    const items = order.items || [];

    const itemsHtml = items
        .map(item => renderOrderItem(item))
        .join("");

    detailContent.className = "detail-layout";
    detailContent.innerHTML = `
        <div class="detail-main">
            <div class="section">
                <div class="section-title">Thông tin đơn hàng</div>

                <div class="info-grid">
                    <div class="info-item">
                        <strong>Mã đơn hàng</strong>
                        #${escapeHtml(orderId)}
                    </div>

                    <div class="info-item">
                        <strong>Ngày đặt</strong>
                        ${escapeHtml(formatDate(order.createdAt || order.created_at))}
                    </div>

                    <div class="info-item">
                        <strong>Trạng thái đơn hàng</strong>
                        <span class="status-badge ${getStatusClass(orderStatus)}">
                            ${escapeHtml(getOrderStatusText(orderStatus))}
                        </span>
                    </div>

                    <div class="info-item">
                        <strong>Trạng thái thanh toán</strong>
                        <span class="status-badge ${getStatusClass(paymentStatus)}">
                            ${escapeHtml(getPaymentStatusText(paymentStatus))}
                        </span>
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Thông tin nhận hàng</div>

                <div class="info-grid">
                    <div class="info-item">
                        <strong>Người nhận</strong>
                        ${escapeHtml(order.receiverName || order.receiver_name)}
                    </div>

                    <div class="info-item">
                        <strong>Số điện thoại</strong>
                        ${escapeHtml(order.receiverPhone || order.receiver_phone)}
                    </div>

                    <div class="info-item">
                        <strong>Địa chỉ giao hàng</strong>
                        ${escapeHtml(order.shippingAddress || order.shipping_address)}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Phương thức thanh toán</div>

                <div class="info-grid">
                    <div class="info-item">
                        <strong>Loại thanh toán</strong>
                        ${escapeHtml(order.paymentMethodType || order.payment_method_type)}
                    </div>

                    <div class="info-item">
                        <strong>Phương thức</strong>
                        ${escapeHtml(order.paymentMethodDisplayName || order.payment_method_display_name)}
                    </div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Sản phẩm</div>
                ${itemsHtml}
            </div>
        </div>

        <div class="detail-summary">
            <div class="summary-title">Tóm tắt đơn hàng</div>

            <div class="summary-row">
                <span>Tổng số lượng</span>
                <strong>${escapeHtml(order.totalQuantity || order.total_quantity || 0)}</strong>
            </div>

            <div class="summary-row summary-total">
                <span>Tổng tiền</span>
                <span>${formatPrice(order.totalAmount || order.total_amount || 0)}</span>
            </div>

            ${renderActionButtons(order)}

            <a class="back-link" href="/orders">
                ← Quay lại danh sách đơn hàng
            </a>
        </div>
    `;

    bindActionButtons(order);
}

function renderOrderItem(item) {
    const productName = item.productName || item.product_name;
    const categoryName = item.categoryName || item.category_name || "Chưa phân loại";
    const imageUrl = item.imageUrl || item.image_url;
    const unitPrice = item.unitPrice || item.unit_price || 0;
    const quantity = item.quantity || 0;
    const subtotal = item.subtotal || 0;

    const imageHtml = imageUrl
        ? `<img class="order-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : "Không có ảnh";

    return `
        <div class="order-item">
            <div class="order-image-wrap">
                ${imageHtml}
            </div>

            <div>
                <div class="order-product-name">
                    ${escapeHtml(productName)}
                </div>

                <div class="order-product-meta">
                    ${escapeHtml(categoryName)}
                </div>

                <div class="order-product-meta">
                    Số lượng: ${escapeHtml(quantity)}
                </div>

                <div class="order-product-price">
                    ${formatPrice(unitPrice)}
                </div>

                <div class="order-product-meta">
                    Tạm tính: ${formatPrice(subtotal)}
                </div>
            </div>
        </div>
    `;
}

function renderActionButtons(order) {
    const orderStatus = order.orderStatus || order.order_status;

    const canCancel = !["SHIPPING", "COMPLETED", "CANCELLED"].includes(orderStatus);
    const canConfirmReceived = orderStatus === "SHIPPING";

    let html = "";

    if (canCancel) {
        html += `
            <button class="action-btn cancel-btn" id="cancel-order-btn">
                Hủy đơn hàng
            </button>
        `;
    }

    if (canConfirmReceived) {
        html += `
            <button class="action-btn received-btn" id="received-order-btn">
                Tôi đã nhận hàng
            </button>
        `;
    }

    return html;
}

function bindActionButtons(order) {
    const orderId = order.orderId || order.order_id;

    const cancelButton = document.getElementById("cancel-order-btn");
    const receivedButton = document.getElementById("received-order-btn");

    if (cancelButton) {
        cancelButton.addEventListener("click", () => {
            cancelOrder(orderId);
        });
    }

    if (receivedButton) {
        receivedButton.addEventListener("click", () => {
            confirmReceived(orderId);
        });
    }
}

async function cancelOrder(orderId) {
    const confirmed = confirm("Bạn có chắc muốn hủy đơn hàng này?");

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/me/${orderId}/cancel`, {
            method: "PUT"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể hủy đơn hàng.");
        }

        showMessage("Hủy đơn hàng thành công.", "success");
        renderOrderDetail(data.order);

    } catch (error) {
        console.error("Lỗi hủy đơn hàng:", error);
        showMessage(error.message || "Không thể hủy đơn hàng.", "error");
    }
}

async function confirmReceived(orderId) {
    const confirmed = confirm("Bạn xác nhận đã nhận được hàng?");

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/me/${orderId}/received`, {
            method: "PUT"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể xác nhận đã nhận hàng.");
        }

        showMessage("Xác nhận đã nhận hàng thành công.", "success");
        renderOrderDetail(data.order);

    } catch (error) {
        console.error("Lỗi xác nhận đã nhận hàng:", error);
        showMessage(error.message || "Không thể xác nhận đã nhận hàng.", "error");
    }
}