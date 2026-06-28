const ORDER_SERVICE_URL = window.APP_CONFIG?.ORDER_SERVICE_URL || "";

const content = document.getElementById("admin-orders-content");
const messageBox = document.getElementById("message");

let orderDetailModal = null;

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
    messageBox.className = `alert alert-${type === "success" ? "success" : "danger"} mt-3`;
    messageBox.textContent = message;

    setTimeout(() => {
        messageBox.className = "";
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
    if (status === "PENDING_PAYMENT" || status === "PENDING") return "bg-warning text-dark";
    if (status === "CONFIRMED" || status === "PAID") return "bg-primary";
    if (status === "SHIPPING") return "bg-info text-dark";
    if (status === "COMPLETED") return "bg-success";
    if (status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "FAILED") return "bg-danger";
    return "bg-secondary";
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

    content.className = "";
    content.innerHTML = `
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                    <tr>
                        <th>Mã đơn</th>
                        <th>Ngày đặt</th>
                        <th>Người nhận</th>
                        <th>Phương thức thanh toán</th>
                        <th>Thanh toán</th>
                        <th>Số lượng</th>
                        <th>Tổng tiền</th>
                        <th>Trạng thái đơn</th>
                        <th class="text-end">Cập nhật</th>
                    </tr>
                </thead>

                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
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
            <td class="align-middle">
                <div class="fw-bold text-primary">#${escapeHtml(orderId)}</div>
                <div class="text-muted small">${escapeHtml(order.sourceType || order.source_type || "")}</div>
            </td>

            <td class="align-middle text-muted small">
                ${escapeHtml(formatDate(order.createdAt || order.created_at))}
            </td>

            <td class="align-middle">
                <div class="fw-bold">${escapeHtml(receiverName)}</div>
                <div class="text-muted small">${escapeHtml(receiverPhone)}</div>
                <div class="text-muted small text-truncate" style="max-width: 150px;" title="${escapeHtml(shippingAddress)}">${escapeHtml(shippingAddress)}</div>
            </td>

            <td class="align-middle">
                <div class="fw-bold">${escapeHtml(paymentMethodType)}</div>
                <div class="text-muted small">${escapeHtml(paymentMethodDisplayName)}</div>
            </td>

            <td class="align-middle">
                <span class="badge ${getStatusClass(paymentStatus)}">
                    ${escapeHtml(getPaymentStatusText(paymentStatus))}
                </span>
            </td>

            <td class="align-middle text-center fw-bold">
                ${escapeHtml(order.totalQuantity || order.total_quantity || 0)}
            </td>

            <td class="align-middle text-success fw-bold text-nowrap">
                ${formatPrice(order.totalAmount || order.total_amount || 0)}
            </td>

            <td class="align-middle">
                <span class="badge ${getStatusClass(orderStatus)}">
                    ${escapeHtml(getOrderStatusText(orderStatus))}
                </span>
            </td>

            <td class="align-middle text-end">
                <div class="d-flex flex-column gap-2 align-items-end">
                    <button
                        class="btn btn-sm btn-outline-info view-detail-btn text-nowrap"
                        data-order-id="${escapeAttribute(orderId)}"
                    >
                        <i class="bi bi-eye"></i> Xem chi tiết
                    </button>

                    <div class="input-group input-group-sm flex-nowrap" style="width: 200px;">
                        <select
                            class="form-select border-primary"
                            id="status-select-${escapeAttribute(orderId)}"
                            data-current-status="${escapeAttribute(orderStatus)}"
                        >
                            ${renderStatusOptions(orderStatus)}
                        </select>
                        <button
                            class="btn btn-primary update-status-btn"
                            data-order-id="${escapeAttribute(orderId)}"
                        >
                            <i class="bi bi-check-lg"></i>
                        </button>
                    </div>
                </div>
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
    const updateButtons = document.querySelectorAll(".update-status-btn");
    const detailButtons = document.querySelectorAll(".view-detail-btn");

    updateButtons.forEach(button => {
        button.addEventListener("click", () => {
            updateOrderStatus(button.dataset.orderId);
        });
    });

    detailButtons.forEach(button => {
        button.addEventListener("click", () => {
            openOrderDetailModal(button.dataset.orderId);
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

function ensureOrderDetailModal() {
    if (orderDetailModal) {
        return orderDetailModal;
    }

    const modal = document.createElement("div");

    modal.id = "order-detail-modal";
    modal.className = "modal fade";
    modal.setAttribute("tabindex", "-1");

    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fw-bold">Chi tiết đơn hàng</h5>
                    <button type="button" class="btn-close" id="close-order-detail-modal-btn" aria-label="Close"></button>
                </div>
                <div class="modal-body p-4" id="order-detail-modal-content">
                    Đang tải...
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeOrderDetailModal();
        }
    });

    modal.querySelector("#close-order-detail-modal-btn").addEventListener("click", () => {
        closeOrderDetailModal();
    });

    orderDetailModal = modal;

    return orderDetailModal;
}

function closeOrderDetailModal() {
    if (!orderDetailModal) return;

    orderDetailModal.classList.remove("show");
}

async function openOrderDetailModal(orderId) {
    const modal = ensureOrderDetailModal();
    const modalContent = document.getElementById("order-detail-modal-content");

    modal.classList.add("show");

    modalContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Đang tải...</span>
            </div>
            <p class="mt-3 text-muted">Đang tải chi tiết đơn hàng #${escapeHtml(orderId)}...</p>
        </div>
    `;

    try {
        const response = await fetchWithAuth(`${ORDER_SERVICE_URL}/api/orders/admin/orders/${orderId}`);

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải chi tiết đơn hàng.");
        }

        modalContent.innerHTML = renderOrderDetailContent(data.order);

    } catch (error) {
        console.error("Lỗi tải chi tiết đơn hàng admin:", error);

        modalContent.innerHTML = `
            <div class="modal-error">
                ${escapeHtml(error.message || "Không thể tải chi tiết đơn hàng.")}
            </div>
        `;
    }
}

function renderOrderDetailContent(order) {
    const orderId = order.orderId || order.order_id;
    const orderStatus = order.orderStatus || order.order_status;
    const paymentStatus = order.paymentStatus || order.payment_status;

    const receiverName = order.receiverName || order.receiver_name || "";
    const receiverPhone = order.receiverPhone || order.receiver_phone || "";
    const shippingAddress = order.shippingAddress || order.shipping_address || "";

    const paymentMethodType = order.paymentMethodType || order.payment_method_type || "";
    const paymentMethodDisplayName =
        order.paymentMethodDisplayName || order.payment_method_display_name || "";

    const items = order.items || [];

    return `
        <div class="card border mb-4 shadow-sm">
            <div class="card-header bg-light fw-bold">Thông tin chung</div>
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-3">
                        <div class="text-muted small mb-1">Mã đơn</div>
                        <div class="fw-bold text-primary">#${escapeHtml(orderId)}</div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-muted small mb-1">Ngày đặt</div>
                        <div>${escapeHtml(formatDate(order.createdAt || order.created_at))}</div>
                    </div>
                    <div class="col-md-3">
                        <div class="text-muted small mb-1">Trạng thái đơn</div>
                        <span class="badge ${getStatusClass(orderStatus)}">${escapeHtml(getOrderStatusText(orderStatus))}</span>
                    </div>
                    <div class="col-md-3">
                        <div class="text-muted small mb-1">Thanh toán</div>
                        <span class="badge ${getStatusClass(paymentStatus)}">${escapeHtml(getPaymentStatusText(paymentStatus))}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="row g-4 mb-4">
            <div class="col-md-6">
                <div class="card border h-100 shadow-sm">
                    <div class="card-header bg-light fw-bold">Thông tin nhận hàng</div>
                    <div class="card-body">
                        <div class="mb-2"><strong>Người nhận:</strong> ${escapeHtml(receiverName)}</div>
                        <div class="mb-2"><strong>Điện thoại:</strong> ${escapeHtml(receiverPhone)}</div>
                        <div><strong>Địa chỉ:</strong> ${escapeHtml(shippingAddress)}</div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border h-100 shadow-sm">
                    <div class="card-header bg-light fw-bold">Phương thức thanh toán</div>
                    <div class="card-body">
                        <div class="mb-2"><strong>Loại:</strong> ${escapeHtml(paymentMethodType)}</div>
                        <div><strong>Phương thức:</strong> ${escapeHtml(paymentMethodDisplayName)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="card border shadow-sm mb-4">
            <div class="card-header bg-light fw-bold">Sản phẩm cần đóng gói</div>
            <div class="card-body p-0">
                <div class="list-group list-group-flush">
                    ${items.length > 0
                        ? items.map(renderAdminOrderItem).join("")
                        : `<div class="list-group-item text-muted">Đơn hàng không có sản phẩm.</div>`
                    }
                </div>
            </div>
        </div>

        <div class="card border shadow-sm">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="text-muted">Tổng số lượng:</span>
                    <span class="fw-bold fs-5">${escapeHtml(order.totalQuantity || order.total_quantity || 0)}</span>
                </div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted">Tổng tiền:</span>
                    <span class="fw-bold fs-4 text-success">${formatPrice(order.totalAmount || order.total_amount || 0)}</span>
                </div>
            </div>
        </div>
    `;
}

function renderAdminOrderItem(item) {
    const productName = item.productName || item.product_name || "";
    const categoryName = item.categoryName || item.category_name || "Chưa phân loại";

    const sizeName = item.sizeName || item.size_name || "";
    const colorName = item.colorName || item.color_name || "";
    const colorCode = item.colorCode || item.color_code || "";

    const imageUrl = item.imageUrl || item.image_url || "";
    const unitPrice = item.unitPrice || item.unit_price || 0;
    const quantity = item.quantity || 0;
    const subtotal = item.subtotal || 0;

    const imageHtml = imageUrl
        ? `<img class="img-thumbnail me-3" style="width: 70px; height: 70px; object-fit: cover;" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(productName)}">`
        : `<div class="d-flex align-items-center justify-content-center bg-light text-muted rounded me-3" style="width: 70px; height: 70px;"><i class="bi bi-image fs-3"></i></div>`;

    const colorDotHtml = colorCode
        ? `<span class="rounded-circle d-inline-block border border-secondary align-middle me-1" style="width: 14px; height: 14px; background: ${escapeAttribute(colorCode)};"></span>`
        : "";

    const variantHtml = (sizeName || colorName)
        ? `
            <div class="d-flex flex-wrap gap-2 mb-2">
                <span class="badge bg-light text-dark border">
                    Size: ${escapeHtml(sizeName || "Không rõ")}
                </span>
                <span class="badge bg-light text-dark border d-flex align-items-center">
                    ${colorDotHtml}
                    Màu: ${escapeHtml(colorName || "Không rõ")}
                </span>
            </div>
        `
        : `
            <div class="text-warning small mb-2">
                <i class="bi bi-exclamation-triangle"></i> Đơn hàng cũ chưa có dữ liệu size/màu.
            </div>
        `;

    return `
        <div class="list-group-item p-3">
            <div class="d-flex align-items-start">
                ${imageHtml}
                <div class="flex-grow-1">
                    <h6 class="mb-1 fw-bold">${escapeHtml(productName)}</h6>
                    <div class="text-muted small mb-2">${escapeHtml(categoryName)}</div>
                    ${variantHtml}
                    
                    <div class="d-flex justify-content-between align-items-end mt-2">
                        <div>
                            <div class="text-danger fw-bold">Cần đóng gói: ${escapeHtml(quantity)}</div>
                        </div>
                        <div class="text-end">
                            <div class="text-muted small">Đơn giá: ${formatPrice(unitPrice)}</div>
                            <div class="fw-bold text-success mt-1">Tạm tính: ${formatPrice(subtotal)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}