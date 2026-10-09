/* Azimuth Map service worker: офлайн-запуск застосунку й кеш переглянутих тайлів. */
'use strict';

var VERSION = '66e65be0e0b5';
var SHELL_CACHE = 'azimuth-shell-' + VERSION;
var TILE_CACHE = 'azimuth-tiles-v2';
var FONT_CACHE = 'azimuth-fonts-v1';
var TILE_MAX_ENTRIES = 3000;
var TILE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

var SHELL = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/apple-touch-icon.png',
    './icons/favicon-32.png'
];

var TILE_HOSTS = /(^|\.)(tile\.openstreetmap\.org|server\.arcgisonline\.com|visicom\.ua)$/;
var FONT_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com)$/;

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then(function (cache) { return cache.addAll(SHELL); })
            .then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) {
                // Старі кеші застосунку й тайлів (серед них могли бути тайли Visicom із написом).
                return (k.indexOf('azimuth-shell-') === 0 && k !== SHELL_CACHE)
                    || (k.indexOf('azimuth-tiles-') === 0 && k !== TILE_CACHE);
            }).map(function (k) { return caches.delete(k); }));
        }).then(function () { return self.clients.claim(); })
    );
});

// Застосунок просить прибрати тайли Visicom із написом про обмеження, щоб вони не лишались у кеші.
self.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'purge-visicom') return;
    event.waitUntil(caches.open(TILE_CACHE).then(function (cache) {
        return cache.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) { return /visicom\.ua/.test(k.url); })
                .map(function (k) { return cache.delete(k); }));
        });
    }));
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);

    if (url.origin === self.location.origin) {
        event.respondWith(networkFirst(req));
    } else if (TILE_HOSTS.test(url.hostname)) {
        event.respondWith(tile(req));
    } else if (FONT_HOSTS.test(url.hostname)) {
        event.respondWith(cacheFirst(req, FONT_CACHE));
    }
    // Усе інше (зокрема пошук Nominatim) іде напряму в мережу.
});

// Застосунок: спершу мережа, щоб оновлення приходили одразу; без мережі — збережена копія.
function networkFirst(req) {
    return fetch(req).then(function (res) {
        if (res.ok) {
            var copy = res.clone();
            caches.open(SHELL_CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
    }).catch(function () {
        return caches.match(req, { ignoreSearch: true }).then(function (hit) {
            return hit || caches.match('./index.html');
        });
    });
}

function cacheFirst(req, cacheName) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(req).then(function (hit) {
            if (hit) return hit;
            return fetch(req).then(function (res) {
                if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
                return res;
            });
        });
    });
}

// Тайли: беремо з кешу, якщо їм менше 7 днів; інакше оновлюємо з мережі.
// Без мережі віддаємо навіть застарілий тайл.
function tile(req) {
    return caches.open(TILE_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
            var fresh = hit && Date.now() - Number(hit.headers.get('x-sw-cached') || 0) < TILE_MAX_AGE;
            if (fresh) return hit;
            return fetch(req).then(function (res) {
                if (!res.ok) return hit || res;
                return stamp(res.clone()).then(function (stamped) {
                    return cache.put(req, stamped).then(function () { trim(cache); });
                }).then(function () { return res; }, function () { return res; });
            }).catch(function (err) {
                if (hit) return hit;
                throw err;
            });
        });
    });
}

function stamp(res) {
    return res.blob().then(function (body) {
        var headers = new Headers(res.headers);
        headers.set('x-sw-cached', String(Date.now()));
        return new Response(body, { status: res.status, statusText: res.statusText, headers: headers });
    });
}

var trimming = false;
function trim(cache) {
    if (trimming) return;
    trimming = true;
    cache.keys().then(function (keys) {
        var extra = keys.length - TILE_MAX_ENTRIES;
        if (extra <= 0) return;
        return Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); }));
    }).then(function () { trimming = false; }, function () { trimming = false; });
}
