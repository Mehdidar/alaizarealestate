document.addEventListener('DOMContentLoaded', () => {
    const ham = document.getElementById('hamburger');
    const menu = document.getElementById('nav-links');
    const body = document.body;

    ham.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('active');
        ham.classList.toggle('toggle');
        body.style.overflow = isOpen ? 'hidden' : 'initial';
    });

    const links = document.querySelectorAll('.nav-link, .login-btn');
    links.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            ham.classList.remove('toggle');
            body.style.overflow = 'initial';
        });
    });
});

// --- Lenis Smooth Scroll ---
const scrollScript = document.createElement('script');
scrollScript.src = "https://cdn.jsdelivr.net/gh/studio-freight/lenis@1.0.19/bundled/lenis.min.js";
scrollScript.onload = () => {
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        smoothTouch: false,
    });

    // Parallax logic synced with scroll
    lenis.on('scroll', () => {
        const viewportHeight = window.innerHeight;
        document.querySelectorAll('.parallax-wrap').forEach(wrap => {
            const rect = wrap.getBoundingClientRect();
            if (rect.top < viewportHeight && rect.bottom > 0) {
                const inner = wrap.querySelector('.parallax-inner');
                if (inner) {
                    const speed = wrap.dataset.speed || 0.15;
                    const yPos = (rect.top * speed);
                    inner.style.transform = `translate3d(0, ${yPos}px, 0)`;
                }
            }
        });
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
};
document.head.appendChild(scrollScript);

// --- Dynamic Stats Counter ---
function countUp(element) {
    const target = +element.getAttribute('data-target');
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.innerText = target;
            clearInterval(timer);
        } else {
            element.innerText = Math.floor(current);
        }
    }, 16);
}

const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const counters = entry.target.querySelectorAll('.counter');
            counters.forEach(c => countUp(c));
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const statsSection = document.querySelector('.stats-grid');
if (statsSection) statsObserver.observe(statsSection);

// --- Operational Dashboard Logic ---
function updateUptime() {
    const uptimeElement = document.getElementById('uptime-counter');
    if (!uptimeElement) return;
    
    let seconds = 0;
    setInterval(() => {
        seconds++;
        const d = Math.floor(seconds / (3600*24));
        const h = Math.floor(seconds % (3600*24) / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = Math.floor(seconds % 60);
        uptimeElement.innerText = `${d}d ${h}h ${m}m ${s}s`;
    }, 1000);
}

document.addEventListener('DOMContentLoaded', updateUptime);
