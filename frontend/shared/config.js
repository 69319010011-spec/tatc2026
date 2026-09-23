// Where the frontend should send API requests.
//
// - On your own machine (localhost/127.0.0.1) it talks to the local backend.
// - Everywhere else (e.g. once this is deployed on Vercel) it talks to
//   PRODUCTION_API_BASE below — edit that one line after you deploy the
//   backend (Railway/Render/etc.) to point at its real URL.
(function () {
  const PRODUCTION_API_BASE = 'https://tatc2026-production.up.railway.app/api';

  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  window.API_BASE = isLocal ? 'http://localhost:4000/api' : PRODUCTION_API_BASE;
})();
