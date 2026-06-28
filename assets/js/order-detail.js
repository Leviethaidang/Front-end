const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const detailContent = document.getElementById("order-detail-content");
const messageBox = document.getElementById("message");

let paymentPollingTimer = null;
let paymentPollingCount = 0;
const MAX_PAYMENT_POLLING_COUNT = 30;

let currentOrderId = null;
let currentOrderIsPaymentFailed = false;
let cleanupStarted = false;

loadOrderDetail();
setupLeavePageCleanup();
setupUnloadCleanup();

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

function getPendingPaymentKey(orderId) {
    return `pendingPaymentOrder:${orderId}`;
}

function clearPendingPaymentFlag(orderId) {
    sessionStorage.removeItem(getPendingPaymentKey(orderId));
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
    return "payment-pending";
}

function getPaymentMethodTypeLabel(type) {
    const map = {
        COD: "💵 COD (Thanh toán khi nhận hàng)",
        MOMO: "📱 Ví MoMo",
        BANK: "🏦 Chuyển khoản ngân hàng"
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
            const error = new Error(data.error || "Không thể tải chi tiết đơn hàng.");
            error.statusCode = response.status;
            throw error;
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
    const paymentMethodType = order.paymentMethodType || order.payment_method_type;
    const paymentMethodDisplay = order.paymentMethodDisplayName || order.payment_method_display_name || "";
    const receiverName = order.receiverName || order.receiver_name || "";
    const receiverPhone = order.receiverPhone || order.receiver_phone || "";
    const shippingAddress = order.shippingAddress || order.shipping_address || "";
    const customerEmail = order.customerEmail || order.customer_email || "";
    const paidAt = order.paidAt || order.paid_at;
    const paymentError = order.paymentError || order.payment_error || "";
    const sourceType = order.sourceType || order.source_type || "";
    const items = order.items || [];

    currentOrderId = orderId;
    currentOrderIsPaymentFailed = orderStatus === "PAYMENT_FAILED";

    const orderStatusClass = getOrderStatusClass(orderStatus);
    const paymentStatusClass = getPaymentStatusClass(paymentStatus);

    const itemsHtml = items.map(item => renderOrderItem(item)).join("");

    const canCancel = !["SHIPPING", "COMPLETED", "CANCELLED", "PAYMENT_FAILED"].includes(orderStatus);
    const canConfirmReceived = orderStatus === "SHIPPING";

    const actionButtonsHtml = (canCancel || canConfirmReceived) ? `
        <div class="detail-section order-detail-side" style="position: static;">
            <div class="detail-section-header">
                <div class="detail-section-title">⚙️ Thao tác</div>
            </div>
            <div class="detail-section-body action-buttons">
                ${canConfirmReceived ? `
                    <button class="btn-received" id="received-order-btn">
                        ✅ Tôi đã nhận hàng
                    </button>
                ` : ""}
                ${canCancel ? `
                    <button class="btn-cancel" id="cancel-order-btn">
                        ✖ Hủy đơn hàng
                    </button>
                ` : ""}
            </div>
        </div>
    ` : "";

    const sourceLabel = sourceType === "CART" ? "Từ giỏ hàng" : sourceType === "BUY_NOW" ? "Mua ngay" : sourceType;

    detailContent.className = "";
    detailContent.innerHTML = `
        <div class="order-detail-layout">
            <!-- Main Column -->
            <div class="order-detail-main">

                <!-- Header Card -->
                <div class="detail-section">
                    <div class="detail-section-body">
                        <div class="order-header">
                            <div>
                                <div class="order-id">Đơn hàng #${escapeHtml(orderId)}</div>
                                <div class="order-date">🕐 ${escapeHtml(formatDate(order.createdAt || order.created_at))}</div>
                            </div>
                            <div class="order-statuses">
                                <span class="status-badge ${orderStatusClass}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
                                <span class="status-badge ${paymentStatusClass}">💳 ${escapeHtml(getPaymentStatusText(paymentStatus))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Products Card -->
                <div class="detail-section">
                    <div class="detail-section-header">
                        <div class="detail-section-title">🛍️ Sản phẩm đặt hàng</div>
                        <span style="font-size: 0.875rem; color: var(--text-3);">${items.length} sản phẩm</span>
                    </div>
                    <div class="detail-section-body">
                        ${itemsHtml}
                    </div>
                </div>

                <!-- Receiver Info Card -->
                <div class="detail-section">
                    <div class="detail-section-header">
                        <div class="detail-section-title">📦 Thông tin giao hàng</div>
                    </div>
                    <div class="detail-section-body">
                        ${receiverName ? `
                            <div class="info-row">
                                <span class="info-label">Người nhận</span>
                                <span class="info-value">${escapeHtml(receiverName)}</span>
                            </div>
                        ` : ""}
                        ${receiverPhone ? `
                            <div class="info-row">
                                <span class="info-label">Điện thoại</span>
                                <span class="info-value">${escapeHtml(receiverPhone)}</span>
                            </div>
                        ` : ""}
                        ${customerEmail ? `
                            <div class="info-row">
                                <span class="info-label">Email</span>
                                <span class="info-value">${escapeHtml(customerEmail)}</span>
                            </div>
                        ` : ""}
                        ${shippingAddress ? `
                            <div class="info-row">
                                <span class="info-label">Địa chỉ</span>
                                <span class="info-value shipping-address">${escapeHtml(shippingAddress)}</span>
                            </div>
                        ` : ""}
                        ${!receiverName && !receiverPhone && !shippingAddress ? `
                            <div style="color: var(--text-3); font-size: 0.9rem;">Không có thông tin giao hàng.</div>
                        ` : ""}
                    </div>
                </div>

                <!-- Payment Info Card -->
                <div class="detail-section">
                    <div class="detail-section-header">
                        <div class="detail-section-title">💳 Thông tin thanh toán</div>
                    </div>
                    <div class="detail-section-body">
                        <div class="info-row">
                            <span class="info-label">Phương thức</span>
                            <span class="info-value">${escapeHtml(getPaymentMethodTypeLabel(paymentMethodType))}</span>
                        </div>
                        ${paymentMethodDisplay ? `
                            <div class="info-row">
                                <span class="info-label">Tên/Số TK</span>
                                <span class="info-value">${escapeHtml(paymentMethodDisplay)}</span>
                            </div>
                        ` : ""}
                        <div class="info-row">
                            <span class="info-label">Trạng thái TT</span>
                            <span class="info-value">
                                <span class="status-badge ${paymentStatusClass}" style="font-size: 0.8rem; padding: 4px 12px;">
                                    ${escapeHtml(getPaymentStatusText(paymentStatus))}
                                </span>
                            </span>
                        </div>
                        ${paidAt ? `
                            <div class="info-row">
                                <span class="info-label">Thanh toán lúc</span>
                                <span class="info-value">${escapeHtml(formatDate(paidAt))}</span>
                            </div>
                        ` : ""}
                        ${paymentError ? `
                            <div class="info-row">
                                <span class="info-label">Lỗi TT</span>
                                <span class="info-value" style="color: #d70018;">${escapeHtml(paymentError)}</span>
                            </div>
                        ` : ""}
                        ${sourceLabel ? `
                            <div class="info-row">
                                <span class="info-label">Loại đơn</span>
                                <span class="info-value">${escapeHtml(sourceLabel)}</span>
                            </div>
                        ` : ""}
                    </div>
                </div>

            </div>

            <!-- Side Column -->
            <div class="order-detail-side">

                <!-- Summary Card -->
                <div class="detail-section">
                    <div class="detail-section-header">
                        <div class="detail-section-title">🧾 Tóm tắt đơn hàng</div>
                    </div>
                    <div class="detail-section-body">
                        <div class="summary-row">
                            <span>Số lượng sản phẩm</span>
                            <strong>${escapeHtml(order.totalQuantity || order.total_quantity || 0)}</strong>
                        </div>
                        <div class="summary-row summary-total">
                            <span>Tổng tiền</span>
                            <span>${formatPrice(order.totalAmount || order.total_amount || 0)}</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                ${(canCancel || canConfirmReceived) ? `
                    <div class="detail-section">
                        <div class="detail-section-header">
                            <div class="detail-section-title">⚙️ Thao tác</div>
                        </div>
                        <div class="detail-section-body action-buttons">
                            ${canConfirmReceived ? `
                                <button class="btn-received" id="received-order-btn">
                                    ✅ Tôi đã nhận hàng
                                </button>
                            ` : ""}
                            ${canCancel ? `
                                <button class="btn-cancel" id="cancel-order-btn">
                                    ✖ Hủy đơn hàng
                                </button>
                            ` : ""}
                        </div>
                    </div>
                ` : ""}

                <!-- Back Link -->
                <a class="back-link" href="/orders">
                    ← Quay lại danh sách đơn hàng
                </a>

            </div>
        </div>
    `;

    bindActionButtons(order);
    setupPaymentStatusPolling(order);
}

function renderOrderItem(item) {
    const productName = item.productName || item.product_name;
    const sizeName = item.sizeName || item.size_name || "";
    const colorName = item.colorName || item.color_name || "";
    const colorCode = item.colorCode || item.color_code || "";
    const imageUrl = item.imageUrl || item.image_url;
    const unitPrice = item.unitPrice || item.unit_price || 0;
    const quantity = item.quantity || 0;
    const subtotal = item.subtotal || 0;
    const categoryName = item.categoryName || item.category_name || "";

    const imageHtml = imageUrl
        ? `<img class="item-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : `<div style="font-size: 1.75rem;">📦</div>`;

    const colorDotHtml = colorCode
        ? `<span class="color-dot" style="background: ${escapeAttribute(colorCode)};"></span>`
        : "";

    const variantHtml = (sizeName || colorName)
        ? `
            <div class="variant-info">
                ${sizeName ? `<span class="variant-badge">📏 ${escapeHtml(sizeName)}</span>` : ""}
                ${colorName ? `<span class="variant-badge">${colorDotHtml} ${escapeHtml(colorName)}</span>` : ""}
            </div>
        `
        : "";

    return `
        <div class="order-item">
            <div class="item-image-wrap">
                ${imageHtml}
            </div>

            <div class="item-info">
                <div class="item-name">${escapeHtml(productName)}</div>
                ${categoryName ? `<div class="item-meta">${escapeHtml(categoryName)}</div>` : ""}
                ${variantHtml}
                <div class="item-bottom">
                    <span class="item-qty">SL: ${escapeHtml(quantity)}</span>
                    <div>
                        <div class="item-price">${formatPrice(unitPrice)}</div>
                        <div class="item-subtotal">Tạm tính: ${formatPrice(subtotal)}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
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
        loadOrderDetail();

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
        loadOrderDetail();

    } catch (error) {
        console.error("Lỗi xác nhận đã nhận hàng:", error);
        showMessage(error.message || "Không thể xác nhận đã nhận hàng.", "error");
    }
}

function setupPaymentStatusPolling(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const paymentStatus = order.paymentStatus || order.payment_status;

    if (paymentPollingTimer) {
        clearTimeout(paymentPollingTimer);
        paymentPollingTimer = null;
    }

    const isWaitingPayment =
        orderStatus === "PENDING_PAYMENT" || paymentStatus === "PENDING";

    if (!isWaitingPayment) {
        clearPendingPaymentFlag(orderId);
        return;
    }

    if (paymentPollingCount >= MAX_PAYMENT_POLLING_COUNT) {
        return;
    }

    paymentPollingCount += 1;

    paymentPollingTimer = setTimeout(() => {
        loadOrderDetail();
    }, 2000);
}

async function cleanupFailedOrderBeforeLeave() {
    if (!currentOrderId || !currentOrderIsPaymentFailed || cleanupStarted) {
        return;
    }

    cleanupStarted = true;

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/me/${currentOrderId}/failed-cleanup`, {
            method: "DELETE"
        });

        if (!response) return;

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            console.error("Cleanup failed order error:", data.error || response.status);
        }

    } catch (error) {
        console.error("Lỗi cleanup failed order trước khi rời trang:", error);
    }
}

function setupLeavePageCleanup() {
    document.addEventListener("click", async (event) => {
        const link = event.target.closest("a");

        if (!link) return;

        const href = link.getAttribute("href");

        if (!href || href.startsWith("#")) {
            return;
        }

        const isInternalLink =
            href.startsWith("/") || href.startsWith(window.location.origin);

        if (!isInternalLink) {
            return;
        }

        if (!currentOrderIsPaymentFailed || !currentOrderId) {
            return;
        }

        event.preventDefault();

        await cleanupFailedOrderBeforeLeave();

        window.location.href = href;
    });
}

function setupUnloadCleanup() {
    window.addEventListener("pagehide", () => {
        if (!currentOrderId || !currentOrderIsPaymentFailed || cleanupStarted) {
            return;
        }

        cleanupStarted = true;

        const accessToken = getAccessToken();

        if (!accessToken) {
            return;
        }

        fetch(`${ORDER_SERVICE_URL}/api/orders/me/${currentOrderId}/failed-cleanup`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            },
            keepalive: true
        }).catch(() => {});
    });
}