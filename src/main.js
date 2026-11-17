import './styles.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// La librería se empaqueta con Vite; la capa cartográfica se consulta online.
window.L = L;
import { storage, makeId } from './storage.js';
import { getCurrentPosition, compressImage, formatDate } from './platform.js';

const app = document.querySelector('#app');
const now = new Date();
const localDateTime = (date = new Date()) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const initials = (name = 'S') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'S';

const seedAlerts = [];
let leafletMap = null;
let userLocationMarker = null;

const state = {
  screen: storage.get('session') && storage.get('profile') ? 'home' : 'welcome',
  authMode: 'login',
  profile: storage.get('profile', null),
  session: storage.get('session', null),
  pendingName: '',
  currentLocation: null,
  reports: storage.get('reports', []),
  emergencyHistory: storage.get('emergencyHistory', []),
  communityAlerts: storage.get('communityAlerts', seedAlerts).filter((alert) => !alert.sample),
  contacts: storage.get('contacts', []),
  preferences: storage.get('preferences', { notifications: true, communityAlerts: true, language: 'es' }),
  photoData: null,
  modal: null,
  lumaOpen: false,
  lumaMessages: [{ role: 'assistant', text: 'Hola, soy Luma. Puedo orientarte con información preventiva y el uso de SegurApp. ¿Qué necesitas hoy?' }],
  activeFilter: 'all'
};

function persist(key, value) {
  state[key] = value;
  storage.set(key, value);
}

function showToast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => node.classList.remove('show'), 3000);
}

function openModal(title, body, actions = '') {
  state.modal = { title, body, actions };
  render();
}
function closeModal() { state.modal = null; render(); }

function shieldArtwork() {
  return `<svg viewBox="0 0 360 380" role="img" aria-label="Escudo de protección SegurApp">
    <defs>
      <linearGradient id="shieldGradient" x1=".05" y1=".05" x2=".9" y2="1"><stop stop-color="#a88aef"/><stop offset=".55" stop-color="#7447c5"/><stop offset="1" stop-color="#4e249b"/></linearGradient>
      <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c4a7ff"/><stop offset="1" stop-color="#8e5cda"/></linearGradient>
    </defs>
    <ellipse cx="183" cy="194" rx="155" ry="48" fill="none" stroke="url(#ringGradient)" stroke-width="9" transform="rotate(-24 183 194)"/>
    <path d="M180 25 291 68v91c0 89-48 145-111 183C117 304 69 248 69 159V68Z" fill="#5d36aa" opacity=".18" transform="translate(7 8)"/>
    <path d="M180 18 286 59v91c0 84-45 137-106 175C119 287 74 234 74 150V59Z" fill="url(#shieldGradient)" stroke="#452184" stroke-width="8" stroke-linejoin="round"/>
    <path d="M180 39 265 72v78c0 69-34 115-85 148-51-33-85-79-85-148V72Z" fill="none" stroke="#d8c8ff" stroke-width="5" opacity=".9"/>
    <rect x="135" y="151" width="90" height="80" rx="20" fill="#fff"/>
    <path d="M151 151v-23a29 29 0 0 1 58 0v23" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round"/>
    <circle cx="180" cy="184" r="10" fill="#6034b0"/><path d="M180 193v17" stroke="#6034b0" stroke-width="8" stroke-linecap="round"/>
    <path d="m45 107 7 13 14 7-14 7-7 13-7-13-14-7 14-7Zm275 170 6 11 12 6-12 6-6 12-6-12-12-6 12-6Z" fill="#fff" opacity=".9"/>
  </svg>`;
}

function brand() {
  return `<a class="brand" href="#" data-go="welcome" aria-label="SegurApp, inicio"><span class="brand-shield"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M16 2 28 7v9c0 8-4.8 14-12 18C8.8 30 4 24 4 16V7Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m10.5 17 3.6 3.6 7.7-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>SegurApp</span></a>`;
}

function welcomeView() {
  return `<main class="welcome-wrap">
    <section class="welcome-copy">
      ${brand()}
      <span class="pill" style="margin-top:28px">Seguridad ciudadana</span>
      <h1>Tu seguridad,<br><span>nuestra prioridad.</span></h1>
      <p class="lead">Pequeñas acciones, información útil y una comunidad más atenta pueden hacer que cada camino se sienta un poco más seguro.</p>
      <div class="welcome-actions">
        <button class="btn btn-primary" data-action="start">Comenzar <span aria-hidden="true">➜</span></button>
        <button class="btn btn-white" data-action="story">Conoce la historia</button>
      </div>
      <div class="privacy-note"><span class="privacy-icon">⌑</span><span><b>Tu privacidad primero.</b> Tu ubicación solo se comparte cuando tú lo decides. La información de tu perfil se conserva en este dispositivo.</span></div>
    </section>
    <section class="welcome-art" aria-label="Ilustración de protección">
      <span class="art-spark one">✦</span><span class="art-spark two">✧</span><span class="art-spark three">✦</span>
      <div class="shield-illustration">${shieldArtwork()}</div>
      <div class="art-caption"><strong>Tu camino, más seguro</strong><span>Información, prevención y redes de apoyo a tu ritmo.</span></div>
    </section>
  </main>`;
}

function loginView() {
  const signup = state.authMode === 'signup';
  return `<main class="auth-page">
    <section class="auth-card card">
      <div class="auth-header">
        <div class="auth-logo"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M16 2 28 7v9c0 8-4.8 14-12 18C8.8 30 4 24 4 16V7Z" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="m10.5 17 3.6 3.6 7.7-8" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h1>${signup ? 'Crea tu cuenta' : 'SegurApp'}</h1>
        <p>${signup ? 'Un espacio para aprender, prevenir y estar en contacto con tu comunidad.' : 'Inicia sesión para cuidarte y mantenerte segura.'}</p>
      </div>
      <form class="form-grid" data-form="${signup ? 'signup' : 'login'}">
        ${signup ? `<div class="input-group"><label for="signup-name">¿Cómo te llamas?</label><input class="input" id="signup-name" name="name" autocomplete="name" placeholder="Tu nombre" required maxlength="60" /></div>` : ''}
        <div class="input-group"><label for="auth-email">Correo electrónico</label><input class="input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="nombre@correo.com" required maxlength="120" /></div>
        <div class="input-group"><label for="auth-password">Contraseña</label><input class="input" id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="${signup ? '8' : '1'}" placeholder="${signup ? 'Mínimo 8 caracteres' : 'Tu contraseña'}" required /></div>
        ${signup ? '' : `<div class="auth-links"><label class="small muted"><input type="checkbox" name="remember" checked /> Recordarme</label><button class="text-link" type="button" data-action="forgot">¿Olvidaste tu contraseña?</button></div>`}
        <button class="btn btn-primary btn-block" type="submit">${signup ? 'Crear cuenta' : 'Iniciar sesión'} <span>➜</span></button>
      </form>
      <div class="divider-text" style="margin:18px 0 13px">o continúa con</div>
      <div class="form-grid" style="gap:9px">
        <button class="social-btn" type="button" data-action="social" data-provider="Google">🌐 &nbsp; Continuar con Google</button>
        <button class="social-btn" type="button" data-action="social" data-provider="Apple"> &nbsp; Continuar con Apple</button>
      </div>
      <p class="small muted" style="text-align:center;margin:17px 0 0">${signup ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} <button class="text-link" type="button" data-action="switch-auth">${signup ? 'Inicia sesión' : 'Regístrate'}</button></p>
      <p class="small muted" style="text-align:center;margin:13px 0 0;line-height:1.5">El acceso de esta instalación conserva el perfil en este dispositivo. No valida credenciales con un servidor.</p>
      <button class="btn btn-quiet btn-block" type="button" data-action="guest">Continuar sin cuenta</button>
    </section>
  </main>`;
}

function onboardingView() {
  return `<main class="auth-page">
    <section class="onboarding-card card">
      <div class="onboarding-mascot">SA</div>
      <div class="auth-header" style="margin-bottom:20px"><span class="eyebrow">Tu espacio, a tu manera</span><h1 style="font-size:27px;margin-top:5px">Empecemos con calma</h1><p>Cuéntanos cómo te gusta que te llamemos y cómo podrías recibir una llamada de alguien de confianza.</p></div>
      <form class="form-grid" data-form="onboarding">
        <div class="input-group"><label for="profile-name">Tu nombre</label><input class="input" id="profile-name" name="name" autocomplete="name" placeholder="Ej. Sofía" maxlength="60" value="${escapeHTML(state.pendingName || state.profile?.name || '')}" required /></div>
        <div class="input-group"><label for="profile-phone">Tu teléfono (opcional)</label><input class="input" id="profile-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Ej. 999 123 456" maxlength="24" value="${escapeHTML(state.profile?.phone || '')}" /></div>
        <div class="info-strip"><span>🔐</span><span>Estos datos se guardan solo en este dispositivo. No enviaremos mensajes ni compartiremos tu número.</span></div>
        <button class="btn btn-primary btn-block" type="submit">Guardar y continuar <span>➜</span></button>
        <button class="btn btn-quiet btn-block" type="button" data-action="skip-onboarding">Ahora no</button>
      </form>
    </section>
  </main>`;
}

const navItems = [
  ['home', 'Inicio', '⌂'], ['map', 'Mapa', '⌖'], ['tips', 'Consejos', '✧'], ['profile', 'Perfil', '♙']
];
const sideItems = [
  ['home', 'Inicio', '⌂'], ['map', 'Mapa de zonas', '⌖'], ['report', 'Reportar un robo', '▤'], ['alerts', 'Alertas comunitarias', '◉'], ['tips', 'Consejos', '✧'], ['contacts', 'Tu gente', '♡'], ['profile', 'Mi perfil', '♙']
];
const titles = {
  home: 'Tu espacio seguro', map: 'Mapa de zonas de riesgo', report: 'Reportar un robo', alerts: 'Alertas comunitarias',
  tips: 'Consejos de seguridad', profile: 'Mi perfil', contacts: 'Tu gente de confianza', settings: 'Configuración',
  'my-reports': 'Mis reportes', 'my-alerts': 'Mis alertas', help: 'Ayuda y soporte'
};

function navItem([route, label, icon], mobile = false) {
  const active = state.screen === route || (route === 'profile' && ['settings', 'contacts', 'my-reports', 'my-alerts', 'help'].includes(state.screen));
  return `<button class="nav-item ${active ? 'active' : ''}" type="button" data-go="${route}" ${active ? 'aria-current="page"' : ''}><span class="nav-icon">${icon}</span><span>${label}</span></button>`;
}

function appShell(content) {
  const name = state.profile?.name || 'Amiga';
  return `<div class="app-frame">
    <aside class="sidebar">
      ${brand()}
      <p class="side-label">Tu SegurApp</p>
      <nav class="side-nav" aria-label="Navegación principal">${sideItems.map((item) => navItem(item)).join('')}</nav>
      <div class="sidebar-bottom"><div class="privacy-note"><span>🔒</span><span>Tu ubicación permanece privada hasta que decidas compartirla.</span></div></div>
    </aside>
    <div class="main-column">
      <header class="topbar">
        <div class="topbar-greeting"><span class="eyebrow">SEGURAPP · COMUNIDAD Y PREVENCIÓN</span><strong>${escapeHTML(titles[state.screen] || 'SegurApp')}</strong></div>
        <div class="topbar-actions"><button class="icon-btn" type="button" data-go="alerts" aria-label="Ver alertas">♧</button><button class="avatar-mini" type="button" data-go="profile" aria-label="Abrir perfil">${escapeHTML(initials(name))}</button></div>
      </header>
      <main class="content">${content}</main>
      <nav class="bottom-nav" aria-label="Navegación inferior">${navItems.map((item) => navItem(item, true)).join('')}</nav>
    </div>
  </div>
  <button class="luma-fab" type="button" data-action="toggle-luma" aria-label="Abrir asistente Luma">${state.lumaOpen ? '×' : '···'}</button>
  ${state.lumaOpen ? lumaChat() : ''}`;
}

function lumaChat() {
  return `<section class="luma-chat" aria-label="Asistente Luma">
    <header class="luma-chat-header"><strong>Luma · Asistente de seguridad</strong><button class="icon-btn" type="button" data-action="toggle-luma" aria-label="Cerrar asistente">×</button></header>
    <div class="luma-chat-body" id="luma-messages">${state.lumaMessages.map((message) => `<div class="chat-bubble ${message.role === 'user' ? 'user' : ''}">${escapeHTML(message.text)}</div>`).join('')}</div>
    <form class="luma-chat-form" data-form="luma"><input name="message" placeholder="Escribe tu pregunta…" aria-label="Mensaje para Luma" maxlength="240" required /><button type="submit" aria-label="Enviar mensaje">➤</button></form>
  </section>`;
}

function homePage() {
  const name = state.profile?.name?.split(' ')[0] || 'amiga';
  const firstName = name.charAt(0).toUpperCase() + name.slice(1);
  return `<div class="welcome-banner"><span class="eyebrow">UN DÍA A LA VEZ</span><h1>¡Hola, ${escapeHTML(firstName)}!</h1><p>Juntas construimos una comunidad más atenta. Revisa la información antes de salir y confía en tu intuición.</p><span class="banner-chip">✦ Tu camino, más seguro</span></div>
    <div class="home-grid" style="margin-top:17px">
      <section class="home-main">
        <div class="emergency-card">
          <div class="emergency-head"><div class="siren">SOS</div><div><h2>Alerta de emergencia</h2><p>Registra una solicitud y consulta los canales de ayuda disponibles.</p></div></div>
          <button class="emergency-trigger" type="button" data-action="emergency-hold" aria-label="Mantén presionado para registrar una solicitud de ayuda"><span class="hold-fill"></span><span class="hold-label">Mantén presionado para activar</span></button>
          <p class="emergency-hint">Suelta para cancelar · Mantén 2,2 segundos para registrar una solicitud de ayuda.</p>
        </div>
        <div>
          <div class="section-heading"><div><h2>Accesos rápidos</h2><p>Lo que necesitas, a un toque.</p></div></div>
          <div class="quick-grid">
            <button class="quick-card" type="button" data-go="map"><span class="quick-icon">⌖</span><strong>Mapa de zonas</strong><small>Revisa los puntos reportados</small></button>
            <button class="quick-card" type="button" data-go="report"><span class="quick-icon">▤</span><strong>Reportar un robo</strong><small>Comparte información útil</small></button>
            <button class="quick-card" type="button" data-go="alerts"><span class="quick-icon">◉</span><strong>Alertas comunitarias</strong><small>Entérate de novedades</small></button>
            <button class="quick-card" type="button" data-go="tips"><span class="quick-icon">✧</span><strong>Consejos de seguridad</strong><small>Ideas simples para prevenir</small></button>
            <button class="quick-card" type="button" data-go="contacts"><span class="quick-icon">♡</span><strong>Tu gente</strong><small>Contactos de confianza</small></button>
            <button class="quick-card" type="button" data-go="profile"><span class="quick-icon">♙</span><strong>Mi perfil</strong><small>Cuida tus preferencias</small></button>
          </div>
        </div>
      </section>
      <aside class="home-side">
        <div class="luma-card card"><div class="luma-avatar">L</div><div><h3>¡Hola, soy Luma!</h3><p>Te acompaño con ideas prácticas para cuidarte y tomar decisiones informadas.</p><button class="text-link" type="button" data-action="toggle-luma">Conversar conmigo →</button></div></div>
        <div class="stat-row"><div class="stat-card"><strong>${state.reports.length}</strong><span>Mis reportes locales</span></div><div class="stat-card"><strong>${state.contacts.length}</strong><span>Contactos de confianza</span></div></div>
        <div class="card card-pad"><div class="section-heading" style="margin-top:0"><div><h3>En tu comunidad</h3><p>Actividad registrada</p></div></div>
          ${state.communityAlerts.length ? state.communityAlerts.slice(0, 2).map((alert) => `<div class="community-preview"><strong>${escapeHTML(alert.place)}</strong><span class="small muted">${escapeHTML(alert.title)} · ${escapeHTML(alert.time)}</span></div>`).join('') : '<p class="community-empty">Aún no hay registros comunitarios en este dispositivo.</p>'}
          <button class="text-link" type="button" data-go="alerts">Ver alertas →</button>
        </div>
        <div class="info-strip"><span>ℹ</span><span>Los avisos que se muestran aquí proceden de registros guardados en este dispositivo. Verifica la información antes de actuar.</span></div>
      </aside>
    </div>`;
}

const TRUJILLO_CENTER = [-8.1, -79.03056];

function mapPage() {
  const mappedReports = state.reports.filter((report) => report.coordinates?.latitude && report.coordinates?.longitude).length;
  return `<div class="page-intro-row"><div><span class="eyebrow">LA LIBERTAD · PERÚ</span><h1 class="page-title">Mapa de Trujillo</h1><p class="page-subtitle">Cartografía de OpenStreetMap con reportes locales georreferenciados.</p></div><a class="btn btn-white map-external" href="https://www.openstreetmap.org/#map=14/-8.10/-79.03056" target="_blank" rel="noopener noreferrer">Abrir en OpenStreetMap ↗</a></div>
    <div class="map-layout">
      <section class="map-panel">
        <div class="map-toolbar"><div><strong>Trujillo, La Libertad</strong><span class="map-toolbar-meta">Centro urbano · Vista interactiva</span></div><button class="btn btn-soft" type="button" data-action="map-location">◎ Mi ubicación</button></div>
        <div id="trujillo-map" class="map-canvas" role="application" aria-label="Mapa interactivo de Trujillo, La Libertad, basado en OpenStreetMap"><div class="map-loading">Cargando cartografía…</div></div>
        <div class="map-legend"><span class="legend-item"><i class="legend-dot report"></i> Reporte local con GPS</span><span class="legend-item"><i class="legend-dot current"></i> Tu ubicación</span><span class="legend-item"><i class="legend-dot center"></i> Centro de referencia</span></div>
      </section>
      <aside class="map-side">
        <div class="card risk-card map-summary-card"><span class="eyebrow">ÁREA DE CONSULTA</span><h3>Centro urbano de Trujillo</h3><p>Explora calles, avenidas, espacios públicos y puntos de referencia de la ciudad.</p><div class="map-stat-line"><span>Provincia</span><strong>Trujillo</strong></div><div class="map-stat-line"><span>Departamento</span><strong>La Libertad</strong></div><div class="map-stat-line"><span>Reportes con GPS</span><strong>${mappedReports}</strong></div></div>
        <div class="card risk-card"><h3>Cómo interpretar los puntos</h3><p>Los marcadores de reportes corresponden únicamente a registros creados en este dispositivo y que incluyen GPS. No son una clasificación oficial del nivel de seguridad.</p></div>
        <div class="info-strip map-notice"><span>i</span><span>La base cartográfica se actualiza desde OpenStreetMap al consultar el mapa. Los reportes no se publican ni se comparten con otras personas.</span></div>
        <a class="map-credit-link" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Informar un problema del mapa ↗</a>
      </aside>
    </div>`;
}

function reportPage() {
  return `<h1 class="page-title">Reportar un robo</h1><p class="page-subtitle">Cuéntanos qué ocurrió. Comparte solo los datos que consideres seguros.</p>
    <section class="report-form-card card">
      <form class="form-grid" data-form="report">
        <div class="input-group"><label for="report-location">Ubicación del hecho</label><select class="select" id="report-location" name="location" required><option value="">Selecciona una ubicación</option><option>Centro Histórico de Trujillo</option><option>El Porvenir</option><option>La Esperanza</option><option>Víctor Larco Herrera</option><option>Florencia de Mora</option><option>Huanchaco</option><option>Otra ubicación</option></select><button class="btn btn-quiet" type="button" data-action="report-location">◎ Usar mi ubicación actual (opcional)</button><input class="input" id="report-reference" name="reference" placeholder="Referencia o dirección adicional (opcional)" maxlength="140" /></div>
        <div class="form-row"><div class="input-group"><label for="report-date">Fecha y hora</label><input class="input" type="datetime-local" id="report-date" name="date" value="${localDateTime()}" required /></div><div class="input-group"><label for="report-type">Tipo de incidente</label><select class="select" id="report-type" name="type"><option>Robo</option><option>Intento de robo</option><option>Actividad sospechosa</option><option>Otro incidente</option></select></div></div>
        <div class="input-group"><label for="report-description">Descripción del incidente · ¿Qué pasó?</label><textarea class="textarea" id="report-description" name="description" placeholder="Describe lo ocurrido, evitando incluir datos personales de otras personas…" minlength="12" maxlength="1200" required></textarea><small class="muted">No publiques nombres, teléfonos ni información sensible de terceros.</small></div>
        <div class="input-group"><label>Adjunta una fotografía (opcional)</label><label class="upload-box"><span style="font-size:26px">＋</span><strong>Seleccionar una imagen</strong><small>JPG, PNG o WEBP · máximo 12 MB antes de comprimir</small><input id="report-photo" type="file" accept="image/*" /></label><div id="photo-preview"></div></div>
        <div class="info-strip"><span class="privacy-icon">⌑</span><span>El reporte se guarda en este dispositivo. No se transmite a autoridades ni se publica para otros usuarios.</span></div>
        <button class="btn btn-primary btn-block" type="submit">Guardar reporte</button>
      </form>
    </section>`;
}

function alertsPage() {
  const filtered = state.communityAlerts;
  return `<h1 class="page-title">Alertas comunitarias</h1><p class="page-subtitle">Consulta los incidentes registrados en esta instalación. Verifica cualquier información antes de tomar decisiones.</p>
    <div class="alert-feature"><div><span class="eyebrow">RECUERDA</span><h3>Mantente alerta y evita zonas solitarias.</h3><p>Prefiere calles iluminadas y avisa a alguien de confianza sobre tu recorrido.</p></div><div class="siren">SOS</div></div>
    <div class="section-heading"><div><h2>Reportes recientes</h2><p>Registros almacenados en este dispositivo.</p></div></div>
    <div class="alert-list">${filtered.length ? filtered.map((alert) => `<article class="alert-item"><div class="alert-icon">${alert.level === 'safe' ? '✓' : '!'}</div><div><h3>${escapeHTML(alert.place)} · ${escapeHTML(alert.title)}</h3><p>${escapeHTML(alert.detail)}</p><span class="pill success" style="margin-top:7px">Registro local</span></div><time>${escapeHTML(alert.time)}</time></article>`).join('') : '<div class="empty-state"><span class="empty-icon">⌖</span><strong>No hay reportes en esta categoría</strong><p>Los reportes guardados en este dispositivo aparecerán aquí.</p></div>'}</div>`;
}

const tips = [
  ['01', 'Elige rutas concurridas', 'Evita calles solitarias y procura caminar por vías iluminadas, especialmente por la noche.'],
  ['02', 'Cuida tus objetos de valor', 'Lleva el bolso cerrado y cerca del cuerpo. Evita mostrar dinero o dispositivos innecesariamente.'],
  ['03', 'Comparte tu recorrido', 'Avisa a alguien de confianza cuando salgas y acuerda un mensaje al llegar. Comparte ubicación solo si lo decides.'],
  ['04', 'Confía en tu intuición', 'Si una situación te incomoda, dirígete a un lugar concurrido y pide ayuda a personal identificado.'],
  ['05', 'Prepara tu teléfono', 'Mantén batería suficiente y guarda tus contactos de emergencia. Evita distraerte mirando la pantalla al caminar.'],
  ['06', 'Cuida en comunidad', 'Comparte información concreta y prudente. No difundas rumores ni datos personales de otras personas.']
];
function tipsPage() {
  return `<h1 class="page-title">Consejos de seguridad</h1><p class="page-subtitle">Acciones sencillas que pueden ayudarte a prevenir riesgos cotidianos.</p>
    <div class="tips-grid">${tips.map(([icon, title, detail]) => `<article class="tip-card"><div class="tip-icon">${icon}</div><h3>${title}</h3><p>${detail}</p></article>`).join('')}</div>
    <section class="card card-pad" style="margin-top:17px"><div class="section-heading" style="margin-top:0"><div><h2>En caso de emergencia</h2><p>En Perú, puedes contactar a los servicios correspondientes.</p></div><span class="pill danger">Auxilio</span></div>
      <div class="emergency-numbers"><a class="number-card" href="tel:105"><strong>105</strong><span>Policía Nacional</span></a><a class="number-card" href="tel:116"><strong>116</strong><span>Bomberos</span></a><a class="number-card" href="tel:106"><strong>106</strong><span>SAMU</span></a></div>
      <p class="small muted" style="margin:12px 0 0">Los enlaces abren el marcador del dispositivo; comprueba la cobertura y los números aplicables a tu localidad.</p>
    </section>`;
}

function profilePage() {
  const profile = state.profile || { name: 'Usuaria SegurApp', phone: '' };
  const memberDate = profile.createdAt ? formatDate(profile.createdAt, { month: 'short', year: 'numeric' }) : formatDate(new Date(), { month: 'short', year: 'numeric' });
  return `<h1 class="page-title">Mi perfil</h1><p class="page-subtitle">Administra tu información y preferencias de privacidad.</p>
    <section class="profile-hero"><div class="profile-avatar">${escapeHTML(initials(profile.name))}</div><div><span class="eyebrow">MIEMBRO DE SEGURAPP</span><h2>${escapeHTML(profile.name)}</h2><p>${profile.phone ? escapeHTML(profile.phone) + ' · ' : ''}Desde ${escapeHTML(memberDate)}</p><span class="pill success">Perfil en este dispositivo</span></div></section>
    <div class="menu-list">
      <button class="menu-row" type="button" data-go="my-reports"><span class="menu-icon">▤</span><strong>Mis reportes</strong><span class="arrow">›</span></button>
      <button class="menu-row" type="button" data-go="my-alerts"><span class="menu-icon">♧</span><strong>Mis alertas de emergencia</strong><span class="arrow">›</span></button>
      <button class="menu-row" type="button" data-go="contacts"><span class="menu-icon">♡</span><strong>Mi gente de confianza</strong><span class="arrow">›</span></button>
      <button class="menu-row" type="button" data-go="settings"><span class="menu-icon">⚙</span><strong>Configuración</strong><span class="arrow">›</span></button>
      <button class="menu-row" type="button" data-go="help"><span class="menu-icon">?</span><strong>Ayuda y soporte</strong><span class="arrow">›</span></button>
      <button class="menu-row" type="button" data-action="logout"><span class="menu-icon">↪</span><strong>Cerrar sesión</strong><span class="arrow">›</span></button>
    </div>`;
}

function contactsPage() {
  return `<h1 class="page-title">Tu gente de confianza</h1><p class="page-subtitle">Guarda contactos a quienes podrías llamar. SegurApp no les envía notificaciones automáticamente.</p>
    <section class="card card-pad" style="margin-bottom:16px"><form class="form-grid" data-form="contact"><div class="input-group"><label for="contact-name">Nombre</label><input class="input" id="contact-name" name="name" placeholder="Nombre de tu contacto" maxlength="60" required /></div><div class="input-group"><label for="contact-phone">Teléfono</label><input class="input" id="contact-phone" name="phone" type="tel" placeholder="Número de teléfono" maxlength="24" required /></div><button class="btn btn-primary" type="submit">＋ Añadir contacto</button></form></section>
    <div class="section-heading"><div><h2>Mis contactos</h2><p>${state.contacts.length} guardado(s) en este dispositivo.</p></div></div>
    <div class="contact-list">${state.contacts.length ? state.contacts.map((contact) => `<article class="contact-card"><div class="contact-initial">${escapeHTML(initials(contact.name))}</div><div><strong>${escapeHTML(contact.name)}</strong><small>${escapeHTML(contact.phone)}</small></div><a class="icon-btn" href="tel:${escapeHTML(contact.phone.replace(/[^+\d]/g, ''))}" aria-label="Llamar a ${escapeHTML(contact.name)}">☎</a><button class="icon-btn" type="button" data-action="delete-contact" data-id="${contact.id}" aria-label="Eliminar contacto">×</button></article>`).join('') : '<div class="empty-state"><span class="empty-icon">♡</span><strong>Aún no agregas contactos</strong><p>Añade a alguien de confianza para tener su número a mano.</p></div>'}</div>`;
}

function settingsPage() {
  return `<h1 class="page-title">Configuración</h1><p class="page-subtitle">Administra las preferencias de funcionamiento y privacidad.</p>
    <section class="card card-pad">
      <div class="setting-row"><div><strong>Notificaciones de la app</strong><small>Preferencia local; no activa notificaciones push reales.</small></div><button class="switch" type="button" role="switch" aria-checked="${state.preferences.notifications}" data-action="toggle-setting" data-setting="notifications" aria-label="Notificaciones"></button></div>
      <div class="setting-row"><div><strong>Alertas comunitarias</strong><small>Mostrar avisos dentro de SegurApp.</small></div><button class="switch" type="button" role="switch" aria-checked="${state.preferences.communityAlerts}" data-action="toggle-setting" data-setting="communityAlerts" aria-label="Alertas comunitarias"></button></div>
      <div class="setting-row"><div><strong>Idioma</strong><small>Idioma de esta versión.</small></div><select class="select" style="width:auto;max-width:145px" disabled><option>Español</option></select></div>
      <div class="setting-row"><div><strong>Datos guardados</strong><small>Los reportes y contactos viven en el almacenamiento local de este dispositivo.</small></div><span class="pill success">Local</span></div>
    </section>
    <div class="info-strip" style="margin-top:14px"><span>🔐</span><span>Para una publicación real se recomienda incorporar autenticación segura, base de datos cifrada, política de retención y controles de acceso.</span></div>`;
}

function myReportsPage() {
  return `<h1 class="page-title">Mis reportes</h1><p class="page-subtitle">Reportes creados en este dispositivo.</p>
    <div class="alert-list">${state.reports.length ? [...state.reports].reverse().map((report) => `<article class="report-row"><div><strong>${escapeHTML(report.type)} · ${escapeHTML(report.location)}</strong><small>${escapeHTML(formatDate(report.date, { dateStyle: 'medium', timeStyle: 'short' }))} · ${escapeHTML(report.description.slice(0, 90))}${report.description.length > 90 ? '…' : ''}</small></div><span class="pill warning">Local</span></article>`).join('') : '<div class="empty-state"><span class="empty-icon">📝</span><strong>Aún no tienes reportes</strong><p>Cuando guardes un reporte desde SegurApp aparecerá aquí.</p><button class="btn btn-primary" style="margin-top:12px" data-go="report">Crear reporte</button></div>'}</div>`;
}

function myAlertsPage() {
  return `<h1 class="page-title">Mis alertas de emergencia</h1><p class="page-subtitle">Historial de solicitudes de ayuda registradas en este dispositivo.</p>
    <div class="alert-list">${state.emergencyHistory.length ? [...state.emergencyHistory].reverse().map((alert) => `<article class="alert-item"><div class="alert-icon">🚨</div><div><h3>Solicitud de ayuda registrada</h3><p>${escapeHTML(alert.location || 'Ubicación no compartida')} · No se transmitió a servicios de emergencia.</p></div><time>${escapeHTML(formatDate(alert.createdAt, { dateStyle: 'short', timeStyle: 'short' }))}</time></article>`).join('') : '<div class="empty-state"><span class="empty-icon">🔔</span><strong>No hay alertas registradas</strong><p>Las solicitudes de ayuda registradas desde el botón de emergencia aparecerán aquí.</p></div>'}</div>`;
}

function helpPage() {
  return `<h1 class="page-title">Ayuda y soporte</h1><p class="page-subtitle">Información de uso y privacidad de SegurApp.</p>
    <div class="menu-list">
      <article class="card card-pad"><h3 style="margin:0 0 7px">¿SegurApp envía reportes a la Policía?</h3><p class="muted small" style="margin:0;line-height:1.6">Los reportes y solicitudes de ayuda se conservan en el almacenamiento de este dispositivo. Esta instalación no cuenta con una conexión institucional para transmitir alertas a una central de emergencias o a una plataforma comunitaria.</p></article>
      <article class="card card-pad"><h3 style="margin:0 0 7px">¿Se comparte mi ubicación?</h3><p class="muted small" style="margin:0;line-height:1.6">Solo se solicita cuando pulsas una acción específica como “Usar mi ubicación”. El navegador o Android mostrará el permiso correspondiente.</p></article>
      <article class="card card-pad"><h3 style="margin:0 0 7px">¿Qué hago ante un peligro real?</h3><p class="muted small" style="margin:0 0 10px;line-height:1.6">Busca un lugar seguro y contacta directamente con los servicios de emergencia locales. En Perú, la Policía Nacional atiende en el 105.</p><a class="btn btn-danger" href="tel:105">Llamar al 105</a></article>
      <article class="card card-pad"><h3 style="margin:0 0 7px">SegurApp · Proyecto de seguridad ciudadana</h3><p class="muted small" style="margin:0;line-height:1.6">Plataforma de prevención, orientación y organización de redes personales de apoyo. Para alertas o denuncias reales, contacta directamente con los servicios oficiales.</p></article>
    </div>`;
}


function createMapIcon(kind = 'report') {
  const L = window.L;
  const glyph = kind === 'current' ? '<span></span>' : kind === 'center' ? '<span>•</span>' : '<span>!</span>';
  return L.divIcon({
    className: `segurapp-map-marker marker-${kind}`,
    html: `<div class="segurapp-marker-inner">${glyph}</div>`,
    iconSize: [30, 38],
    iconAnchor: [15, 35],
    popupAnchor: [0, -32]
  });
}

function initializeTrujilloMap() {
  const node = document.querySelector('#trujillo-map');
  if (!node) return;
  if (!window.L) {
    node.innerHTML = '<div class="map-loading map-error">No se pudo cargar el visor cartográfico. Comprueba tu conexión a internet.</div>';
    return;
  }

  const L = window.L;
  leafletMap = L.map(node, {
    zoomControl: true,
    scrollWheelZoom: false,
    tap: true,
    minZoom: 11,
    maxZoom: 19
  }).setView(TRUJILLO_CENTER, 14);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
  }).addTo(leafletMap);

  L.marker(TRUJILLO_CENTER, { icon: createMapIcon('center') })
    .addTo(leafletMap)
    .bindPopup('<strong>Trujillo</strong><br>Capital de La Libertad · Punto de referencia urbano.');

  state.reports.filter((report) => report.coordinates?.latitude && report.coordinates?.longitude).forEach((report) => {
    const coords = [report.coordinates.latitude, report.coordinates.longitude];
    const marker = L.marker(coords, { icon: createMapIcon('report') }).addTo(leafletMap);
    marker.bindPopup(`<strong>${escapeHTML(report.type || 'Incidente registrado')}</strong><br>${escapeHTML(report.location || 'Ubicación registrada')}<br><small>${escapeHTML(formatDate(report.createdAt, { dateStyle: 'medium', timeStyle: 'short' }))}</small><br><small>Registro local; no es una evaluación oficial de riesgo.</small>`);
  });

  window.setTimeout(() => leafletMap?.invalidateSize(), 90);
}

function pageContent() {
  switch (state.screen) {
    case 'home': return homePage();
    case 'map': return mapPage();
    case 'report': return reportPage();
    case 'alerts': return alertsPage();
    case 'tips': return tipsPage();
    case 'profile': return profilePage();
    case 'contacts': return contactsPage();
    case 'settings': return settingsPage();
    case 'my-reports': return myReportsPage();
    case 'my-alerts': return myAlertsPage();
    case 'help': return helpPage();
    default: return homePage();
  }
}

function modalView() {
  if (!state.modal) return '';
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${state.modal.title}</h2><div>${state.modal.body}</div>${state.modal.actions ? `<div class="modal-actions">${state.modal.actions}</div>` : ''}<button class="btn btn-quiet" style="width:100%;margin-top:12px" type="button" data-action="close-modal">Cerrar</button></section></div>`;
}

function render() {
  if (leafletMap) { leafletMap.remove(); leafletMap = null; userLocationMarker = null; }
  if (state.screen === 'welcome') app.innerHTML = welcomeView();
  else if (state.screen === 'login') app.innerHTML = loginView();
  else if (state.screen === 'onboarding') app.innerHTML = onboardingView();
  else app.innerHTML = appShell(pageContent());
  if (state.modal) app.insertAdjacentHTML('beforeend', modalView());
  if (state.screen === 'map') initializeTrujilloMap();
  if (state.photoData && state.screen === 'report') renderPhotoPreview();
  if (state.lumaOpen && state.screen !== 'welcome' && state.screen !== 'login' && state.screen !== 'onboarding') {
    const body = document.querySelector('#luma-messages');
    if (body) body.scrollTop = body.scrollHeight;
  }
}

function go(screen) {
  const allowed = ['home', 'map', 'report', 'alerts', 'tips', 'profile', 'contacts', 'settings', 'my-reports', 'my-alerts', 'help'];
  state.screen = allowed.includes(screen) ? screen : 'home';
  state.modal = null;
  state.photoData = state.screen === 'report' ? state.photoData : null;
  render();
  window.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function storyModal() {
  openModal('La historia de Sofía', `<p>Sofía es una protagonista ficticia creada para explicar por qué la prevención y la colaboración vecinal pueden ser importantes. En su recorrido cotidiano, aprende a identificar rutas concurridas, compartir su ubicación solo con personas de confianza y comunicar incidentes de forma responsable.</p><p>SegurApp reúne esas ideas en un mismo espacio: información preventiva, registros locales de incidentes y una red personal de contactos. La historia no describe un expediente policial ni un caso real documentado.</p><div class="info-strip"><span>💜</span><span>La seguridad también se construye respetando la privacidad, evitando rumores y verificando la información.</span></div>`, `<button class="btn btn-primary" type="button" data-action="story-start">Quiero comenzar</button>`);
}

function startOnboarding(name = '') {
  state.pendingName = name;
  state.screen = 'onboarding';
  render();
}

function saveReport(formData) {
  const location = String(formData.get('location') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const report = {
    id: makeId(),
    location,
    reference: String(formData.get('reference') || '').trim(),
    date: String(formData.get('date') || new Date().toISOString()),
    type: String(formData.get('type') || 'Robo'),
    description,
    coordinates: state.currentLocation ? { latitude: state.currentLocation.latitude, longitude: state.currentLocation.longitude, accuracy: state.currentLocation.accuracy } : null,
    photo: state.photoData,
    createdAt: new Date().toISOString(),
    status: 'local'
  };
  const reports = [...state.reports, report];
  persist('reports', reports);
  const community = [{
    id: report.id, place: location, title: `${report.type} reportado`,
    detail: description.slice(0, 180), time: 'Ahora', level: 'medium', sample: false
  }, ...state.communityAlerts];
  persist('communityAlerts', community);
  state.photoData = null;
  openModal('Reporte guardado', `<p>Tu reporte se guardó correctamente en este dispositivo.</p><div class="info-strip"><span>🔒</span><span><b>Importante:</b> no se ha enviado a la Policía ni se ha compartido con otros usuarios. Para denunciar un hecho real, usa los canales oficiales.</span></div>`, `<button class="btn btn-primary" type="button" data-action="view-reports">Ver mis reportes</button>`);
}

let holdTimer = null;
let holdInterval = null;
let holdStartedAt = 0;
let holdCompleted = false;
let activeHoldButton = null;
const HOLD_DURATION = 2200;
function stopEmergencyHold() {
  clearTimeout(holdTimer);
  clearInterval(holdInterval);
  if (activeHoldButton && !holdCompleted) {
    activeHoldButton.style.setProperty('--hold-progress', '0%');
    const label = activeHoldButton.querySelector('.hold-label');
    if (label) label.textContent = 'Mantén presionado para activar';
  }
  holdTimer = null;
  holdInterval = null;
  activeHoldButton = null;
}
function beginEmergencyHold(button) {
  if (holdTimer || holdCompleted) return;
  activeHoldButton = button;
  holdStartedAt = Date.now();
  holdCompleted = false;
  const label = button.querySelector('.hold-label');
  if (label) label.textContent = 'Mantén…';
  holdInterval = setInterval(() => {
    const progress = Math.min(100, ((Date.now() - holdStartedAt) / HOLD_DURATION) * 100);
    button.style.setProperty('--hold-progress', `${progress}%`);
    if (label) label.textContent = `Activando ${Math.max(0, Math.ceil((HOLD_DURATION - (Date.now() - holdStartedAt)) / 1000))}…`;
  }, 50);
  holdTimer = setTimeout(() => {
    holdCompleted = true;
    clearInterval(holdInterval);
    button.style.setProperty('--hold-progress', '100%');
    activateEmergency();
    setTimeout(() => { holdCompleted = false; stopEmergencyHold(); }, 300);
  }, HOLD_DURATION);
}

async function activateEmergency() {
  // Mantener pulsado el SOS es una acción explícita para solicitar ubicación.
  // Si el permiso se deniega o el GPS falla, la alerta local igual queda registrada.
  if (!state.currentLocation) {
    try {
      const position = await getCurrentPosition();
      state.currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    } catch (error) {
      console.info('[SegurApp] Ubicación no disponible para la solicitud de ayuda:', error?.message);
    }
  }
  let locationText = 'Ubicación no compartida';
  if (state.currentLocation) locationText = `${state.currentLocation.latitude.toFixed(5)}, ${state.currentLocation.longitude.toFixed(5)}`;
  const record = { id: makeId(), createdAt: new Date().toISOString(), location: locationText, status: 'local' };
  persist('emergencyHistory', [...state.emergencyHistory, record]);
  openModal('Solicitud de ayuda registrada', `<div style="text-align:center;font-size:42px;margin:4px 0 12px">SOS</div><p>La solicitud quedó registrada en el historial de este dispositivo.</p><div class="info-strip"><span>i</span><span><b>Esta acción no contacta automáticamente a autoridades ni a tus contactos.</b> Ante una emergencia real, llama directamente al servicio correspondiente.</span></div><p>En Perú, la Policía Nacional atiende en el 105.</p>`, `<a class="btn btn-danger" href="tel:105">Llamar al 105</a><button class="btn btn-soft" type="button" data-action="view-my-alerts">Ver historial</button>`);
}

async function requestLocation(inputId = null) {
  try {
    showToast('Solicitando permiso de ubicación…');
    const position = await getCurrentPosition();
    state.currentLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy
    };
    if (inputId) {
      const input = document.querySelector(inputId);
      if (input) input.value = `GPS: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
    }
    if (leafletMap && window.L) {
      const point = [position.coords.latitude, position.coords.longitude];
      if (userLocationMarker) userLocationMarker.remove();
      userLocationMarker = window.L.marker(point, { icon: createMapIcon('current') })
        .addTo(leafletMap).bindPopup('<strong>Tu ubicación</strong><br>Disponible solo durante esta sesión.');
      leafletMap.setView(point, 16, { animate: true });
    }
    showToast('Ubicación obtenida. Solo se conserva en esta sesión.');
  } catch (error) {
    showToast(error.message || 'No se pudo acceder a la ubicación.');
  }
}

async function handlePhoto(file) {
  if (!file) return;
  try {
    showToast('Preparando imagen…');
    state.photoData = await compressImage(file);
    renderPhotoPreview();
    showToast('Imagen adjuntada. Se guardará con el reporte local.');
  } catch (error) {
    state.photoData = null;
    showToast(error.message || 'No se pudo adjuntar la imagen.');
  }
}
function renderPhotoPreview() {
  const holder = document.querySelector('#photo-preview');
  if (!holder) return;
  holder.innerHTML = state.photoData ? `<div class="upload-preview"><img src="${state.photoData}" alt="Vista previa de la imagen adjunta" /><span>Imagen preparada y comprimida.</span><button class="btn btn-quiet" type="button" data-action="remove-photo">Quitar</button></div>` : '';
}

function lumaReply(text) {
  const normalized = text.toLowerCase();
  if (normalized.includes('ubic') || normalized.includes('mapa')) return 'Puedes abrir el mapa de Trujillo desde la navegación. Los reportes con GPS se muestran solo en este dispositivo y no representan niveles oficiales de riesgo.';
  if (normalized.includes('robo') || normalized.includes('report')) return 'En “Reportar un robo” puedes describir el incidente y guardarlo en este dispositivo. El registro se conserva localmente y no se transmite a ninguna autoridad.';
  if (normalized.includes('emerg') || normalized.includes('peligro')) return 'Prioriza llegar a un lugar seguro y pedir ayuda directamente. En Perú, la Policía Nacional atiende en el 105. El botón de SegurApp registra la solicitud en este dispositivo; ante una emergencia real, llama directamente al 105.';
  if (normalized.includes('contact')) return 'En “Tu gente” puedes guardar números de personas de confianza. SegurApp no les envía alertas automáticas desde esta instalación.';
  if (normalized.includes('gracias')) return '¡Para eso estoy! 💜 Recuerda: tu intuición importa y no tienes que exponerte para ayudar.';
  return 'Puedo orientarte sobre el mapa, los reportes, los contactos de confianza o medidas de prevención. ¿Qué tema te interesa?';
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action], [data-go]');
  if (!target) return;
  if (target.dataset.go) { event.preventDefault(); go(target.dataset.go); return; }
  const action = target.dataset.action;
  switch (action) {
    case 'start': state.authMode = 'login'; state.screen = 'login'; render(); break;
    case 'story': storyModal(); break;
    case 'story-start': closeModal(); state.screen = 'login'; render(); break;
    case 'switch-auth': state.authMode = state.authMode === 'login' ? 'signup' : 'login'; render(); break;
    case 'forgot': openModal('Recuperar contraseña', '<p>La recuperación de contraseña requiere un servicio de autenticación conectado a una cuenta de correo. Puedes continuar con el acceso local disponible.</p>'); break;
    case 'social': openModal(`Continuar con ${escapeHTML(target.dataset.provider)}`, `<p>El inicio de sesión con ${escapeHTML(target.dataset.provider)} requiere configurar OAuth y credenciales del proveedor.</p><p>La autenticación con este proveedor requiere configurar las credenciales OAuth del proyecto. SegurApp no solicitará ni almacenará la contraseña de tu cuenta externa.</p>`, '<button class="btn btn-primary" type="button" data-action="close-modal">Entendido</button>'); break;
    case 'guest': closeModal(); startOnboarding(''); break;
    
    case 'skip-onboarding': finishOnboarding(state.profile?.name || state.pendingName || 'Usuaria SegurApp', state.profile?.phone || ''); break;
    case 'logout':
      persist('session', null); state.session = null; state.screen = 'welcome'; state.lumaOpen = false; state.modal = null; render(); break;
    case 'toggle-luma': state.lumaOpen = !state.lumaOpen; render(); break;
    case 'toggle-setting': {
      const key = target.dataset.setting;
      if (!['notifications', 'communityAlerts'].includes(key)) break;
      state.preferences = { ...state.preferences, [key]: !state.preferences[key] };
      storage.set('preferences', state.preferences); render(); break;
    }
    case 'filter-alerts': state.activeFilter = target.dataset.filter || 'all'; render(); break;
    
    case 'map-location': await requestLocation(); break;
    case 'report-location': await requestLocation('#report-reference'); break;
    case 'remove-photo': state.photoData = null; renderPhotoPreview(); break;
    case 'close-modal': closeModal(); break;
    case 'modal-backdrop': if (event.target === target) closeModal(); break;
    case 'view-reports': closeModal(); go('my-reports'); break;
    case 'view-my-alerts': closeModal(); go('my-alerts'); break;
    case 'delete-contact': {
      const contacts = state.contacts.filter((contact) => contact.id !== target.dataset.id);
      persist('contacts', contacts); render(); showToast('Contacto eliminado.'); break;
    }
    default: break;
  }
});

app.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const formData = new FormData(form);
  switch (form.dataset.form) {
    case 'login': {
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const password = String(formData.get('password') || '');
      if (!email || !password) { showToast('Completa tu correo y contraseña.'); return; }
      persist('session', { email, createdAt: new Date().toISOString(), local: true });
      if (state.profile) { state.screen = 'home'; render(); showToast('Sesión local iniciada.'); }
      else startOnboarding(email.split('@')[0]);
      break;
    }
    case 'signup': {
      const name = String(formData.get('name') || '').trim();
      const email = String(formData.get('email') || '').trim().toLowerCase();
      const password = String(formData.get('password') || '');
      if (password.length < 8) { showToast('Usa una contraseña de al menos 8 caracteres.'); return; }
      persist('session', { email, createdAt: new Date().toISOString(), local: true });
      state.pendingName = name;
      startOnboarding(name);
      break;
    }
    case 'onboarding': finishOnboarding(String(formData.get('name') || '').trim(), String(formData.get('phone') || '').trim()); break;
    case 'report': saveReport(formData); break;
    case 'contact': {
      const name = String(formData.get('name') || '').trim();
      const phone = String(formData.get('phone') || '').trim();
      if (!name || !phone) { showToast('Completa el nombre y teléfono.'); return; }
      persist('contacts', [...state.contacts, { id: makeId(), name, phone }]);
      render(); showToast('Contacto guardado en este dispositivo.'); break;
    }
    case 'luma': {
      const message = String(formData.get('message') || '').trim();
      if (!message) return;
      state.lumaMessages = [...state.lumaMessages, { role: 'user', text: message }, { role: 'assistant', text: lumaReply(message) }].slice(-16);
      render(); break;
    }
    default: break;
  }
});

function finishOnboarding(name, phone) {
  if (!name) { showToast('Escribe tu nombre para continuar.'); return; }
  const profile = { ...(state.profile || {}), name, phone, email: state.session?.email || state.profile?.email || '', createdAt: state.profile?.createdAt || new Date().toISOString() };
  persist('profile', profile);
  if (!state.session) persist('session', { local: true, createdAt: new Date().toISOString() });
  state.pendingName = '';
  state.screen = 'home';
  render();
  showToast(`¡Bienvenida, ${name.split(' ')[0]}!`);
}

app.addEventListener('change', (event) => {
  if (event.target.id === 'report-photo') handlePhoto(event.target.files?.[0]);
});

app.addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-action="emergency-hold"]');
  if (!button || event.button !== 0) return;
  event.preventDefault();
  try { button.setPointerCapture(event.pointerId); } catch { /* no disponible en WebView antiguo */ }
  beginEmergencyHold(button);
});
app.addEventListener('pointerup', (event) => {
  if (!activeHoldButton) return;
  if (!holdCompleted) stopEmergencyHold();
});
app.addEventListener('pointercancel', stopEmergencyHold);
app.addEventListener('lostpointercapture', stopEmergencyHold);
app.addEventListener('keydown', (event) => {
  const button = event.target.closest?.('[data-action="emergency-hold"]');
  if (!button || !['Enter', ' '].includes(event.key) || event.repeat) return;
  event.preventDefault(); beginEmergencyHold(button);
});
app.addEventListener('keyup', (event) => {
  if (event.target.closest?.('[data-action="emergency-hold"]') && ['Enter', ' '].includes(event.key) && !holdCompleted) stopEmergencyHold();
});

// Repara el estado inicial si el usuario vuelve con una sesión local almacenada.
if (state.session && state.profile) state.screen = 'home';
render();
