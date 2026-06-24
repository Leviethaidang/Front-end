const PRODUCT_SERVICE_URL = window.APP_CONFIG?.PRODUCT_SERVICE_URL || "";
const INVENTORY_SERVICE_URL = window.APP_CONFIG?.INVENTORY_SERVICE_URL || "";
const CART_SERVICE_URL = window.APP_CONFIG?.CART_SERVICE_URL || "";

const detailContainer = document.getElementById("product-detail");

let currentProduct = null;
let selectedSizeId = null;
let selectedColorId = null;
let selectedVariant = null;

let galleryImages = [];
let currentGalleryIndex = 0;

loadProductDetail();

function getProductIdFromUrl() {
    const parts = window.location.pathname.split("/").filter(Boolean);

    return parts[1];
}

function getAccessToken() {
    return localStorage.getItem("accessToken");
}

function redirectToLogin() {
    window.location.href = "/login";
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

function showCartMessage(message, type = "success") {
    const messageElement = document.getElementById("cart-message");

    if (!messageElement) {
        return;
    }

    messageElement.className = `cart-message ${type}`;
    messageElement.textContent = message;
}

async function loadProductDetail() {
    const productId = getProductIdFromUrl();

    if (!productId) {
        detailContainer.className = "error";
        detailContainer.innerHTML = `
            Không tìm thấy mã sản phẩm trên URL.
            <br>
            <a class="back-link" href="/">← Quay về trang chủ</a>
        `;
        return;
    }

    try {
        const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products/${productId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Không thể tải chi tiết sản phẩm.");
        }

        const product = data.product;
        const variantIds = (product.variants || [])
            .map(variant => variant.variant_id)
            .filter(Boolean);

        const inventoryMap = await loadVariantInventories(variantIds);

        currentProduct = mergeInventoryIntoProduct(product, inventoryMap);
        renderProductDetail(currentProduct);

    } catch (error) {
        console.error("Lỗi tải chi tiết sản phẩm:", error);

        detailContainer.className = "error";
        detailContainer.innerHTML = `
            ${escapeHtml(error.message || "Không thể tải chi tiết sản phẩm.")}
            <br>
            <a class="back-link" href="/">← Quay về trang chủ</a>
        `;
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
        console.error("Lỗi tải inventory variants:", error);

        // Nếu Inventory lỗi thì vẫn hiển thị thông tin sản phẩm,
        // nhưng toàn bộ biến thể sẽ được xem như hết hàng.
        return new Map();
    }
}

function mergeInventoryIntoProduct(product, inventoryMap) {
    const variants = (product.variants || []).map(variant => {
        const inventory = inventoryMap.get(Number(variant.variant_id));

        return {
            ...variant,
            quantity_on_hand: inventory?.quantity_on_hand ?? 0,
            quantity_reserved: inventory?.quantity_reserved ?? 0,
            quantity_available: inventory?.quantity_available ?? 0,
            quantity_sold: inventory?.quantity_sold ?? 0
        };
    });

    const inventorySummary = variants.reduce(
        (summary, variant) => {
            summary.quantity_on_hand += Number(variant.quantity_on_hand) || 0;
            summary.quantity_reserved += Number(variant.quantity_reserved) || 0;
            summary.quantity_available += Number(variant.quantity_available) || 0;
            summary.quantity_sold += Number(variant.quantity_sold) || 0;
            return summary;
        },
        {
            quantity_on_hand: 0,
            quantity_reserved: 0,
            quantity_available: 0,
            quantity_sold: 0
        }
    );

    return {
        ...product,
        variants,
        inventorySummary
    };
}

function getActiveVariants(product) {
    return (product.variants || []).filter(variant => {
        return Number(variant.quantity_available || 0) > 0;
    });
}

function getUniqueSizes(product) {
    const map = new Map();

    getActiveVariants(product).forEach(variant => {
        if (!map.has(Number(variant.size_id))) {
            map.set(Number(variant.size_id), {
                sizeId: Number(variant.size_id),
                sizeName: variant.size_name
            });
        }
    });

    return Array.from(map.values());
}

function getColorsForSize(product, sizeId) {
    const map = new Map();

    getActiveVariants(product)
        .filter(variant => Number(variant.size_id) === Number(sizeId))
        .forEach(variant => {
            if (!map.has(Number(variant.color_id))) {
                map.set(Number(variant.color_id), {
                    colorId: Number(variant.color_id),
                    colorName: variant.color_name,
                    colorCode: variant.color_code
                });
            }
        });

    return Array.from(map.values());
}

function findVariant(product, sizeId, colorId) {
    return (product.variants || []).find(variant => {
        return Number(variant.size_id) === Number(sizeId)
            && Number(variant.color_id) === Number(colorId)
            && Number(variant.quantity_available || 0) > 0;
    }) || null;
}

function renderProductDetail(product) {
    const activeVariants = getActiveVariants(product);
    const isOutOfStock = activeVariants.length === 0;

    galleryImages = product.images || [];

    const imageHtml = product.imageUrl
        ? `<img class="product-image" src="${escapeAttribute(product.imageUrl)}" alt="${escapeAttribute(product.product_name)}">`
        : `<span class="no-image">Không có ảnh</span>`;

    detailContainer.className = "detail-card";

    detailContainer.innerHTML = `
        <div class="product-image-wrap">
            ${imageHtml}
        </div>

        <div>
            <div class="product-name">
                ${escapeHtml(product.product_name)}
            </div>

            <div class="product-category">
                ${escapeHtml(product.category_name || "Chưa phân loại")}
            </div>

            <div class="product-description">
                ${escapeHtml(product.description || "Chưa có mô tả cho sản phẩm này.")}
            </div>

            <div class="product-price">
                ${formatPrice(product.price)}
            </div>

            <div class="product-meta">
                <strong>Đã bán:</strong>
                ${escapeHtml(product.inventorySummary?.quantity_sold ?? 0)}
            </div>

            <div class="product-meta">
                <strong>Tổng còn lại:</strong>
                ${escapeHtml(product.inventorySummary?.quantity_available ?? 0)}
            </div>

            ${renderVariantSelector(product)}

            <div class="action-area">
                <div class="quantity-row">
                    <label for="cart-quantity">Số lượng:</label>

                    <input
                        id="cart-quantity"
                        class="quantity-input"
                        type="number"
                        min="1"
                        max="1"
                        value="${isOutOfStock ? 0 : 1}"
                        disabled
                    >
                </div>

                <div class="product-action-buttons">
                    <button
                        id="add-to-cart-btn"
                        class="add-to-cart-btn"
                        disabled
                    >
                        ${isOutOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
                    </button>

                    <button
                        id="buy-now-btn"
                        class="buy-now-btn"
                        disabled
                    >
                        Mua ngay
                    </button>
                </div>

                ${renderSubImageGallery(product)}

                <div id="cart-message" class="cart-message"></div>
            </div>

            ${renderImageModal()}
        </div>
    `;

    bindVariantButtons(product);
    bindActionButtons(product);
    bindGalleryButtons();

    if (isOutOfStock) {
        showCartMessage("Sản phẩm hiện đã hết hàng.", "error");
    }
}

function renderVariantSelector(product) {
    const sizes = getUniqueSizes(product);

    if (sizes.length === 0) {
        return `
            <div class="variant-selector">
                <strong>Sản phẩm hiện không có biến thể còn hàng.</strong>
            </div>
        `;
    }

    return `
        <div class="variant-selector">
            <div class="variant-row">
                <span class="variant-label">Chọn size</span>

                <div id="size-option-list" class="option-list">
                    ${sizes.map(size => `
                        <button
                            type="button"
                            class="option-btn size-option-btn"
                            data-size-id="${escapeAttribute(size.sizeId)}"
                        >
                            ${escapeHtml(size.sizeName)}
                        </button>
                    `).join("")}
                </div>
            </div>

            <div class="variant-row">
                <span class="variant-label">Chọn màu</span>

                <div id="color-option-list" class="option-list">
                    <span class="selected-variant-info">
                        Vui lòng chọn size trước.
                    </span>
                </div>
            </div>

            <div id="selected-variant-info" class="selected-variant-info">
                Chưa chọn biến thể.
            </div>
        </div>
    `;
}

function renderColorOptions(product, sizeId) {
    const colors = getColorsForSize(product, sizeId);

    if (colors.length === 0) {
        return `
            <span class="selected-variant-info">
                Size này hiện không còn màu nào.
            </span>
        `;
    }

    return colors.map(color => `
        <button
            type="button"
            class="option-btn color-option-btn"
            data-color-id="${escapeAttribute(color.colorId)}"
            title="${escapeAttribute(color.colorCode || "")}"
        >
            ${escapeHtml(color.colorName)}
        </button>
    `).join("");
}

function bindVariantButtons(product) {
    const sizeButtons = document.querySelectorAll(".size-option-btn");

    sizeButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectedSizeId = Number(button.dataset.sizeId);
            selectedColorId = null;
            selectedVariant = null;

            document.querySelectorAll(".size-option-btn").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            const colorList = document.getElementById("color-option-list");
            colorList.innerHTML = renderColorOptions(product, selectedSizeId);

            bindColorButtons(product);
            updateSelectedVariantUI(product);
        });
    });
}

function bindColorButtons(product) {
    const colorButtons = document.querySelectorAll(".color-option-btn");

    colorButtons.forEach(button => {
        button.addEventListener("click", () => {
            selectedColorId = Number(button.dataset.colorId);

            document.querySelectorAll(".color-option-btn").forEach(btn => {
                btn.classList.remove("active");
            });

            button.classList.add("active");

            selectedVariant = findVariant(product, selectedSizeId, selectedColorId);

            updateSelectedVariantUI(product);
        });
    });
}

function updateSelectedVariantUI(product) {
    const info = document.getElementById("selected-variant-info");
    const quantityInput = document.getElementById("cart-quantity");
    const addButton = document.getElementById("add-to-cart-btn");
    const buyNowButton = document.getElementById("buy-now-btn");

    if (!quantityInput || !addButton || !buyNowButton) {
        return;
    }

    if (!selectedSizeId) {
        info.textContent = "Chưa chọn biến thể.";
        quantityInput.disabled = true;
        addButton.disabled = true;
        buyNowButton.disabled = true;
        return;
    }

    if (!selectedColorId) {
        info.textContent = "Vui lòng chọn màu.";
        quantityInput.disabled = true;
        addButton.disabled = true;
        buyNowButton.disabled = true;
        return;
    }

    if (!selectedVariant) {
        info.textContent = "Biến thể này hiện không còn hàng.";
        quantityInput.disabled = true;
        addButton.disabled = true;
        buyNowButton.disabled = true;
        return;
    }

    const availableQuantity = Number(selectedVariant.quantity_available || 0);

    info.innerHTML = `
        Đang chọn:
        <strong>${escapeHtml(selectedVariant.size_name)}</strong> /
        <strong>${escapeHtml(selectedVariant.color_name)}</strong>.
        Còn lại: <strong>${escapeHtml(availableQuantity)}</strong>
    `;

    quantityInput.max = availableQuantity;
    quantityInput.value = availableQuantity > 0 ? 1 : 0;
    quantityInput.disabled = availableQuantity <= 0;

    addButton.disabled = availableQuantity <= 0;
    buyNowButton.disabled = availableQuantity <= 0;

    if (availableQuantity <= 0) {
        addButton.textContent = "Hết hàng";
    } else {
        addButton.textContent = "Thêm vào giỏ hàng";
    }
}

function bindActionButtons(product) {
    const addToCartButton = document.getElementById("add-to-cart-btn");
    const buyNowButton = document.getElementById("buy-now-btn");

    if (addToCartButton) {
        addToCartButton.addEventListener("click", () => {
            addToCart(product.product_id);
        });
    }

    if (buyNowButton) {
        buyNowButton.addEventListener("click", () => {
            buyNow(product.product_id);
        });
    }
}

function renderSubImageGallery(product) {
    const images = product.images || [];

    if (images.length === 0) {
        return "";
    }

    const visibleImages = images.slice(0, 3);

    return `
        <div class="sub-image-gallery">
            <div class="sub-image-title">
                Ảnh phụ
            </div>

            <div class="sub-image-list">
                ${visibleImages.map((image, index) => `
                    <div
                        class="sub-image-thumb"
                        data-image-index="${escapeAttribute(index)}"
                    >
                        <img
                            src="${escapeAttribute(image.imageUrl)}"
                            alt="Ảnh phụ ${escapeAttribute(index + 1)}"
                        >
                    </div>
                `).join("")}
            </div>

            ${images.length > 3 ? `
                <div class="selected-variant-info">
                    Có ${escapeHtml(images.length)} ảnh phụ. Bấm vào ảnh để xem toàn bộ.
                </div>
            ` : ""}
        </div>
    `;
}

function renderImageModal() {
    return `
        <div id="image-modal" class="image-modal-overlay">
            <div class="image-modal-box">
                <button id="image-modal-close" class="image-modal-close" type="button">
                    ×
                </button>

                <button id="image-modal-prev" class="image-nav-btn image-nav-prev" type="button">
                    ‹
                </button>

                <img id="image-modal-main" class="image-modal-main" src="" alt="Ảnh sản phẩm">

                <button id="image-modal-next" class="image-nav-btn image-nav-next" type="button">
                    ›
                </button>

                <div id="image-modal-counter" class="image-modal-counter"></div>
            </div>
        </div>
    `;
}

function bindGalleryButtons() {
    const thumbnails = document.querySelectorAll(".sub-image-thumb");

    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener("click", () => {
            const imageIndex = Number(thumbnail.dataset.imageIndex || 0);
            openImageModal(imageIndex);
        });
    });

    const closeButton = document.getElementById("image-modal-close");
    const prevButton = document.getElementById("image-modal-prev");
    const nextButton = document.getElementById("image-modal-next");
    const modal = document.getElementById("image-modal");

    if (closeButton) {
        closeButton.addEventListener("click", closeImageModal);
    }

    if (prevButton) {
        prevButton.addEventListener("click", showPreviousImage);
    }

    if (nextButton) {
        nextButton.addEventListener("click", showNextImage);
    }

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeImageModal();
            }
        });
    }
}

function openImageModal(index) {
    if (!galleryImages.length) {
        return;
    }

    currentGalleryIndex = index;

    const modal = document.getElementById("image-modal");

    if (!modal) {
        return;
    }

    modal.classList.add("show");
    updateImageModal();
}

function closeImageModal() {
    const modal = document.getElementById("image-modal");

    if (!modal) {
        return;
    }

    modal.classList.remove("show");
}

function showPreviousImage() {
    if (!galleryImages.length) {
        return;
    }

    currentGalleryIndex =
        (currentGalleryIndex - 1 + galleryImages.length) % galleryImages.length;

    updateImageModal();
}

function showNextImage() {
    if (!galleryImages.length) {
        return;
    }

    currentGalleryIndex =
        (currentGalleryIndex + 1) % galleryImages.length;

    updateImageModal();
}

function updateImageModal() {
    const image = galleryImages[currentGalleryIndex];
    const modalImage = document.getElementById("image-modal-main");
    const counter = document.getElementById("image-modal-counter");

    if (!image || !modalImage || !counter) {
        return;
    }

    modalImage.src = image.imageUrl;
    counter.textContent = `${currentGalleryIndex + 1} / ${galleryImages.length}`;
}

function getValidSelectedQuantity() {
    const quantityInput = document.getElementById("cart-quantity");

    if (!selectedVariant) {
        showCartMessage("Vui lòng chọn size và màu trước.", "error");
        return null;
    }

    if (!quantityInput) {
        return null;
    }

    const quantity = Number(quantityInput.value);
    const maxAvailableQuantity = Number(quantityInput.max);

    if (!Number.isInteger(quantity) || quantity <= 0) {
        showCartMessage("Số lượng phải là số nguyên lớn hơn 0.", "error");
        return null;
    }

    if (quantity > maxAvailableQuantity) {
        showCartMessage("Số lượng không được vượt quá số lượng còn lại của biến thể.", "error");
        return null;
    }

    return quantity;
}

async function addToCart(productId) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        redirectToLogin();
        return;
    }

    const addButton = document.getElementById("add-to-cart-btn");
    const quantity = getValidSelectedQuantity();

    if (!quantity) {
        return;
    }

    try {
        addButton.disabled = true;
        addButton.textContent = "Đang thêm...";

        const response = await fetch(`${CART_SERVICE_URL}/api/cart/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                productId: Number(productId),
                variantId: Number(selectedVariant.variant_id),
                quantity
            })
        });

        const data = await response.json();

        if (response.status === 401) {
            localStorage.removeItem("accessToken");
            redirectToLogin();
            return;
        }

        if (!response.ok) {
            throw new Error(data.error || "Không thể thêm sản phẩm vào giỏ hàng.");
        }

        showCartMessage("Đã thêm sản phẩm vào giỏ hàng!", "success");

    } catch (error) {
        console.error("Lỗi thêm vào giỏ hàng:", error);

        showCartMessage(
            error.message || "Không thể thêm sản phẩm vào giỏ hàng.",
            "error"
        );

    } finally {
        addButton.disabled = false;
        addButton.textContent = "Thêm vào giỏ hàng";
    }
}

function buyNow(productId) {
    const accessToken = getAccessToken();

    if (!accessToken) {
        redirectToLogin();
        return;
    }

    const quantity = getValidSelectedQuantity();

    if (!quantity) {
        return;
    }

    window.location.href =
        `/confirm-order/buy-now?productId=${encodeURIComponent(productId)}&variantId=${encodeURIComponent(selectedVariant.variant_id)}&quantity=${encodeURIComponent(quantity)}`;
}