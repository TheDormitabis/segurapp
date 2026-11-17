import { Geolocation } from '@capacitor/geolocation';

/**
 * Adaptador de capacidades del dispositivo.
 * En Capacitor usa el plugin nativo; en navegador recurre a la API web.
 * La ubicación solo se solicita después de una acción explícita de la persona.
 */
export async function getCurrentPosition() {
  try {
    const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
    if (isNative) {
      return await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 12000 });
    }
    if (!('geolocation' in navigator)) throw new Error('Este dispositivo no ofrece geolocalización.');
    return await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000
      });
    });
  } catch (error) {
    const message = error?.message || 'No fue posible obtener la ubicación.';
    throw new Error(message);
  }
}

/** Reduce las imágenes antes de persistirlas para evitar llenar localStorage. */
export async function compressImage(file, maxDimension = 1280, quality = 0.72) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.');
  if (file.size > 12 * 1024 * 1024) throw new Error('La imagen supera el límite de 12 MB.');

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
    img.src = source;
  });

  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo preparar la imagen.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function formatDate(value, options = { dateStyle: 'medium' }) {
  try {
    return new Intl.DateTimeFormat('es-PE', options).format(new Date(value));
  } catch {
    return String(value ?? '');
  }
}
