const CACHE_NAME = 'sm-dental-v2';

// Recursos de la App
const assets = ['/', '/manifest.json'];

// Instalar Service Worker y pre-cachear recursos básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        assets.map(url => {
          return fetch(url)
            .then(response => {
              if (response.ok) {
                return cache.put(url, response);
              }
            })
            .catch(err => console.log('Omitiendo pre-cacheo de:', url, err));
        })
      );
    })
  );
  self.skipWaiting();
});

// Limpieza de cachés antiguas al activar para forzar al iPhone a tirar código fresco
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antigua de la app:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de Red-Primero (Network-First) para asegurar que el celular siempre tenga el código más reciente
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Ignorar peticiones de API para que siempre vayan a internet directamente
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Guardar copia fresca en caché para modo offline
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // En caso de estar desconectado o de error de red, servir desde caché
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback a app shell si es una llamada HTML
          const acceptHeader = event.request.headers.get('accept');
          if (acceptHeader && acceptHeader.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});

// ESCUCHADOR DE NOTIFICACIONES PUSH (Para notificaciones directas al celular)
self.addEventListener('push', (event) => {
  let data = { 
    title: 'Clínica Dental San Miguel', 
    body: 'Tiene un próximo paciente en 20 minutos.' 
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { 
        title: 'Clínica Dental San Miguel', 
        body: event.data.text() 
      };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: data.vibrate || [200, 100, 200],
    data: data.data || { url: '/' },
    actions: [
      { action: 'open_url', title: 'Ver Agenda 📅' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ESCUCHADOR DE CLICS EN LA NOTIFICACIÓN
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Si la app ya está abierta, hacer foco en ella
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // De lo contrario, abrir la app en una nueva ventana/pestana
      if (clients.openWindow) {
        const urlToOpen = event.notification.data ? event.notification.data.url : '/';
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
