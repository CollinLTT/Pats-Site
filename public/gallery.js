document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('slider');
    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');

    let currentIndex = 0;
    let images = [];
    let autoSlideInterval;

    fetch('/api/images')
        .then(res => res.json())
        .then(files => {
            if (!files.length) {
                slider.innerHTML = '<p style="color:white;text-align:center;">No images uploaded yet.</p>';
                return;
            }

            images = files;

            // Create slide elements
            files.forEach(url => {
                const slide = document.createElement('div');
                slide.classList.add('slide');

                const img = document.createElement('img');
                img.src = url; // Use Cloudinary URL directly
                img.alt = 'Gallery image';

                slide.appendChild(img);
                slider.appendChild(slide);
            });

            // Wait for all images to load before starting auto-slide
            const allImages = slider.querySelectorAll('img');
            let loadedCount = 0;
            allImages.forEach(img => {
                img.onload = () => {
                    loadedCount++;
                    if (loadedCount === allImages.length) {
                        startAutoSlide();
                    }
                };
            });
        })
        .catch(err => console.error('Error loading images:', err));

    function showSlide(index) {
        if (!images.length) return;
        currentIndex = (index + images.length) % images.length;
        slider.style.transform = `translateX(-${currentIndex * 100}%)`;
    }

    prevBtn.addEventListener('click', () => {
        showSlide(currentIndex - 1);
        restartAutoSlide();
    });
    nextBtn.addEventListener('click', () => {
        showSlide(currentIndex + 1);
        restartAutoSlide();
    });

    function startAutoSlide() {
        autoSlideInterval = setInterval(() => {
            showSlide(currentIndex + 1);
        }, 4000);
    }

    function restartAutoSlide() {
        clearInterval(autoSlideInterval);
        startAutoSlide();
    }
});
