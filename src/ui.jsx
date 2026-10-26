import React from 'react';
import {ChevronLeft} from 'lucide-react';

export const money=v=>`¥${Number(v||0).toFixed(2)}`;
export const maskPhone=p=>p?String(p).replace(/^(\d{3})\d{4}(\d{4})$/,'$1****$2'):'未绑定';
const pad=n=>String(n).padStart(2,'0');
export const formatTime=iso=>{const d=new Date(iso);return `${d.getMonth()+1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`};
export const formatDateTime=iso=>{const d=new Date(iso);return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`};

export function MiniProgramCapsule(){return <div className="capsule"><span>•••</span><i></i><span>−</span><i></i><span>◉</span></div>}
export function Header({title,onBack}){return <header className="topbar">{onBack?<button className="back" onClick={onBack} aria-label="返回"><ChevronLeft size={24}/></button>:<span/>}<h1>{title}</h1><MiniProgramCapsule/></header>}
export function Loading({text='加载中…'}){return <div className="loading-block">{text}</div>}
export function Dialog({title,children,actions,onClose}){return <div className="modal center-modal" onClick={onClose}><div className="dialog" onClick={e=>e.stopPropagation()}>{title&&<h3>{title}</h3>}<div className="dialog-body">{children}</div><div className="dialog-actions">{actions}</div></div></div>}
