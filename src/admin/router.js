import {useCallback, useEffect, useState} from 'react';

const parse = () => {
  const raw = location.hash.replace(/^#/, '') || '/index';
  const [path, qs = ''] = raw.split('?');
  return {path, query: Object.fromEntries(new URLSearchParams(qs))};
};

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const go = (path) => { location.hash = path; };
export const back = (fallback) => (history.length > 1 ? history.back() : go(fallback));
export const useNav = () => useCallback(go, []);
