import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:8787';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const boot = http.get(`${BASE}/api/bootstrap`);
  check(boot, { 'bootstrap 200': (r) => r.status === 200 });

  const products = http.get(`${BASE}/api/products`);
  check(products, { 'products 200': (r) => r.status === 200 });

  const one = http.get(`${BASE}/api/products?category=a`);
  check(one, { 'category 200': (r) => r.status === 200 });

  sleep(1 + Math.random() * 2);
}
