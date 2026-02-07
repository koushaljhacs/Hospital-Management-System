/* HMS - Hospital Management System JavaScript */

/* TYPEWRITER EFFECT FOR HERO TITLE - INFINITE LOOP */
function typewriterEffect() {
    const heroTitle = document.querySelector('.hero-title');
    if (!heroTitle) return;
    
    const text = 'Hospital Management System';
    let isTyping = true;
    
    function startTypeAnimation() {
        // Make text visible during typing
        heroTitle.style.webkitTextFillColor = '#ffffff';
        heroTitle.style.webkitBackgroundClip = 'unset';
        heroTitle.style.backgroundClip = 'unset';
        heroTitle.style.color = '#ffffff';
        heroTitle.style.minWidth = 'fit-content';
        heroTitle.textContent = '';
        
        let index = 0;
        const speed = 80; // milliseconds per character
        let lastTime = performance.now();
        isTyping = true;
        
        function typeCharacter(currentTime) {
            if (currentTime - lastTime >= speed) {
                if (index < text.length) {
                    heroTitle.textContent += text.charAt(index);
                    index++;
                    lastTime = currentTime;
                } else {
                    // Typing complete - restore gradient effect
                    heroTitle.style.transition = 'color 0.5s ease, -webkit-text-fill-color 0.5s ease';
                    heroTitle.style.webkitTextFillColor = 'transparent';
                    heroTitle.style.webkitBackgroundClip = 'text';
                    heroTitle.style.backgroundClip = 'text';
                    heroTitle.style.color = 'transparent';
                    isTyping = false;
                    
                    // After showing gradient for 3 seconds, loop back to typing
                    setTimeout(() => {
                        heroTitle.style.transition = 'none';
                        startTypeAnimation();
                    }, 3000);
                    return;
                }
            }
            if (isTyping) {
                requestAnimationFrame(typeCharacter);
            }
        }
        
        requestAnimationFrame(typeCharacter);
    }
    
    // Start typewriter after initial reveal animation (0.3s delay + slight offset)
    setTimeout(() => {
        startTypeAnimation();
    }, 700);
}

/* HERO INITIALIZATION - SEQUENTIAL ANIMATIONS */
window.addEventListener('load', () => {
    const statPills = document.querySelectorAll('.stat-pill');
    statPills.forEach((pill, index) => {
        pill.style.setProperty('--pill-index', index);
    });
    
    // Initialize role tags with stagger (hidden initially)
    const roleTags = document.querySelectorAll('.role-tag');
    roleTags.forEach((tag, index) => {
        tag.style.setProperty('--tag-index', index);
    });
    
    // Initialize content cards with stagger
    const contentCards = document.querySelectorAll('.content-card');
    contentCards.forEach((card, index) => {
        card.style.setProperty('--card-index', index);
    });
    
    // Start typewriter effect
    typewriterEffect();
});

/* ADVANCED CANVAS ENGINE */
const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const particleCount = 80;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = document.querySelector('.hero').offsetHeight;
}

window.addEventListener('resize', resize);
resize();

class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.radius = Math.random() * 1.5 + 1;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 163, 191, 0.4)'; ctx.fill();
    }
}

for (let i = 0; i < particleCount; i++) particles.push(new Particle());

function animateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p, i) => {
        p.update(); p.draw();
        for (let j = i + 1; j < particles.length; j++) {
            const dx = p.x - particles[j].x; const dy = p.y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                ctx.beginPath(); ctx.strokeStyle = `rgba(0, 82, 204, ${0.15 * (1 - dist / 150)})`;
                ctx.lineWidth = 0.5; ctx.moveTo(p.x, p.y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke();
            }
        }
    });
    requestAnimationFrame(animateCanvas);
}
animateCanvas();

/* ENHANCED 3D TILT ENGINE WITH GLOW EFFECT */
const tiltBox = document.getElementById('hero-tilt-box');
const heroSection = document.querySelector('.hero');
const heroTitle = document.querySelector('.hero-title');

let mouseX = 0;
let mouseY = 0;
let centerX = window.innerWidth / 2;
let centerY = window.innerHeight / 2;

heroSection.addEventListener('mousemove', (e) => {
    mouseX = e.pageX;
    mouseY = e.pageY;
    
    const xAxis = (centerX - mouseX) / 45;
    const yAxis = (centerY - mouseY) / 45;
    
    tiltBox.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
    
    // Dynamic glow based on mouse position
    const glowIntensity = Math.min(0.6, (Math.abs(xAxis) + Math.abs(yAxis)) / 20);
    heroTitle.style.textShadow = `
        0 0 20px rgba(0, 163, 191, ${0.3 + glowIntensity}),
        0 0 40px rgba(0, 82, 204, ${0.2 + glowIntensity}),
        0 0 60px rgba(0, 163, 191, ${0.1 + glowIntensity}),
        0 20px 50px rgba(0, 0, 0, 0.6)
    `;
});

heroSection.addEventListener('mouseleave', () => {
    tiltBox.style.transform = `rotateY(0deg) rotateX(0deg)`;
    heroTitle.style.textShadow = '0 0 10px rgba(0, 163, 191, 0), 0 0 20px rgba(0, 82, 204, 0), 0 20px 50px rgba(0, 0, 0, 0.6)';
});

/* FLOATING ANIMATION FOR STAT PILLS ON SCROLL - GPU ACCELERATED SMOOTH */
let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const statPills = document.querySelectorAll('.stat-pill');
            const scrollPos = window.scrollY;
            const heroSection = document.querySelector('.hero');
            const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
            
            statPills.forEach((pill, index) => {
                // Only apply subtle float effect when hero section is in view
                if (scrollPos < heroBottom) {
                    const floatOffset = Math.sin((scrollPos * 0.003) + (index * 0.5)) * 6; // Reduced float amplitude
                    pill.style.transform = `translateZ(50px) translateY(${floatOffset}px)`;
                } else {
                    pill.style.transform = `translateZ(0) translateY(0)`; // Reset after hero
                }
            });
            ticking = false;
        });
        ticking = true;
    }
});

/* BI-DIRECTIONAL SCROLL OBSERVER */
const observerOptions = { threshold: 0.15 };
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('reveal');
        } else {
            entry.target.classList.remove('reveal');
        }
    });
}, observerOptions);

document.querySelectorAll('section').forEach(section => revealObserver.observe(section));

/* ROLE TAG SCROLL ANIMATION - Reveal one by one */
const roleTagObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.role-tag').forEach(tag => {
    roleTagObserver.observe(tag);
});

/* CONTENT CARD AND IMAGE SCROLL ANIMATION */
const contentObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.content-card, .content-integrated-img, .full-image, .section-title').forEach(el => {
    contentObserver.observe(el);
});

/* SCROLLSPY - GPU ACCELERATED */
let scrollTicking = false;
window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        requestAnimationFrame(() => {
            let current = '';
            document.querySelectorAll('section, header').forEach(section => {
                if (window.pageYOffset >= section.offsetTop - 120) current = section.getAttribute('id');
            });
            document.querySelectorAll('.nav-link').forEach(link => {
                const isActive = link.getAttribute('href').substring(1).split('-')[0] === current.split('-')[0];
                if (isActive && !link.classList.contains('active')) {
                    link.classList.add('active');
                } else if (!isActive && link.classList.contains('active')) {
                    link.classList.remove('active');
                }
            });
            scrollTicking = false;
        });
        scrollTicking = true;
    }
});

