const USER_SERVICE_URL = window.APP_CONFIG?.USER_SERVICE_URL || "";
const accessToken = localStorage.getItem("accessToken");

const message = document.getElementById("message");
const userTableBody = document.getElementById("userTableBody");
const createUserBtn = document.getElementById("createUserBtn");

createUserBtn.addEventListener("click", createUser);

loadUsers();

function setMessage(text, type = "success") {
    message.className = `message ${type}`;
    message.textContent = text;
}

function clearMessage() {
    message.className = "message";
    message.textContent = "";
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

function getTokenPayload(token) {
    try {
        const base64Payload = token.split(".")[1];
        const jsonPayload = atob(
            base64Payload.replace(/-/g, "+").replace(/_/g, "/")
        );

        return JSON.parse(jsonPayload);
    } catch {
        return {};
    }
}

function checkAdmin() {
    if (!accessToken) {
        setMessage("Bạn chưa đăng nhập.", "danger");

        userTableBody.innerHTML = `
            <tr>
                <td colspan="7">Vui lòng đăng nhập bằng tài khoản Admin.</td>
            </tr>
        `;

        return false;
    }

    const payload = getTokenPayload(accessToken);
    const groups = payload["cognito:groups"] || [];

    if (!groups.includes("Admin")) {
        setMessage("Bạn không có quyền Admin.", "danger");

        userTableBody.innerHTML = `
            <tr>
                <td colspan="7">Bạn không có quyền xem nội dung này.</td>
            </tr>
        `;

        return false;
    }

    return true;
}

async function fetchWithAuth(url, options = {}) {
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
        setMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "danger");

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1200);
    }

    return response;
}

async function loadUsers() {
    if (!checkAdmin()) return;

    userTableBody.innerHTML = `
        <tr>
            <td colspan="7">Đang tải...</td>
        </tr>
    `;

    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh sách users.", "danger");
            return;
        }

        const users = data.users || [];

        if (users.length === 0) {
            userTableBody.innerHTML = `
                <tr>
                    <td colspan="7">Chưa có user nào.</td>
                </tr>
            `;
            return;
        }

        userTableBody.innerHTML = users
            .map(user => createUserRow(user))
            .join("");

        bindUserActionButtons();

    } catch (error) {
        console.error("Lỗi load users:", error);

        setMessage("Không thể kết nối User Service.", "danger");

        userTableBody.innerHTML = `
            <tr>
                <td colspan="7">Không thể tải dữ liệu users.</td>
            </tr>
        `;
    }
}

function createUserRow(user) {
    const userId = user.user_id;
    const status = user.status || "ACTIVE";

    return `
        <tr>
            <td class="user-id-cell">${escapeHtml(userId)}</td>

            <td>
                <input
                    id="name-${escapeAttribute(userId)}"
                    value="${escapeAttribute(user.full_name)}"
                >
            </td>

            <td>
                <input
                    id="email-${escapeAttribute(userId)}"
                    value="${escapeAttribute(user.email)}"
                >
            </td>

            <td>
                <input
                    id="phone-${escapeAttribute(userId)}"
                    value="${escapeAttribute(user.phone_number)}"
                >
            </td>

            <td>
                <textarea id="address-${escapeAttribute(userId)}">${escapeHtml(user.default_shipping_address || "")}</textarea>
            </td>

            <td>
                <select id="status-${escapeAttribute(userId)}">
                    <option value="ACTIVE" ${status === "ACTIVE" ? "selected" : ""}>ACTIVE</option>
                    <option value="DISABLED" ${status === "DISABLED" ? "selected" : ""}>DISABLED</option>
                </select>
            </td>

            <td>
                <button
                    class="btn btn-blue update-user-btn"
                    data-user-id="${escapeAttribute(userId)}"
                >
                    Lưu
                </button>

                <button
                    class="btn btn-red delete-user-btn"
                    data-user-id="${escapeAttribute(userId)}"
                >
                    Xóa
                </button>
            </td>
        </tr>
    `;
}

function bindUserActionButtons() {
    const updateButtons = document.querySelectorAll(".update-user-btn");
    const deleteButtons = document.querySelectorAll(".delete-user-btn");

    updateButtons.forEach(button => {
        button.addEventListener("click", () => {
            updateUser(button.dataset.userId);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener("click", () => {
            deleteUser(button.dataset.userId);
        });
    });
}

async function createUser() {
    if (!checkAdmin()) return;

    clearMessage();

    const body = {
        fullName: document.getElementById("newFullName").value.trim(),
        email: document.getElementById("newEmail").value.trim(),
        phoneNumber: document.getElementById("newPhone").value.trim(),
        password: document.getElementById("newPassword").value,
        defaultShippingAddress: document.getElementById("newAddress").value.trim(),
        groupName: document.getElementById("newGroup").value
    };

    if (!body.fullName || !body.email || !body.phoneNumber || !body.password) {
        setMessage("Vui lòng nhập đầy đủ họ tên, email, số điện thoại và mật khẩu.", "danger");
        return;
    }

    if (!body.phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại cần dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
        return;
    }

    try {
        createUserBtn.disabled = true;
        createUserBtn.textContent = "Đang tạo...";

        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Tạo user thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Tạo user thành công.", "success");

        clearCreateUserForm();

        await loadUsers();

    } catch (error) {
        console.error("Lỗi tạo user:", error);
        setMessage("Không thể tạo user.", "danger");

    } finally {
        createUserBtn.disabled = false;
        createUserBtn.textContent = "Tạo user";
    }
}

async function updateUser(userId) {
    if (!checkAdmin()) return;

    clearMessage();

    const body = {
        fullName: document.getElementById(`name-${userId}`).value.trim(),
        email: document.getElementById(`email-${userId}`).value.trim(),
        phoneNumber: document.getElementById(`phone-${userId}`).value.trim(),
        defaultShippingAddress: document.getElementById(`address-${userId}`).value.trim(),
        status: document.getElementById(`status-${userId}`).value
    };

    if (!body.fullName || !body.email || !body.phoneNumber) {
        setMessage("Họ tên, email và số điện thoại không được để trống.", "danger");
        return;
    }

    if (!body.phoneNumber.startsWith("+")) {
        setMessage("Số điện thoại cần dùng định dạng quốc tế, ví dụ +84901234567.", "danger");
        return;
    }

    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật user thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Cập nhật user thành công.", "success");

        await loadUsers();

    } catch (error) {
        console.error("Lỗi cập nhật user:", error);
        setMessage("Không thể cập nhật user.", "danger");
    }
}

async function deleteUser(userId) {
    if (!checkAdmin()) return;

    clearMessage();

    if (!confirm("Bạn có chắc muốn xóa user này không?")) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${USER_SERVICE_URL}/api/users/${userId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xóa user thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xóa user thành công.", "success");

        await loadUsers();

    } catch (error) {
        console.error("Lỗi xóa user:", error);
        setMessage("Không thể xóa user.", "danger");
    }
}

function clearCreateUserForm() {
    document.getElementById("newFullName").value = "";
    document.getElementById("newEmail").value = "";
    document.getElementById("newPhone").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("newAddress").value = "";
    document.getElementById("newGroup").value = "Customer";
}