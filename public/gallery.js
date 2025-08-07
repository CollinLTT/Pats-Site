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

            // Show first 3 images
            for (let i = 0; i < 3 && i < images.length; i++) {
                const img = document.createElement('img');
                img.className = 'floating-img';
                img.src = images[i];
                sliderTrack.appendChild(img);
            }

            setInterval(() => {
                const imgElements = sliderTrack.querySelectorAll('.floating-img');
                const nextImage = images[(currentIndex + 3) % images.length];

                if (imgElements.length) {
                    const firstImg = imgElements[0];
                    firstImg.classList.add('fade-out');

                    // Slide remaining images left
                    for (let i = 1; i < imgElements.length; i++) {
                        imgElements[i].classList.add('slide-left');
                    }

                    setTimeout(() => {
                        firstImg.remove();

                        // Remove slide-left class after they shift
                        const updatedImages = sliderTrack.querySelectorAll('.floating-img');
                        updatedImages.forEach(img => img.classList.remove('slide-left'));

                        // Add new image at the end
                        const newImg = document.createElement('img');
                        newImg.src = nextImage;
                        newImg.className = 'floating-img fade-in';
                        sliderTrack.appendChild(newImg);

                        currentIndex = (currentIndex + 1) % images.length;
                    }, 1000); // matches fade-out & slide duration
                }
            }, 4000);
        });
});
