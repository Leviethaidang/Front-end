const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";
const PAYMENT_SERVICE_URL = window.APP_CONFIG?.PAYMENT_SERVICE_URL || "";

const editForm = document.getElementById("edit-profile-form");
const messageBox = document.getElementById("edit-profile-message");
const saveButton = document.querySelector("#edit-profile-form .btn-primary");
const paymentTypeSelect = document.getElementById("paymentType");
const addPaymentMethodButton = document.getElementById("addPaymentMethodBtn");

let currentProfile = null;
let paymentMethods = [];

loadEditProfile();
setupPaymentControls();

if (editForm) {
    editForm.addEventListener("submit", updateProfile);
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

function setMessage(message, type = "success") {
    if (!messageBox) {
        return;
    }

    messageBox.className = `message ${type}`;
    messageBox.textContent = message;
}

function setPaymentMessage(message, type = "success") {
    const paymentMessageBox = document.getElementById("payment-message-box");

    if (!paymentMessageBox) {
        return;
    }

    paymentMessageBox.className = `message ${type}`;
    paymentMessageBox.textContent = message;
}

function showLoginRequired() {
    setMessage("Bạn chưa đăng nhập. Vui lòng đăng nhập để chỉnh sửa hồ sơ.", "error");
}

async function fetchWithAuth(url, options = {}) {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
        showLoginRequired();
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
        showLoginRequired();
        return null;
    }

    return response;
}

async function loadEditProfile() {
    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET"
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải hồ sơ.", "error");
            return;
        }

        currentProfile = data.profile || {};

        setInputValue("edit-name", currentProfile.full_name);
        setInputValue("edit-email", currentProfile.email);
        setInputValue("edit-phone", currentProfile.phone_number);
        setInputValue("edit-address", currentProfile.default_shipping_address);
        setInputValue("momoPhoneNumber", currentProfile.phone_number);

        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi load edit profile:", error);
        setMessage("Không thể kết nối User Service.", "error");
    }
}

async function updateProfile(event) {
    event.preventDefault();

    const fullName = getInputValue("edit-name");
    const email = getInputValue("edit-email");
    const phoneNumber = getInputValue("edit-phone");
    const defaultShippingAddress = getInputValue("edit-address");

    if (!fullName) {
        setMessage("Họ và tên không được để trống.", "error");
        return;
    }

    if (!email) {
        setMessage("Email không được để trống.", "error");
        return;
    }

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "error");
        return;
    }

    try {
        setSaving(true);

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "PUT",
            body: JSON.stringify({
                fullName,
                email,
                phoneNumber,
                defaultShippingAddress
            })
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật hồ sơ thất bại.", "error");
            return;
        }

        if (data.profile?.full_name) {
            localStorage.setItem("fullName", data.profile.full_name);

            if (typeof renderNavbarAuthSection === "function") {
                renderNavbarAuthSection();
            }
        }

        if (data.emailVerificationRequired) {
            setMessage(data.message || "Vui lòng xác minh email mới.", "warning");
            return;
        }

        setMessage(data.message || "Cập nhật hồ sơ thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1000);

    } catch (error) {
        console.error("Lỗi update profile:", error);
        setMessage("Không thể kết nối User Service.", "error");

    } finally {
        setSaving(false);
    }
}

function setupPaymentControls() {
    if (paymentTypeSelect) {
        paymentTypeSelect.addEventListener("change", handlePaymentTypeChange);
        handlePaymentTypeChange();
    }

    if (addPaymentMethodButton) {
        addPaymentMethodButton.addEventListener("click", addPaymentMethod);
    }
}

function handlePaymentTypeChange() {
    const paymentType = paymentTypeSelect?.value;
    const momoFields = document.getElementById("momoFields");
    const bankFields = document.getElementById("bankFields");

    if (!momoFields || !bankFields) {
        return;
    }

    momoFields.classList.toggle("payment-hidden", paymentType !== "MOMO");
    bankFields.classList.toggle("payment-hidden", paymentType !== "BANK");
}

async function loadPaymentMethods() {
    const paymentMethodsBox = document.getElementById("payment-methods-box");

    if (!paymentMethodsBox) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`, {
            method: "GET"
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            paymentMethodsBox.innerHTML = `<p class="message error">${escapeHtml(data.error || "Không thể tải phương thức thanh toán.")}</p>`;
            return;
        }

        paymentMethods = data.paymentMethods || [];
        renderPaymentMethodsTable();

    } catch (error) {
        console.error("Lỗi load payment methods:", error);
        paymentMethodsBox.innerHTML = `<p class="message error">Không thể kết nối Payment Service.</p>`;
    }
}

function renderPaymentMethodsTable() {
    const paymentMethodsBox = document.getElementById("payment-methods-box");

    if (!paymentMethodsBox) {
        return;
    }

    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        paymentMethodsBox.innerHTML = `<p>Chưa có phương thức thanh toán.</p>`;
        return;
    }

    const rowsHtml = paymentMethods.map(method => {
        const paymentMethodId = method.payment_method_id;
        const methodType = method.method_type;
        const isDefault = Number(method.is_default) === 1;
        const isSystemDefault = Number(method.is_system_default) === 1;

        const defaultBadge = isDefault
            ? `<span class="badge badge-default">Mặc định</span>`
            : "";

        const setDefaultButton = isDefault
            ? `<span class="muted-text">Đang mặc định</span>`
            : `<button class="btn-small btn-blue" data-action="set-default" data-id="${paymentMethodId}">Đặt mặc định</button>`;

        const deleteButton = isSystemDefault || methodType === "COD"
            ? `<span class="muted-text">Không thể xóa</span>`
            : `<button class="btn-small btn-danger" data-action="delete" data-id="${paymentMethodId}">Xóa</button>`;

        return `
            <tr>
                <td>${escapeHtml(getPaymentTypeLabel(methodType))}</td>
                <td>${escapeHtml(method.display_name || "")}${defaultBadge}</td>
                <td>${escapeHtml(formatPaymentDetail(method))}</td>
                <td>
                    <div class="payment-actions">
                        ${setDefaultButton}
                        ${deleteButton}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    paymentMethodsBox.innerHTML = `
        <div class="table-wrapper">
            <table class="payment-table">
                <thead>
                    <tr>
                        <th>Loại</th>
                        <th>Tên hiển thị</th>
                        <th>Thông tin</th>
                        <th>Thao tác</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;

    paymentMethodsBox.querySelectorAll("button[data-action='set-default']").forEach(button => {
        button.addEventListener("click", () => {
            setDefaultPaymentMethod(button.getAttribute("data-id"));
        });
    });

    paymentMethodsBox.querySelectorAll("button[data-action='delete']").forEach(button => {
        button.addEventListener("click", () => {
            deletePaymentMethod(button.getAttribute("data-id"));
        });
    });
}

function getPaymentTypeLabel(methodType) {
    if (methodType === "COD") return "COD";
    if (methodType === "MOMO") return "MoMo";
    if (methodType === "BANK") return "Ngân hàng";
    return methodType || "Khác";
}

function formatPaymentDetail(method) {
    if (method.method_type === "COD") {
        return "Thanh toán khi nhận hàng";
    }

    if (method.method_type === "MOMO") {
        return method.momo_phone_number || "Chưa có số điện thoại";
    }

    if (method.method_type === "BANK") {
        const bankName = method.bank_name || "";
        const accountNumber = method.bank_account_number || "";

        if (!bankName && !accountNumber) {
            return "Chưa có thông tin ngân hàng";
        }

        return `${bankName} - ${accountNumber}`;
    }

    return "";
}

async function addPaymentMethod() {
    const paymentType = paymentTypeSelect?.value;

    const body = {
        methodType: paymentType
    };

    if (paymentType === "MOMO") {
        const momoPhoneNumber = getInputValue("momoPhoneNumber");

        if (!momoPhoneNumber) {
            setPaymentMessage("Vui lòng nhập số điện thoại MoMo.", "error");
            return;
        }

        body.momoPhoneNumber = momoPhoneNumber;
    }

    if (paymentType === "BANK") {
        const bankName = getInputValue("bankName");
        const bankAccountNumber = getInputValue("bankAccountNumber");

        if (!bankName) {
            setPaymentMessage("Vui lòng chọn ngân hàng.", "error");
            return;
        }

        if (!bankAccountNumber) {
            setPaymentMessage("Vui lòng nhập số tài khoản.", "error");
            return;
        }

        body.bankName = bankName;
        body.bankAccountNumber = bankAccountNumber;
    }

    try {
        setPaymentLoading(true);

        const response = await fetchWithAuth(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Liên kết phương thức thanh toán thất bại.", "error");
            return;
        }

        setPaymentMessage(data.message || "Liên kết phương thức thanh toán thành công.", "success");
        clearPaymentForm();
        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi thêm payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "error");

    } finally {
        setPaymentLoading(false);
    }
}

function clearPaymentForm() {
    if (paymentTypeSelect?.value === "MOMO") {
        setInputValue("momoPhoneNumber", currentProfile?.phone_number);
    }

    if (paymentTypeSelect?.value === "BANK") {
        setInputValue("bankName", "");
        setInputValue("bankAccountNumber", "");
    }
}

async function setDefaultPaymentMethod(paymentMethodId) {
    if (!paymentMethodId) {
        return;
    }

    try {
        const response = await fetchWithAuth(
            `${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods/${paymentMethodId}/default`,
            { method: "PUT" }
        );

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Không thể đặt phương thức mặc định.", "error");
            return;
        }

        setPaymentMessage(data.message || "Đã đặt phương thức thanh toán mặc định.", "success");
        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi set default payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "error");
    }
}

async function deletePaymentMethod(paymentMethodId) {
    if (!paymentMethodId) {
        return;
    }

    const confirmed = confirm("Bạn có chắc muốn xóa phương thức thanh toán này không?");

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetchWithAuth(
            `${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods/${paymentMethodId}`,
            { method: "DELETE" }
        );

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Không thể xóa phương thức thanh toán.", "error");
            return;
        }

        setPaymentMessage(data.message || "Đã xóa phương thức thanh toán.", "success");
        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi delete payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "error");
    }
}

function setInputValue(id, value) {
    const input = document.getElementById(id);

    if (input) {
        input.value = value || "";
    }
}

function getInputValue(id) {
    const input = document.getElementById(id);

    return input ? input.value.trim() : "";
}

function setSaving(isSaving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = isSaving;
    saveButton.textContent = isSaving ? "Đang lưu..." : "Lưu thay đổi";
}

function setPaymentLoading(isLoading) {
    if (!addPaymentMethodButton) {
        return;
    }

    addPaymentMethodButton.disabled = isLoading;
    addPaymentMethodButton.textContent = isLoading
        ? "Đang liên kết..."
        : "Liên kết phương thức thanh toán";
}
