// ============================================================
//  Pawportion – Runtime Configuration
//  Update BACKEND_URL after deploying the backend to Railway.
// ============================================================
const isNetlifyHost = window.location.hostname.endsWith('netlify.app');

window.BACKEND_URL = isNetlifyHost
	? 'https://pawportion-web-production.up.railway.app'
	: `${window.location.protocol}//${window.location.hostname}:5000`;
