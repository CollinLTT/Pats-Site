document.addEventListener('DOMContentLoaded', () => {
    const sliderTrack = document.getElementById('floatingGallery');
    let images = [];
    let currentIndex = 0;

    fetch('/api/images')
        .then(res => res.json())
        .then(files => {
            if (!files.length) {
                sliderTrack.innerHTML = '<p style="color:white;text-align:center;">No images uploaded yet.</p>';
                return;
            }

            images = files;

            // Helper: create image with float/rotation
            const createFloatingImage = (src) => {
                const img = document.createElement('img');
                img.src = src;
                img.classList.add('floating-img');

                // Apply custom wiggle rotation via CSS variable
                const angles = [-6, -3, 3, 6];
                const angle = angles[Math.floor(Math.random() * angles.length)];
                const delay = Math.floor(Math.random() * 3); // 0s–2s

                img.style.setProperty('--angle', `${angle}deg`);
                img.style.animationDelay = `${delay}s`;

                return img;
            };

            // Show first 3 images
            for (let i = 0; i < 3 && i < images.length; i++) {
                const img = createFloatingImage(images[i]);
                sliderTrack.appendChild(img);
            }

            // Start slideshow
            setInterval(() => {
                const imgElements = sliderTrack.querySelectorAll('.floating-img');
                const nextImage = images[(currentIndex + 3) % images.length];

                if (imgElements.length) {
                    const firstImg = imgElements[0];
                    firstImg.classList.add('fade-out');

                    // Slide remaining images left smoothly
                    for (let i = 1; i < imgElements.length; i++) {
                        imgElements[i].style.transition = 'margin-left 1s ease';
                        imgElements[i].style.marginLeft = '-220px'; // adjust as needed
                    }

                    setTimeout(() => {
                        firstImg.remove();

                        // Reset styles on remaining images
                        const updatedImages = sliderTrack.querySelectorAll('.floating-img');
                        updatedImages.forEach(img => {
                            img.style.transition = '';
                            img.style.marginLeft = '';
                        });

                        // Add new image at the end
                        const newImg = createFloatingImage(nextImage);
                        newImg.classList.add('fade-in');
                        sliderTrack.appendChild(newImg);

                        currentIndex = (currentIndex + 1) % images.length;
                    }, 1000); // match slide duration
                }
            }, 4000); // slide interval
        });
});
