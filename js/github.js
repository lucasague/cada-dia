// Acceso mínimo a la API de GitHub para leer/escribir ficheros JSON en el repo privado de datos.
// Se usa con un token fine-grained (Contents: read/write) que Lucas pega una vez en Ajustes.

const API = 'https://api.github.com';

function aBase64(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function deBase64(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function cabeceras(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export async function leerJSON({ token, repo }, ruta) {
  const r = await fetch(`${API}/repos/${repo}/contents/${ruta}`, { headers: cabeceras(token), cache: 'no-store' });
  if (r.status === 404) return { datos: null, sha: null };
  if (!r.ok) throw new Error(`GitHub ${r.status} al leer ${ruta}`);
  const cuerpo = await r.json();
  return { datos: JSON.parse(deBase64(cuerpo.content)), sha: cuerpo.sha };
}

export async function escribirJSON({ token, repo }, ruta, datos, sha, mensaje) {
  const r = await fetch(`${API}/repos/${repo}/contents/${ruta}`, {
    method: 'PUT', headers: cabeceras(token),
    body: JSON.stringify({ message: mensaje, content: aBase64(JSON.stringify(datos, null, 1)), ...(sha ? { sha } : {}) }),
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} al escribir ${ruta}`);
  return (await r.json()).content.sha;
}

/** Lee, transforma y escribe; reintenta una vez si otro dispositivo escribió entre medias (409/422). */
export async function actualizarJSON(cfg, ruta, transformar, mensaje) {
  for (let intento = 0; intento < 2; intento++) {
    const { datos, sha } = await leerJSON(cfg, ruta);
    const nuevo = transformar(datos);
    try { await escribirJSON(cfg, ruta, nuevo, sha, mensaje); return nuevo; }
    catch (e) { if (intento === 1 || !/409|422/.test(e.message)) throw e; }
  }
}

export async function comprobarToken(cfg) {
  const r = await fetch(`${API}/repos/${cfg.repo}`, { headers: cabeceras(cfg.token) });
  if (!r.ok) throw new Error(r.status === 401 ? 'Token no válido' : r.status === 404 ? 'El token no ve ese repositorio' : `GitHub ${r.status}`);
  const info = await r.json();
  return { ok: true, privado: info.private, permisos: info.permissions };
}
