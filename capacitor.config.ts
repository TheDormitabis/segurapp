import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pe.segurapp.app',
  appName: 'SegurApp',
  webDir: 'dist',
  android: {
    appendUserAgent: 'SegurApp/1.0',
    // El contenido se entrega desde los archivos empaquetados; no necesita servidor remoto.
    allowMixedContent: false
  }
};

export default config;
