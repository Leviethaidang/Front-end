const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";
const PAYMENT_SERVICE_URL = window.APP_CONFIG?.PAYMENT_SERVICE_URL || "";

const accessToken = localStorage.getItem("accessToken");
const editContent = document.getElementById("edit-content");

let currentProfile = null;
let paymentMethods = [];

loadEditProfile();

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

function setMessage(message, type = "success") {
    const messageBox = document.getElementById("message-box");

    if (!messageBox) {
        return;
    }

    messageBox.className = `message ${type}`;
    messageBox.textContent = message;
}

function setPaymentMessage(message, type = "success") {
    const messageBox = document.getElementById("payment-message-box");

    if (!messageBox) {
        return;
    }

    messageBox.className = `message ${type}`;
    messageBox.textContent = message;
}

function showLoginRequired() {
    editContent.innerHTML = `
        <p class="danger">Bạn chưa đăng nhập.</p>
        <a href="/login" class="login-link">Đăng nhập</a>
    `;
}

async function fetchWithAuth(url, options = {}) {
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
    if (!accessToken) {
        showLoginRequired();
        return;
    }

    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "GET"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            editContent.innerHTML = `
                <p class="danger">${escapeHtml(data.error || "Không thể tải profile.")}</p>
            `;
            return;
        }

        currentProfile = data.profile;

        renderEditForm(currentProfile);

        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi load edit profile:", error);

        editContent.innerHTML = `
            <p class="danger">Không thể kết nối User Service.</p>
        `;
    }
}

function renderEditForm(profile) {
    editContent.innerHTML = `
        <div class="section-block">
            <h3>Thông tin cá nhân</h3>

            <p>
                <strong>User ID:</strong>
                <span class="user-id">${escapeHtml(profile.user_id)}</span>
            </p>

            <label for="fullName">Họ và tên</label>
            <input
                id="fullName"
                value="${escapeAttribute(profile.full_name)}"
            >

            <label for="email">Email</label>
            <input
                id="email"
                type="email"
                value="${escapeAttribute(profile.email)}"
            >

            <label for="phoneNumber">Số điện thoại</label>
            <input
                id="phoneNumber"
                value="${escapeAttribute(profile.phone_number || "")}"
                placeholder="+84901234567"
            >

            <label for="defaultShippingAddress">Địa chỉ giao hàng mặc định</label>
            <textarea
                id="defaultShippingAddress"
                placeholder="Nhập địa chỉ giao hàng"
            >${escapeHtml(profile.default_shipping_address || "")}</textarea>

            <button id="updateProfileBtn" class="btn btn-green">
                Lưu thay đổi
            </button>

            <p id="message-box" class="message"></p>

            <div id="email-verify-box" class="section" style="display:none;">
                <h3>Xác minh email mới</h3>

                <p class="warning-text">
                    Nếu bạn đổi email, hãy kiểm tra email mới để lấy mã xác minh.
                </p>

                <input
                    id="emailVerifyCode"
                    placeholder="Mã xác minh email"
                >

                <button id="verifyEmailBtn" class="btn btn-blue">
                    Xác minh email
                </button>
            </div>
        </div>

        <div class="section payment-section">
            <h3>Phương thức thanh toán</h3>

            <div class="payment-add-box">
                <label for="paymentType">Loại phương thức thanh toán</label>
                <select id="paymentType">
                    <option value="MOMO">MoMo</option>
                    <option value="BANK">Ngân hàng</option>
                </select>

                <div id="momoFields">
                    <label for="momoPhoneNumber">Số điện thoại MoMo</label>
                    <input
                        id="momoPhoneNumber"
                        value="${escapeAttribute(profile.phone_number || "")}"
                        placeholder="+84901234567"
                    >
                </div>

                <div id="bankFields" style="display:none;">
                    <label for="bankName">Ngân hàng</label>
                    <select id="bankName">
                        <option value="">-- Chọn ngân hàng --</option>
                        <option value="Vietcombank">Vietcombank</option>
                        <option value="Techcombank">Techcombank</option>
                        <option value="ACB">ACB</option>
                        <option value="BIDV">BIDV</option>
                        <option value="VietinBank">VietinBank</option>
                        <option value="MB Bank">MB Bank</option>
                        <option value="VPBank">VPBank</option>
                        <option value="Sacombank">Sacombank</option>
                    </select>

                    <label for="bankAccountNumber">Số tài khoản</label>
                    <input
                        id="bankAccountNumber"
                        placeholder="Nhập số tài khoản"
                    >
                </div>

                <button id="addPaymentMethodBtn" class="btn btn-blue">
                    Liên kết phương thức thanh toán
                </button>

                <p id="payment-message-box" class="message"></p>
            </div>

            <h4>Danh sách phương thức thanh toán</h4>

            <div id="payment-methods-box">
                Đang tải phương thức thanh toán...
            </div>
        </div>
    `;

    document
        .getElementById("updateProfileBtn")
        .addEventListener("click", updateProfile);

    document
        .getElementById("verifyEmailBtn")
        .addEventListener("click", verifyNewEmail);

    document
        .getElementById("paymentType")
        .addEventListener("change", handlePaymentTypeChange);

    document
        .getElementById("addPaymentMethodBtn")
        .addEventListener("click", addPaymentMethod);
}

function handlePaymentTypeChange() {
    const paymentType = document.getElementById("paymentType").value;
    const momoFields = document.getElementById("momoFields");
    const bankFields = document.getElementById("bankFields");

    if (paymentType === "MOMO") {
        momoFields.style.display = "block";
        bankFields.style.display = "none";
        return;
    }

    if (paymentType === "BANK") {
        momoFields.style.display = "none";
        bankFields.style.display = "block";
    }
}

async function updateProfile() {
    const updateProfileBtn = document.getElementById("updateProfileBtn");

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const defaultShippingAddress = document
        .getElementById("defaultShippingAddress")
        .value
        .trim();

    if (!fullName) {
        setMessage("Họ và tên không được để trống.", "danger");
        return;
    }

    if (!email) {
        setMessage("Email không được để trống.", "danger");
        return;
    }

    if (!phoneNumber || !phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại phải dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
        return;
    }

    try {
        updateProfileBtn.disabled = true;
        updateProfileBtn.textContent = "Đang lưu...";

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me`, {
            method: "PUT",
            body: JSON.stringify({
                fullName,
                email,
                phoneNumber,
                defaultShippingAddress
            })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật thất bại.", "danger");
            return;
        }

        if (data.profile && data.profile.full_name) {
            localStorage.setItem("fullName", data.profile.full_name);

            if (typeof renderNavbarAuthSection === "function") {
                renderNavbarAuthSection();
            }
        }

        if (data.emailVerificationRequired) {
            setMessage(data.message || "Vui lòng xác minh email mới.", "warning");

            document.getElementById("email-verify-box").style.display = "block";
            return;
        }

        setMessage(data.message || "Cập nhật profile thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1200);

    } catch (error) {
        console.error("Lỗi update profile:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        updateProfileBtn.disabled = false;
        updateProfileBtn.textContent = "Lưu thay đổi";
    }
}

async function verifyNewEmail() {
    const verifyEmailBtn = document.getElementById("verifyEmailBtn");
    const code = document.getElementById("emailVerifyCode").value.trim();

    if (!code) {
        setMessage("Vui lòng nhập mã xác minh email.", "danger");
        return;
    }

    try {
        verifyEmailBtn.disabled = true;
        verifyEmailBtn.textContent = "Đang xác minh...";

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/me/verify-email`, {
            method: "POST",
            body: JSON.stringify({ code })
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xác minh email thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xác minh email mới thành công.", "success");

        setTimeout(() => {
            window.location.href = "/profile";
        }, 1200);

    } catch (error) {
        console.error("Lỗi verify email:", error);
        setMessage("Không thể kết nối User Service.", "danger");

    } finally {
        verifyEmailBtn.disabled = false;
        verifyEmailBtn.textContent = "Xác minh email";
    }
}

// ================================
// PAYMENT METHODS
// ================================
async function loadPaymentMethods() {
    const paymentMethodsBox = document.getElementById("payment-methods-box");

    if (!paymentMethodsBox) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`, {
            method: "GET"
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            paymentMethodsBox.innerHTML = `
                <p class="danger">${escapeHtml(data.error || "Không thể tải phương thức thanh toán.")}</p>
            `;
            return;
        }

        paymentMethods = data.paymentMethods || [];
        renderPaymentMethodsTable();

    } catch (error) {
        console.error("Lỗi load payment methods:", error);

        paymentMethodsBox.innerHTML = `
            <p class="danger">Không thể kết nối Payment Service.</p>
        `;
    }
}

function renderPaymentMethodsTable() {
    const paymentMethodsBox = document.getElementById("payment-methods-box");

    if (!paymentMethodsBox) {
        return;
    }

    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        paymentMethodsBox.innerHTML = `
            <p>Chưa có phương thức thanh toán.</p>
        `;
        return;
    }

    const rowsHtml = paymentMethods.map(method => {
        const paymentMethodId = method.payment_method_id;
        const methodType = method.method_type;
        const isDefault = Number(method.is_default) === 1;
        const isSystemDefault = Number(method.is_system_default) === 1;

        const methodTypeLabel = getPaymentTypeLabel(methodType);

        const defaultBadge = isDefault
            ? `<span class="badge badge-default">Mặc định</span>`
            : "";

        const setDefaultButton = isDefault
            ? `<span class="muted-text">Đang mặc định</span>`
            : `
                <button
                    class="btn-small btn-blue"
                    data-action="set-default"
                    data-id="${paymentMethodId}"
                >
                    Đặt mặc định
                </button>
            `;

        const deleteButton = isSystemDefault || methodType === "COD"
            ? `<span class="muted-text">Không thể xóa</span>`
            : `
                <button
                    class="btn-small btn-danger"
                    data-action="delete"
                    data-id="${paymentMethodId}"
                >
                    Xóa
                </button>
            `;

        return `
            <tr>
                <td>${escapeHtml(methodTypeLabel)}</td>
                <td>
                    ${escapeHtml(method.display_name || "")}
                    ${defaultBadge}
                </td>
                <td>${escapeHtml(formatPaymentDetail(method))}</td>
                <td class="payment-actions">
                    ${setDefaultButton}
                    ${deleteButton}
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
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;

    paymentMethodsBox.querySelectorAll("button[data-action='set-default']").forEach(button => {
        button.addEventListener("click", () => {
            const paymentMethodId = button.getAttribute("data-id");
            setDefaultPaymentMethod(paymentMethodId);
        });
    });

    paymentMethodsBox.querySelectorAll("button[data-action='delete']").forEach(button => {
        button.addEventListener("click", () => {
            const paymentMethodId = button.getAttribute("data-id");
            deletePaymentMethod(paymentMethodId);
        });
    });
}

function getPaymentTypeLabel(methodType) {
    if (methodType === "COD") {
        return "COD";
    }

    if (methodType === "MOMO") {
        return "MoMo";
    }

    if (methodType === "BANK") {
        return "Ngân hàng";
    }

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
    const addPaymentMethodBtn = document.getElementById("addPaymentMethodBtn");
    const paymentType = document.getElementById("paymentType").value;

    let body = {
        methodType: paymentType
    };

    if (paymentType === "MOMO") {
        const momoPhoneNumber = document.getElementById("momoPhoneNumber").value.trim();

        if (!momoPhoneNumber) {
            setPaymentMessage("Vui lòng nhập số điện thoại MoMo.", "danger");
            return;
        }

        body.momoPhoneNumber = momoPhoneNumber;
    }

    if (paymentType === "BANK") {
        const bankName = document.getElementById("bankName").value.trim();
        const bankAccountNumber = document.getElementById("bankAccountNumber").value.trim();

        if (!bankName) {
            setPaymentMessage("Vui lòng chọn ngân hàng.", "danger");
            return;
        }

        if (!bankAccountNumber) {
            setPaymentMessage("Vui lòng nhập số tài khoản.", "danger");
            return;
        }

        body.bankName = bankName;
        body.bankAccountNumber = bankAccountNumber;
    }

    try {
        addPaymentMethodBtn.disabled = true;
        addPaymentMethodBtn.textContent = "Đang liên kết...";

        const response = await fetchWithAuth(`${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Liên kết phương thức thanh toán thất bại.", "danger");
            return;
        }

        setPaymentMessage(data.message || "Liên kết phương thức thanh toán thành công.", "success");

        clearPaymentForm();
        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi thêm payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "danger");

    } finally {
        addPaymentMethodBtn.disabled = false;
        addPaymentMethodBtn.textContent = "Liên kết phương thức thanh toán";
    }
}

function clearPaymentForm() {
    const paymentType = document.getElementById("paymentType").value;

    if (paymentType === "MOMO") {
        const momoPhoneNumber = document.getElementById("momoPhoneNumber");
        momoPhoneNumber.value = currentProfile?.phone_number || "";
    }

    if (paymentType === "BANK") {
        document.getElementById("bankName").value = "";
        document.getElementById("bankAccountNumber").value = "";
    }
}

async function setDefaultPaymentMethod(paymentMethodId) {
    if (!paymentMethodId) {
        return;
    }

    try {
        const response = await fetchWithAuth(
            `${PAYMENT_SERVICE_URL}/api/payments/me/payment-methods/${paymentMethodId}/default`,
            {
                method: "PUT"
            }
        );

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Không thể đặt phương thức mặc định.", "danger");
            return;
        }

        setPaymentMessage(data.message || "Đã đặt phương thức thanh toán mặc định.", "success");

        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi set default payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "danger");
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
            {
                method: "DELETE"
            }
        );

        if (!response) return;

        const data = await response.json();

        if (!response.ok) {
            setPaymentMessage(data.error || "Không thể xóa phương thức thanh toán.", "danger");
            return;
        }

        setPaymentMessage(data.message || "Đã xóa phương thức thanh toán.", "success");

        await loadPaymentMethods();

    } catch (error) {
        console.error("Lỗi delete payment method:", error);
        setPaymentMessage("Không thể kết nối Payment Service.", "danger");
    }
}