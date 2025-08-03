// 1. Track image clicks (original feature)
document.addEventListener("click", e => {
    if (e.target.tagName === "IMG" && e.target.dataset.id) {
        fetch(`/api/click/${e.target.dataset.id}`, { method: "POST" });
    }
});

// 2. Track unique browser view
async function updateViewCount() {
    const hasVisited = localStorage.getItem('viewCounted');
    const url = hasVisited ? '/api/views' : '/api/views?count=true';

    try {
        const response = await fetch(url);
        const data = await response.json();

        // Display the view count
        const viewCountElement = document.getElementById('viewCount');
        if (viewCountElement) {
            viewCountElement.textContent = data.views;
        }

        // Mark as counted
        if (!hasVisited) {
            localStorage.setItem('viewCounted', 'true');
        }
    } catch (error) {
        console.error('Error fetching view count:', error);
    }
}

document.addEventListener('DOMContentLoaded', updateViewCount);
