const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const INVENTORY_SERVICE_URL = window.APP_CONFIG?.INVENTORY_SERVICE_URL || "";
const accessToken = localStorage.getItem("accessToken");

const message = document.getElementById("message");
const productTableBody = document.getElementById("productTableBody");
const productSearchInput = document.getElementById("productSearchInput");
const productCategoryFilter = document.getElementById("productCategoryFilter");
const productStockFilter = document.getElementById("productStockFilter");
const resetProductFiltersBtn = document.getElementById("resetProductFiltersBtn");

const createProductBtn = document.getElementById("createProductBtn");

const productImageInput = document.getElementById("newProductImage");
const productPreviewImage = document.getElementById("productPreviewImage");

const addNewProductSubImageBtn = document.getElementById("addNewProductSubImageBtn");
const addCreateVariantBtn = document.getElementById("addCreateVariantBtn");
const createVariantTableBody = document.getElementById("createVariantTableBody");

const editProductModal = document.getElementById("editProductModal");
const closeEditModalBtn = document.getElementById("closeEditModalBtn");
const cancelEditProductBtn = document.getElementById("cancelEditProductBtn");
const saveEditProductBtn = document.getElementById("saveEditProductBtn");
const addEditProductSubImageBtn = document.getElementById("addEditProductSubImageBtn");
const addEditVariantBtn = document.getElementById("addEditVariantBtn");
const editVariantTableBody = document.getElementById("editVariantTableBody");

let categories = [];
let sizes = [];
let colors = [];
let allProducts = [];

let editingProduct = null;
let editingSubImageKeys = [];

createProductBtn.addEventListener("click", createProduct);

addNewProductSubImageBtn.addEventListener("click", () => {
    addSubImageInputRow("newProductSubImagesGroup");
});

addCreateVariantBtn.addEventListener("click", () => {
    addVariantRow("createVariantTableBody");
});

addEditProductSubImageBtn.addEventListener("click", () => {
    addSubImageInputRow("editProductSubImagesGroup");
});

addEditVariantBtn.addEventListener("click", () => {
    addVariantRow("editVariantTableBody");
});

if (productSearchInput) {
    productSearchInput.addEventListener("input", renderFilteredProducts);
}

if (productCategoryFilter) {
    productCategoryFilter.addEventListener("change", renderFilteredProducts);
}

if (productStockFilter) {
    productStockFilter.addEventListener("change", renderFilteredProducts);
}

if (resetProductFiltersBtn) {
    resetProductFiltersBtn.addEventListener("click", () => {
        if (productSearchInput) productSearchInput.value = "";
        if (productCategoryFilter) productCategoryFilter.value = "";
        if (productStockFilter) productStockFilter.value = "all";

        renderFilteredProducts();
    });
}

closeEditModalBtn.addEventListener("click", closeEditModal);
cancelEditProductBtn.addEventListener("click", closeEditModal);
saveEditProductBtn.addEventListener("click", saveEditProduct);

productImageInput.addEventListener("change", () => {
    const file = productImageInput.files[0];

    if (!file) {
        productPreviewImage.style.display = "none";
        productPreviewImage.src = "";
        return;
    }

    productPreviewImage.src = URL.createObjectURL(file);
    productPreviewImage.style.display = "block";
});

initPage();

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

function addSubImageInputRow(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;

    const row = document.createElement("div");
    row.className = "sub-image-input-row";
    row.innerHTML = `
        <input class="product-sub-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
        <button type="button" class="btn btn-red remove-sub-image-input-btn">Xóa</button>
    `;

    row.querySelector(".remove-sub-image-input-btn").addEventListener("click", () => {
        row.remove();
    });

    group.appendChild(row);
}

function getSubImageFiles(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return [];

    return Array.from(group.querySelectorAll(".product-sub-image-input"))
        .map(input => input.files?.[0])
        .filter(Boolean);
}

function resetSubImageInputs(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;

    group.innerHTML = `
        <div class="sub-image-input-row">
            <input class="product-sub-image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif">
        </div>
    `;
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

        productTableBody.innerHTML = `
            <tr>
                <td colspan="9">Vui lòng đăng nhập bằng tài khoản Admin.</td>
            </tr>
        `;

        return false;
    }

    const payload = getTokenPayload(accessToken);
    const groups = payload["cognito:groups"] || [];

    if (!groups.includes("Admin")) {
        setMessage("Bạn không có quyền Admin.", "danger");

        productTableBody.innerHTML = `
            <tr>
                <td colspan="9">Bạn không có quyền xem nội dung này.</td>
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

async function initPage() {
    if (!checkAdmin()) return;

    await loadCategoriesForProductForm();
    await loadSizesAndColors();

    renderCreateVariantDefaultRows();

    await loadProducts();
}

async function loadProducts() {
    if (!checkAdmin()) return;

    productTableBody.innerHTML = `
        <tr>
            <td colspan="9">Đang tải...</td>
        </tr>
    `;

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh sách sản phẩm.", "danger");
            return;
        }

        const products = data.products || [];

        if (products.length === 0) {
            productTableBody.innerHTML = `
                <tr>
                    <td colspan="9">Chưa có sản phẩm nào.</td>
                </tr>
            `;
            return;
        }

        const productIds = products
            .map(product => product.product_id)
            .filter(Boolean);

        const inventorySummaryMap = await loadInventoryProductSummaries(productIds);

        const mergedProducts = products.map(product => {
            const summary = inventorySummaryMap.get(Number(product.product_id));

            return {
                ...product,
                quantity_available: summary?.quantity_available ?? 0,
                quantity_on_hand: summary?.quantity_on_hand ?? 0,
                quantity_reserved: summary?.quantity_reserved ?? 0,
                quantity_sold: summary?.quantity_sold ?? 0
            };
        });

        allProducts = mergedProducts;
        renderFilteredProducts();

    } catch (error) {
        console.error("Lỗi load products:", error);

        setMessage("Không thể kết nối Product Service.", "danger");

        productTableBody.innerHTML = `
            <tr>
                <td colspan="9">Không thể tải dữ liệu sản phẩm.</td>
            </tr>
        `;
    }
}

function createProductRow(product) {
    const productId = product.product_id;

    const imageHtml = product.imageUrl
        ? `<img class="product-img" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.product_name)}">`
        : "Không có ảnh";

    return `
        <tr>
            <td>${escapeHtml(productId)}</td>

            <td>
                ${imageHtml}
            </td>

            <td>
                <div class="product-summary-name">
                    ${escapeHtml(product.product_name)}
                </div>
            </td>

            <td>
                ${escapeHtml(product.category_name || "Chưa phân loại")}
            </td>

            <td>
                ${Number(product.price).toLocaleString("vi-VN")} đ
            </td>

            <td>
                <span class="readonly-number">
                    ${escapeHtml(product.quantity_available || 0)}
                </span>
                <div class="small-text">
                    On hand: ${escapeHtml(product.quantity_on_hand || 0)},
                    Reserved: ${escapeHtml(product.quantity_reserved || 0)}
                </div>
            </td>

            <td>
                <span class="readonly-number">
                    ${escapeHtml(product.quantity_sold || 0)}
                </span>
            </td>

            <td>
                <div class="product-summary-desc">
                    ${escapeHtml(product.description || "")}
                </div>
            </td>

            <td>
                <button
                    class="btn btn-blue edit-product-btn"
                    data-product-id="${escapeAttribute(productId)}"
                >
                    Sửa
                </button>

                <button
                    class="btn btn-red delete-product-btn"
                    data-product-id="${escapeAttribute(productId)}"
                >
                    Xóa
                </button>
            </td>
        </tr>
    `;
}

function bindProductActionButtons() {
    const editButtons = document.querySelectorAll(".edit-product-btn");
    const deleteButtons = document.querySelectorAll(".delete-product-btn");

    editButtons.forEach(button => {
        button.addEventListener("click", () => {
            openEditModal(button.dataset.productId);
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener("click", () => {
            deleteProduct(button.dataset.productId);
        });
    });
}

async function createProduct() {
    if (!checkAdmin()) return;

    clearMessage();

    const productName = document.getElementById("newProductName").value.trim();
    const description = document.getElementById("newProductDescription").value.trim();
    const categoryIdRaw = document.getElementById("newCategoryId").value.trim();
    const priceRaw = document.getElementById("newPrice").value.trim();
    const mainFile = document.getElementById("newProductImage").files[0];
    const subFiles = getSubImageFiles("newProductSubImagesGroup");

    let variants = [];

    if (!productName || !priceRaw) {
        setMessage("Vui lòng nhập tên sản phẩm và giá.", "danger");
        return;
    }

    if (Number(priceRaw) <= 0) {
        setMessage("Giá sản phẩm phải lớn hơn 0.", "danger");
        return;
    }

    try {
        variants = collectVariants("createVariantTableBody");
    } catch (error) {
        setMessage(error.message, "danger");
        return;
    }

    try {
        createProductBtn.disabled = true;
        createProductBtn.textContent = "Đang tạo...";
        setMessage("Đang tạo sản phẩm...", "success");

        let imageKey = null;
        let subImageKeys = [];

        if (mainFile) {
            imageKey = await uploadProductImage(mainFile);
        }

        if (subFiles.length > 0) {
            subImageKeys = await uploadProductImages(subFiles);
        }

        const body = {
            productName,
            description,
            categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
            price: Number(priceRaw),
            imageKey,
            subImageKeys,
            variants
        };

        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/products`, {
            method: "POST",
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Tạo sản phẩm thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Tạo sản phẩm thành công.", "success");

        clearProductForm();

        await loadProducts();

    } catch (error) {
        console.error("Lỗi tạo sản phẩm:", error);
        setMessage(error.message || "Không thể tạo sản phẩm.", "danger");

    } finally {
        createProductBtn.disabled = false;
        createProductBtn.textContent = "Tạo sản phẩm";
    }
}

async function openEditModal(productId) {
    if (!checkAdmin()) return;

    clearMessage();

    try {
        setMessage("Đang tải chi tiết sản phẩm...", "success");

        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải chi tiết sản phẩm.", "danger");
            return;
        }

        editingProduct = data.product;

        const variantIds = (editingProduct.variants || [])
            .map(variant => variant.variant_id)
            .filter(Boolean);

        const inventoryMap = await loadVariantInventories(variantIds);

        editingProduct = mergeInventoryIntoProduct(editingProduct, inventoryMap);

        editingSubImageKeys = (editingProduct.images || []).map(image => image.image_key);

        document.getElementById("editProductId").value = editingProduct.product_id;
        document.getElementById("editProductName").value = editingProduct.product_name || "";
        document.getElementById("editProductDescription").value = editingProduct.description || "";
        document.getElementById("editPrice").value = editingProduct.price || "";
        document.getElementById("editImageKey").value = editingProduct.image_key || "";
        document.getElementById("editProductImage").value = "";
        resetSubImageInputs("editProductSubImagesGroup");

        renderEditCategoryDropdown(editingProduct.category_id);

        const mainImage = document.getElementById("editCurrentMainImage");

        if (editingProduct.imageUrl) {
            mainImage.src = editingProduct.imageUrl;
            mainImage.style.display = "block";
        } else {
            mainImage.src = "";
            mainImage.style.display = "none";
        }

        renderEditSubImagesPreview();

        editVariantTableBody.innerHTML = "";

        const variants = editingProduct.variants || [];

        if (variants.length === 0) {
            addVariantRow("editVariantTableBody");
        } else {
            variants.forEach(variant => {
                addVariantRow("editVariantTableBody", variant);
            });
        }

        editProductModal.classList.add("show");
        clearMessage();

    } catch (error) {
        console.error("Lỗi mở modal sửa sản phẩm:", error);
        setMessage(error.message || "Không thể mở form sửa sản phẩm.", "danger");
    }
}

function closeEditModal() {
    editProductModal.classList.remove("show");
    editingProduct = null;
    editingSubImageKeys = [];
}

function renderEditSubImagesPreview() {
    const container = document.getElementById("editSubImagesPreview");

    if (!editingProduct) {
        container.innerHTML = "";
        return;
    }

    const images = editingProduct.images || [];

    const visibleImages = images.filter(image =>
        editingSubImageKeys.includes(image.image_key)
    );

    if (visibleImages.length === 0) {
        container.innerHTML = `<span class="small-text">Chưa có ảnh phụ.</span>`;
        return;
    }

    container.innerHTML = visibleImages.map(image => `
        <div class="sub-image-item">
            <img src="${escapeAttribute(image.imageUrl)}" alt="Ảnh phụ">

            <button
                type="button"
                class="remove-sub-image-btn"
                data-image-key="${escapeAttribute(image.image_key)}"
            >
                ×
            </button>
        </div>
    `).join("");

    container.querySelectorAll(".remove-sub-image-btn").forEach(button => {
        button.addEventListener("click", () => {
            const imageKey = button.dataset.imageKey;

            editingSubImageKeys = editingSubImageKeys.filter(key => key !== imageKey);

            renderEditSubImagesPreview();
        });
    });
}

async function saveEditProduct() {
    if (!checkAdmin()) return;

    clearMessage();

    const productId = document.getElementById("editProductId").value;
    const productName = document.getElementById("editProductName").value.trim();
    const description = document.getElementById("editProductDescription").value.trim();
    const categoryIdRaw = document.getElementById("editCategoryId").value.trim();
    const priceRaw = document.getElementById("editPrice").value.trim();
    const currentImageKey = document.getElementById("editImageKey").value.trim();

    const mainFile = document.getElementById("editProductImage").files[0];
    const newSubFiles = getSubImageFiles("editProductSubImagesGroup");

    let variants = [];

    if (!productName || !priceRaw) {
        setMessage("Vui lòng nhập tên sản phẩm và giá.", "danger");
        return;
    }

    if (Number(priceRaw) <= 0) {
        setMessage("Giá sản phẩm phải lớn hơn 0.", "danger");
        return;
    }

    try {
        variants = collectVariants("editVariantTableBody");
    } catch (error) {
        setMessage(error.message, "danger");
        return;
    }

    try {
        saveEditProductBtn.disabled = true;
        saveEditProductBtn.textContent = "Đang lưu...";
        setMessage("Đang cập nhật sản phẩm...", "success");

        let imageKey = currentImageKey || null;

        if (mainFile) {
            imageKey = await uploadProductImage(mainFile);
        }

        let newSubImageKeys = [];

        if (newSubFiles.length > 0) {
            newSubImageKeys = await uploadProductImages(newSubFiles);
        }

        const body = {
            productName,
            description,
            categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
            price: Number(priceRaw),
            imageKey,
            subImageKeys: [
                ...editingSubImageKeys,
                ...newSubImageKeys
            ],
            variants
        };

        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/products/${productId}`, {
            method: "PUT",
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Cập nhật sản phẩm thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Cập nhật sản phẩm thành công.", "success");

        closeEditModal();

        await loadProducts();

    } catch (error) {
        console.error("Lỗi cập nhật sản phẩm:", error);
        setMessage(error.message || "Không thể cập nhật sản phẩm.", "danger");

    } finally {
        saveEditProductBtn.disabled = false;
        saveEditProductBtn.textContent = "Lưu thay đổi";
    }
}

async function deleteProduct(productId) {
    if (!checkAdmin()) return;

    clearMessage();

    if (!confirm("Bạn có chắc muốn xóa sản phẩm này không?")) {
        return;
    }

    try {
        const response = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/products/${productId}`, {
            method: "DELETE"
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Xóa sản phẩm thất bại.", "danger");
            return;
        }

        setMessage(data.message || "Xóa sản phẩm thành công.", "success");

        await loadProducts();

    } catch (error) {
        console.error("Lỗi xóa sản phẩm:", error);
        setMessage(error.message || "Không thể xóa sản phẩm.", "danger");
    }
}

async function uploadProductImage(file) {
    const uploadUrlResponse = await fetchWithAuth(`${PRODUCT_SERVICE_URL}/api/products/upload-url`, {
        method: "POST",
        body: JSON.stringify({
            fileName: file.name,
            contentType: file.type
        })
    });

    const uploadUrlData = await uploadUrlResponse.json();

    if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlData.error || "Không thể lấy upload URL.");
    }

    const { uploadUrl, imageKey } = uploadUrlData;

    const s3Response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Type": file.type
        },
        body: file
    });

    if (!s3Response.ok) {
        throw new Error("Upload ảnh lên S3 thất bại.");
    }

    return imageKey;
}

async function uploadProductImages(files) {
    const imageKeys = [];

    for (const file of files) {
        const imageKey = await uploadProductImage(file);
        imageKeys.push(imageKey);
    }

    return imageKeys;
}

async function loadCategoriesForProductForm() {
    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/categories`);
        const data = await response.json();

        if (!response.ok) {
            setMessage(data.error || "Không thể tải danh mục.", "danger");
            return;
        }

        categories = data.categories || [];

        renderCreateCategoryDropdown();
        renderProductCategoryFilterDropdown();

    } catch (error) {
        console.error("Lỗi load categories:", error);
        setMessage("Không thể kết nối Product Service để tải danh mục.", "danger");
    }
}

async function loadSizesAndColors() {
    try {
        const [sizeResponse, colorResponse] = await Promise.all([
            fetch(`${PRODUCT_SERVICE_URL}/api/sizes`),
            fetch(`${PRODUCT_SERVICE_URL}/api/colors`)
        ]);

        const sizeData = await sizeResponse.json();
        const colorData = await colorResponse.json();

        if (!sizeResponse.ok) {
            setMessage(sizeData.error || "Không thể tải danh sách size.", "danger");
            return;
        }

        if (!colorResponse.ok) {
            setMessage(colorData.error || "Không thể tải danh sách màu.", "danger");
            return;
        }

        sizes = sizeData.sizes || [];
        colors = colorData.colors || [];

    } catch (error) {
        console.error("Lỗi load sizes/colors:", error);
        setMessage("Không thể tải size hoặc màu.", "danger");
    }
}

function renderCreateCategoryDropdown() {
    const select = document.getElementById("newCategoryId");

    select.innerHTML = `
        <option value="">Chưa phân loại</option>
        ${categories.map(category => `
            <option value="${escapeAttribute(category.category_id)}">
                ${escapeHtml(category.category_name)}
            </option>
        `).join("")}
    `;
}

function renderProductCategoryFilterDropdown() {
    if (!productCategoryFilter) {
        return;
    }

    const currentValue = productCategoryFilter.value;

    productCategoryFilter.innerHTML = `
        <option value="">Tất cả danh mục</option>
        ${categories.map(category => `
            <option value="${escapeAttribute(category.category_id)}">
                ${escapeHtml(category.category_name)}
            </option>
        `).join("")}
    `;

    productCategoryFilter.value = currentValue;
}

function renderEditCategoryDropdown(selectedCategoryId) {
    const select = document.getElementById("editCategoryId");

    select.innerHTML = `
        <option value="">Chưa phân loại</option>
        ${categories.map(category => `
            <option
                value="${escapeAttribute(category.category_id)}"
                ${Number(selectedCategoryId) === Number(category.category_id) ? "selected" : ""}
            >
                ${escapeHtml(category.category_name)}
            </option>
        `).join("")}
    `;
}

function clearProductForm() {
    document.getElementById("newProductName").value = "";
    document.getElementById("newProductDescription").value = "";
    document.getElementById("newCategoryId").value = "";
    document.getElementById("newPrice").value = "";
    document.getElementById("newProductImage").value = "";
    resetSubImageInputs("newProductSubImagesGroup");

    productPreviewImage.style.display = "none";
    productPreviewImage.src = "";

    renderCreateVariantDefaultRows();
}
function renderSizeOptions(selectedSizeId = "") {
    return sizes.map(size => `
        <option
            value="${escapeAttribute(size.size_id)}"
            ${Number(selectedSizeId) === Number(size.size_id) ? "selected" : ""}
        >
            ${escapeHtml(size.size_name)}
        </option>
    `).join("");
}

function renderColorOptions(selectedColorId = "") {
    return colors.map(color => `
        <option
            value="${escapeAttribute(color.color_id)}"
            ${Number(selectedColorId) === Number(color.color_id) ? "selected" : ""}
        >
            ${escapeHtml(color.color_name)}
        </option>
    `).join("");
}

function addVariantRow(tableBodyId, variant = null) {
    const tbody = document.getElementById(tableBodyId);

    const tr = document.createElement("tr");

    tr.innerHTML = `
        <td>
            <select class="variant-size">
                <option value="">Chọn size</option>
                ${renderSizeOptions(variant?.size_id || variant?.sizeId || "")}
            </select>
        </td>

        <td>
            <select class="variant-color">
                <option value="">Chọn màu</option>
                ${renderColorOptions(variant?.color_id || variant?.colorId || "")}
            </select>
        </td>

        <td>
            <input
                class="variant-quantity-on-hand"
                type="number"
                min="0"
                step="1"
                value="${escapeAttribute(variant?.quantity_on_hand ?? 0)}"
            >
        </td>

        <td>
            <button type="button" class="btn btn-red remove-variant-btn">
                Xóa
            </button>
        </td>
    `;

    tbody.appendChild(tr);

    tr.querySelector(".remove-variant-btn").addEventListener("click", () => {
        tr.remove();
    });
}

function renderCreateVariantDefaultRows() {
    createVariantTableBody.innerHTML = "";

    addVariantRow("createVariantTableBody");
}

function collectVariants(tableBodyId) {
    const tbody = document.getElementById(tableBodyId);
    const rows = tbody.querySelectorAll("tr");

    const variants = [];

    rows.forEach(row => {
        const sizeId = row.querySelector(".variant-size").value;
        const colorId = row.querySelector(".variant-color").value;
        const quantityOnHand = row.querySelector(".variant-quantity-on-hand").value;

        if (!sizeId && !colorId && quantityOnHand === "") {
            return;
        }

        variants.push({
            sizeId: Number(sizeId),
            colorId: Number(colorId),
            quantityOnHand: Number(quantityOnHand)
        });
    });

    if (variants.length === 0) {
        throw new Error("Vui lòng thêm ít nhất một biến thể sản phẩm.");
    }

    for (const variant of variants) {
        if (!variant.sizeId || !variant.colorId) {
            throw new Error("Mỗi biến thể phải có size và màu.");
        }

        if (!Number.isInteger(variant.quantityOnHand) || variant.quantityOnHand < 0) {
            throw new Error("Số lượng tồn kho của biến thể không hợp lệ.");
        }
    }

    const duplicateMap = new Set();

    for (const variant of variants) {
        const key = `${variant.sizeId}:${variant.colorId}`;

        if (duplicateMap.has(key)) {
            throw new Error("Không được tạo trùng biến thể cùng size và màu.");
        }

        duplicateMap.add(key);
    }

    return variants;
}

async function loadInventoryProductSummaries(productIds) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return new Map();
    }

    try {
        const response = await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/products/summary`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ productIds })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải tổng tồn kho sản phẩm.");
        }

        const summaries = data.summaries || [];
        const summaryMap = new Map();

        for (const summary of summaries) {
            summaryMap.set(Number(summary.product_id), {
                quantity_on_hand: Number(summary.quantity_on_hand) || 0,
                quantity_reserved: Number(summary.quantity_reserved) || 0,
                quantity_available: Number(summary.quantity_available) || 0,
                quantity_sold: Number(summary.quantity_sold) || 0
            });
        }

        return summaryMap;

    } catch (error) {
        console.error("Lỗi load inventory summaries:", error);
        return new Map();
    }
}
async function loadVariantInventories(variantIds) {
    if (!Array.isArray(variantIds) || variantIds.length === 0) {
        return new Map();
    }

    try {
        const response = await fetch(`${INVENTORY_SERVICE_URL}/api/inventory/variants/batch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ variantIds })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải tồn kho biến thể.");
        }

        const inventories = data.inventories || [];
        const inventoryMap = new Map();

        for (const inventory of inventories) {
            inventoryMap.set(Number(inventory.variant_id), {
                quantity_on_hand: Number(inventory.quantity_on_hand) || 0,
                quantity_reserved: Number(inventory.quantity_reserved) || 0,
                quantity_available: Number(inventory.quantity_available) || 0,
                quantity_sold: Number(inventory.quantity_sold) || 0
            });
        }

        return inventoryMap;

    } catch (error) {
        console.error("Lỗi load variant inventories:", error);
        return new Map();
    }
}

function mergeInventoryIntoProduct(product, inventoryMap) {
    return {
        ...product,
        variants: (product.variants || []).map(variant => {
            const inventory = inventoryMap.get(Number(variant.variant_id));

            return {
                ...variant,
                quantity_on_hand: inventory?.quantity_on_hand ?? 0,
                quantity_reserved: inventory?.quantity_reserved ?? 0,
                quantity_available: inventory?.quantity_available ?? 0,
                quantity_sold: inventory?.quantity_sold ?? 0
            };
        })
    };
}

function renderFilteredProducts() {
    const filteredProducts = filterProducts(allProducts);

    renderProductTable(
        filteredProducts,
        allProducts.length > 0
            ? "Không tìm thấy sản phẩm phù hợp bộ lọc."
            : "Chưa có sản phẩm nào."
    );
}

function filterProducts(products) {
    const searchText = (productSearchInput?.value || "").trim().toLowerCase();
    const categoryValue = productCategoryFilter?.value || "";
    const stockValue = productStockFilter?.value || "all";

    return products.filter(product => {
        const productName = product.product_name || "";
        const description = product.description || "";
        const categoryId = String(product.category_id || "");
        const categoryName = product.category_name || "";
        const availableQuantity = Number(product.quantity_available || 0);

        const matchesSearch = !searchText || [
            productName,
            description,
            categoryName
        ].some(value => String(value).toLowerCase().includes(searchText));

        const matchesCategory = !categoryValue || categoryId === String(categoryValue);

        const matchesStock = (() => {
            if (stockValue === "all") return true;
            if (stockValue === "available") return availableQuantity > 0;
            if (stockValue === "low") return availableQuantity > 0 && availableQuantity <= 5;
            if (stockValue === "out") return availableQuantity === 0;
            return true;
        })();

        return matchesSearch && matchesCategory && matchesStock;
    });
}

function renderProductTable(products, emptyMessage = "Chưa có sản phẩm nào.") {
    if (products.length === 0) {
        productTableBody.innerHTML = `
            <tr>
                <td colspan="9">${escapeHtml(emptyMessage)}</td>
            </tr>
        `;
        return;
    }

    productTableBody.innerHTML = products
        .map(product => createProductRow(product))
        .join("");

    bindProductActionButtons();
}
