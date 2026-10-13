/**
 * Small client for the local API. Keep all network calls in one place so the
 * React UI can later switch from the mock service to an authorised production
 * endpoint without changing page components.
 */

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    const message = payload?.error?.message || `请求失败（${response.status}）`;
    const error = new Error(message);
    error.code = payload?.error?.code || 'API_ERROR';
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const getBootstrap = () => apiFetch('/api/bootstrap');
export const getProducts = (params = {}) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.q) query.set('q', params.q);
  const suffix = query.toString() ? `?${query}` : '';
  return apiFetch(`/api/products${suffix}`);
};
export const getMe = () => apiFetch('/api/me');
export const getOrders = (status) => apiFetch(`/api/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const quoteCart = (items) => apiFetch('/api/cart/quote', {
  method: 'POST',
  body: JSON.stringify({ items }),
});
export const registerSession = (nickname) => apiFetch('/api/session/register', {
  method: 'POST',
  body: JSON.stringify({ nickname }),
});
export const createOrder = (order) => apiFetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify(order),
});

export const getAuthConfig = () => apiFetch('/api/auth/config');
export const wechatLogin = (code) => apiFetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ code }),
});
export const bindWechatPhone = (code, token) => apiFetch('/api/auth/phone', {
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: JSON.stringify({ code }),
});

