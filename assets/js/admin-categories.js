const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const accessToken = localStorage.getItem("accessToken");

const message = document.getElementById("message");
const categoryTableBody = document.getElementById("categoryTableBody");
const createCategoryBtn = document.getElementById("createCategoryBtn");
const newCategoryNameInput = document.getElementById("newCategoryName");

createCategoryBtn.addEventListener("click", createCategory);

loadCategories();

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

        categoryTableBody.innerHTML = `
            <tr>
                <td colspan="4">Vui lòng đăng nhập bằng tài khoản Admin.</td>
            </tr>
        `;

        return false;
    }

    const payload = getTokenPayload(accessToken);
    const groups = payload["cognito:groups"] || [];

    if (!groups.includes("Admin")) {
        setMessage("Bạn không có quyền Admin.", "danger");

        categoryTableBody.innerHTML = `
            <tr>
                <td colspan="4">Bạn không có quyền xem nội dung này.</td>
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
            window.location.href = "/login";
        }, 1200);
    }

    return response;
}

async function loadCategories() {
    if (!checkAdmin()) return;

    categoryTableBody.innerHTML = `
        <tr>
            <td colspan="4">Đang tải...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/categories`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh sách danh mục.", "danger");
            return;
        }

        const categories = data.categories || [];

        if (categories.length === 0) {
            categoryTableBody.innerHTML = `
                <tr>
                    <td colspan="4">Chưa có danh mục nào.</td>
                </tr>
            `;
            return;
        }

        categoryTableBody.innerHTML = categories
            .map(category => createCategoryRow(category))
            .join("");

        bindCategoryActionButtons();

    } catch (error) {
        console.error("Lỗi load categories:", error);

        setMessage("Không thể kết nối Product Service.", "danger");

        categoryTableBody.innerHTML = `
            <tr>
                <td colspan="4">Không thể tải dữ liệu.</td>
            </tr>
        `;
    }
}

function createCategoryRow(category) {
    return `
        <tr>
            <td>${escapeHtml(category.category_id)}</td>

            <td>
                <input
                    id="category-name-${escapeAttribute(category.category_id)}"
                    value="${escapeAttribute(category.category_name)}"
                >
            </td>

            <td>${escapeHtml(category.created_at)}</td>

            <td>
                <button
                    class="btn btn-blue update-category-btn"
                    data-category-id="${escapeAttribute(category.category_id)}"
                >
                    Lưu
                </button>

                <button
                    class="btn btn-red delete-category-btn"
                    data-category-id="${escapeAttribute(category.category_id)}"
                >
                    Xóa
                </button>
            </td>
        </tr>
    `;
}

function bindCategoryActionButtons() {
    const updateButtons = document.querySelectorAll(".update-category-btn");
    const deleteButtons = document.querySelectorAll(".delete-category-btn");

    updateButtons.forEach(button => {
        button.addEventListener("click", () => {
            updateCategory(button.dataset.categoryId);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener("click", () => {
            deleteCategory(button.dataset.categoryId);
        });
    });
}

async function createCategory() {
    if (!checkAdmin()) return;

    clearMessage();

    const categoryName = newCategoryNameInput.value.trim();

    if (!categoryName) {
        setMessage("Tên danh mục không được để trống.", "danger");
        return;
    }

    try {
        createCategoryBtn.disabled = true;
        createCategoryBtn.textContent = "Đang tạo...";

        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/categories`, {
            method: "POST",
            body: JSON.stringify({ categoryName })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Tạo danh mục thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Tạo danh mục thành công.", "success");

        newCategoryNameInput.value = "";

        await loadCategories();

    } catch (error) {
        console.error("Lỗi tạo category:", error);
        setMessage("Không thể tạo danh mục.", "danger");

    } finally {
        createCategoryBtn.disabled = false;
        createCategoryBtn.textContent = "Tạo danh mục";
    }
}

async function updateCategory(categoryId) {
    if (!checkAdmin()) return;

    clearMessage();

    const categoryNameInput = document.getElementById(`category-name-${categoryId}`);

    if (!categoryNameInput) {
        setMessage("Không tìm thấy ô nhập tên danh mục.", "danger");
        return;
    }

    const categoryName = categoryNameInput.value.trim();

    if (!categoryName) {
        setMessage("Tên danh mục không được để trống.", "danger");
        return;
    }

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/categories/${categoryId}`, {
            method: "PUT",
            body: JSON.stringify({ categoryName })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật danh mục thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Cập nhật danh mục thành công.", "success");

        await loadCategories();

    } catch (error) {
        console.error("Lỗi update category:", error);
        setMessage("Không thể cập nhật danh mục.", "danger");
    }
}

async function deleteCategory(categoryId) {
    if (!checkAdmin()) return;

    clearMessage();

    const confirmed = confirm(
        "Bạn có chắc muốn xóa danh mục này không? Các sản phẩm thuộc danh mục này sẽ chuyển về Chưa phân loại."
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/categories/${categoryId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xóa danh mục thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xóa danh mục thành công.", "success");

        await loadCategories();

    } catch (error) {
        console.error("Lỗi delete category:", error);
        setMessage("Không thể xóa danh mục.", "danger");
    }
}