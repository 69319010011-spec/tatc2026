const API_BASE = window.API_BASE || 'http://localhost:4000/api';
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

function mediaUrl(imageUrl) {
  if (!imageUrl) return null;
  return /^https?:\/\//.test(imageUrl) ? imageUrl : `${API_ORIGIN}${imageUrl}`;
}

async function apiRequest(path, options = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const token = localStorage.getItem('admin_token');
  if (token && path.startsWith('/admin')) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiUpload(path, file, fieldName = 'image') {
  const formData = new FormData();
  formData.append(fieldName, file);
  const headers = {};
  const token = localStorage.getItem('admin_token');
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', body: formData, headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const api = {
  getMachine: (machineCode) => apiRequest(`/kiosk/machines/${machineCode}`),
  checkout: (payload) => apiRequest('/kiosk/checkout', { method: 'POST', body: JSON.stringify(payload) }),
  adminLogin: (username, password) =>
    apiRequest('/auth/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  adminMe: () => apiRequest('/admin/me'),
  adminChangePassword: (current_password, new_password) =>
    apiRequest('/admin/me/password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
  adminAdmins: () => apiRequest('/admin/admins'),
  adminCreateAdmin: (payload) => apiRequest('/admin/admins', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateAdmin: (id, payload) => apiRequest(`/admin/admins/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDashboard: () => apiRequest('/admin/dashboard'),
  adminSalesDaily: (days = 14) => apiRequest(`/admin/analytics/sales-daily?days=${days}`),
  adminTopProducts: (limit = 8) => apiRequest(`/admin/analytics/top-products?limit=${limit}`),
  adminSalesByCategory: () => apiRequest('/admin/analytics/sales-by-category'),
  adminProducts: () => apiRequest('/admin/products'),
  adminCreateProduct: (payload) => apiRequest('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateProduct: (id, payload) => apiRequest(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminDeleteProduct: (id) => apiRequest(`/admin/products/${id}`, { method: 'DELETE' }),
  adminUploadProductImage: (id, file) => apiUpload(`/admin/products/${id}/image`, file),
  adminCategories: () => apiRequest('/admin/categories'),
  adminMachines: () => apiRequest('/admin/machines'),
  adminCreateMachine: (payload) => apiRequest('/admin/machines', { method: 'POST', body: JSON.stringify(payload) }),
  adminUpdateMachine: (id, payload) => apiRequest(`/admin/machines/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminAddSlots: (machineId, count) => apiRequest(`/admin/machines/${machineId}/slots`, { method: 'POST', body: JSON.stringify({ count }) }),
  adminSlots: (machineId) => apiRequest(`/admin/machines/${machineId}/slots`),
  adminUpdateSlot: (slotId, payload) => apiRequest(`/admin/slots/${slotId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  adminRestock: (slotId, payload) => apiRequest(`/admin/slots/${slotId}/restock`, { method: 'POST', body: JSON.stringify(payload) }),
  adminAdjustStock: (slotId, delta) => apiRequest(`/admin/slots/${slotId}/adjust`, { method: 'POST', body: JSON.stringify({ delta }) }),
  adminOrders: (params = '') => apiRequest(`/admin/orders${params}`),
  adminAlerts: (status) => apiRequest(`/admin/alerts${status ? `?status=${status}` : ''}`),
  adminUpdateAlert: (id, status) => apiRequest(`/admin/alerts/${id}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  adminMaintenance: () => apiRequest('/admin/maintenance'),
  adminCreateMaintenance: (payload) => apiRequest('/admin/maintenance', { method: 'POST', body: JSON.stringify(payload) }),
  adminResolveMaintenance: (id) => apiRequest(`/admin/maintenance/${id}/resolve`, { method: 'PUT' }),
};
