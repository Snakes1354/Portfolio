(() => {
  const canvas = document.querySelector('.sakura-canvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // [tip, base] colour pairs. Light mode uses deeper pinks so petals stay visible.
  const palettes = {
    dark: [
      ['#ffe4ec', '#ff9fb8'],
      ['#ffd3df', '#f28bad'],
      ['#fff0f4', '#ffb7c5'],
    ],
    light: [
      ['#ffc6d4', '#ec6f9b'],
      ['#ffd5e0', '#f285a8'],
      ['#ffb7c5', '#d9608c'],
    ],
  };

  const HOLD_LIMIT = 12;
  const FLICK_SPEED = 4000;
  const MAX_THROW = 1400;
  const MAX_EXTRA = 80;

  // A single sakura petal drawn in unit space: narrow base at the bottom,
  // widest near the top, with the little notch at the tip.
  const petalPath = new Path2D();
  petalPath.moveTo(0, 0.5);
  petalPath.bezierCurveTo(-0.28, 0.36, -0.5, 0, -0.42, -0.32);
  petalPath.quadraticCurveTo(-0.34, -0.5, -0.14, -0.5);
  petalPath.quadraticCurveTo(-0.05, -0.48, 0, -0.38);
  petalPath.quadraticCurveTo(0.05, -0.48, 0.14, -0.5);
  petalPath.quadraticCurveTo(0.34, -0.5, 0.42, -0.32);
  petalPath.bezierCurveTo(0.5, 0, 0.28, 0.36, 0, 0.5);
  petalPath.closePath();

  const pointer = { active: false, x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0 };
  let petals = [];
  let gradients = [];
  let width = 0;
  let height = 0;
  let targetCount = 0;
  let time = 0;
  let lastTime = 0;
  let frameId = 0;

  const random = (min, max) => min + Math.random() * (max - min);

  const buildGradients = () => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

    gradients = palettes[theme].map(([tip, base]) => {
      const gradient = ctx.createLinearGradient(0, -0.5, 0, 0.5);
      gradient.addColorStop(0, tip);
      gradient.addColorStop(1, base);
      return gradient;
    });
  };

  const createPetal = (spawnAbove, depth = random(0.55, 1.15)) => {
    const fall = random(30, 55) * depth;
    const spin = random(-1.2, 1.2);

    return {
      x: random(-40, width + 40),
      y: spawnAbove ? random(-80, -20) : random(-20, height),
      vx: 0,
      vy: fall,
      size: random(12, 18) * depth,
      fall,
      depth,
      swayAmp: random(18, 42) * depth,
      swaySpeed: random(0.8, 1.6),
      swayPhase: random(0, Math.PI * 2),
      rotation: random(0, Math.PI * 2),
      spin,
      baseSpin: spin,
      flip: random(0, Math.PI * 2),
      flipSpeed: random(1.5, 3.2),
      alpha: Math.min(0.9, 0.4 + depth * 0.45),
      color: Math.floor(Math.random() * 3),
      held: false,
      holdTime: 0,
      offsetX: 0,
      offsetY: 0,
      cooldown: 0,
      bloom: 1,
    };
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    // Any surplus (from clicks or a smaller window) drains away as petals fall off screen.
    targetCount = Math.round(Math.min(55, Math.max(14, (width * height) / 30000)));
    while (petals.length < targetCount) petals.push(createPetal(false));
  };

  // Let go of a petal, throwing it in whatever direction the mouse was moving.
  const release = (petal) => {
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const scale = speed > MAX_THROW ? MAX_THROW / speed : 1;

    petal.held = false;
    petal.vx = pointer.vx * scale;
    petal.vy = pointer.vy * scale;
    petal.spin = petal.baseSpin + (pointer.vx * scale) / 150;
    petal.cooldown = 1.2;
  };

  const trackPointer = (dt) => {
    if (!pointer.active) return;

    const smoothing = 1 - Math.exp(-dt * 22);
    pointer.vx += ((pointer.x - pointer.lastX) / dt - pointer.vx) * smoothing;
    pointer.vy += ((pointer.y - pointer.lastY) / dt - pointer.vy) * smoothing;
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  };

  const update = (dt) => {
    time += dt;

    const wind = 14 + Math.sin(time * 0.15) * 12;
    const ease = 1 - Math.exp(-dt * 1.6);
    const follow = 1 - Math.exp(-dt * 18);
    const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);
    let heldCount = petals.filter((petal) => petal.held).length;
    let removed = 0;

    petals.forEach((petal) => {
      petal.cooldown = Math.max(0, petal.cooldown - dt);
      petal.bloom = Math.min(1, petal.bloom + dt * 4);
      petal.swayPhase += petal.swaySpeed * dt;
      petal.flip += petal.flipSpeed * dt;

      if (petal.held) {
        petal.holdTime -= dt;

        if (pointer.active && petal.holdTime > 0 && pointerSpeed < FLICK_SPEED) {
          // Ride along with the mouse, trailing slightly behind it.
          petal.x += (pointer.x + petal.offsetX - petal.x) * follow;
          petal.y += (pointer.y + petal.offsetY - petal.y) * follow;
          petal.rotation += (petal.spin * 0.4 + pointer.vx * 0.002) * dt;
          return;
        }

        release(petal);
        heldCount -= 1;
      }

      // Drift back towards a gentle, swaying fall.
      const targetVx = wind * petal.depth + Math.sin(petal.swayPhase) * petal.swayAmp;
      const targetVy = petal.fall * (1 + Math.cos(petal.swayPhase * 2) * 0.25);
      petal.vx += (targetVx - petal.vx) * ease;
      petal.vy += (targetVy - petal.vy) * ease;
      petal.spin += (petal.baseSpin - petal.spin) * ease;
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.rotation += petal.spin * dt;

      if (pointer.active && petal.cooldown === 0 && heldCount < HOLD_LIMIT) {
        const dx = petal.x - pointer.x;
        const dy = petal.y - pointer.y;
        const reach = 12 + petal.size * 0.6;

        if (dx * dx + dy * dy < reach * reach) {
          petal.held = true;
          petal.holdTime = random(2.5, 5);
          petal.offsetX = dx * 0.8;
          petal.offsetY = dy * 0.8;
          heldCount += 1;
        }
      }

      if (petal.y > height + 40 || petal.y < -height) {
        if (petals.length - removed > targetCount) {
          petal.removed = true;
          removed += 1;
        } else {
          Object.assign(petal, createPetal(true));
        }
      } else if (petal.x > width + 50) {
        petal.x = -50;
      } else if (petal.x < -50) {
        petal.x = width + 50;
      }
    });

    if (removed > 0) petals = petals.filter((petal) => !petal.removed);
  };

  const render = () => {
    ctx.clearRect(0, 0, width, height);

    petals.forEach((petal) => {
      // Squash one axis as the petal tumbles so it looks like it is turning over.
      const turn = Math.max(0.12, Math.abs(Math.cos(petal.flip)));
      const size = petal.size * (1 - (1 - petal.bloom) ** 3);

      ctx.save();
      ctx.translate(petal.x, petal.y);
      ctx.rotate(petal.rotation);
      ctx.scale(size * turn, size);
      ctx.globalAlpha = petal.alpha;
      ctx.fillStyle = gradients[petal.color];
      ctx.fill(petalPath);
      ctx.restore();
    });
  };

  const tick = (now) => {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (dt > 0) {
      trackPointer(dt);
      update(dt);
    }

    render();
    frameId = requestAnimationFrame(tick);
  };

  const start = () => {
    cancelAnimationFrame(frameId);

    // Keep the petals but hold them still for people who prefer less motion.
    if (reducedMotion.matches) {
      render();
      return;
    }

    lastTime = performance.now();
    frameId = requestAnimationFrame(tick);
  };

  const movePointer = (event) => {
    if (!pointer.active) {
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.vx = 0;
      pointer.vy = 0;
    }

    pointer.active = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };

  const leavePointer = () => {
    pointer.active = false;
  };

  // Pop a new petal out wherever the page is clicked.
  const spawnPetal = (event) => {
    // Keyboard "clicks" have no real position, so skip them.
    if (event.detail === 0 || reducedMotion.matches) return;
    if (petals.length >= targetCount + MAX_EXTRA) return;

    const petal = createPetal(false, random(0.95, 1.15));
    petal.x = event.clientX;
    petal.y = event.clientY;
    petal.vx = random(-80, 80);
    petal.vy = random(-110, -50);
    petal.bloom = 0;
    petal.cooldown = 0.8;
    petals.push(petal);
  };

  window.addEventListener('pointermove', movePointer, { passive: true });
  window.addEventListener('pointerdown', movePointer, { passive: true });
  window.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'mouse') leavePointer();
  });
  window.addEventListener('pointercancel', leavePointer);
  window.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) leavePointer();
  });
  window.addEventListener('blur', leavePointer);
  window.addEventListener('click', spawnPetal);

  window.addEventListener('resize', () => {
    resize();
    if (reducedMotion.matches) render();
  });

  new MutationObserver(() => {
    buildGradients();
    if (reducedMotion.matches) render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  reducedMotion.addEventListener('change', start);

  buildGradients();
  resize();
  start();
})();
