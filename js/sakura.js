(() => {
  const canvas = document.querySelector('.sakura-canvas');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // [base, body, rim] colours sampled from real petals: deepest where the petal was
  // attached, palest at the outer edge. Light mode leans deeper so petals stay visible.
  const palettes = {
    dark: [
      ['#cf2e56', '#e3597f', '#f290aa'],
      ['#d63c63', '#ea6a8e', '#f5a0b8'],
      ['#dd4a70', '#f17d9f', '#f6b4c6'],
      ['#e3597f', '#f496b0', '#f9c8d8'],
    ],
    light: [
      ['#b81f49', '#d33a62', '#ec7096'],
      ['#c92e57', '#de4c74', '#f38aa8'],
      ['#d43d65', '#ea6f92', '#f7b0c3'],
      ['#de4a71', '#f39bb4', '#f9cfdb'],
    ],
  };

  // Mostly mid pinks, with fewer very deep or very pale petals, like a real fall.
  const tintWeights = [0.24, 0.34, 0.28, 0.14];

  // A tight contact shadow baked under each petal: crisps its edge on the pale page,
  // and on the dark page separates petals that overlap.
  const shadows = { dark: 'rgba(10, 2, 14, 0.4)', light: 'rgba(90, 20, 50, 0.2)' };

  // Silhouette recipes, as [min, max]. width is the half-width, flare widens the rim
  // end, notch dips the rim's centre, claw is the stalk at the base, bend curls the
  // petal sideways, ruffle makes the edge wavy, curl rolls one edge over and point
  // narrows the rim end.
  const plain = { notch: [0, 0], bend: [0, 0.05], curl: [0, 0], point: 0 };
  const kinds = {
    oval: { width: [0.33, 0.4], flare: [0.12, 0.25], claw: [0.04, 0.07], ruffle: [0.015, 0.035] },
    cup: { width: [0.34, 0.4], flare: [0.15, 0.28], claw: [0.04, 0.07], ruffle: [0.015, 0.03], curl: [0.2, 0.32] },
    fold: {
      width: [0.3, 0.36], flare: [0.1, 0.25], claw: [0.06, 0.09], bend: [0.04, 0.1],
      ruffle: [0.01, 0.025], curl: [0.42, 0.52], point: 0.2,
    },
    fan: { width: [0.4, 0.46], flare: [0.3, 0.4], notch: [0.05, 0.09], claw: [0.03, 0.04], ruffle: [0.025, 0.04] },
    crescent: {
      width: [0.17, 0.22], flare: [0, 0.1], claw: [0.05, 0.08], bend: [0.12, 0.2],
      ruffle: [0.005, 0.015], curl: [0.38, 0.5], point: 0.45,
    },
    tear: {
      width: [0.27, 0.33], flare: [0.35, 0.45], claw: [0.1, 0.14], bend: [0.02, 0.08],
      ruffle: [0.01, 0.02], curl: [0, 0.15],
    },
  };
  // How many of each silhouette to make: mostly plain and cupped petals, as in a real fall.
  const shapeMix = { oval: 4, cup: 4, fold: 2, fan: 2, crescent: 2, tear: 2 };

  const HOLD_LIMIT = 12;
  const MAX_EXTRA = 80;
  const MIN_SIZE = 10;
  const MAX_SIZE = 26;
  // Room left around each petal's sprite for its shadow, in petal lengths. The petal
  // itself is drawn a touch smaller so petal and shadow together stay within petal.size.
  const MARGIN = 0.04;
  const FIT = 1 / 1.03;
  // Nearly edge-on, a sprite squashed this thin breaks into pieces, so draw the outline instead.
  const EDGE_ON = 0.3;
  const ATLAS_WIDTH = 1024;
  // Wide enough that neighbouring sprites never bleed into each other in the half-size copy.
  const GUTTER = 4;

  // Visitors whose device asks for reduced motion still get moving petals,
  // just slower, fewer and without the fast flick-throws.
  const FULL_MOTION = { pace: 1, density: 1, flickSpeed: 4000, maxThrow: 1400 };
  const CALM_MOTION = { pace: 0.6, density: 0.6, flickSpeed: Infinity, maxThrow: 350 };

  const pointer = { active: false, x: 0, y: 0, lastX: 0, lastY: 0, vx: 0, vy: 0 };
  let motion = reducedMotion.matches ? CALM_MOTION : FULL_MOTION;
  let petals = [];
  // Painted sprite sets, kept per theme so switching back and forth is instant.
  let spriteSets = {};
  let spriteSet = null;
  let spriteRatio = 0;
  let ratio = 1;
  let width = 0;
  let height = 0;
  let targetCount = 0;
  let time = 0;
  let lastTime = 0;

  const random = (min, max) => min + Math.random() * (max - min);
  const pick = ([min, max]) => random(min, max);

  const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (from, to, amount) => {
    const end = toRgb(to);
    return `#${toRgb(from)
      .map((value, i) => Math.round(value + (end[i] - value) * amount).toString(16).padStart(2, '0'))
      .join('')}`;
  };
  const rgba = (hex, alpha) => `rgba(${toRgb(hex).join(', ')}, ${alpha})`;

  // The back of a petal is paler than its front.
  const faceTint = ([base, body, rim], back) => (back
    ? [mix(base, rim, 0.35), mix(body, rim, 0.3), mix(rim, '#ffffff', 0.15)]
    : [base, body, rim]);

  // Trace a petal outline in unit space: base (stalk) at the bottom, rim at the top,
  // exactly one unit tall so petal.size sets its length.
  const makeShape = (kind) => {
    const recipe = { ...plain, ...kinds[kind] };
    const half = pick(recipe.width);
    const flare = pick(recipe.flare);
    const notch = pick(recipe.notch);
    const claw = pick(recipe.claw);
    const bend = pick(recipe.bend) * (Math.random() < 0.5 ? -1 : 1);
    const ruffle = pick(recipe.ruffle);
    const waves = [2, 3, 5, 7].map((freq) => [freq, random(0, Math.PI * 2), ruffle * random(0.4, 1)]);
    const points = [];

    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      const fromRim = Math.min(angle, Math.PI * 2 - angle);
      const atBase = Math.exp(-(((angle - Math.PI) / 0.3) ** 2));
      // Keep the stalk clean; only the free edge ruffles.
      const ripple = waves.reduce((sum, [freq, phase, amp]) => sum + amp * Math.sin(freq * angle + phase), 0);
      const wave = 1 + ripple * (1 - atBase);
      const taper = (1 - 0.8 * atBase) * (1 - recipe.point * Math.exp(-((fromRim / 0.7) ** 2)));
      const x = Math.sin(angle) * half * (1 + flare * Math.cos(angle)) * taper * wave;
      const y = (-Math.cos(angle) * 0.5 + notch * Math.exp(-((fromRim / 0.14) ** 2))) * wave + claw * atBase;
      points.push([x + bend * (1 - 4 * y * y), y]);
    }

    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    const minY = Math.min(...ys);
    const scale = 1 / (Math.max(...ys) - minY);
    const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
    // Never wider than long, so the tumble squash can't change the petal's length.
    const squeeze = Math.min(1, 0.95 / ((Math.max(...xs) - Math.min(...xs)) * scale));
    const outline = points.map(([x, y]) => [(x - midX) * scale * squeeze, (y - minY) * scale - 0.5]);
    const curl = pick(recipe.curl);
    const spine = (outline[24][0] + outline[72][0]) / 2;
    const veinCount = Math.round(random(7, 11));

    return {
      outline,
      spine,
      left: Math.min(...outline.map(([x]) => x)),
      right: Math.max(...outline.map(([x]) => x)),
      tilt: random(-0.12, 0.12),
      sheen: [random(-0.14, 0.14), random(-0.24, -0.02)],
      curl,
      curlSide: Math.random() < 0.5 ? -1 : 1,
      veins: Array.from({ length: veinCount }, (_, i) => [(i / (veinCount - 1) - 0.5) * 1.6, random(-0.04, 0.04)]),
      veinAlpha: kind === 'fan' ? 0.3 : random(0.12, 0.22),
    };
  };

  const shapes = Object.entries(shapeMix).flatMap(([kind, count]) =>
    Array.from({ length: count }, () => makeShape(kind)),
  );

  // Outline as a Path2D. squeeze pulls it towards the far side, leaving a crescent
  // along the curled edge for the rolled-over lip.
  const tracePath = (shape, squeeze = 0) => {
    const far = shape.curlSide > 0 ? shape.left : shape.right;
    const path = new Path2D();
    shape.outline.forEach(([x, y], i) => {
      const px = far + (x - far) * (1 - squeeze);
      if (i === 0) path.moveTo(px, y);
      else path.lineTo(px, y);
    });
    path.closePath();
    return path;
  };

  shapes.forEach((shape) => {
    shape.path = tracePath(shape);
  });

  // Paint one face of a petal in unit space. The back is paler and its rolled lip
  // shows the deeper front, the way a real petal looks when it turns over.
  const paintPetal = (g, shape, tint, back) => {
    const outline = shape.path;
    const lipFold = shape.curl > 0 && tracePath(shape, shape.curl);
    const [sheenX, sheenY] = shape.sheen;
    const halfWidth = (shape.right - shape.left) / 2;
    const deep = mix(tint[0], '#6e0b2a', 0.35);
    const glint = mix(tint[2], '#ffffff', 0.5);
    const [base, body, rim] = faceTint(tint, back);

    // Deep at the stalk, easing out to the pale rim.
    const fill = g.createLinearGradient(shape.tilt, 0.5, -shape.tilt, -0.5);
    fill.addColorStop(0, base);
    fill.addColorStop(0.22, mix(base, body, 0.6));
    fill.addColorStop(0.55, body);
    fill.addColorStop(0.85, mix(body, rim, 0.45));
    fill.addColorStop(1, mix(body, rim, 0.8));
    g.fillStyle = fill;
    g.fillRect(-1, -1, 2, 2);

    // The petal is cupped: shaded across to the side facing away from the light...
    const shade = g.createLinearGradient(sheenX, 0, sheenX < 0 ? shape.right : shape.left, 0);
    shade.addColorStop(0, rgba(base, 0));
    shade.addColorStop(0.55, rgba(base, 0.08));
    shade.addColorStop(1, rgba(base, back ? 0.25 : 0.42));
    g.fillStyle = shade;
    g.fillRect(-1, -1, 2, 2);

    // ...with a broad, soft sheen where it faces it.
    const sheen = g.createRadialGradient(sheenX, sheenY, 0, sheenX, sheenY, 0.42);
    sheen.addColorStop(0, rgba(glint, back ? 0.2 : 0.36));
    sheen.addColorStop(0.5, rgba(glint, back ? 0.08 : 0.14));
    sheen.addColorStop(1, rgba(glint, 0));
    g.fillStyle = sheen;
    g.fillRect(-1, -1, 2, 2);

    // Where it tore from the flower the petal is darkest.
    const heart = g.createRadialGradient(shape.spine * 0.5, 0.5, 0, shape.spine * 0.5, 0.5, 0.38);
    heart.addColorStop(0, rgba(deep, 0.95));
    heart.addColorStop(0.3, rgba(base, 0.65));
    heart.addColorStop(1, rgba(base, 0));
    g.fillStyle = heart;
    g.fillRect(-1, -1, 2, 2);

    // Fine veins fanning out from the base, fading well before the rim.
    const veinFade = g.createLinearGradient(0, 0.45, 0, -0.45);
    veinFade.addColorStop(0, rgba(base, shape.veinAlpha * (back ? 1.3 : 1)));
    veinFade.addColorStop(0.85, rgba(base, 0));
    g.strokeStyle = veinFade;
    g.lineWidth = 0.006;
    g.beginPath();
    shape.veins.forEach(([spread, bow]) => {
      const reach = spread * halfWidth;
      g.moveTo(shape.spine * 0.4, 0.4);
      g.quadraticCurveTo(shape.spine + reach * 0.5 + bow, 0, shape.spine * 0.3 + reach * 0.85, -0.47);
    });
    g.stroke();

    // A soft crease from the base: a shadowed groove with a catch-light beside it.
    g.strokeStyle = rgba(base, 0.1);
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(shape.spine * 0.4, 0.44);
    g.quadraticCurveTo(shape.spine, 0.1, shape.spine * 0.8, -0.15);
    g.stroke();
    g.strokeStyle = rgba(glint, back ? 0.06 : 0.1);
    g.lineWidth = 0.045;
    g.beginPath();
    g.moveTo(shape.spine * 0.4 + 0.03, 0.42);
    g.quadraticCurveTo(shape.spine + 0.035, 0.1, shape.spine * 0.8 + 0.03, -0.13);
    g.stroke();

    if (lipFold) {
      const edgeX = shape.curlSide > 0 ? shape.right : shape.left;
      const foldX = edgeX - shape.curlSide * (shape.right - shape.left) * shape.curl;

      // Shadow cast on the petal just inside the fold.
      const cast = g.createLinearGradient(foldX - shape.curlSide * 0.25, 0, edgeX, 0);
      cast.addColorStop(0, rgba(base, 0));
      cast.addColorStop(0.7, rgba(deep, 0.5));
      g.save();
      g.clip(lipFold);
      g.strokeStyle = cast;
      [0.2, 0.09].forEach((lineWidth) => {
        g.lineWidth = lineWidth;
        g.stroke(lipFold);
      });
      g.restore();

      // The rolled-over lip shows the other face, lit along the fold.
      const lip = new Path2D();
      lip.addPath(outline);
      lip.addPath(lipFold);
      const lipFill = g.createLinearGradient(foldX, 0, edgeX, 0);
      lipFill.addColorStop(0, back ? body : mix(body, rim, 0.7));
      lipFill.addColorStop(1, back ? base : mix(body, rim, 0.25));
      g.save();
      g.clip(lip, 'evenodd');
      g.fillStyle = lipFill;
      g.fillRect(-1, -1, 2, 2);
      g.strokeStyle = rgba(glint, back ? 0.25 : 0.4);
      g.lineWidth = 0.03;
      g.stroke(lipFold);
      g.restore();
    }

    // The outer rim is thinner: a little lighter and a little see-through.
    const rimLight = g.createLinearGradient(0, 0.1, 0, -0.5);
    rimLight.addColorStop(0, rgba(rim, 0));
    rimLight.addColorStop(1, rgba(rim, 0.45));
    g.strokeStyle = rimLight;
    g.lineWidth = 0.05;
    g.stroke(outline);

    // Cut everything to the silhouette in one go; cheaper than clipping each layer.
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000';
    g.fill(outline);
    const rimClear = g.createLinearGradient(0, 0.2, 0, -0.5);
    rimClear.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rimClear.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    g.globalCompositeOperation = 'destination-out';
    g.strokeStyle = rimClear;
    g.lineWidth = 0.04;
    g.stroke(outline);
  };

  const paint = document.createElement('canvas');

  // Every shape, tint and face is painted up front into one atlas at the screen's pixel
  // density, so a frame is only cheap image draws from one source.
  const buildSprites = (theme) => {
    const tints = palettes[theme];
    const scale = MAX_SIZE * ratio;
    const g = paint.getContext('2d');
    let cursorX = 0;
    let cursorY = 0;
    let rowHeight = 0;

    // Lay the sprites out in rows, each cropped to its petal plus room for the shadow.
    const sprites = shapes.flatMap((shape) => tints.flatMap((tint) => [0, 1].map((back) => {
      const sw = Math.ceil(((shape.right - shape.left) * FIT + MARGIN * 2) * scale);
      const sh = Math.ceil((FIT + MARGIN * 2) * scale);
      if (cursorX + sw > ATLAS_WIDTH) {
        cursorX = 0;
        cursorY += rowHeight + GUTTER;
        rowHeight = 0;
      }
      const sprite = {
        shape, tint, back,
        x: (back ? -shape.right : shape.left) * FIT - MARGIN,
        y: -0.5 * FIT - MARGIN,
        w: sw / scale,
        h: sh / scale,
        sx: cursorX,
        sy: cursorY,
        sw,
        sh,
      };
      cursorX += sw + GUTTER;
      rowHeight = Math.max(rowHeight, sh);
      return sprite;
    })));

    // Resizing also clears it and resets its state.
    paint.width = ATLAS_WIDTH;
    paint.height = cursorY + rowHeight;
    sprites.forEach(({ shape, tint, back, x, y, sx, sy, sw, sh }) => {
      g.save();
      g.beginPath();
      g.rect(sx, sy, sw, sh);
      g.clip();
      // The back is seen mirrored, as if the petal has turned over.
      g.setTransform((back ? -scale : scale) * FIT, 0, 0, scale * FIT, sx - x * scale, sy - y * scale);
      paintPetal(g, shape, tint, back);
      g.restore();
    });

    // One pass lays every petal's contact shadow under it, then one smooth draw makes the half-size copy.
    const atlas = document.createElement('canvas');
    atlas.width = paint.width;
    atlas.height = paint.height;
    const a = atlas.getContext('2d');
    a.shadowColor = shadows[theme];
    a.shadowBlur = scale * 0.02;
    a.drawImage(paint, 0, 0);
    paint.width = 0;

    // Smaller petals draw from the half-size copy so they stay crisp instead of shimmering.
    const halfAtlas = document.createElement('canvas');
    halfAtlas.width = Math.ceil(atlas.width / 2);
    halfAtlas.height = Math.ceil(atlas.height / 2);
    const h = halfAtlas.getContext('2d');
    h.imageSmoothingQuality = 'high';
    h.drawImage(atlas, 0, 0, atlas.width / 2, atlas.height / 2);

    // Flat fills for petals seen nearly edge-on, where none of the shading would show.
    const edgeFills = tints.flatMap((tint) => [0, 1].map((back) => {
      const [base, body, rim] = faceTint(tint, back);
      const fill = ctx.createLinearGradient(0, 0.5, 0, -0.5);
      fill.addColorStop(0, base);
      fill.addColorStop(0.55, body);
      fill.addColorStop(1, mix(body, rim, 0.8));
      return fill;
    }));

    return { atlas, halfAtlas, sprites, edgeFills };
  };

  const themeName = (light) => (light ? 'light' : 'dark');

  // Switch to the current theme's sprites, then paint the other theme's while the page is
  // idle so the theme button never stalls the petals.
  const useTheme = () => {
    const light = document.documentElement.dataset.theme === 'light';
    const theme = themeName(light);
    const other = themeName(!light);
    const prepareOther = () => {
      if (!spriteSets[other]) spriteSets[other] = buildSprites(other);
    };

    spriteSet = spriteSets[theme] || (spriteSets[theme] = buildSprites(theme));
    // A busy device may never go idle, so don't wait more than a moment.
    if (window.requestIdleCallback) window.requestIdleCallback(prepareOther, { timeout: 1500 });
    else setTimeout(prepareOther, 200);
  };

  // Petal length in CSS pixels. Averaging two randoms favours mid sizes over extremes.
  const petalSize = () => MIN_SIZE + ((Math.random() + Math.random()) / 2) * (MAX_SIZE - MIN_SIZE);

  const pickTint = () => {
    let roll = Math.random();
    const tint = tintWeights.findIndex((weight) => (roll -= weight) < 0);
    return tint < 0 ? tintWeights.length - 1 : tint;
  };

  const createPetal = (spawnAbove, size = petalSize()) => {
    // Bigger petals read as nearer: they fall faster, sway more and are more opaque.
    const depth = 0.55 + ((size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 0.6;
    const fall = random(30, 55) * depth;
    const spin = random(-1.2, 1.2);

    return {
      x: random(-40, width + 40),
      y: spawnAbove ? random(-80, -20) : random(-20, height),
      vx: 0,
      vy: fall,
      size,
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
      mirror: Math.random() < 0.5 ? -1 : 1,
      alpha: Math.min(0.97, 0.62 + depth * 0.33),
      shape: Math.floor(Math.random() * shapes.length),
      color: pickTint(),
      held: false,
      holdTime: 0,
      offsetX: 0,
      offsetY: 0,
      cooldown: 0,
      bloom: 1,
    };
  };

  const resize = () => {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);

    // Moving to a screen with a different pixel density needs sharper (or lighter) sprites.
    if (ratio !== spriteRatio) {
      spriteRatio = ratio;
      spriteSets = {};
      useTheme();
    }

    // Any surplus (from clicks or a smaller window) drains away as petals fall off screen.
    targetCount = Math.round(Math.min(55, Math.max(14, (width * height) / 30000)) * motion.density);
    while (petals.length < targetCount) petals.push(createPetal(false));
  };

  // Let go of a petal, throwing it in whatever direction the mouse was moving.
  const release = (petal) => {
    const speed = Math.hypot(pointer.vx, pointer.vy);
    const scale = speed > motion.maxThrow ? motion.maxThrow / speed : 1;

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
    // Time for the natural drift runs slower in calm mode; following the mouse doesn't.
    const ambient = dt * motion.pace;
    time += ambient;

    const wind = 14 + Math.sin(time * 0.15) * 12;
    const ease = 1 - Math.exp(-dt * 1.6);
    const follow = 1 - Math.exp(-dt * 18);
    const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);
    let heldCount = petals.filter((petal) => petal.held).length;
    let removed = 0;

    petals.forEach((petal) => {
      petal.cooldown = Math.max(0, petal.cooldown - dt);
      petal.bloom = Math.min(1, petal.bloom + dt * 4);
      petal.swayPhase += petal.swaySpeed * ambient;
      petal.flip += petal.flipSpeed * ambient;

      if (petal.held) {
        petal.holdTime -= dt;

        if (pointer.active && petal.holdTime > 0 && pointerSpeed < motion.flickSpeed) {
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
      const targetVx = (wind * petal.depth + Math.sin(petal.swayPhase) * petal.swayAmp) * motion.pace;
      const targetVy = petal.fall * (1 + Math.cos(petal.swayPhase * 2) * 0.25) * motion.pace;
      petal.vx += (targetVx - petal.vx) * ease;
      petal.vy += (targetVy - petal.vy) * ease;
      petal.spin += (petal.baseSpin - petal.spin) * ease;
      petal.x += petal.vx * dt;
      petal.y += petal.vy * dt;
      petal.rotation += petal.spin * ambient;

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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    petals.forEach((petal) => {
      // Squash across the petal as it tumbles, showing its back once it turns over.
      const facing = Math.cos(petal.flip);
      const turn = Math.max(0.12, Math.abs(facing)) * petal.mirror;
      const size = petal.size * (1 - (1 - petal.bloom) ** 3) * ratio;
      const cos = Math.cos(petal.rotation) * size;
      const sin = Math.sin(petal.rotation) * size;
      const back = facing < 0 ? 1 : 0;

      ctx.setTransform(cos * turn, sin * turn, -sin, cos, petal.x * ratio, petal.y * ratio);
      ctx.globalAlpha = petal.alpha;

      if (Math.abs(facing) < EDGE_ON) {
        ctx.scale(back ? -FIT : FIT, FIT);
        ctx.fillStyle = spriteSet.edgeFills[petal.color * 2 + back];
        ctx.fill(shapes[petal.shape].path);
        return;
      }

      const sprite = spriteSet.sprites[(petal.shape * tintWeights.length + petal.color) * 2 + back];
      const k = size <= MAX_SIZE * ratio * 0.5 ? 0.5 : 1;
      ctx.drawImage(
        k < 1 ? spriteSet.halfAtlas : spriteSet.atlas,
        sprite.sx * k, sprite.sy * k, sprite.sw * k, sprite.sh * k,
        sprite.x, sprite.y, sprite.w, sprite.h,
      );
    });

    ctx.globalAlpha = 1;
  };

  const tick = (now) => {
    // Queue the next frame first so one bad frame can never freeze the petals.
    requestAnimationFrame(tick);

    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    if (dt > 0) {
      trackPointer(dt);
      update(dt);
    }

    render();
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
    if (event.detail === 0) return;
    if (petals.length >= targetCount + MAX_EXTRA) return;

    // Clicked petals pop out near the front.
    const petal = createPetal(false, random(21, MAX_SIZE));
    petal.x = event.clientX;
    petal.y = event.clientY;
    petal.vx = random(-80, 80) * motion.pace;
    petal.vy = random(-110, -50) * motion.pace;
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

  window.addEventListener('resize', resize);

  new MutationObserver(useTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  reducedMotion.addEventListener('change', () => {
    motion = reducedMotion.matches ? CALM_MOTION : FULL_MOTION;
    resize();
  });

  resize();
  lastTime = performance.now();
  requestAnimationFrame(tick);
})();
