// 1. Track image clicks (original feature)
document.addEventListener("click", e => {
    if (e.target.tagName === "IMG" && e.target.dataset.id) {
        fetch(`/api/click/${e.target.dataset.id}`, { method: "POST" });
    }
});

async function updateViewCount() {
    console.log('updateViewCount running'); // <--- DEBUG

    const hasVisited = localStorage.getItem('viewCounted');
    const url = hasVisited ? '/api/views' : '/api/views?count=true';
    console.log('Fetching from', url); // <--- DEBUG

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log('Server response:', data); // <--- DEBUG

        const viewCountElement = document.getElementById('viewCount');
        if (viewCountElement) {
            viewCountElement.textContent = data.views;
        }

        if (!hasVisited) {
            localStorage.setItem('viewCounted', 'true');
        }
    } catch (error) {
        console.error('Error fetching view count:', error);
    }
}

