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
        <div class="card border-0 shadow-sm mb-4">
            <div class="card-header bg-white py-3">
                <h5 class="mb-0">⚙️ Thao tác</h5>
            </div>
            <div class="card-body">
                ${canConfirmReceived ? `
                    <button class="btn btn-success w-100 mb-2" id="received-order-btn">
                        ✅ Tôi đã nhận hàng
                    </button>
                ` : ""}
                ${canCancel ? `
                    <button class="btn btn-outline-danger w-100" id="cancel-order-btn">
                        ✖ Hủy đơn hàng
                    </button>
                ` : ""}
            </div>
        </div>
    ` : "";

    const sourceLabel = sourceType === "CART" ? "Từ giỏ hàng" : sourceType === "BUY_NOW" ? "Mua ngay" : sourceType;

    detailContent.className = "";
    detailContent.innerHTML = `
        <div class="row">
            <!-- Main Column -->
            <div class="col-lg-8">
                <!-- Header Card -->
                <div class="modern-card mb-4">
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-center flex-wrap">
                            <div>
                                <h5 class="mb-1 fw-bold">Đơn hàng #${escapeHtml(orderId)}</h5>
                                <div class="text-muted small">
                                    <i class="bi bi-clock"></i> ${escapeHtml(formatDate(order.createdAt || order.created_at))}
                                </div>
                            </div>
                            <div class="mt-2 mt-md-0">
                                <span class="badge ${orderStatusClass === 'pending' ? 'bg-warning text-dark' : orderStatusClass === 'processing' ? 'bg-info text-dark' : orderStatusClass === 'shipped' ? 'bg-primary' : orderStatusClass === 'delivered' ? 'bg-success' : 'bg-danger'}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
                                <span class="badge bg-secondary ms-1">💳 ${escapeHtml(getPaymentStatusText(paymentStatus))}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Products Card -->
                <div class="modern-card mb-4">
                    <div class="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                        <h5 class="mb-0">🛍️ Sản phẩm đặt hàng</h5>
                        <span class="text-muted small">${items.length} sản phẩm</span>
                    </div>
                    <div class="card-body p-0">
                        ${itemsHtml}
                    </div>
                </div>

                <!-- Receiver Info Card -->
                <div class="modern-card mb-4">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0">📦 Thông tin giao hàng</h5>
                    </div>
                    <div class="card-body p-4">
                        ${receiverName ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Người nhận</div>
                                <div class="col-sm-8">${escapeHtml(receiverName)}</div>
                            </div>
                        ` : ""}
                        ${receiverPhone ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Điện thoại</div>
                                <div class="col-sm-8">${escapeHtml(receiverPhone)}</div>
                            </div>
                        ` : ""}
                        ${customerEmail ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Email</div>
                                <div class="col-sm-8">${escapeHtml(customerEmail)}</div>
                            </div>
                        ` : ""}
                        ${shippingAddress ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Địa chỉ</div>
                                <div class="col-sm-8">${escapeHtml(shippingAddress)}</div>
                            </div>
                        ` : ""}
                        ${!receiverName && !receiverPhone && !shippingAddress ? `
                            <div class="text-muted small">Không có thông tin giao hàng.</div>
                        ` : ""}
                    </div>
                </div>

                <!-- Payment Info Card -->
                <div class="modern-card mb-4">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0">💳 Thông tin thanh toán</h5>
                    </div>
                    <div class="card-body p-4">
                        <div class="row mb-2">
                            <div class="col-sm-4 text-muted fw-bold">Phương thức</div>
                            <div class="col-sm-8">${escapeHtml(getPaymentMethodTypeLabel(paymentMethodType))}</div>
                        </div>
                        ${paymentMethodDisplay ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Tên/Số TK</div>
                                <div class="col-sm-8">${escapeHtml(paymentMethodDisplay)}</div>
                            </div>
                        ` : ""}
                        <div class="row mb-2">
                            <div class="col-sm-4 text-muted fw-bold">Trạng thái TT</div>
                            <div class="col-sm-8">
                                <span class="badge ${paymentStatusClass === 'payment-paid' ? 'bg-success' : paymentStatusClass === 'payment-failed' ? 'bg-danger' : 'bg-warning text-dark'}">
                                    ${escapeHtml(getPaymentStatusText(paymentStatus))}
                                </span>
                            </div>
                        </div>
                        ${paidAt ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Thanh toán lúc</div>
                                <div class="col-sm-8">${escapeHtml(formatDate(paidAt))}</div>
                            </div>
                        ` : ""}
                        ${paymentError ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Lỗi TT</div>
                                <div class="col-sm-8 text-danger">${escapeHtml(paymentError)}</div>
                            </div>
                        ` : ""}
                        ${sourceLabel ? `
                            <div class="row mb-2">
                                <div class="col-sm-4 text-muted fw-bold">Loại đơn</div>
                                <div class="col-sm-8">${escapeHtml(sourceLabel)}</div>
                            </div>
                        ` : ""}
                    </div>
                </div>

            </div>

            <!-- Side Column -->
            <div class="col-lg-4">

                <!-- Summary Card -->
                <div class="modern-card mb-4">
                    <div class="card-header bg-white py-3">
                        <h5 class="mb-0">🧾 Tóm tắt đơn hàng</h5>
                    </div>
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between mb-2">
                            <span>Số lượng sản phẩm</span>
                            <strong>${escapeHtml(order.totalQuantity || order.total_quantity || 0)}</strong>
                        </div>
                        <hr>
                        <div class="d-flex justify-content-between mb-3">
                            <span class="fs-5 fw-bold">Tổng tiền</span>
                            <span class="fs-5 fw-bold text-success">${formatPrice(order.totalAmount || order.total_amount || 0)}</span>
                        </div>
                    </div>
                </div>

                <!-- Action Buttons -->
                ${actionButtonsHtml}

                <!-- Back Link -->
                <a class="text-center d-block text-decoration-none mt-3" href="/orders">
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
        ? `<img style="width:60px; height:60px; object-fit:cover;" class="rounded" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : `<div class="d-flex align-items-center justify-content-center bg-light text-muted rounded" style="width:60px; height:60px; font-size:24px;">📦</div>`;

    const colorDotHtml = colorCode
        ? `<span style="display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; border:1px solid #ddd; background: ${escapeAttribute(colorCode)};"></span>`
        : "";

    const variantHtml = (sizeName || colorName)
        ? `
            <div class="small mb-1">
                ${sizeName ? `<span class="badge bg-secondary me-1">Size: ${escapeHtml(sizeName)}</span>` : ""}
                ${colorName ? `<span class="badge bg-secondary">${colorDotHtml} ${escapeHtml(colorName)}</span>` : ""}
            </div>
        `
        : "";

    return `
        <div class="d-flex align-items-center p-3 border-bottom">
            <div class="me-3">
                ${imageHtml}
            </div>

            <div class="flex-grow-1">
                <div class="fw-bold">${escapeHtml(productName)}</div>
                ${categoryName ? `<div class="small text-muted mb-1">${escapeHtml(categoryName)}</div>` : ""}
                ${variantHtml}
                
                <div class="d-flex align-items-center mt-2">
                    <span class="px-3 fw-bold text-muted border-end">SL: ${escapeHtml(quantity)}</span>
                    <div class="ms-3">
                        <div class="text-muted small text-decoration-line-through">${formatPrice(unitPrice)}</div>
                        <div class="fw-bold">${formatPrice(subtotal)}</div>
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