const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const accessToken = localStorage.getItem("accessToken");

const message = document.getElementById("message");

const categoryTableBody = document.getElementById("categoryTableBody");
const sizeTableBody = document.getElementById("sizeTableBody");
const colorTableBody = document.getElementById("colorTableBody");

const createCategoryBtn = document.getElementById("createCategoryBtn");
const createSizeBtn = document.getElementById("createSizeBtn");
const createColorBtn = document.getElementById("createColorBtn");

const newCategoryNameInput = document.getElementById("newCategoryName");
const newSizeNameInput = document.getElementById("newSizeName");
const newSizeDisplayOrderInput = document.getElementById("newSizeDisplayOrder");

const newColorNameInput = document.getElementById("newColorName");
const newColorCodeInput = document.getElementById("newColorCode");
const newColorDisplayOrderInput = document.getElementById("newColorDisplayOrder");

createCategoryBtn.addEventListener("click", createCategory);
createSizeBtn.addEventListener("click", createSize);
createColorBtn.addEventListener("click", createColor);

loadAllData();

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

        sizeTableBody.innerHTML = `
            <tr>
                <td colspan="5">Vui lòng đăng nhập bằng tài khoản Admin.</td>
            </tr>
        `;

        colorTableBody.innerHTML = `
            <tr>
                <td colspan="6">Vui lòng đăng nhập bằng tài khoản Admin.</td>
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

        sizeTableBody.innerHTML = `
            <tr>
                <td colspan="5">Bạn không có quyền xem nội dung này.</td>
            </tr>
        `;

        colorTableBody.innerHTML = `
            <tr>
                <td colspan="6">Bạn không có quyền xem nội dung này.</td>
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

function parseOptionalNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") {
        return undefined;
    }

    const numberValue = Number(value);

    if (!Number.isInteger(numberValue) || numberValue < 0) {
        return null;
    }

    return numberValue;
}

function isValidColorCode(value) {
    if (!value) return true;
    return /^#[0-9A-Fa-f]{6}$/.test(String(value).trim());
}

async function loadAllData() {
    if (!checkAdmin()) return;

    await Promise.all([
        loadCategories(),
        loadSizes(),
        loadColors()
    ]);
}

// =========================================================
// CATEGORY
// =========================================================

async function loadCategories() {
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
    document.querySelectorAll(".update-category-btn").forEach(button => {
        button.addEventListener("click", () => {
            updateCategory(button.dataset.categoryId);
        });
    });

    document.querySelectorAll(".delete-category-btn").forEach(button => {
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

    if (!confirmed) return;

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

// =========================================================
// SIZE
// =========================================================

async function loadSizes() {
    sizeTableBody.innerHTML = `
        <tr>
            <td colspan="5">Đang tải...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/sizes`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh sách size.", "danger");
            return;
        }

        const sizes = data.sizes || [];

        if (sizes.length === 0) {
            sizeTableBody.innerHTML = `
                <tr>
                    <td colspan="5">Chưa có size nào.</td>
                </tr>
            `;
            return;
        }

        sizeTableBody.innerHTML = sizes
            .map(size => createSizeRow(size))
            .join("");

        bindSizeActionButtons();

    } catch (error) {
        console.error("Lỗi load sizes:", error);

        sizeTableBody.innerHTML = `
            <tr>
                <td colspan="5">Không thể tải dữ liệu.</td>
            </tr>
        `;
    }
}

function createSizeRow(size) {
    return `
        <tr>
            <td>${escapeHtml(size.size_id)}</td>

            <td>
                <input
                    id="size-name-${escapeAttribute(size.size_id)}"
                    value="${escapeAttribute(size.size_name)}"
                >
            </td>

            <td>
                <input
                    id="size-order-${escapeAttribute(size.size_id)}"
                    class="table-input-small"
                    type="number"
                    min="0"
                    value="${escapeAttribute(size.display_order)}"
                >
            </td>

            <td>${escapeHtml(size.created_at)}</td>

            <td>
                <button
                    class="btn btn-blue update-size-btn"
                    data-size-id="${escapeAttribute(size.size_id)}"
                >
                    Lưu
                </button>

                <button
                    class="btn btn-red delete-size-btn"
                    data-size-id="${escapeAttribute(size.size_id)}"
                >
                    Xóa
                </button>
            </td>
        </tr>
    `;
}

function bindSizeActionButtons() {
    document.querySelectorAll(".update-size-btn").forEach(button => {
        button.addEventListener("click", () => {
            updateSize(button.dataset.sizeId);
        });
    });

    document.querySelectorAll(".delete-size-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteSize(button.dataset.sizeId);
        });
    });
}

async function createSize() {
    if (!checkAdmin()) return;

    clearMessage();

    const sizeName = newSizeNameInput.value.trim();
    const displayOrder = parseOptionalNumber(newSizeDisplayOrderInput.value);

    if (!sizeName) {
        setMessage("Tên size không được để trống.", "danger");
        return;
    }

    if (displayOrder === null) {
        setMessage("Thứ tự hiển thị của size phải là số nguyên >= 0.", "danger");
        return;
    }

    const payload = {
        sizeName
    };

    if (displayOrder !== undefined) {
        payload.displayOrder = displayOrder;
    }

    try {
        createSizeBtn.disabled = true;
        createSizeBtn.textContent = "Đang tạo...";

        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/sizes`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Tạo size thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Tạo size thành công.", "success");

        newSizeNameInput.value = "";
        newSizeDisplayOrderInput.value = "";

        await loadSizes();

    } catch (error) {
        console.error("Lỗi tạo size:", error);
        setMessage("Không thể tạo size.", "danger");

    } finally {
        createSizeBtn.disabled = false;
        createSizeBtn.textContent = "Tạo size";
    }
}

async function updateSize(sizeId) {
    if (!checkAdmin()) return;

    clearMessage();

    const sizeNameInput = document.getElementById(`size-name-${sizeId}`);
    const displayOrderInput = document.getElementById(`size-order-${sizeId}`);

    if (!sizeNameInput || !displayOrderInput) {
        setMessage("Không tìm thấy ô nhập size.", "danger");
        return;
    }

    const sizeName = sizeNameInput.value.trim();
    const displayOrder = parseOptionalNumber(displayOrderInput.value);

    if (!sizeName) {
        setMessage("Tên size không được để trống.", "danger");
        return;
    }

    if (displayOrder === null) {
        setMessage("Thứ tự hiển thị của size phải là số nguyên >= 0.", "danger");
        return;
    }

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/sizes/${sizeId}`, {
            method: "PUT",
            body: JSON.stringify({
                sizeName,
                displayOrder
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật size thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Cập nhật size thành công.", "success");

        await loadSizes();

    } catch (error) {
        console.error("Lỗi update size:", error);
        setMessage("Không thể cập nhật size.", "danger");
    }
}

async function deleteSize(sizeId) {
    if (!checkAdmin()) return;

    clearMessage();

    const confirmed = confirm(
        "Bạn có chắc muốn xóa size này không? Chỉ xóa được nếu size chưa được dùng bởi sản phẩm nào."
    );

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/sizes/${sizeId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xóa size thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xóa size thành công.", "success");

        await loadSizes();

    } catch (error) {
        console.error("Lỗi delete size:", error);
        setMessage("Không thể xóa size.", "danger");
    }
}

// =========================================================
// COLOR
// =========================================================

async function loadColors() {
    colorTableBody.innerHTML = `
        <tr>
            <td colspan="6">Đang tải...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/colors`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh sách màu.", "danger");
            return;
        }

        const colors = data.colors || [];

        if (colors.length === 0) {
            colorTableBody.innerHTML = `
                <tr>
                    <td colspan="6">Chưa có màu nào.</td>
                </tr>
            `;
            return;
        }

        colorTableBody.innerHTML = colors
            .map(color => createColorRow(color))
            .join("");

        bindColorActionButtons();

    } catch (error) {
        console.error("Lỗi load colors:", error);

        colorTableBody.innerHTML = `
            <tr>
                <td colspan="6">Không thể tải dữ liệu.</td>
            </tr>
        `;
    }
}

function createColorRow(color) {
    const colorCode = color.color_code || "";
    const colorDotClass = colorCode ? "color-dot" : "color-dot empty";
    const colorDotStyle = colorCode ? `style="background: ${escapeAttribute(colorCode)};"` : "";

    return `
        <tr>
            <td>${escapeHtml(color.color_id)}</td>

            <td>
                <input
                    id="color-name-${escapeAttribute(color.color_id)}"
                    value="${escapeAttribute(color.color_name)}"
                >
            </td>

            <td>
                <div class="color-preview-wrap">
                    <span class="${colorDotClass}" ${colorDotStyle}></span>

                    <input
                        id="color-code-${escapeAttribute(color.color_id)}"
                        class="table-input-color"
                        value="${escapeAttribute(colorCode)}"
                        placeholder="#F8BBD0"
                    >
                </div>
            </td>

            <td>
                <input
                    id="color-order-${escapeAttribute(color.color_id)}"
                    class="table-input-small"
                    type="number"
                    min="0"
                    value="${escapeAttribute(color.display_order)}"
                >
            </td>

            <td>${escapeHtml(color.created_at)}</td>

            <td>
                <button
                    class="btn btn-blue update-color-btn"
                    data-color-id="${escapeAttribute(color.color_id)}"
                >
                    Lưu
                </button>

                <button
                    class="btn btn-red delete-color-btn"
                    data-color-id="${escapeAttribute(color.color_id)}"
                >
                    Xóa
                </button>
            </td>
        </tr>
    `;
}

function bindColorActionButtons() {
    document.querySelectorAll(".update-color-btn").forEach(button => {
        button.addEventListener("click", () => {
            updateColor(button.dataset.colorId);
        });
    });

    document.querySelectorAll(".delete-color-btn").forEach(button => {
        button.addEventListener("click", () => {
            deleteColor(button.dataset.colorId);
        });
    });
}

async function createColor() {
    if (!checkAdmin()) return;

    clearMessage();

    const colorName = newColorNameInput.value.trim();
    const colorCode = newColorCodeInput.value.trim();
    const displayOrder = parseOptionalNumber(newColorDisplayOrderInput.value);

    if (!colorName) {
        setMessage("Tên màu không được để trống.", "danger");
        return;
    }

    if (!isValidColorCode(colorCode)) {
        setMessage("Mã màu phải có dạng #RRGGBB, ví dụ #F8BBD0.", "danger");
        return;
    }

    if (displayOrder === null) {
        setMessage("Thứ tự hiển thị của màu phải là số nguyên >= 0.", "danger");
        return;
    }

    const payload = {
        colorName,
        colorCode: colorCode || null
    };

    if (displayOrder !== undefined) {
        payload.displayOrder = displayOrder;
    }

    try {
        createColorBtn.disabled = true;
        createColorBtn.textContent = "Đang tạo...";

        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/colors`, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Tạo màu thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Tạo màu thành công.", "success");

        newColorNameInput.value = "";
        newColorCodeInput.value = "";
        newColorDisplayOrderInput.value = "";

        await loadColors();

    } catch (error) {
        console.error("Lỗi tạo color:", error);
        setMessage("Không thể tạo màu.", "danger");

    } finally {
        createColorBtn.disabled = false;
        createColorBtn.textContent = "Tạo màu";
    }
}

async function updateColor(colorId) {
    if (!checkAdmin()) return;

    clearMessage();

    const colorNameInput = document.getElementById(`color-name-${colorId}`);
    const colorCodeInput = document.getElementById(`color-code-${colorId}`);
    const displayOrderInput = document.getElementById(`color-order-${colorId}`);

    if (!colorNameInput || !colorCodeInput || !displayOrderInput) {
        setMessage("Không tìm thấy ô nhập màu.", "danger");
        return;
    }

    const colorName = colorNameInput.value.trim();
    const colorCode = colorCodeInput.value.trim();
    const displayOrder = parseOptionalNumber(displayOrderInput.value);

    if (!colorName) {
        setMessage("Tên màu không được để trống.", "danger");
        return;
    }

    if (!isValidColorCode(colorCode)) {
        setMessage("Mã màu phải có dạng #RRGGBB, ví dụ #F8BBD0.", "danger");
        return;
    }

    if (displayOrder === null) {
        setMessage("Thứ tự hiển thị của màu phải là số nguyên >= 0.", "danger");
        return;
    }

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/colors/${colorId}`, {
            method: "PUT",
            body: JSON.stringify({
                colorName,
                colorCode: colorCode || null,
                displayOrder
            })
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật màu thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Cập nhật màu thành công.", "success");

        await loadColors();

    } catch (error) {
        console.error("Lỗi update color:", error);
        setMessage("Không thể cập nhật màu.", "danger");
    }
}

async function deleteColor(colorId) {
    if (!checkAdmin()) return;

    clearMessage();

    const confirmed = confirm(
        "Bạn có chắc muốn xóa màu này không? Chỉ xóa được nếu màu chưa được dùng bởi sản phẩm nào."
    );

    if (!confirmed) return;

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/colors/${colorId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xóa màu thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xóa màu thành công.", "success");

        await loadColors();

    } catch (error) {
        console.error("Lỗi delete color:", error);
        setMessage("Không thể xóa màu.", "danger");
    }
}