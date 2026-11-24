// Cloudflare-style interactive 3D dotted globe for Chain Manager Live Traffic.

const LAND_POLYGONS = [
  // North America + Central America
  [[-168, 65], [-162, 71], [-140, 70], [-125, 71], [-110, 74], [-95, 74], [-82, 69], [-78, 62], [-65, 60], [-56, 52], [-67, 45], [-75, 35], [-81, 25], [-82, 30], [-90, 29], [-97, 26], [-96, 19], [-87, 21], [-84, 10], [-78, 8], [-85, 11], [-93, 15], [-105, 20], [-112, 24], [-117, 32], [-124, 42], [-125, 49], [-136, 58], [-152, 60], [-162, 55], [-168, 65]],
  // Greenland
  [[-53, 60], [-42, 60], [-34, 68], [-20, 74], [-18, 81], [-42, 83], [-65, 78], [-56, 68], [-53, 60]],
  // South America
  [[-78, 9], [-72, 12], [-62, 10], [-50, 1], [-35, -6], [-38, -14], [-41, -22], [-49, -28], [-54, -34], [-62, -40], [-67, -54], [-74, -52], [-73, -40], [-71, -30], [-70, -18], [-78, -12], [-81, -5], [-78, 2], [-78, 9]],
  // Africa
  [[-17, 15], [-12, 28], [-6, 36], [10, 37], [12, 33], [25, 32], [33, 31], [43, 12], [51, 12], [49, 4], [41, -2], [40, -11], [35, -24], [28, -33], [18, -35], [14, -22], [12, -12], [9, 4], [2, 6], [-8, 5], [-15, 10], [-17, 15]],
  // Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -18], [44, -25]],
  // UK & Ireland
  [[-10, 51], [-6, 50], [2, 51], [1, 53], [-2, 58], [-6, 59], [-10, 54], [-10, 51]],
  // Continental Europe & Scandinavia
  [[-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 54], [8, 58], [5, 61], [14, 68], [28, 71], [42, 68], [60, 68], [60, 52], [46, 45], [39, 47], [29, 41], [23, 37], [18, 40], [14, 40], [12, 44], [6, 44], [3, 42], [-5, 36], [-9, 37]],
  // Asia, Middle East, India & SE Asia
  [[27, 41], [42, 43], [52, 40], [55, 46], [60, 52], [60, 68], [85, 73], [110, 75], [140, 72], [175, 66], [162, 55], [142, 54], [135, 44], [129, 35], [126, 38], [122, 40], [118, 39], [122, 31], [120, 24], [109, 20], [109, 11], [104, 2], [100, 13], [97, 16], [91, 22], [85, 19], [80, 13], [77.5, 8], [73, 19], [68, 23], [61, 25], [56, 26], [49, 29], [56, 22], [52, 15], [44, 12], [35, 28], [33, 31], [36, 36], [27, 41]],
  // Sri Lanka
  [[79.8, 9.7], [81.8, 7.6], [80.5, 6.0], [79.7, 7.5], [79.8, 9.7]],
  // Japan
  [[130, 31], [136, 34], [141, 38], [145, 44], [141, 45], [137, 37], [131, 34], [130, 31]],
  // Sumatra & Java
  [[95, 5], [105, -5], [114, -8], [105, -7], [96, 2], [95, 5]],
  // Borneo
  [[109, -3], [117, -3], [118, 6], [112, 3], [109, -3]],
  // Philippines
  [[120, 18], [123, 14], [126, 7], [122, 6], [120, 14], [120, 18]],
  // New Guinea
  [[132, -2], [141, -3], [150, -10], [140, -8], [132, -2]],
  // Australia
  [[114, -22], [122, -17], [131, -12], [136, -12], [142, -11], [146, -18], [153, -27], [150, -37], [141, -38], [135, -34], [129, -32], [122, -34], [115, -34], [114, -27], [114, -22]],
  // New Zealand
  [[167, -46], [172, -43], [178, -37], [174, -35], [172, -41], [167, -46]]
];

const CITY_COORDS = {
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  mumbai: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  'new delhi': [28.6139, 77.209],
  hyderabad: [17.385, 78.4867],
  chennai: [13.0827, 80.2707],
  kolkata: [22.5726, 88.3639],
  pune: [18.5204, 73.8567],
  kochi: [9.9312, 76.2673],
  cochin: [9.9312, 76.2673],
  mattanur: [11.9308, 75.5707],
  kannur: [11.8745, 75.3704],
  thiruvananthapuram: [8.5241, 76.9366],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  mysuru: [12.2958, 76.6394],
  mangaluru: [12.9141, 74.856],
  coimbatore: [11.0168, 76.9558],
  chandigarh: [30.7333, 76.7794],
  lucknow: [26.8467, 80.9462],
  surat: [21.1702, 72.8311],
  indore: [22.7196, 75.8577],
  guwahati: [26.1445, 91.7362],
  goa: [15.4909, 73.8278],
  panaji: [15.4909, 73.8278],
  singapore: [1.3521, 103.8198],
  tokyo: [35.6762, 139.6503],
  osaka: [34.6937, 135.5023],
  seoul: [37.5665, 126.978],
  london: [51.5074, -0.1278],
  'new york': [40.7128, -74.006],
  newark: [40.7357, -74.1724],
  'san jose': [37.3382, -121.8863],
  'san francisco': [37.7749, -122.4194],
  dallas: [32.7767, -96.797],
  'dallas-fort worth': [32.8998, -97.0403],
  ashburn: [39.0438, -77.4874],
  dulles: [38.9531, -77.4565],
  seattle: [47.6062, -122.3321],
  frankfurt: [50.1109, 8.6821],
  marseille: [43.2965, 5.3698],
  paris: [48.8566, 2.3522],
  amsterdam: [52.3676, 4.9041],
  dubai: [25.2048, 55.2708],
  sydney: [-33.8688, 151.2093],
  melbourne: [-37.8136, 144.9631],
  toronto: [43.6532, -79.3832],
  bangkok: [13.7563, 100.5018],
  'kuala lumpur': [3.139, 101.6869],
  'hong kong': [22.3193, 114.1694]
};

const COUNTRY_COORDS = {
  IN: [20.5937, 78.9629],
  US: [39.8283, -98.5795],
  GB: [54.0, -2.5],
  SG: [1.3521, 103.8198],
  JP: [36.2048, 138.2529],
  DE: [51.1657, 10.4515],
  FR: [46.2276, 2.2137],
  CA: [56.1304, -106.3468],
  AU: [-25.2744, 133.7751],
  AE: [24.4539, 54.3773],
  NL: [52.1326, 5.2913],
  ID: [-2.5, 118.0],
  MY: [4.2105, 101.9758],
  TH: [15.87, 100.9925],
  KR: [35.9078, 127.7669],
  BR: [-14.235, -51.9253],
  CH: [46.8182, 8.2275],
  IT: [41.8719, 12.5674],
  ES: [40.4637, -3.7492],
  IE: [53.1424, -7.6921],
  NZ: [-40.9006, 174.886],
  LK: [7.8731, 80.7718]
};

function pointInPolygon(lng, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLand(lng, lat) {
  for (let i = 0; i < LAND_POLYGONS.length; i++) {
    if (pointInPolygon(lng, lat, LAND_POLYGONS[i])) return true;
  }
  return false;
}

let cachedLandDots = null;
function getLandDots() {
  if (cachedLandDots) return cachedLandDots;
  const total = 4800;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out = [];
  for (let i = 0; i < total; i++) {
    const y = 1 - (i / (total - 1)) * 2;
    const lat = Math.asin(y) * (180 / Math.PI);
    const theta = golden * i;
    let lng = ((theta % (2 * Math.PI)) * (180 / Math.PI)) - 180;
    if (lng < -180) lng += 360;
    if (lng > 180) lng -= 360;
    if (!isLand(lng, lat)) continue;
    const phi = lat * (Math.PI / 180);
    const lam = lng * (Math.PI / 180);
    out.push(
      Math.cos(phi) * Math.sin(lam),
      Math.sin(phi),
      Math.cos(phi) * Math.cos(lam)
    );
  }
  cachedLandDots = new Float32Array(out);
  return cachedLandDots;
}

export function resolveLocationCoords(loc) {
  const latNum = Number(loc?.lat);
  const lngNum = Number(loc?.lng);
  if (loc?.lat !== null && loc?.lat !== undefined && loc?.lng !== null && loc?.lng !== undefined
      && Number.isFinite(latNum) && Number.isFinite(lngNum)
      && Math.abs(latNum) <= 90 && Math.abs(lngNum) <= 180) {
    return { lat: latNum, lng: lngNum };
  }
  const label = String(loc?.label || loc?.city || '').toLowerCase();
  const firstSegment = label.split(',')[0].trim();
  if (CITY_COORDS[firstSegment]) {
    return { lat: CITY_COORDS[firstSegment][0], lng: CITY_COORDS[firstSegment][1] };
  }
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (label.includes(city)) return { lat: coords[0], lng: coords[1] };
  }
  const cc = String(loc?.country || '').trim().toUpperCase();
  if (COUNTRY_COORDS[cc]) {
    return { lat: COUNTRY_COORDS[cc][0], lng: COUNTRY_COORDS[cc][1] };
  }
  return null;
}

function normalizeLonDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function mountTrafficGlobe(container, { locations = [], mode = 'all', onSelect = null } = {}) {
  if (!container) return null;
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.className = 'mgr-globe-canvas';
  canvas.setAttribute('aria-label', 'Interactive 3D globe showing store visitors around the world');
  container.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.className = 'mgr-globe-tooltip';
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const hint = document.createElement('div');
  hint.className = 'mgr-globe-hint';
  hint.textContent = 'Drag to rotate · Click pin to focus';
  container.appendChild(hint);

  const ctx = canvas.getContext('2d');
  const landDots = getLandDots();

  let points = [];
  let maxCount = 1;
  let currentMode = mode === 'live' ? 'live' : 'all';
  let focusedKey = '';

  // Start facing India / Asia
  const DEFAULT_LAT = 20 * (Math.PI / 180);
  const DEFAULT_LNG = 78 * (Math.PI / 180);
  let rotLat = DEFAULT_LAT;
  let rotLng = DEFAULT_LNG;
  let targetLat = null;
  let targetLng = null;
  let dragging = false;
  let pointerMoved = false;
  let lastX = 0;
  let lastY = 0;
  let velLng = 0;
  let velLat = 0;
  let pauseSpinUntil = 0;
  let hoveredPoint = null;
  let screenPins = [];
  let rafId = 0;
  let lastTime = performance.now();
  let width = 320;
  let height = 320;

  function applyLocations(nextLocations, opts = {}) {
    if (opts.mode) currentMode = opts.mode === 'live' ? 'live' : 'all';
    if (typeof opts.focusedKey === 'string') focusedKey = opts.focusedKey;
    const mapped = [];
    for (const loc of (Array.isArray(nextLocations) ? nextLocations : [])) {
      const coords = resolveLocationCoords(loc);
      if (!coords) continue;
      const phi = coords.lat * (Math.PI / 180);
      const lam = coords.lng * (Math.PI / 180);
      mapped.push({
        ...loc,
        key: `${loc.label}|${loc.country}`,
        lat: coords.lat,
        lng: coords.lng,
        x: Math.cos(phi) * Math.sin(lam),
        y: Math.sin(phi),
        z: Math.cos(phi) * Math.cos(lam)
      });
    }
    points = mapped;
    maxCount = Math.max(1, ...mapped.map(p => Number(p.count) || 1));
  }

  applyLocations(locations, { mode });

  // Focus toward top active or top location on initial mount if available
  const firstPoint = points.find(p => (p.activeNow || 0) > 0) || points[0];
  if (firstPoint) {
    rotLat = Math.max(-1.05, Math.min(1.05, firstPoint.lat * (Math.PI / 180)));
    rotLng = firstPoint.lng * (Math.PI / 180);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width || 320));
    const h = Math.max(250, Math.round(rect.height || 320));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  function renderFrame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;

    if (!dragging) {
      if (targetLat !== null && targetLng !== null) {
        const dLat = targetLat - rotLat;
        const dLng = normalizeLonDiff(targetLng, rotLng);
        rotLat += dLat * Math.min(1, dt * 7);
        rotLng += dLng * Math.min(1, dt * 7);
        if (Math.abs(dLat) < 0.002 && Math.abs(dLng) < 0.002) {
          targetLat = null;
          targetLng = null;
        }
      } else {
        if (Math.abs(velLng) > 0.0005 || Math.abs(velLat) > 0.0005) {
          rotLng += velLng;
          rotLat = Math.max(-1.12, Math.min(1.12, rotLat + velLat));
          velLng *= Math.pow(0.08, dt);
          velLat *= Math.pow(0.08, dt);
        } else if (!hoveredPoint && now > pauseSpinUntil) {
          rotLng -= dt * 0.13;
        }
      }
    }

    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.43;

    // Soft drop shadow under sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy + R * 0.06, R * 0.99, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.055)';
    ctx.fill();
    ctx.restore();

    // Cloudflare-style bright white sphere with subtle cool rim shading
    const sphereGrad = ctx.createRadialGradient(
      cx - R * 0.3, cy - R * 0.32, R * 0.12,
      cx, cy, R
    );
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.68, '#f8fafd');
    sphereGrad.addColorStop(0.92, '#edf2f8');
    sphereGrad.addColorStop(1, '#e1e8f2');

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = sphereGrad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
    ctx.stroke();

    const sinLng = Math.sin(rotLng);
    const cosLng = Math.cos(rotLng);
    const sinLat = Math.sin(rotLat);
    const cosLat = Math.cos(rotLat);

    // Draw halftone landmass dots on front hemisphere
    const dotSize = Math.max(1.05, R * 0.0115);
    for (let i = 0; i < landDots.length; i += 3) {
      const xe = landDots[i];
      const ye = landDots[i + 1];
      const ze = landDots[i + 2];

      const x0 = xe * cosLng - ze * sinLng;
      const z0 = xe * sinLng + ze * cosLng;
      const y1 = ye * cosLat - z0 * sinLat;
      const z1 = ye * sinLat + z0 * cosLat;

      if (z1 <= 0.02) continue;
      const alpha = Math.min(0.68, 0.14 + z1 * 0.54);
      const px = cx + x0 * R;
      const py = cy - y1 * R;

      ctx.fillStyle = `rgba(122, 146, 178, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Project and draw visitor markers
    const nextScreenPins = [];
    for (const pt of points) {
      const x0 = pt.x * cosLng - pt.z * sinLng;
      const z0 = pt.x * sinLng + pt.z * cosLng;
      const y1 = pt.y * cosLat - z0 * sinLat;
      const z1 = pt.y * sinLat + z0 * cosLat;

      if (z1 < -0.06) continue;
      const depthFade = z1 < 0.08 ? Math.max(0.25, (z1 + 0.06) / 0.14) : 1;
      const px = cx + x0 * R;
      const py = cy - y1 * R;
      const isLive = (pt.activeNow || 0) > 0;
      const isFocused = focusedKey && pt.key === focusedKey;
      const dimmed = currentMode === 'live' && !isLive;
      const ratio = Math.sqrt(Math.max(1, Number(pt.count) || 1) / maxCount);
      const radius = Math.max(3.6, Math.min(11, 3.6 + ratio * 7.4));

      nextScreenPins.push({ pt, px, py, radius, z1, isLive, dimmed, isFocused, depthFade });
    }

    nextScreenPins.sort((a, b) => a.z1 - b.z1);
    screenPins = nextScreenPins;

    const pulsePhase = (now % 2000) / 2000;
    for (const pin of nextScreenPins) {
      const alpha = pin.depthFade * (pin.dimmed ? 0.25 : 1);
      ctx.save();
      ctx.globalAlpha = alpha;

      // Animated live halo ring for active visitors
      if (pin.isLive) {
        const ringR = pin.radius + 3 + pulsePhase * 12;
        ctx.beginPath();
        ctx.arc(pin.px, pin.py, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(5, 150, 105, ${(1 - pulsePhase) * 0.65})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      if (pin.isFocused) {
        ctx.beginPath();
        ctx.arc(pin.px, pin.py, pin.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(29, 95, 230, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Soft cobalt drop glow
      ctx.beginPath();
      ctx.arc(pin.px, pin.py, pin.radius + 2.2, 0, Math.PI * 2);
      ctx.fillStyle = pin.isLive ? 'rgba(5, 150, 105, 0.22)' : 'rgba(29, 95, 230, 0.2)';
      ctx.fill();

      // Core pin circle
      ctx.beginPath();
      ctx.arc(pin.px, pin.py, pin.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#1d5fe6';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.restore();
    }

    rafId = requestAnimationFrame(renderFrame);
  }

  rafId = requestAnimationFrame(renderFrame);

  function findPinAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    let best = null;
    let bestDist = Infinity;
    for (let i = screenPins.length - 1; i >= 0; i--) {
      const pin = screenPins[i];
      const dx = mx - pin.px;
      const dy = my - pin.py;
      const dist = Math.hypot(dx, dy);
      if (dist <= Math.max(11, pin.radius + 6) && dist < bestDist) {
        bestDist = dist;
        best = pin;
      }
    }
    return best;
  }

  function showTooltip(pin) {
    if (!pin) {
      tooltip.hidden = true;
      canvas.style.cursor = dragging ? 'grabbing' : 'grab';
      return;
    }
    const { pt, px, py } = pin;
    const liveTxt = (pt.activeNow || 0) > 0 ? ` · ${pt.activeNow} live` : '';
    const coloTxt = pt.colo ? ` (${pt.colo})` : '';
    tooltip.textContent = `${pt.label}, ${pt.country}${coloTxt} · ${pt.count} ${pt.count === 1 ? 'visitor' : 'visitors'}${liveTxt}`;
    tooltip.style.left = `${Math.max(10, Math.min(width - 10, px))}px`;
    tooltip.style.top = `${Math.max(26, py - pin.radius - 10)}px`;
    tooltip.hidden = false;
    canvas.style.cursor = 'pointer';
  }

  function onPointerDown(e) {
    dragging = true;
    pointerMoved = false;
    lastX = e.clientX;
    lastY = e.clientY;
    velLng = 0;
    velLat = 0;
    targetLat = null;
    targetLng = null;
    pauseSpinUntil = performance.now() + 8000;
    canvas.style.cursor = 'grabbing';
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  }

  function onPointerMove(e) {
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pointerMoved = true;
      lastX = e.clientX;
      lastY = e.clientY;
      const R = Math.max(80, Math.min(width, height) * 0.43);
      const dLng = -dx / R;
      const dLat = dy / R;
      rotLng += dLng;
      rotLat = Math.max(-1.12, Math.min(1.12, rotLat + dLat));
      velLng = dLng * 0.55;
      velLat = dLat * 0.55;
      tooltip.hidden = true;
      return;
    }
    const hit = findPinAt(e.clientX, e.clientY);
    hoveredPoint = hit?.pt || null;
    showTooltip(hit);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    pauseSpinUntil = performance.now() + 6000;
    if (!pointerMoved) {
      const hit = findPinAt(e.clientX, e.clientY);
      if (hit) {
        focusedKey = hit.pt.key;
        targetLat = Math.max(-1.05, Math.min(1.05, hit.pt.lat * (Math.PI / 180)));
        targetLng = hit.pt.lng * (Math.PI / 180);
        showTooltip(hit);
        onSelect?.(hit.pt);
      }
    }
    canvas.style.cursor = hoveredPoint ? 'pointer' : 'grab';
  }

  function onPointerLeave() {
    if (!dragging) {
      hoveredPoint = null;
      tooltip.hidden = true;
      canvas.style.cursor = 'grab';
    }
  }

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerLeave);

  return {
    getCanvas: () => canvas,
    setLocations(nextLocations, opts = {}) {
      applyLocations(nextLocations, opts);
    },
    focusLocation(lat, lng, key = '') {
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
      focusedKey = key;
      targetLat = Math.max(-1.05, Math.min(1.05, Number(lat) * (Math.PI / 180)));
      targetLng = Number(lng) * (Math.PI / 180);
      pauseSpinUntil = performance.now() + 7000;
    },
    resetView() {
      focusedKey = '';
      targetLat = DEFAULT_LAT;
      targetLng = DEFAULT_LNG;
      pauseSpinUntil = performance.now() + 2500;
    },
    destroy() {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    }
  };
}
