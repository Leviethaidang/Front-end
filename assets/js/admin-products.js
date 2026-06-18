const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const accessToken = localStorage.getItem("accessToken");

const message = document.getElementById("message");
const productTableBody = document.getElementById("productTableBody");

const createProductBtn = document.getElementById("createProductBtn");

const productImageInput = document.getElementById("newProductImage");
const productPreviewImage = document.getElementById("productPreviewImage");

let categories = [];

createProductBtn.addEventListener("click", createProduct);

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
                <td colspan="10">Vui lòng đăng nhập bằng tài khoản Admin.</td>
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
                <td colspan="10">Bạn không có quyền xem nội dung này.</td>
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
    await loadProducts();
}

async function loadProducts() {
    if (!checkAdmin()) return;

    productTableBody.innerHTML = `
        <tr>
            <td colspan="10">Đang tải...</td>
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
                    <td colspan="10">Chưa có sản phẩm nào.</td>
                </tr>
            `;
            return;
        }

        productTableBody.innerHTML = products
            .map(product => createProductRow(product))
            .join("");

        bindProductActionButtons();

    } catch (error) {
        console.error("Lỗi load products:", error);

        setMessage("Không thể kết nối Product Service.", "danger");

        productTableBody.innerHTML = `
            <tr>
                <td colspan="10">Không thể tải dữ liệu sản phẩm.</td>
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
                <input
                    id="product-name-${escapeAttribute(productId)}"
                    value="${escapeAttribute(product.product_name)}"
                >
            </td>

            <td>
                ${renderCategoryDropdownForProduct(product)}
            </td>

            <td>
                <input
                    id="product-price-${escapeAttribute(productId)}"
                    type="number"
                    value="${escapeAttribute(product.price)}"
                >
            </td>

            <td>
                <input
                    id="product-stock-${escapeAttribute(productId)}"
                    type="number"
                    value="${escapeAttribute(product.stock_quantity)}"
                >
            </td>

            <td>
                <input
                    id="product-sold-${escapeAttribute(productId)}"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeAttribute(product.sold_quantity || 0)}"
                >
            </td>

            <td>
                <textarea id="product-description-${escapeAttribute(productId)}">${escapeHtml(product.description || "")}</textarea>
            </td>

            <td>
                <input
                    id="product-image-key-${escapeAttribute(productId)}"
                    type="hidden"
                    value="${escapeAttribute(product.image_key || "")}"
                >

                <input
                    id="product-image-file-${escapeAttribute(productId)}"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                >
            </td>

            <td>
                <button
                    class="btn btn-blue update-product-btn"
                    data-product-id="${escapeAttribute(productId)}"
                >
                    Lưu
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
    const updateButtons = document.querySelectorAll(".update-product-btn");
    const deleteButtons = document.querySelectorAll(".delete-product-btn");

    updateButtons.forEach(button => {
        button.addEventListener("click", () => {
            updateProduct(button.dataset.productId);
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
    const stockRaw = document.getElementById("newStockQuantity").value.trim();
    const file = document.getElementById("newProductImage").files[0];

    if (!productName || !priceRaw || stockRaw === "") {
        setMessage("Vui lòng nhập tên sản phẩm, giá và số lượng kho.", "danger");
        return;
    }

    if (Number(priceRaw) <= 0) {
        setMessage("Giá sản phẩm phải lớn hơn 0.", "danger");
        return;
    }

    if (Number(stockRaw) < 0) {
        setMessage("Số lượng kho không được nhỏ hơn 0.", "danger");
        return;
    }

    try {
        createProductBtn.disabled = true;
        createProductBtn.textContent = "Đang tạo...";
        setMessage("Đang tạo sản phẩm...", "success");

        let imageKey = null;

        if (file) {
            imageKey = await uploadProductImage(file);
        }

        const body = {
            productName,
            description,
            categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
            price: Number(priceRaw),
            stockQuantity: Number(stockRaw),
            imageKey
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

async function updateProduct(productId) {
    if (!checkAdmin()) return;

    clearMessage();

    const productName = document.getElementById(`product-name-${productId}`).value.trim();
    const description = document.getElementById(`product-description-${productId}`).value.trim();
    const categoryIdRaw = document.getElementById(`product-category-${productId}`).value.trim();
    const priceRaw = document.getElementById(`product-price-${productId}`).value.trim();
    const stockRaw = document.getElementById(`product-stock-${productId}`).value.trim();
    const soldRaw = document.getElementById(`product-sold-${productId}`).value.trim();

    const currentImageKey = document.getElementById(`product-image-key-${productId}`).value.trim();
    const fileInput = document.getElementById(`product-image-file-${productId}`);
    const file = fileInput.files[0];

    if (!productName || !priceRaw || stockRaw === "" || soldRaw === "") {
        setMessage("Vui lòng nhập tên sản phẩm, giá, số lượng kho và số lượng đã bán.", "danger");
        return;
    }

    if (Number(priceRaw) <= 0) {
        setMessage("Giá sản phẩm phải lớn hơn 0.", "danger");
        return;
    }

    if (Number(stockRaw) < 0) {
        setMessage("Số lượng tồn kho không được nhỏ hơn 0.", "danger");
        return;
    }

    if (Number(soldRaw) < 0) {
        setMessage("Số lượng đã bán không được nhỏ hơn 0.", "danger");
        return;
    }

    try {
        setMessage("Đang cập nhật sản phẩm...", "success");

        let imageKey = currentImageKey || null;

        if (file) {
            imageKey = await uploadProductImage(file);
        }

        const body = {
            productName,
            description,
            categoryId: categoryIdRaw ? Number(categoryIdRaw) : null,
            price: Number(priceRaw),
            stockQuantity: Number(stockRaw),
            soldQuantity: Number(soldRaw),
            imageKey
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

        await loadProducts();

    } catch (error) {
        console.error("Lỗi cập nhật sản phẩm:", error);
        setMessage(error.message || "Không thể cập nhật sản phẩm.", "danger");
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

    } catch (error) {
        console.error("Lỗi load categories:", error);
        setMessage("Không thể kết nối Product Service để tải danh mục.", "danger");
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

function renderCategoryDropdownForProduct(product) {
    return `
        <select id="product-category-${escapeAttribute(product.product_id)}">
            <option value="">Chưa phân loại</option>

            ${categories.map(category => `
                <option
                    value="${escapeAttribute(category.category_id)}"
                    ${Number(product.category_id) === Number(category.category_id) ? "selected" : ""}
                >
                    ${escapeHtml(category.category_name)}
                </option>
            `).join("")}
        </select>
    `;
}

function clearProductForm() {
    document.getElementById("newProductName").value = "";
    document.getElementById("newProductDescription").value = "";
    document.getElementById("newCategoryId").value = "";
    document.getElementById("newPrice").value = "";
    document.getElementById("newStockQuantity").value = "";
    document.getElementById("newProductImage").value = "";

    productPreviewImage.style.display = "none";
    productPreviewImage.src = "";
}