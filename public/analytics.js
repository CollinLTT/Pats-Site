// =========================
// 1. Track image clicks (your original code)
// =========================
document.addEventListener("click", e => {
    if (e.target.tagName === "IMG" && e.target.dataset.id) {
        fetch(`/api/click/${e.target.dataset.id}`, { method: "POST" });
    }
});

// =========================
// 2. Track and display website views
// =========================
async function updateViewCount() {
    try {
        const response = await fetch('/api/views');
        const data = await response.json();
        const viewCountElement = document.getElementById('viewCount');
        if (viewCountElement) {
            viewCountElement.textContent = data.views;
        }
    } catch (error) {
        console.error('Error fetching view count:', error);
    }
}

document.addEventListener('DOMContentLoaded', updateViewCount);
