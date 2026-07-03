async function loadFooter() {
    const placeholder = document.getElementById("footer-placeholder");
    if (!placeholder) return;

    try {
        const response = await fetch("/footer.html");
        
        if (!response.ok) {
            throw new Error("Không thể load footer.html");
        }

        const footerHtml = await response.text();
        placeholder.innerHTML = footerHtml;
    } catch (error) {
        console.error("Lỗi load footer:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadFooter();
});
