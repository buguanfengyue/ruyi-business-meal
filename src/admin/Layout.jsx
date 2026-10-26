import React, {useEffect, useRef, useState} from 'react';
import {ChevronDown, Menu as MenuIcon} from 'lucide-react';
import {MENU, findMenu} from './menu';
import {go} from './router';
import {STORE} from './mock';
import {pending, toast, Dialog, Form, F} from './ui';
import {api} from './api';

export const ALERT_KEY = 'ruyiAdminSoundAlert';

/** Short two-tone chime via Web Audio (no asset needed). */
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + i * 0.25 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.45);
    });
  } catch { /* audio unavailable */ }
}

/** Poll for orders waiting to be accepted; chime when the count grows. */
function useNewOrderAlert() {
  const [waiting, setWaiting] = useState(0);
  const last = useRef(null);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const data = await api.orders({tab: 'accept', pageSize: 1});
        if (stop) return;
        const n = data.tabCounts.accept;
        if (last.current !== null && n > last.current) {
          toast(`您有 ${n - last.current} 笔新订单待接单`);
          if (localStorage.getItem(ALERT_KEY) !== 'off') chime();
        }
        last.current = n;
        setWaiting(n);
      } catch { /* shown elsewhere */ }
    };
    check();
    const timer = setInterval(check, 15000);
    window.addEventListener('ruyi:orders-changed', check);
    return () => { stop = true; clearInterval(timer); window.removeEventListener('ruyi:orders-changed', check); };
  }, []);
  return waiting;
}

function SideItem({group, active, path, badge}) {
  const [hover, setHover] = useState(false);
  const Icon = group.icon;
  const open = () => go(group.path || group.children[0][1]);
  return (
    <div role="button" aria-label={group.label} className={`ad-nav-item ${active ? 'active' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={group.path ? open : undefined}>
      <Icon color={group.color && !active ? group.color : undefined} />
      {badge > 0 && <span className="ad-nav-badge">{badge > 99 ? '99+' : badge}</span>}
      {hover && !group.children && <span className="ad-tooltip">{group.label}</span>}
      {hover && group.children && (
        <div className="ad-flyout">
          {group.children.map(([label, p]) => <div key={p} className={p === path ? 'on' : ''} onClick={(e) => { e.stopPropagation(); setHover(false); go(p); }}>{label}</div>)}
        </div>
      )}
    </div>
  );
}

function WideMenu({path, activeKey}) {
  const [openKey, setOpenKey] = useState(activeKey);
  return MENU.map((group) => {
    const Icon = group.icon;
    return (
      <div key={group.key} className="ad-wide-group">
        <div className={`ad-wide-title ${group.key === activeKey ? 'active' : ''}`} onClick={() => (group.path ? go(group.path) : setOpenKey(openKey === group.key ? null : group.key))}>
          <Icon />{group.label}{group.children && <ChevronDown size={14} style={{marginLeft: 'auto', transform: openKey === group.key ? 'rotate(180deg)' : ''}} />}
        </div>
        {openKey === group.key && group.children?.map(([label, p]) => <div key={p} className={`ad-wide-sub ${p === path ? 'on' : ''}`} onClick={() => go(p)}>{label}</div>)}
      </div>
    );
  });
}

export default function Layout({path, crumbs, children, onLogout, user, demo}) {
  const [wide, setWide] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [storeName, setStoreName] = useState(STORE.name);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({current: '', next: '', again: ''});
  const waiting = useNewOrderAlert();
  useEffect(() => { api.settings().then((d) => setStoreName(d.settings.store.name)).catch(() => {}); }, []);
  const savePassword = async () => {
    if (pwd.next.length < 10) { toast('新密码至少 10 位', 'info'); return false; }
    if (pwd.next !== pwd.again) { toast('两次输入的新密码不一致', 'info'); return false; }
    try { await api.changePassword(pwd.current, pwd.next); toast('密码已修改'); setPwd({current: '', next: '', again: ''}); return true; } catch (e) { toast(e.message, 'info'); return false; }
  };
  const {group} = findMenu(path);
  return (
    <div className="ad-shell">
      <aside className={`ad-side ${wide ? 'wide' : ''}`}>
        {wide ? <WideMenu path={path} activeKey={group?.key} /> : MENU.map((g) => <SideItem key={g.key} group={g} path={path} active={g.key === group?.key} badge={g.key === 'order' ? waiting : 0} />)}
      </aside>
      <div className="ad-main">
        <header className="ad-head">
          <button type="button" className="ad-burger" onClick={() => setWide(!wide)} aria-label="展开菜单"><MenuIcon size={18} /></button>
          {crumbs.length > 0 && (
            <div className="ad-crumb">
              <b onClick={() => go('/index')}>首页</b>
              {crumbs.map((c, i) => <React.Fragment key={i}><span>/</span>{i === crumbs.length - 1 ? <i>{c}</i> : <b>{c}</b>}</React.Fragment>)}
            </div>
          )}
          {demo && <span className="ad-demo-tag" title="该功能后端尚未支持，页面为演示数据">演示数据</span>}
          {waiting > 0 && <span className="tag orange" style={{marginLeft: 12, cursor: 'pointer'}} onClick={() => go('/order/list?tab=accept')}>待接单 {waiting}</span>}
          <div className="ad-head-right">
            <span className="brand" onClick={() => go('/weChatPayBrand/index')}><span style={{color: '#c0c4cc'}}>◉</span>微信支付品牌</span>
            <span>{STORE.expire}到期<span className="ad-renew" onClick={() => pending('续费')}>续费</span></span>
            <span className="ad-store" onClick={() => setStoreOpen(!storeOpen)} onMouseLeave={() => setStoreOpen(false)}>
              {storeName}({STORE.branch})<ChevronDown size={14} />
              {storeOpen && (
                <div className="ad-store-menu">
                  <div onClick={() => go('/setting/storeSetting')}>门店信息</div>
                  <div onClick={() => pending('切换门店')}>切换门店</div>
                  <div style={{color: '#909399', cursor: 'default'}}>管理员：{user}</div>
                  <div onClick={() => setPwdOpen(true)}>修改密码</div>
                  <div onClick={onLogout}>退出登录</div>
                </div>
              )}
            </span>
          </div>
        </header>
        <main className="ad-body">{children}</main>
        <Dialog title="修改密码" open={pwdOpen} onClose={() => setPwdOpen(false)} onOk={savePassword} width={460}>
          <Form narrow>
            <F label="当前密码" required><input className="inp w-m" type="password" value={pwd.current} onChange={(e) => setPwd({...pwd, current: e.target.value})} /></F>
            <F label="新密码" required help="至少 10 位"><input className="inp w-m" type="password" value={pwd.next} onChange={(e) => setPwd({...pwd, next: e.target.value})} /></F>
            <F label="确认新密码" required><input className="inp w-m" type="password" value={pwd.again} onChange={(e) => setPwd({...pwd, again: e.target.value})} /></F>
          </Form>
        </Dialog>
      </div>
    </div>
  );
}
