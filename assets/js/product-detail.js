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
let imageAutoPlayInterval = null;

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
    messageElement.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            messageElement.style.display = "";
            messageElement.className = "cart-message";
            messageElement.textContent = "";
        }, 3000);
    }
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

    // Handle both images (product_images array) and single imageUrl/image_key
    const productImages = product.images || product.product_images || [];
    galleryImages = productImages;

    // Get main image: first product image or single imageUrl/image_key
    let mainImageUrl = null;
    if (productImages.length > 0) {
        mainImageUrl = productImages[0].imageUrl || productImages[0].image_url || productImages[0].image_key;
    } else {
        mainImageUrl = product.imageUrl || product.image_url || product.image_key;
    }

    const productName = product.product_name || product.productName || "Sản phẩm";
    const categoryName = product.category_name || product.categoryName || "Chưa phân loại";
    const soldQty = product.inventorySummary?.quantity_sold ?? 0;
    const availableQty = product.inventorySummary?.quantity_available ?? 0;

    const mainImageHtml = mainImageUrl
        ? `<img class="product-image" id="main-product-image" src="${escapeAttribute(mainImageUrl)}" alt="${escapeHtml(productName)}"
               style="cursor:pointer; width: 100%; height: 400px; object-fit: contain;" onclick="openImageModal(0)">`
        : `<span class="no-image">📦 Chưa có ảnh</span>`;

    const stockStatusHtml = isOutOfStock
        ? `<span class="product-stock-status out-of-stock">Hết hàng</span>`
        : `<span class="product-stock-status in-stock">✓ Còn hàng</span>`;

    detailContainer.className = "detail-card";

    detailContainer.innerHTML = `
        <div class="row">
            <!-- Image Column -->
            <div class="col-md-6">
                <div class="product-image-main" id="product-image-main" style="border: 1px solid #eee; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                    ${mainImageHtml}
                </div>
                ${renderSubImageGallery(product)}
            </div>

            <!-- Info Column -->
            <div class="col-md-6">
                <div class="mb-2">
                    <span class="badge bg-secondary me-2">${escapeHtml(categoryName)}</span>
                    ${stockStatusHtml}
                </div>

                <h1 class="mb-1">${escapeHtml(productName)}</h1>

                <div class="mb-3 d-flex align-items-center">
                    <small class="text-warning">
                        <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i>
                    </small>
                    <a href="#" class="ms-2 text-muted">Đã bán: ${escapeHtml(soldQty)}</a>
                    <a href="#" class="ms-3 text-muted">Còn lại: ${escapeHtml(availableQty)}</a>
                </div>

                <div class="fs-3 mb-4">
                    <span class="fw-bold text-success">${formatPrice(product.price)}</span>
                </div>

                <div class="mb-4">
                    ${escapeHtml(product.description || "Chưa có mô tả cho sản phẩm này.")}
                </div>

                <hr class="my-4">

                ${renderVariantSelector(product)}

                <div class="mt-4 row align-items-center">
                    <div class="col-auto">
                        <label class="form-label" for="cart-quantity">Số lượng:</label>
                    </div>
                    <div class="col-auto">
                        <div class="input-group">
                            <button type="button" class="btn btn-outline-secondary" id="qty-decrease" disabled>−</button>
                            <div class="form-control text-center d-flex align-items-center justify-content-center" id="qty-display" style="width: 50px;">${isOutOfStock ? 0 : 1}</div>
                            <button type="button" class="btn btn-outline-secondary" id="qty-increase" disabled>+</button>
                        </div>
                        <input
                            id="cart-quantity"
                            type="number"
                            min="1"
                            max="1"
                            value="${isOutOfStock ? 0 : 1}"
                            disabled
                            style="display:none"
                        >
                    </div>
                </div>

                <div class="mt-4 d-flex gap-3">
                    <button
                        id="add-to-cart-btn"
                        class="btn btn-primary bg-gradient px-4 py-2"
                        disabled
                    >
                        <i class="bi bi-cart-plus me-2"></i> ${isOutOfStock ? "Hết hàng" : "Thêm vào giỏ hàng"}
                    </button>

                    <button
                        id="buy-now-btn"
                        class="btn btn-outline-primary px-4 py-2"
                        disabled
                    >
                        ⚡ Mua ngay
                    </button>
                </div>

                <div id="cart-message" class="mt-3"></div>
            </div>
        </div>
        ${renderImageModal()}
    `;

    bindVariantButtons(product);
    bindActionButtons(product);
    bindGalleryButtons();
    bindQtyControls();

    if (isOutOfStock) {
        showCartMessage("Sản phẩm hiện đã hết hàng.", "error");
    }
}

function renderVariantSelector(product) {
    const sizes = getUniqueSizes(product);

    if (sizes.length === 0) {
        return `
            <div class="variant-selector mb-3">
                <strong>Sản phẩm hiện không có biến thể còn hàng.</strong>
            </div>
        `;
    }

    return `
        <div class="variant-selector mb-3">
            <div class="variant-row mb-3">
                <span class="variant-label fw-bold d-block mb-2">Chọn size:</span>

                <div id="size-option-list" class="d-flex flex-wrap gap-2">
                    ${sizes.map(size => `
                        <button
                            type="button"
                            class="btn btn-outline-secondary size-option-btn"
                            data-size-id="${escapeAttribute(size.sizeId)}"
                        >
                            ${escapeHtml(size.sizeName)}
                        </button>
                    `).join("")}
                </div>
            </div>
            <div class="variant-row mb-3" id="color-selector-row" style="display:none">
                <span class="variant-label fw-bold d-block mb-2">Chọn màu:</span>
                <div id="color-option-list" class="d-flex flex-wrap gap-2">
                </div>
            </div>

            <div id="selected-variant-info" class="text-primary mt-2 small fw-bold">
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
            class="btn btn-outline-secondary color-option-btn"
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
                btn.classList.remove("btn-success", "text-white");
                btn.classList.add("btn-outline-secondary");
            });

            button.classList.remove("btn-outline-secondary");
            button.classList.add("btn-success", "text-white");

            const colorList = document.getElementById("color-option-list");
            colorList.innerHTML = renderColorOptions(product, selectedSizeId);
            document.getElementById("color-selector-row").style.display = "block";

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
                btn.classList.remove("btn-success", "text-white");
                btn.classList.add("btn-outline-secondary");
            });

            button.classList.remove("btn-outline-secondary");
            button.classList.add("btn-success", "text-white");

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

    // Sync qty display controls
    const qtyDisplay = document.getElementById("qty-display");
    const qtyDecrease = document.getElementById("qty-decrease");
    const qtyIncrease = document.getElementById("qty-increase");
    if (qtyDisplay) qtyDisplay.textContent = availableQuantity > 0 ? 1 : 0;
    if (qtyDecrease) qtyDecrease.disabled = availableQuantity <= 0;
    if (qtyIncrease) qtyIncrease.disabled = availableQuantity <= 1;

    addButton.disabled = availableQuantity <= 0;
    buyNowButton.disabled = availableQuantity <= 0;

    if (availableQuantity <= 0) {
        addButton.textContent = "Hết hàng";
    } else {
        addButton.textContent = "🛒 Thêm vào giỏ hàng";
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
    const images = product.images || product.product_images || [];

    if (images.length === 0) {
        return "";
    }

    return `
        <div class="sub-image-gallery mt-3 position-relative">
            <div class="d-flex align-items-center justify-content-center">
                <button type="button" class="btn btn-sm btn-outline-secondary" id="gallery-prev-btn" style="border: none; background: transparent; font-size: 1.5rem;"><i class="bi bi-chevron-left"></i></button>
                <div class="sub-image-list d-flex overflow-hidden mx-2 py-1" id="gallery-scroll-container" style="max-width: 320px; gap: 10px; scroll-behavior: smooth;">
                    ${images.map((image, index) => {
                        const imgUrl = image.imageUrl || image.image_url || image.image_key;
                        const isActive = index === 0;
                        return `
                            <div
                                class="sub-image-thumb${isActive ? ' active' : ''}"
                                data-image-index="${escapeAttribute(index)}"
                                data-image-url="${escapeAttribute(imgUrl)}"
                                style="flex: 0 0 70px; height: 70px; border: ${isActive ? '2px solid #0d6efd' : '1px solid #ddd'}; border-radius: 4px; overflow: hidden; cursor: pointer; opacity: ${isActive ? '1' : '0.5'}; transition: all 0.3s ease; position: relative;"
                            >
                                <img
                                    src="${escapeAttribute(imgUrl)}"
                                    alt="Ảnh ${escapeAttribute(index + 1)}"
                                    style="width: 100%; height: 100%; object-fit: cover;"
                                >
                            </div>
                        `;
                    }).join("")}
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary" id="gallery-next-btn" style="border: none; background: transparent; font-size: 1.5rem;"><i class="bi bi-chevron-right"></i></button>
            </div>
        </div>
    `;
}

function renderImageModal() {
    return `
        <div class="modal fade" id="image-modal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered modal-lg">
                <div class="modal-content bg-transparent border-0">
                    <div class="modal-header border-0 pb-0 justify-content-end">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" style="filter: invert(1) grayscale(100%) brightness(200%);"></button>
                    </div>
                    <div class="modal-body text-center position-relative">
                        <button id="image-modal-prev" class="btn btn-dark rounded-circle position-absolute top-50 start-0 translate-middle-y ms-2" type="button" style="z-index: 1055; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-chevron-left"></i>
                        </button>

                        <img id="image-modal-main" class="img-fluid rounded shadow" src="" alt="Ảnh sản phẩm" style="max-height: 80vh; object-fit: contain;">

                        <button id="image-modal-next" class="btn btn-dark rounded-circle position-absolute top-50 end-0 translate-middle-y me-2" type="button" style="z-index: 1055; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                            <i class="bi bi-chevron-right"></i>
                        </button>
                        
                        <div id="image-modal-counter" class="text-white mt-3 fw-bold fs-5 text-shadow"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function bindQtyControls() {
    const qtyDecrease = document.getElementById("qty-decrease");
    const qtyIncrease = document.getElementById("qty-increase");
    const qtyDisplay = document.getElementById("qty-display");
    const quantityInput = document.getElementById("cart-quantity");

    if (!qtyDecrease || !qtyIncrease || !qtyDisplay || !quantityInput) return;

    qtyDecrease.addEventListener("click", () => {
        const current = Number(quantityInput.value) || 1;
        if (current <= 1) return;
        const next = current - 1;
        quantityInput.value = next;
        qtyDisplay.textContent = next;
        qtyDecrease.disabled = next <= 1;
        qtyIncrease.disabled = next >= Number(quantityInput.max);
    });

    qtyIncrease.addEventListener("click", () => {
        const current = Number(quantityInput.value) || 1;
        const max = Number(quantityInput.max) || 1;
        if (current >= max) return;
        const next = current + 1;
        quantityInput.value = next;
        qtyDisplay.textContent = next;
        qtyDecrease.disabled = next <= 1;
        qtyIncrease.disabled = next >= max;
    });
}

function bindGalleryButtons() {
    const thumbnails = document.querySelectorAll(".sub-image-thumb");
    const mainImage = document.getElementById("main-product-image");
    
    if (imageAutoPlayInterval) {
        clearInterval(imageAutoPlayInterval);
    }
    
    if (thumbnails.length > 1) {
        imageAutoPlayInterval = setInterval(() => {
            currentGalleryIndex = (currentGalleryIndex + 1) % thumbnails.length;
            const nextThumb = thumbnails[currentGalleryIndex];
            updateMainImageFromThumb(nextThumb, thumbnails, mainImage);
        }, 5000);
    }

    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener("click", () => {
            if (imageAutoPlayInterval) clearInterval(imageAutoPlayInterval);
            updateMainImageFromThumb(thumbnail, thumbnails, mainImage);
        });
    });

    const scrollContainer = document.getElementById("gallery-scroll-container");
    const galPrevBtn = document.getElementById("gallery-prev-btn");
    const galNextBtn = document.getElementById("gallery-next-btn");
    
    if (galPrevBtn && scrollContainer) {
        galPrevBtn.addEventListener("click", () => {
            scrollContainer.scrollBy({ left: -80, behavior: "smooth" });
            if (imageAutoPlayInterval) clearInterval(imageAutoPlayInterval);
        });
    }
    if (galNextBtn && scrollContainer) {
        galNextBtn.addEventListener("click", () => {
            scrollContainer.scrollBy({ left: 80, behavior: "smooth" });
            if (imageAutoPlayInterval) clearInterval(imageAutoPlayInterval);
        });
    }

    const prevButton = document.getElementById("image-modal-prev");
    const nextButton = document.getElementById("image-modal-next");

    if (prevButton) prevButton.addEventListener("click", showPreviousImage);
    if (nextButton) nextButton.addEventListener("click", showNextImage);
}

function updateMainImageFromThumb(thumbnail, thumbnails, mainImage) {
    if (!thumbnail) return;
    
    thumbnails.forEach(t => {
        t.classList.remove("active");
        t.style.opacity = "0.5";
        t.style.border = "1px solid #ddd";
    });
    
    thumbnail.classList.add("active");
    thumbnail.style.opacity = "1";
    thumbnail.style.border = "2px solid #0d6efd";

    if (mainImage && thumbnail.dataset.imageUrl) {
        mainImage.src = thumbnail.dataset.imageUrl;
    }

    currentGalleryIndex = Number(thumbnail.dataset.imageIndex || 0);
    
    const scrollContainer = document.getElementById("gallery-scroll-container");
    if (scrollContainer) {
        const thumbLeft = thumbnail.offsetLeft;
        const containerLeft = scrollContainer.scrollLeft;
        const containerWidth = scrollContainer.clientWidth;
        
        if (thumbLeft < containerLeft || thumbLeft + 70 > containerLeft + containerWidth) {
            scrollContainer.scrollTo({ left: thumbLeft - containerWidth / 2 + 35, behavior: 'smooth' });
        }
    }
}

function openImageModal(index) {
    if (!galleryImages.length) {
        return;
    }

    currentGalleryIndex = index;
    updateImageModal();

    const modalElement = document.getElementById("image-modal");
    if (modalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
    }
}

function closeImageModal() {
    const modalElement = document.getElementById("image-modal");
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
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

    const imgUrl = image.imageUrl || image.image_url || image.image_key;
    modalImage.src = imgUrl;
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
        addButton.textContent = "🛒 Thêm vào giỏ hàng";
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