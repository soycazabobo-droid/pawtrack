// ===========================
//   PAWTRACK - LÓGICA PRINCIPAL
// ===========================

// --- ESTADO GLOBAL ---
let map, routeLine, userMarker;
let tracking = false;
let watchId = null;
let routePoints = [];
let startTime = null;
let timerInterval = null;
let totalDistance = 0;
let selectedAvatar = '🐕';

// --- HISTORIAL (localStorage) ---
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('pawtrack_history') || '[]'); }
  catch { return []; }
}
function saveHistory(history) {
  localStorage.setItem('pawtrack_history', JSON.stringify(history));
}

// --- PERFIL ---
function loadProfile() {
  try { return JSON.parse(localStorage.getItem('pawtrack_profile') || 'null'); }
  catch { return null; }
}
function saveProfile(p) {
  localStorage.setItem('pawtrack_profile', JSON.stringify(p));
}

// --- INICIALIZAR MAPA ---
function initMap(lat = -12.046, lng = -77.043) {
  map = L.map('map', { zoomControl: false }).setView([lat, lng], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  routeLine = L.polyline([], {
    color: '#FF6B35',
    weight: 5,
    opacity: 0.85,
    lineJoin: 'round'
  }).addTo(map);
}

// --- MARCADOR DE PERRO ---
function createDogIcon() {
  const avatar = loadProfile()?.avatar || '🐕';
  return L.divIcon({
    html: `<div style="font-size:28px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.3))">${avatar}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    className: ''
  });
}

// --- CALCULAR DISTANCIA (Haversine) ---
function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lng) * Math.PI / 180;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

// --- FORMATO TIEMPO ---
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}

// --- INICIAR PASEO ---
function startWalk() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta GPS 😢');
    return;
  }

  tracking = true;
  routePoints = [];
  totalDistance = 0;
  startTime = Date.now();

  // UI changes
  document.getElementById('btn-start').classList.add('hidden');
  document.getElementById('btn-stop').classList.remove('hidden');
  document.getElementById('live-info').style.display = 'flex';
  document.getElementById('dog-status-badge').innerHTML = '<span class="dot active"></span> De paseo 🦮';

  // Reset mapa
  routeLine.setLatLngs([]);

  // Timer
  timerInterval = setInterval(() => {
    document.getElementById('stat-time').textContent = formatTime(Date.now() - startTime);
  }, 1000);

  // GPS watch
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      const point = { lat, lng };

      // Calcula distancia
      if (routePoints.length > 0) {
        totalDistance += haversine(routePoints[routePoints.length - 1], point);
        document.getElementById('stat-dist').textContent = totalDistance.toFixed(2) + ' km';
      }

      routePoints.push(point);

      // Actualiza línea
      const latlngs = routePoints.map(p => [p.lat, p.lng]);
      routeLine.setLatLngs(latlngs);
      map.panTo([lat, lng]);

      // Marcador
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      } else {
        userMarker = L.marker([lat, lng], { icon: createDogIcon() }).addTo(map);
      }
    },
    (err) => {
      console.warn('GPS error:', err.message);
      if (err.code === 1) alert('Necesitas activar el GPS / permiso de ubicación 📍');
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

// --- TERMINAR PASEO ---
function stopWalk() {
  tracking = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  clearInterval(timerInterval);

  const duration = Date.now() - startTime;
  const durationStr = formatTime(duration);
  const distStr = totalDistance.toFixed(2);

  // UI
  document.getElementById('btn-stop').classList.add('hidden');
  document.getElementById('btn-start').classList.remove('hidden');
  document.getElementById('live-info').style.display = 'none';
  document.getElementById('dog-status-badge').innerHTML = '<span class="dot idle"></span> En casa';

  // Guardar en historial
  if (routePoints.length > 1) {
    const history = loadHistory();
    history.unshift({
      date: new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }),
      distance: distStr,
      duration: durationStr,
      points: routePoints.length
    });
    saveHistory(history.slice(0, 20)); // máximo 20 paseos
    renderHistory();
  }

  // Mostrar resumen
  document.getElementById('sum-dist').textContent = distStr + ' km';
  document.getElementById('sum-time').textContent = durationStr;
  document.getElementById('sum-points').textContent = routePoints.length;
  document.getElementById('modal-summary').classList.remove('hidden');
}

// --- RENDERIZAR HISTORIAL ---
function renderHistory() {
  const list = document.getElementById('history-list');
  const history = loadHistory();

  if (history.length === 0) {
    list.innerHTML = `
      <div class="empty-history">
        <span>🌿</span>
        <p>Aún no hay paseos registrados</p>
      </div>`;
    return;
  }

  list.innerHTML = history.map((item, i) => `
    <div class="history-item">
      <div class="history-icon">🐾</div>
      <div class="history-data">
        <strong>Paseo del ${item.date}</strong>
        <span>⏱️ ${item.duration} &nbsp;·&nbsp; 📍 ${item.points} puntos GPS</span>
      </div>
      <div class="history-badge">📏 ${item.distance} km</div>
    </div>
  `).join('');
}

// --- PERFIL ---
function renderProfile() {
  const p = loadProfile();
  if (!p) return;
  document.getElementById('dog-name-display').textContent = p.name || 'Mi Perro';
  document.getElementById('dog-breed-display').textContent = p.breed || 'Agrega el perfil de tu perro';
  document.getElementById('dog-avatar-display').textContent = p.avatar || '🐕';
}

// --- AVATAR PICKER ---
document.querySelectorAll('.avatar-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedAvatar = opt.dataset.emoji;
  });
});

// --- GUARDAR PERFIL ---
document.getElementById('btn-save-profile').addEventListener('click', () => {
  const name  = document.getElementById('input-name').value.trim() || 'Mi Perro';
  const breed = document.getElementById('input-breed').value.trim() || 'Sin raza especificada';
  const profile = { name, breed, avatar: selectedAvatar };
  saveProfile(profile);
  renderProfile();
  document.getElementById('modal-profile').classList.add('hidden');
});

// --- ABRIR / CERRAR MODAL PERFIL ---
document.getElementById('btn-profile').addEventListener('click', openProfileModal);
document.getElementById('close-profile').addEventListener('click', () => {
  document.getElementById('modal-profile').classList.add('hidden');
});

function openProfileModal() {
  const p = loadProfile();
  if (p) {
    document.getElementById('input-name').value = p.name || '';
    document.getElementById('input-breed').value = p.breed || '';
    selectedAvatar = p.avatar || '🐕';
    document.querySelectorAll('.avatar-opt').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.emoji === selectedAvatar);
    });
  }
  document.getElementById('modal-profile').classList.remove('hidden');
}

// --- CERRAR MODAL RESUMEN ---
document.getElementById('btn-close-summary').addEventListener('click', () => {
  document.getElementById('modal-summary').classList.add('hidden');
});

// --- BOTONES PRINCIPALES ---
document.getElementById('btn-start').addEventListener('click', startWalk);
document.getElementById('btn-stop').addEventListener('click', stopWalk);

// --- BOTTOM NAV ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const page = btn.dataset.page;
    if (page === 'profile') openProfileModal();
  });
});

// --- SPLASH + ARRANQUE ---
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const splash = document.getElementById('splash');
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
      renderProfile();
      renderHistory();

      // Intenta obtener posición inicial para centrar el mapa
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => initMap(pos.coords.latitude, pos.coords.longitude),
          ()  => initMap() // fallback Lima
        );
      } else {
        initMap();
      }
    }, 600);
  }, 2200);
});
