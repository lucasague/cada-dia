// Notificaciones: permiso, suscripción Web Push (VAPID) y alta en el repo de datos.
// El envío real lo hace un workflow de GitHub Actions cada 30 min (ver repo rutina-datos).

import * as estado from './estado.js';
import { guardarSuscripcion, borrarSuscripcion, configurado } from './sincronizar.js';

export const VAPID_PUBLICA = 'BMVJAW_jYhovZuIsFcsnZNwZi10x6m4iPSRoNNMkKpgdJ6uEm-EZkM4SlIApCwGz_2-mDuD90gybHUBGr2TzJ5o';

function base64UrlAUint8(b64) {
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + relleno).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function soporte() {
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const push = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return { push, esIOS, instalada, permiso: 'Notification' in window ? Notification.permission : 'unsupported' };
}

export async function activar(hora) {
  const s = soporte();
  if (!s.push) throw new Error(s.esIOS && !s.instalada
    ? 'En iPhone primero hay que instalar la app (Compartir → Añadir a pantalla de inicio) y abrirla desde el icono.'
    : 'Este navegador no soporta notificaciones push.');
  if (!configurado()) throw new Error('Primero configura el token de GitHub (más abajo): es donde se guarda la suscripción.');
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('Permiso de notificaciones denegado.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlAUint8(VAPID_PUBLICA) });
  }
  await guardarSuscripcion(sub.toJSON(), hora);
  estado.ajustar({ notificaciones: { activas: true, hora } });
  return sub;
}

export async function cambiarHora(hora) {
  estado.ajustar({ notificaciones: { hora } });
  if (!estado.obtener().ajustes.notificaciones.activas) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await guardarSuscripcion(sub.toJSON(), hora);
}

export async function desactivar() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) { console.warn(e); }
  try { await borrarSuscripcion(); } catch (e) { console.warn(e); }
  estado.ajustar({ notificaciones: { activas: false } });
}

/** Notificación local de prueba (sin pasar por el servidor). */
export async function probar(texto) {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Cada día', { body: texto, icon: 'iconos/icono-192.png', badge: 'iconos/insignia-96.png', tag: 'prueba', data: { url: './#/hoy' } });
}
