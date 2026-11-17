# SegurApp · Seguridad ciudadana y prevención

Aplicación web responsive desarrollada con HTML5, CSS3 y JavaScript modular. Está preparada para despliegue en Vercel y empaquetado Android con Capacitor. El mapa interactivo utiliza Leaflet y cartografía de OpenStreetMap, centrada en Trujillo, La Libertad.

## Funcionalidades

- Identidad visual institucional y navegación SPA responsive.
- Acceso local, creación de perfil y preferencias guardadas en el dispositivo.
- Panel de inicio con acceso rápido a las áreas principales.
- Botón SOS con pulsación sostenida, registro de la solicitud y acceso telefónico al 105.
- Registro de incidentes con fecha, ubicación, descripción y fotografía.
- Mapa real de OpenStreetMap centrado en Trujillo, La Libertad, con geolocalización opcional y marcadores para reportes con coordenadas GPS guardados localmente.
- Alertas locales, consejos preventivos, contactos de confianza y asistente Luma.
- Adaptación a navegador móvil y Android WebView mediante Capacitor.

## Mapa y licencia de OpenStreetMap

La aplicación integra Leaflet 1.9.4 en el bundle de Vite y consulta el servicio de teselas estándar de OpenStreetMap (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`). La vista inicial está centrada en la capital distrital de Trujillo (-8.1000, -79.03056), según las coordenadas geográficas publicadas por el INEI. La cartografía se solicita en línea conforme el usuario visualiza cada zona.

La atribución visible a OpenStreetMap se conserva en el mapa. La compilación Android añade el identificador estable `SegurApp/1.0` al User-Agent de WebView, de acuerdo con la recomendación para aplicaciones. No se incluyen teselas descargadas en el repositorio: la política del servidor estándar de OSM prohíbe la descarga masiva, el prefetch y los paquetes offline. Para mapas sin conexión se debe contratar un proveedor que permita ese uso o desplegar un servidor de teselas propio con datos OSM. Los datos de OpenStreetMap se distribuyen bajo ODbL y deben mantener su atribución.

Los puntos del mapa son el centro de referencia y los reportes guardados localmente que cuentan con coordenadas GPS. No representan zonas oficiales de riesgo ni incidentes verificados por las autoridades.

## Requisitos

- Node.js compatible con Vite 7 y npm.
- Para Android: Android Studio, Android SDK y Java/Gradle compatibles con Capacitor 8.
- Conexión a internet para cargar la cartografía base de OpenStreetMap. Leaflet se incluye en la compilación local.

## Ejecutar en desarrollo

```bash
npm install
npm run dev
```

Vite mostrará la dirección local (normalmente `http://localhost:5173`).

## Compilar para web

```bash
npm run build
npm run preview
```

La salida de producción se genera en `dist/`. En Vercel, usa:

| Parámetro | Valor |
|---|---|
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

`vercel.json` ya contiene esta configuración.

## Empaquetar para Android con Capacitor

1. Instala dependencias: `npm install`.
2. Compila: `npm run build`.
3. Añade Android una sola vez: `npx cap add android`.
4. Sincroniza: `npx cap sync android`.
5. Abre Android Studio: `npx cap open android`.
6. En Android Studio, selecciona **Build > Build Bundle(s) / APK(s) > Build APK(s)** para crear un APK de depuración. Para distribución, usa **Build > Generate Signed Bundle / APK** y protege tu keystore.

Después de modificar los archivos web, ejecuta `npm run cap:sync` y vuelve a compilar desde Android Studio.

## Alcance de los servicios

La aplicación ofrece una experiencia funcional en el dispositivo. El acceso y el perfil se almacenan localmente; el formulario de reportes, los contactos, las preferencias y el historial SOS también se conservan en el almacenamiento local. El navegador o Android solicita permiso al acceder a la ubicación.

Para convertirla en un servicio ciudadano con operación institucional se deben integrar y auditar servicios de backend: autenticación, almacenamiento remoto seguro, validación y moderación de reportes, notificaciones push, gestión de consentimientos, controles antiabuso y protocolo de respuesta con entidades competentes. En su configuración actual, SegurApp **no transmite reportes o solicitudes SOS a la Policía, a una central de emergencias ni a otros usuarios**. Ante una emergencia real, el usuario debe llamar directamente al servicio correspondiente.

## Fuentes y atribución

- Cartografía: [OpenStreetMap](https://www.openstreetmap.org/copyright), licencia [ODbL](https://opendatacommons.org/licenses/odbl/).
- Librería cartográfica: [Leaflet](https://leafletjs.com/), licencia BSD 2-Clause.
- Centro urbano de referencia: ubicación geográfica de la capital distrital de Trujillo publicada por el INEI en el *Compendio Estadístico La Libertad 2025*.
