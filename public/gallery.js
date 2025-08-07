document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('floatingGallery');
    let images = [];
    let currentIndex = 0;

    fetch('/api/images')
        .then(res => res.json())
        .then(files => {
            if (!files.length) {
                gallery.innerHTML = '<p style="color:white;text-align:center;">No images uploaded yet.</p>';
                return;
            }

            images = files;

            for (let i = 0; i < 3 && i < images.length; i++) {
                const img = document.createElement('img');
                img.className = 'floating-img';
                img.src = images[i];
                gallery.appendChild(img);
            }

            setInterval(() => {
                const imgElements = gallery.querySelectorAll('.floating-img');
                const nextImage = images[(currentIndex + 3) % images.length];

                if (imgElements.length) {
                    const fadeOutImg = imgElements[0];
                    fadeOutImg.classList.add('fade-out');
                    setTimeout(() => {
                        fadeOutImg.remove();

                        const newImg = document.createElement('img');
                        newImg.src = nextImage;
                        newImg.className = 'floating-img fade-in';
                        gallery.appendChild(newImg);

                        currentIndex = (currentIndex + 1) % images.length;
                    }, 1000);
                }
            }, 4000);
        });
});
