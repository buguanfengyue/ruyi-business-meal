/**
 * Small client for the local API. Keep all network calls in one place so the
 * React UI can later switch from the mock service to an authorised production
 * endpoint without changing page components.
 */

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'ruyiToken';

let sessionToken = typeof localStorage === 'undefined' ? '' : localStorage.getItem(TOKEN_KEY) || '';

export function getToken() {
  return sessionToken;
}

export function setToken(token) {
  sessionToken = token || '';
  if (sessionToken) localStorage.setItem(TOKEN_KEY, sessionToken);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(sessionToken ? { authorization: `Bearer ${sessionToken}` } : {}),
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
export const getOrder = (id) => apiFetch(`/api/orders/${encodeURIComponent(id)}`);
export const payOrder = (id) => apiFetch(`/api/orders/${encodeURIComponent(id)}/pay`, { method: 'POST' });
export const cancelOrder = (id) => apiFetch(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
export const quoteCart = (items, couponId) => apiFetch('/api/cart/quote', {
  method: 'POST',
  body: JSON.stringify({ items, ...(couponId ? { couponId } : {}) }),
});
export const getCoupons = () => apiFetch('/api/coupons');
export const getAddresses = () => apiFetch('/api/addresses');
export const createAddress = (address) => apiFetch('/api/addresses', {
  method: 'POST',
  body: JSON.stringify(address),
});
export const deleteAddress = (id) => apiFetch(`/api/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
export const bindWechatPhone = (code) => apiFetch('/api/auth/phone', {
  method: 'POST',
  body: JSON.stringify({ code }),
});


export const giftCoupon = (id) => apiFetch(`/api/coupons/${encodeURIComponent(id)}/gift`, { method: 'POST' });
export const redeemCoupon = (code) => apiFetch('/api/coupons/redeem', {
  method: 'POST',
  body: JSON.stringify({ code }),
});
export const getMembership = () => apiFetch('/api/membership');
export const getPoints = () => apiFetch('/api/points');
export const getInvite = () => apiFetch('/api/invite');
export const getPartner = () => apiFetch('/api/partner');
export const withdrawPartner = () => apiFetch('/api/partner/withdraw', { method: 'POST' });
