import {useCallback, useEffect, useRef, useState} from 'react';

// Same-origin `/api` in development (Vite proxy). For a separately hosted
// admin, set VITE_API_BASE_URL and add that origin to ALLOWED_ORIGINS.
const BASE = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'ruyiAdminToken';
const USER_KEY = 'ruyiAdminUser';

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => localStorage.getItem(USER_KEY),
  set(token, username) { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, username); },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
};

let unauthorizedHandler = () => {};
export const onUnauthorized = (fn) => { unauthorizedHandler = fn; };

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

async function request(path, {method = 'GET', body, query, raw} = {}) {
  const token = session.token();
  let response;
  try {
    response = await fetch(`${BASE}${path}${qs(query)}`, {
      method,
      headers: {...(body ? {'content-type': 'application/json'} : {}), ...(token ? {authorization: `Bearer ${token}`} : {})},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('无法连接服务器，请确认 API 已启动', 0, 'NETWORK');
  }
  if (response.status === 401 && path !== '/api/admin/login') {
    session.clear();
    unauthorizedHandler();
    throw new ApiError('登录已失效，请重新登录', 401, 'ADMIN_AUTH_REQUIRED');
  }
  if (raw) {
    if (!response.ok) throw new ApiError(`请求失败（${response.status}）`, response.status);
    return response;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new ApiError(payload?.error?.message || `请求失败（${response.status}）`, response.status, payload?.error?.code);
  }
  return payload;
}

async function download(path, query, fallbackName) {
  const response = await request(path, {query, raw: true});
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const a = Object.assign(document.createElement('a'), {href: url, download: name});
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  login: (username, password) => request('/api/admin/login', {method: 'POST', body: {username, password}}),
  logout: () => request('/api/admin/logout', {method: 'POST'}),
  changePassword: (currentPassword, newPassword) => request('/api/admin/password', {method: 'POST', body: {currentPassword, newPassword}}),
  dashboard: (range) => request('/api/admin/dashboard', {query: range}),
  orders: (params) => request('/api/admin/orders', {query: params}),
  order: (id) => request(`/api/admin/orders/${encodeURIComponent(id)}`),
  orderAction: (id, action, body) => request(`/api/admin/orders/${encodeURIComponent(id)}/${action}`, {method: 'POST', body: body || {}}),
  exportOrders: (range) => download('/api/admin/orders/export.csv', range, 'orders.csv'),
  products: () => request('/api/admin/products'),
  saveProduct: (id, body) => (id ? request(`/api/admin/products/${encodeURIComponent(id)}`, {method: 'PUT', body}) : request('/api/admin/products', {method: 'POST', body})),
  deleteProduct: (id) => request(`/api/admin/products/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  categories: () => request('/api/admin/categories'),
  saveCategory: (id, body) => (id ? request(`/api/admin/categories/${encodeURIComponent(id)}`, {method: 'PUT', body}) : request('/api/admin/categories', {method: 'POST', body})),
  deleteCategory: (id) => request(`/api/admin/categories/${encodeURIComponent(id)}`, {method: 'DELETE'}),
  settings: () => request('/api/admin/settings'),
  saveSetting: (key, value) => request(`/api/admin/settings/${key}`, {method: 'PUT', body: {value}}),
  customers: (params) => request('/api/admin/customers', {query: params}),
  customer: (id) => request(`/api/admin/customers/${encodeURIComponent(id)}`),
  issueCoupons: (id, body) => request(`/api/admin/customers/${encodeURIComponent(id)}/coupons`, {method: 'POST', body}),
  audit: (page = 1) => request('/api/admin/audit', {query: {page, pageSize: 50}}),
  backup: () => request('/api/admin/backup', {method: 'POST'}),
  salesReport: (range) => request('/api/admin/reports/sales', {query: range}),
  dailyReport: (range) => request('/api/admin/reports/daily', {query: range}),
  couponSummary: () => request('/api/admin/coupons/summary'),
};

/** Load data with loading/error state; `reload()` refetches. */
export function useApi(loader, deps = []) {
  const [state, setState] = useState({data: null, loading: true, error: null});
  const seq = useRef(0);
  const load = useCallback(() => {
    const id = ++seq.current;
    setState((s) => ({...s, loading: true, error: null}));
    return loader().then(
      (data) => { if (id === seq.current) setState({data, loading: false, error: null}); return data; },
      (error) => { if (id === seq.current) setState((s) => ({...s, loading: false, error})); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return {...state, reload: load};
}

/* ---------- date helpers (store timezone is the browser's in local use) ---------- */
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function quickRange(label) {
  const now = new Date();
  const day = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return ymd(d); };
  switch (label) {
    case '今天': return {from: day(0), to: day(0)};
    case '昨天': return {from: day(-1), to: day(-1)};
    case '近7天': return {from: day(-6), to: day(0)};
    case '近1个月': return {from: day(-29), to: day(0)};
    case '近3个月': return {from: day(-89), to: day(0)};
    case '本周': { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return {from: ymd(d), to: day(0)}; }
    case '本月': return {from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(0)};
    case '上个月': return {from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0))};
    default: return {from: day(0), to: day(0)};
  }
}
export const fmtTime = (iso) => { if (!iso) return '-'; const d = new Date(iso); return `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
export const money = (v) => Number(v || 0).toFixed(2);
