// Confeti ligero en canvas, sin dependencias.
const canvas = document.getElementById('confeti');
const ctx = canvas.getContext('2d');
let piezas = [];
let animando = false;

function redimensionar() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', redimensionar);
redimensionar();

const COLORES = ['#d9a63a', '#f0c25a', '#9b3131', '#4f6d7a', '#fffdf8', '#c39a1c'];

export function lanzarConfeti({ cantidad = 140, origen } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ox = origen ? origen.x : window.innerWidth / 2;
  const oy = origen ? origen.y : window.innerHeight * 0.45;
  for (let i = 0; i < cantidad; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const vel = 6 + Math.random() * 9;
    piezas.push({
      x: ox, y: oy, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: COLORES[(Math.random() * COLORES.length) | 0], vida: 90 + Math.random() * 60,
    });
  }
  if (!animando) { animando = true; ultimo = performance.now(); requestAnimationFrame(paso); }
}

// La simulación avanza por tiempo real (no por frame), así dura lo mismo aunque el navegador
// recorte el frame rate (pestaña en segundo plano, ventana sin foco, móvil en ahorro de energía).
let ultimo = 0;
function paso(ahora) {
  const dt = Math.min(3, (ahora - ultimo) / (1000 / 60)); // en "frames de 60 fps", tope 3
  ultimo = ahora;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  piezas = piezas.filter((p) => p.vida > 0 && p.y < window.innerHeight + 20);
  for (const p of piezas) {
    p.vx *= Math.pow(0.985, dt); p.vy = p.vy * Math.pow(0.985, dt) + 0.28 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vida -= dt;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.vida / 30);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  if (piezas.length) requestAnimationFrame(paso);
  else { animando = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
}
