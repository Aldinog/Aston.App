/**
 * GALAXY THEME - Interactive Logic
 * Handles starry background, parallax nebula, and cosmic animations.
 */

function startGalaxyTheme() {
    console.log('[THEME] Universe expanding... Galaxy mode active.');

    // 1. Create Starry Background
    createStarfield();

    // 2. Add Parallax Effect (Recommendation 5)
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleGalaxyParallax);
    }

    // 3. Sync Market State for Adaptive Glow (Recommendation 3)
    syncMarketState();
}

function stopGalaxyTheme() {
    console.log('[THEME] Returning to Earth.');
    const field = document.getElementById('galaxy-starfield');
    if (field) field.remove();

    window.removeEventListener('deviceorientation', handleGalaxyParallax);
    document.body.classList.remove('market-open', 'market-closed', 'maintenance-active');
}

/**
 * Creates a canvas starfield for high-performance background effect
 */
function createStarfield() {
    if (document.getElementById('galaxy-starfield')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'galaxy-starfield';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = '-2';
    canvas.style.pointerEvents = 'none';
    canvas.style.background = 'transparent';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const stars = [];
    const starCount = 150;

    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.5,
            opacity: Math.random(),
            twinkle: Math.random() * 0.02
        });
    }

    function animate() {
        if (!document.getElementById('galaxy-starfield')) return; // Stop if theme changed

        ctx.clearRect(0, 0, width, height);

        stars.forEach(star => {
            star.opacity += star.twinkle;
            if (star.opacity > 1 || star.opacity < 0.2) star.twinkle = -star.twinkle;

            ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    animate();
}

/**
 * Handles Parallax effect based on device tilt
 */
function handleGalaxyParallax(event) {
    const { beta, gamma } = event; // beta (-180, 180), gamma (-90, 90)
    if (!beta || !gamma) return;

    // Limit the movement
    const xMovement = (gamma / 20).toFixed(2);
    const yMovement = ((beta - 45) / 20).toFixed(2); // Offset beta assuming usual holding angle

    const glow = document.querySelector('.theme-galaxy .ambient-glow::before');
    if (glow) {
        glow.style.transform = `translate(${xMovement}%, ${yMovement}%) scale(1.1)`;
    }
}

/**
 * Basic sync to check if market is open and apply CSS classes
 */
function syncMarketState() {
    const now = new Date();
    const jakartaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: 'numeric',
        hour12: false,
        day: 'numeric'
    }).formatToParts(now);

    const hour = parseInt(jakartaTime.find(p => p.type === 'hour').value);
    const day = now.getDay(); // 0-6 (Sun-Sat)

    // Rough check: Mon-Fri, 9-16
    const isTrading = day > 0 && day < 6 && hour >= 9 && hour < 16;

    // Check maintenance (we can try to read from meta or global window if available)
    const isMaintenance = document.body.classList.contains('maintenance-active');

    if (isMaintenance) {
        document.body.classList.add('maintenance-active');
    } else if (isTrading) {
        document.body.classList.add('market-open');
    } else {
        document.body.classList.add('market-closed');
    }
}

// Global Exports
window.startGalaxyTheme = startGalaxyTheme;
window.stopGalaxyTheme = stopGalaxyTheme;
