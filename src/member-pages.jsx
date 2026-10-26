import React, {useEffect, useRef, useState} from 'react';
import {ChevronRight, Crown, Info, QrCode, ChevronDown, UserRound, BadgePercent} from 'lucide-react';
import {getMembership, bindWechatPhone, getPartner, withdrawPartner, getInvite, getCoupons, giftCoupon, redeemCoupon, getPoints, getOrders} from './api';
import {money, formatTime, formatDateTime, Header, Loading, Dialog} from './ui';

const LEVEL_COLORS=['#c9d1dc','#f3c64b','#8fd14f'];

/* ---------- 会员中心 ---------- */
/**
 * Swiper-like level carousel. Native overflow scrolling only reacts to touch
 * and trackpads, so the position is controlled here: pointer drag (mouse and
 * touch), wheel, keyboard and tapping a peeking side card all change `index`.
 */
function LevelCarousel({count,index,onChange,children}){
  const viewport=useRef();const drag=useRef(null);const wheelLock=useRef(0);const [dx,setDx]=useState(0);
  const go=i=>onChange(Math.max(0,Math.min(count-1,i)));
  const onPointerDown=e=>{drag.current={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false}};
  const onPointerMove=e=>{const d=drag.current;if(!d)return;const offset=e.clientX-d.x;if(!d.moved&&Math.abs(offset)>6){d.moved=true;viewport.current.setPointerCapture(d.id)}if(d.moved)setDx(offset)};
  const onPointerUp=()=>{const d=drag.current;drag.current=null;if(!d?.moved)return;const width=viewport.current.offsetWidth*0.88;if(Math.abs(dx)>width*0.18)go(index+(dx<0?1:-1));setDx(0)};
  // Swallow the click that ends a drag so it doesn't open "升级说明".
  const onClickCapture=e=>{if(dx!==0||drag.current?.moved){e.stopPropagation();e.preventDefault()}};
  const onWheel=e=>{const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:0;if(Math.abs(delta)<8||Date.now()-wheelLock.current<400)return;wheelLock.current=Date.now();go(index+(delta>0?1:-1))};
  const onKeyDown=e=>{if(e.key==='ArrowRight')go(index+1);if(e.key==='ArrowLeft')go(index-1)};
  return <div className="level-carousel">
    <div className="level-viewport" ref={viewport} tabIndex={0} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onClickCapture={onClickCapture} onWheel={onWheel} onKeyDown={onKeyDown}>
      <div className={'level-track'+(dx?' dragging':'')} style={{transform:`translateX(calc(${-index} * (88% + 12px) + 6% + ${dx}px))`}}>
        {React.Children.map(children,(child,i)=><div className={'level-slide'+(i===index?' active':'')} onClick={i!==index?(e=>{e.stopPropagation();go(i)}):undefined}>{child}</div>)}
      </div>
    </div>
    <div className="level-dots">{Array.from({length:count},(_,i)=><button key={i} className={i===index?'on':''} onClick={()=>go(i)} aria-label={`第${i+1}个等级`}/>)}</div>
  </div>;
}

export function MemberCenter({back,toast,refreshUser}){
  const [data,setData]=useState(null);const [index,setIndex]=useState(0);const [rule,setRule]=useState(null);const first=useRef(true);
  const load=()=>getMembership().then(d=>{setData(d);if(first.current){first.current=false;setIndex(Math.max(0,d.member.level-1))}}).catch(e=>toast(e.message));
  useEffect(()=>{load()},[]);
  if(!data)return <div className="page"><Header title="会员中心" onBack={()=>back('/me')}/><Loading/></div>;
  const {member,levels,phoneBound,pointsRule}=data;const level=levels[index];const reached=member.level>=level.level;
  // Mock mode only: the real app binds the phone through WeChat's getPhoneNumber button.
  const bindPhone=async()=>{try{await bindWechatPhone(`web-mock-${Date.now()}`);await load();refreshUser();toast('手机号已绑定')}catch(e){toast(e.message)}};
  const gap=level.minSpent-member.totalSpent;
  return <div className="page member-page"><Header title="会员中心" onBack={()=>back('/me')}/>
    <LevelCarousel count={levels.length} index={index} onChange={setIndex}>{levels.map((l,i)=><div key={l.level} className="level-card">
      <div className="level-name"><Crown size={26} color={LEVEL_COLORS[i]} fill={LEVEL_COLORS[i]}/><i>V{l.level}</i><b>{l.name}</b></div>
      <span className="level-state">{member.level===l.level?'当前等级':member.level>l.level?'已达到该等级':'未达到该等级'}</span>
      <div className="level-foot"><span>{member.level>=l.level?'已开通此VIP特权':'暂未开通此VIP特权'}</span><button onClick={()=>setRule(l)}>升级说明 <Info size={16}/></button></div>
    </div>)}</LevelCarousel>
    <section className="member-section"><h3>会员等级权益</h3><div className="benefit"><span className="benefit-badge">{level.discountText}</span><BadgePercent size={30} strokeWidth={1.4}/><b>会员价</b></div></section>
    <section className="member-section"><h3>开通会员</h3>
      {level.level===1?<p className="member-req">在「个人中心」{phoneBound?<span>已绑定手机号码</span>:<button className="link" onClick={bindPhone}>绑定手机号码</button>}</p>
        :<p className="member-req">累计消费满{level.minSpent}元{!reached&&<span>（已消费{money(member.totalSpent)}，还差{money(gap)}）</span>}{!phoneBound&&<span>，并在「个人中心」<button className="link" onClick={bindPhone}>绑定手机号码</button></span>}</p>}
      <button className="member-open" disabled>{reached?'已开通':'未满足开通条件'}</button>
    </section>
    <section className="member-section"><h2>会员说明</h2><p className="member-rules">{levels.map(l=><span key={l.level}>{l.rule}</span>)}<span>{pointsRule}</span></p></section>
    {rule&&<Dialog title={`${rule.name}升级说明`} onClose={()=>setRule(null)} actions={<button onClick={()=>setRule(null)}>知道了</button>}>{rule.rule}</Dialog>}
  </div>;
}

/* ---------- 共享合伙人 ---------- */
function InviteTable({invited,invalid,invalidLabel,emptyText='暂无数据'}){
  const [tab,setTab]=useState(0);const rows=tab===0?invited:invalid;
  return <><div className="seg"><button className={tab===0?'on':''} onClick={()=>setTab(0)}>已邀请 {invited.length} 人</button><button className={tab===1?'on':''} onClick={()=>setTab(1)}>{invalidLabel} {invalid.length} 人</button></div>
    <div className="fans-head"><b>全部粉丝</b><b>累计佣金</b><b>邀请时间</b></div>
    {rows.length?rows.map((r,i)=><div className="fans-row" key={i}><span>{r.nickname}</span><span>{money(r.commission)}</span><span>{formatTime(r.invitedAt)}</span></div>):<div className="fans-empty"><div>🗂️</div><p>{emptyText}</p></div>}</>;
}

export function Partner({back,navigate,toast}){
  const [data,setData]=useState(null);const [showRules,setShowRules]=useState(false);
  useEffect(()=>{getPartner().then(setData).catch(e=>toast(e.message))},[]);
  if(!data)return <div className="page"><Header title="共享合伙人" onBack={()=>back('/me')}/><Loading/></div>;
  const withdraw=async()=>{try{await withdrawPartner()}catch(e){toast(e.message)}};
  return <div className="page partner-page"><Header title="共享合伙人" onBack={()=>back('/me')}/>
    <div className="partner-rules">{data.rules}</div>
    <div className="partner-card"><span className="partner-avatar"><UserRound size={30}/></span><span className="partner-badge">共享合伙人</span><button onClick={()=>setShowRules(true)}>规则 <ChevronRight size={18}/></button></div>
    <div className="partner-money"><div><strong>{Number(data.withdrawable).toFixed(2)}</strong><span>可提现佣金 (元)</span></div><button className="outline" onClick={()=>navigate('/invite')}>邀请好友</button><button className="solid" onClick={withdraw}>提现</button></div>
    <div className="partner-stats"><div><b>{Number(data.totalIncome).toFixed(2)}</b><span>总收益(元)</span></div><div><b>{Number(data.pending).toFixed(2)}</b><span>待结算(元)</span></div><button onClick={()=>toast(data.totalIncome>0?'收入明细见下方粉丝列表':'暂无收入明细')}><b>查看</b><span>收入明细 ▸</span></button></div>
    <div className="partner-list"><InviteTable invited={data.invited} invalid={data.invalid} invalidLabel="失效"/></div>
    {showRules&&<Dialog title="共享合伙人规则" onClose={()=>setShowRules(false)} actions={<button onClick={()=>setShowRules(false)}>知道了</button>}>{data.rules}{data.commissionRate===0&&<p className="muted-note">佣金比例尚未配置，当前邀请好友消费暂不产生佣金。</p>}</Dialog>}
  </div>;
}

/* ---------- 推荐朋友 ---------- */
function RewardCoupon({reward}){return <div className="reward-coupon"><div className="reward-left"><strong><small>¥</small>{Number(reward.amount).toFixed(2)}</strong><span>满{money(reward.threshold)}可用</span></div><div className="reward-right"><b>{reward.title} × {reward.count}张</b><span>领取后{reward.validDays}天内有效</span></div></div>}

export function Invite({back,toast}){
  const [data,setData]=useState(null);
  useEffect(()=>{getInvite().then(setData).catch(e=>toast(e.message))},[]);
  // In the mini-program this button is <button open-type="share">; the web
  // replica copies the share link instead.
  const share=async()=>{const link=`${location.origin}/#/home?inviter=${encodeURIComponent(data.inviterId)}`;try{await navigator.clipboard.writeText(link);toast('邀请链接已复制，发送给好友即可')}catch{toast(link)}};
  return <div className="page invite-page"><Header title="推荐朋友" onBack={()=>back('/home')}/>
    <div className="invite-hero"><div className="invite-art">🧧💰🎁</div><div className="invite-call"><b>点击下方</b><strong>邀请好友</strong><span>↓</span></div></div>
    {!data?<Loading/>:<>
      <div className="invite-card"><button className="invite-btn" onClick={share}>邀请好友</button>
        <h3>新用户将获得</h3><RewardCoupon reward={data.newUserReward}/>
        <h3>每邀请 1 个用户可获得</h3><RewardCoupon reward={data.inviterReward}/></div>
      <div className="invite-card"><InviteTable invited={data.invited} invalid={data.invalid} invalidLabel="无效" emptyText="还没有邀请到好友"/></div>
    </>}
  </div>;
}

/* ---------- 券包 ---------- */
const COUPON_TABS=[['available','可使用'],['used','已使用'],['unavailable','不可用'],['gifted','已赠送']];

function CouponCard({coupon,onUse}){
  const [open,setOpen]=useState(false);
  return <div className={`wallet-coupon ${coupon.status}`}>
    <div className="wallet-top"><div><b>{coupon.title}</b><span>{formatDateTime(coupon.validFrom)} - {formatDateTime(coupon.validTo)}</span></div><div className="wallet-amount"><strong><small>¥</small>{Number(coupon.amount).toFixed(2)}</strong><span>满{money(coupon.threshold)}可用</span></div><i className="wallet-corner"><QrCode size={18}/></i></div>
    <div className="wallet-bottom"><button className="rule-toggle" onClick={()=>setOpen(o=>!o)}>使用规则 <ChevronDown size={16} style={{transform:open?'rotate(180deg)':''}}/></button>
      {coupon.status==='available'?<button className="use" onClick={onUse}>立即使用</button>:coupon.status==='gifted'?<span className="gift-code">{coupon.claimed?'好友已领取':`兑换码 ${coupon.giftCode}`}</span>:<span className="muted">{coupon.statusText}</span>}</div>
    {open&&<div className="wallet-rule">订单金额（会员价）满{money(coupon.threshold)}可用，每单限用一张，不与其他优惠券叠加。有效期至 {formatDateTime(coupon.validTo)}。</div>}
  </div>;
}

export function Coupons({back,navigate,toast,refreshUser}){
  const [tab,setTab]=useState('available');const [coupons,setCoupons]=useState(null);const [dialog,setDialog]=useState(null);const [code,setCode]=useState('');
  const load=()=>getCoupons().then(d=>setCoupons(d.coupons)).catch(e=>{toast(e.message);setCoupons([])});
  useEffect(()=>{load()},[]);
  const list=(coupons||[]).filter(c=>c.status===tab);const available=(coupons||[]).filter(c=>c.status==='available');
  const gift=async coupon=>{try{const d=await giftCoupon(coupon.id);await load();refreshUser();setDialog({type:'gifted',code:d.giftCode})}catch(e){toast(e.message)}};
  const startGift=()=>{if(!available.length){toast('没有可转赠的优惠券');return}setDialog({type:'pick'})};
  const redeem=async()=>{try{await redeemCoupon(code);setDialog(null);setCode('');await load();refreshUser();setTab('available');toast('兑换成功')}catch(e){toast(e.message)}};
  return <div className="page wallet-page"><Header title="券包" onBack={()=>back('/me')}/>
    <div className="seg wallet-tabs">{COUPON_TABS.map(([id,label])=><button key={id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {coupons===null?<Loading/>:list.length?<div className="wallet-list">{list.map(c=><CouponCard key={c.id} coupon={c} onUse={()=>navigate('/menu')}/>)}</div>:<div className="list-empty">暂无优惠券</div>}
    <div className="wallet-actions"><button className="outline" onClick={startGift}>转赠给好友</button><button className="solid" onClick={()=>setDialog({type:'redeem'})}>兑换码</button></div>
    {dialog?.type==='pick'&&<Dialog title="选择要转赠的优惠券" onClose={()=>setDialog(null)} actions={<button className="ghost" onClick={()=>setDialog(null)}>取消</button>}>{available.map(c=><button key={c.id} className="pick-coupon" onClick={()=>gift(c)}><b>{c.title}</b><span>满{money(c.threshold)}减{money(c.amount)} · 至{formatDateTime(c.validTo)}</span></button>)}</Dialog>}
    {dialog?.type==='gifted'&&<Dialog title="转赠成功" onClose={()=>setDialog(null)} actions={<button onClick={()=>{navigator.clipboard?.writeText(dialog.code).catch(()=>{});setDialog(null);toast('兑换码已复制')}}>复制兑换码</button>}>把兑换码发给好友，好友在「券包 → 兑换码」中输入即可领取：<div className="big-code">{dialog.code}</div></Dialog>}
    {dialog?.type==='redeem'&&<Dialog title="输入兑换码" onClose={()=>setDialog(null)} actions={<><button className="ghost" onClick={()=>setDialog(null)}>取消</button><button onClick={redeem}>兑换</button></>}><input className="code-input" autoFocus placeholder="请输入兑换码" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&redeem()}/></Dialog>}
  </div>;
}

/* ---------- 我的积分 / 我的预约 ---------- */
export function Points({back,navigate,toast}){
  const [data,setData]=useState(null);
  useEffect(()=>{getPoints().then(setData).catch(e=>toast(e.message))},[]);
  return <div className="page"><Header title="我的积分" onBack={()=>back('/me')}/>{!data?<Loading/>:<>
    <div className="points-hero"><span>当前积分</span><strong>{data.points}</strong><small>{data.rule}</small></div>
    <div className="checkout-card"><h3>积分明细</h3>{data.records.length?data.records.map(r=><button key={r.orderId} className="summary-row row-btn" onClick={()=>navigate(`/orders/${r.orderId}`)}><span>消费获得 · {formatTime(r.at)}</span><b className="price">+{r.points}</b></button>):<div className="list-empty">支付订单后即可获得积分</div>}</div>
  </>}</div>;
}

export function Bookings({back,navigate,toast}){
  const [orders,setOrders]=useState(null);
  useEffect(()=>{getOrders().then(d=>setOrders(d.orders.filter(o=>o.schedule&&o.schedule!=='立即取单'&&o.status!=='cancelled'))).catch(e=>{toast(e.message);setOrders([])})},[]);
  return <div className="page"><Header title="我的预约" onBack={()=>back('/me')}/>{orders===null?<Loading/>:orders.length?<div className="order-list">{orders.map(o=><button key={o.id} className="order-card" onClick={()=>navigate(`/orders/${o.id}`)}><div className="order-card-head"><b>预约 {o.schedule}</b><span className={`status-${o.status}`}>{o.statusText}</span></div><div className="order-card-items">{o.items.map(i=>`${i.name}×${i.quantity}`).join('、')}</div><div className="order-card-foot"><span>下单 {formatTime(o.createdAt)}</span><span>实付<b>{money(o.totals.total)}</b></span></div></button>)}</div>:<div className="empty"><div className="empty-icon">🗓</div><p>暂无预约，下单时可在“预约时间”中选择取餐时段</p><button onClick={()=>navigate('/menu')}>去点单</button></div>}</div>;
}
