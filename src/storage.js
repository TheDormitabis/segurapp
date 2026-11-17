const PREFIX = 'segurapp.v1.';
const volatileStore = new Map();

function readRaw(key) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? volatileStore.get(key) : JSON.parse(raw);
  } catch {
    return volatileStore.get(key);
  }
}

export const storage = {
  get(key, fallback = null) {
    const value = readRaw(key);
    return value === undefined || value === null ? fallback : value;
  },
  set(key, value) {
    volatileStore.set(key, value);
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[SegurApp] No se pudo guardar "${key}" en localStorage.`, error);
      return false;
    }
  },
  remove(key) {
    volatileStore.delete(key);
    try { window.localStorage.removeItem(PREFIX + key); } catch { /* modo privado / WebView */ }
  },
  clear() {
    try {
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith(PREFIX))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch { /* almacenamiento no disponible */ }
    volatileStore.clear();
  }
};

export function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `sa-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
