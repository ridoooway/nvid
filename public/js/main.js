document.addEventListener('DOMContentLoaded', () => {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Paste button functionality
    const pasteBtn = document.querySelector('.paste-btn');
    const urlInput = document.querySelector('input[name="url"]');
    
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            urlInput.value = text;
        } catch (err) {
            console.error('Failed to read clipboard contents: ', err);
        }
    });

    // Scroll to top button
    const scrollTop = document.createElement('button');
    scrollTop.classList.add('scroll-top');
    scrollTop.innerHTML = '↑';
    document.body.appendChild(scrollTop);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            scrollTop.classList.add('visible');
        } else {
            scrollTop.classList.remove('visible');
        }
    });

    scrollTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Toast message function
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.classList.add('toast', type);
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}); 