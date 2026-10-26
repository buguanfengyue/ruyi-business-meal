import React, {useEffect, useState} from 'react';
import {CalendarDays, Clock, Search, X} from 'lucide-react';

/* ---------- global toast ---------- */
let toastListener = null;
export const toast = (message, type = 'success') => toastListener?.({message, type, id: Date.now()});
export const pending = (what = '该操作') => toast(`${what}：演示环境，接口待接入`, 'info');
export function ToastHost() {
  const [item, setItem] = useState(null);
  useEffect(() => {
    toastListener = setItem;
    return () => { toastListener = null; };
  }, []);
  useEffect(() => {
    if (!item) return undefined;
    const timer = setTimeout(() => setItem(null), 2200);
    return () => clearTimeout(timer);
  }, [item]);
  return item ? <div className={`toast ${item.type}`}>{item.message}</div> : null;
}

/* ---------- layout ---------- */
export const Card = ({title, sub, extra, children, tight, style, className = ''}) => (
  <div className={`ad-card ${tight ? 'tight' : ''} ${className}`} style={style}>
    {(title || extra) && <div className="ad-card-title">{title}{sub && <span className="sub">{sub}</span>}{extra && <span style={{marginLeft: 'auto', display: 'flex', gap: 10}}>{extra}</span>}</div>}
    {children}
  </div>
);
export const Section = ({children}) => <div className="ad-section">{children}</div>;
export const Row = ({children, style}) => <div className="ad-row" style={style}>{children}</div>;
export const Q = ({tip}) => <i className="qi" title={tip || '说明'}>?</i>;
export const Tip = ({children, inline}) => <div className={`tip ${inline ? 'inline' : ''}`}><span>{children}</span></div>;
export const Tag = ({children, color = ''}) => <span className={`tag ${color}`}>{children}</span>;
export const Empty = ({text = '- 暂无相关记录 -'}) => <div className="empty"><div className="art" />{text}</div>;

/* ---------- buttons ---------- */
export const Btn = ({type = 'default', size, round, children, onClick, disabled, style}) => (
  <button type="button" className={`btn ${type} ${size || ''} ${round ? 'round' : ''}`} onClick={onClick} disabled={disabled} style={style}>{children}</button>
);
export const Lnk = ({color = '', children, onClick}) => <button type="button" className={`lnk ${color}`} onClick={onClick}>{children}</button>;

/* ---------- inputs ---------- */
export const Input = ({w, suffix, value, onChange, defaultValue = '', ...rest}) => {
  const [inner, setInner] = useState(defaultValue ?? '');
  const controlled = value !== undefined;
  const input = <input className={`inp ${w ? `w-${w}` : ''}`} value={controlled ? value : inner} onChange={(e) => (controlled ? onChange?.(e.target.value) : setInner(e.target.value))} {...rest} />;
  return suffix ? <span className="inp-wrap">{input}<span className="suffix">{suffix}</span></span> : input;
};
export const SearchInput = (props) => <span className="inp-wrap"><Input {...props} /><Search size={14} className="suffix" style={{right: 10, position: 'absolute', color: '#c0c4cc'}} /></span>;
export const Addon = ({pre, post, ...rest}) => <span className="inp-addon">{pre && <span className="pre">{pre}</span>}<Input {...rest} />{post && <span className="post">{post}</span>}</span>;
export const TextArea = ({max, defaultValue = '', placeholder, rows = 3, style}) => {
  const [v, setV] = useState(defaultValue);
  return <div style={{position: 'relative', display: 'inline-block'}}><textarea className="ta" rows={rows} value={v} placeholder={placeholder} onChange={(e) => setV(max ? e.target.value.slice(0, max) : e.target.value)} style={style} />{max && <span className="ad-muted" style={{position: 'absolute', right: 8, bottom: 8}}>{v.length}/{max}</span>}</div>;
};
export const Select = ({options = [], placeholder, value, defaultValue, onChange, style}) => {
  const [inner, setInner] = useState(defaultValue ?? '');
  const v = value !== undefined ? value : inner;
  return (
    <select className="sel" value={v} style={style} onChange={(e) => { setInner(e.target.value); onChange?.(e.target.value); }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  );
};
export const DateRange = ({start = '', end = '', time, placeholder = ['开始日期', '结束日期'], sep = '至'}) => (
  <span className={`range ${time ? '' : 'date'}`}>
    {time === 'clock' ? <Clock size={14} /> : <CalendarDays size={14} />}
    <input defaultValue={start} placeholder={placeholder[0]} />
    <span>{sep}</span>
    <input defaultValue={end} placeholder={placeholder[1]} />
  </span>
);
export const DateTime = ({value}) => <span className="range"><Clock size={14} /><input defaultValue={value} style={{width: 150, textAlign: 'left'}} /></span>;
export const Switch = ({checked, defaultChecked = false, onChange, label, onLabel, offLabel, size}) => {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  const text = label ?? (onLabel || offLabel ? (on ? onLabel : offLabel) : null);
  return <span className={`sw ${on ? 'on' : ''} ${size || ''}`} onClick={() => { setInner(!on); onChange?.(!on); }}><i />{text}</span>;
};
export const Radios = ({options, value, defaultValue, onChange, disabled = []}) => {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? options[0]);
  const v = value !== undefined ? value : inner;
  return (
    <span style={{display: 'inline-flex', flexWrap: 'wrap', rowGap: 8}}>
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const dis = disabled.includes(val);
        return <span key={val} className={`rd ${v === val ? 'on' : ''} ${dis ? 'dis' : ''}`} onClick={() => { if (dis) return; setInner(val); onChange?.(val); }}><i />{label}</span>;
      })}
    </span>
  );
};
export const Check = ({checked, defaultChecked = false, onChange, children}) => {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked !== undefined ? checked : inner;
  return <span className={`ck ${on ? 'on' : ''}`} onClick={() => { setInner(!on); onChange?.(!on); }}><i />{children}</span>;
};
export const Upload = ({text = '上传图片', wide}) => <div className={`upload ${wide ? 'wide' : ''}`} onClick={() => pending('上传图片')}><span style={{fontSize: wide ? 22 : 26, lineHeight: 1}}>{wide ? '☁' : '+'}</span>{text}</div>;
export const Stepper = ({defaultValue = 0}) => {
  const [v, setV] = useState(defaultValue);
  return <span className="stepper"><button type="button" onClick={() => setV(Math.max(0, v - 1))}>−</button><input value={v} onChange={(e) => setV(Number(e.target.value) || 0)} /><button type="button" onClick={() => setV(v + 1)}>+</button></span>;
};

/* ---------- tabs ---------- */
export const Tabs = ({items, value, onChange, variant = 'bar', style}) => (
  <div className={`tabs-${variant}`} style={style}>
    {items.map((it) => {
      const key = typeof it === 'string' ? it : it.key;
      const label = typeof it === 'string' ? it : it.label;
      return <button type="button" key={key} className={value === key ? 'on' : ''} onClick={() => onChange(key)}>{label}</button>;
    })}
  </div>
);
export function useTab(initial) { return useState(initial); }
export const Quick = ({items, outline, defaultValue}) => {
  const [on, setOn] = useState(defaultValue ?? items[0]);
  return <span className={`quick ${outline ? 'outline' : ''}`}>{items.map((it) => <button type="button" key={it} className={on === it ? 'on' : ''} onClick={() => setOn(it)}>{it}</button>)}</span>;
};

/* ---------- form ---------- */
export const Form = ({children, narrow, style}) => <div className={`frm ${narrow ? 'narrow' : ''}`} style={style}>{children}</div>;
export const F = ({label, required, children, help, warn, q}) => (
  <div className="fr">
    <label>{required && <em>*</em>}{label}{q && <> <Q tip={q} /></>}</label>
    <div className="fv"><div className="line">{children}</div>{help && <div className="help">ⓘ {help}</div>}{warn && <div className="warn">{warn}</div>}</div>
  </div>
);
export const SaveBar = ({children, onSave, text = '保存'}) => <div className="frm-foot">{children}<Btn type="primary" size="lg" onClick={onSave || (() => pending(text))}>{text}</Btn></div>;

/* ---------- table ---------- */
export function Table({columns, data = [], selectable, empty = '暂无数据', bordered, grayHead, rowKey = 'id', minWidth, onSelect, loading}) {
  const [sel, setSelState] = useState([]);
  const setSel = (next) => { setSelState(next); onSelect?.(next); };
  const all = data.length > 0 && sel.length === data.length;
  return (
    <div className="tbl-wrap">
      <table className={`tbl ${bordered ? 'bordered' : ''} ${grayHead ? 'gray-head' : ''}`} style={{minWidth}}>
        <thead>
          <tr>
            {selectable && <th style={{width: 40}}><Check checked={all} onChange={() => setSel(all ? [] : data.map((r) => r[rowKey]))} /></th>}
            {columns.map((c) => (
              <th key={c.key || c.title} style={{width: c.width, minWidth: c.minWidth, textAlign: c.align, ...(c.fixed === 'right' ? {right: c.right || 0} : {})}} className={c.fixed === 'right' ? `fix-r ${c.right && !c.shadow ? 'no-shadow' : ''}` : c.fixed === 'left' ? 'fix-l' : ''}>
                {c.title}{c.q && <> <Q tip={c.q} /></>}{c.sort && <span className="sort"><span>▲</span><span>▼</span></span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && <tr><td className="tbl-empty" colSpan={columns.length + (selectable ? 1 : 0)}>{loading ? '加载中…' : empty}</td></tr>}
          {data.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {selectable && <td><Check checked={sel.includes(row[rowKey])} onChange={(on) => setSel(on ? [...sel, row[rowKey]] : sel.filter((k) => k !== row[rowKey]))} /></td>}
              {columns.map((c) => (
                <td key={c.key || c.title} style={{textAlign: c.align, ...(c.fixed === 'right' ? {right: c.right || 0} : {})}} className={c.fixed === 'right' ? `fix-r ${c.right && !c.shadow ? 'no-shadow' : ''}` : c.fixed === 'left' ? 'fix-l' : ''}>
                  {c.render ? c.render(row, i) : (row[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Pager({total = 0, size = 10, sizes, jumper, align = 'right', showTotal = true, page: pageProp, onChange, onSize}) {
  const [inner, setInner] = useState(1);
  const page = pageProp ?? inner;
  const setPage = (n) => { setInner(n); onChange?.(n); };
  const pages = Math.max(1, Math.ceil(total / size));
  const list = Array.from({length: Math.min(pages, 6)}, (_, i) => i + 1);
  return (
    <div className={`pager ${align}`}>
      {showTotal && <span>共 {total} 条</span>}
      {sizes && <select className="sel" value={size} onChange={(e) => onSize?.(Number(e.target.value))}>{[10, 15, 20, 50].map((n) => <option key={n} value={n}>{n}条/页</option>)}</select>}
      <button type="button" className="pg" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
      {list.map((n) => <button type="button" key={n} className={`pg ${n === page ? 'on' : ''}`} onClick={() => setPage(n)}>{n}</button>)}
      {pages > 6 && <><span>…</span><button type="button" className={`pg ${page === pages ? 'on' : ''}`} onClick={() => setPage(pages)}>{pages}</button></>}
      <button type="button" className="pg" disabled={page === pages} onClick={() => setPage(page + 1)}>›</button>
      {jumper && <span className="jump">前往<input defaultValue={page} />页</span>}
    </div>
  );
}

/* ---------- overlays ---------- */
export function Dialog({title, open, onClose, children, onOk, okText = '确定', width}) {
  if (!open) return null;
  return (
    <div className="dialog-mask" onClick={onClose}>
      <div className="dialog" style={{width}} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">{title}<button type="button" onClick={onClose}><X size={18} /></button></div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-foot"><Btn onClick={onClose}>取消</Btn><Btn type="primary" onClick={async () => { const keep = await (onOk || (() => pending(title)))(); if (keep !== false) onClose(); }}>{okText}</Btn></div>
      </div>
    </div>
  );
}
/** Hook for "button opens a simple form dialog" — returns [open(), element]. */
export function useFormDialog(title, fields, width) {
  const [open, setOpen] = useState(false);
  const el = (
    <Dialog title={title} open={open} onClose={() => setOpen(false)} width={width}>
      <Form narrow>{fields.map((f) => <F key={f.label} label={f.label} required={f.required}>{f.render ? f.render() : <Input w="m" placeholder={f.placeholder || `请输入${f.label}`} />}</F>)}</Form>
    </Dialog>
  );
  return [() => setOpen(true), el];
}

/* ---------- charts & stats ---------- */
export function Donut({data, size = 130, hole = 0.55}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2;
  const ri = r * hole;
  let angle = -Math.PI / 2;
  const arcs = (total ? data : data.map((d) => ({...d, value: 1}))).map((d) => {
    const sum = total || data.length;
    const a = (d.value / sum) * Math.PI * 2;
    const large = a > Math.PI ? 1 : 0;
    const p = (ang, rad) => [r + rad * Math.cos(ang), r + rad * Math.sin(ang)];
    const [x1, y1] = p(angle, r); const [x2, y2] = p(angle + a - 0.0001, r);
    const [x3, y3] = p(angle + a - 0.0001, ri); const [x4, y4] = p(angle, ri);
    angle += a;
    return <path key={d.label} d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 ${large} 0 ${x4},${y4} Z`} fill={d.color} stroke="#fff" strokeWidth="2" />;
  });
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{arcs}</svg>;
}
export const Legend = ({data, percent}) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  return <div className="legend">{data.map((d) => <span key={d.label}><i style={{background: d.color}} />{d.label} {percent ? `${total ? ((d.value / total) * 100).toFixed(2) : '0.00'}%` : d.value}</span>)}</div>;
};
export const Stat = ({k, v, d, q, more, white}) => <div className={`stat ${white ? 'white' : ''}`}><div className="k">{k}{q && <Q tip={q} />}{more && <span style={{marginLeft: 'auto'}}>›</span>}</div><div className="v">{v}</div>{d && <div className="d">{d}</div>}</div>;
export const KV = ({k, v}) => <div className="kv"><span className="k">{k}</span><span className="v">{v}</span></div>;
export const FeatureHead = ({icon: Icon, title, desc, toggle}) => (
  <div className="feat-head"><div className="feat-icon">{Icon && <Icon />}</div><div><b>{title}</b><span>{desc}</span></div>{toggle && <span style={{marginLeft: 'auto'}}><Switch defaultChecked /></span>}</div>
);

/* ---------- controlled date range & quick picks ---------- */
export const DateRangeInput = ({value, onChange}) => (
  <span className="range date">
    <CalendarDays size={14} />
    <input type="date" value={value.from} max={value.to} onChange={(e) => onChange({...value, from: e.target.value})} style={{width: 120}} />
    <span>至</span>
    <input type="date" value={value.to} min={value.from} onChange={(e) => onChange({...value, to: e.target.value})} style={{width: 120}} />
  </span>
);
export const QuickPick = ({items, active, onPick, outline}) => (
  <span className={`quick ${outline ? 'outline' : ''}`}>{items.map((it) => <button type="button" key={it} className={active === it ? 'on' : ''} onClick={() => onPick(it)}>{it}</button>)}</span>
);
export const ErrorBar = ({error, onRetry}) => (error ? <div className="tip" style={{background: '#fef0f0', borderColor: '#fde2e2', color: '#f56c6c'}}><span>{error.message}{onRetry && <> · <Lnk color="blue" onClick={onRetry}>重试</Lnk></>}</span></div> : null);

/* ---------- imperative confirm / prompt ---------- */
let confirmListener = null;
/** confirmBox({title, content, input: {placeholder, defaultValue}}) -> Promise<false | true | string> */
export const confirmBox = (opts) => new Promise((resolve) => confirmListener?.({...opts, resolve}));
export function ConfirmHost() {
  const [box, setBox] = useState(null);
  const [text, setText] = useState('');
  useEffect(() => { confirmListener = (b) => { setText(b.input?.defaultValue || ''); setBox(b); }; return () => { confirmListener = null; }; }, []);
  if (!box) return null;
  const close = (v) => { box.resolve(v); setBox(null); };
  return (
    <div className="dialog-mask" onClick={() => close(false)}>
      <div className="dialog" style={{width: 420}} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">{box.title || '提示'}<button type="button" onClick={() => close(false)}><X size={18} /></button></div>
        <div className="dialog-body" style={{fontSize: 14, color: '#606266'}}>
          {box.content}
          {box.input && <input className="inp" autoFocus style={{width: '100%', marginTop: 12}} placeholder={box.input.placeholder} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && close(text || true)} />}
        </div>
        <div className="dialog-foot"><Btn onClick={() => close(false)}>取消</Btn><Btn type={box.danger ? 'danger' : 'primary'} onClick={() => close(box.input ? (text || true) : true)}>{box.okText || '确定'}</Btn></div>
      </div>
    </div>
  );
}
