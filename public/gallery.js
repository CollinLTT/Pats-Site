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

            // Load first 3 images
            for (let i = 0; i < 3 && i < images.length; i++) {
                const img = document.createElement('img');
                img.className = 'floating-img';
                img.src = images[i];
                sliderTrack.appendChild(img);
            }

            // Slide + fade loop
            setInterval(() => {
                const imgElements = sliderTrack.querySelectorAll('.floating-img');
                const nextImage = images[(currentIndex + 3) % images.length];

                if (imgElements.length) {
                    const firstImg = imgElements[0];
                    firstImg.classList.add('fade-out');

                    // Wait for fade-out before removing
                    setTimeout(() => {
                        firstImg.remove();

                        // Append new image at end
                        const newImg = document.createElement('img');
                        newImg.src = nextImage;
                        newImg.className = 'floating-img fade-in';
                        sliderTrack.appendChild(newImg);

                        // Allow flexbox to reflow, then trigger smooth transform
                        requestAnimationFrame(() => {
                            sliderTrack.style.transition = 'none';
                            sliderTrack.style.transform = 'translateX(0)';

                            // Force layout flush
                            void sliderTrack.offsetWidth;

                            // Animate slide left by one image width + gap
                            sliderTrack.style.transition = 'transform 0.8s ease';
                            sliderTrack.style.transform = 'translateX(-250px)'; // adjust if your images are wider

                            // After animation completes, reset transform
                            setTimeout(() => {
                                sliderTrack.style.transition = 'none';
                                sliderTrack.style.transform = 'translateX(0)';
                            }, 800);
                        });

                        currentIndex = (currentIndex + 1) % images.length;
                    }, 1000); // Match fade-out duration
                }
            }, 4000);
        });
});
