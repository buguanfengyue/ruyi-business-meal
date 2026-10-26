import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ChevronRight, ChevronLeft, MapPin, Phone, Gift, Coins, Search, ShoppingBag, Minus, Plus, Home as HomeIcon, ClipboardList, UserRound, Ticket, UsersRound, X, ArrowLeft, MessageCircle, Crown, CalendarDays, Map, Trash2, Wallet, Construction} from 'lucide-react';
import {getBootstrap, getAuthConfig, getMe, wechatLogin, registerSession, quoteCart, createOrder, getOrders, getOrder, payOrder, cancelOrder, getCoupons, getAddresses, createAddress, deleteAddress, getToken, setToken} from './api';
import {money,maskPhone,formatTime,Header,Loading} from './ui';
import {MemberCenter,Partner,Invite,Coupons,Points,Bookings} from './member-pages';
import './styles.css';

const DEFAULT_PRODUCTS=[
 {id:'a',categoryId:'a',name:'38元A套餐：三荤三素+两主食',price:37.24,old:38,desc:'我们的服务目标：为白衣天使提供营养、健康、美味',emoji:'🍕'},
 {id:'b',categoryId:'a',name:'58元套餐：三荤三素+一汤+两主食',price:56.84,old:58,desc:'我们的服务目标：为白衣天使提供营养、健康、美味',emoji:'🍲'},
 {id:'c',categoryId:'a',name:'38元A套餐：三荤三素+两主食',price:37.24,old:38,desc:'我们的服务目标：为白衣天使提供营养、健康、美味',emoji:'🍖'},
 {id:'d',categoryId:'soup',name:'松茸鸡汤',price:27.44,old:28,desc:'每日现熬例汤，暖胃又营养',emoji:'🥣'}
];
const DEFAULT_CATEGORIES=[{id:'recommend',label:'推荐',emoji:''},{id:'a',label:'38元A套餐',emoji:'🍕'},{id:'soup',label:'例汤',emoji:'🍲'}];
const DEFAULT_STORE={name:'如一商务餐',distanceText:'距离 1743.2km',phone:'15805320100'};
const DEFAULT_USER={nickname:'未授权',phone:'15805320100',registered:false,balance:0,points:0,availableCoupons:2};
const SCHEDULES=['立即取单','11:30','12:00','12:30','17:30','18:00'];
const CART_KEY='ruyiCart';

// Placeholder pages for entries whose business rules are not defined yet.
const PLACEHOLDERS={
  wechat:{title:'老板微信',text:'扫码添加老板微信，咨询团餐、包月与发票事宜。',qr:true},
  mall:{title:'积分商城',text:'积分商城尚未上架商品，下单累计的积分会保留。'},
  recharge:{title:'余额充值',text:'充值需要接入微信支付商户号，本地 mock 环境不支持真实充值。'},
};

const normalizeProduct=p=>({...p,old:p.oldPrice??p.old,desc:p.description??p.desc});
const loadCart=()=>{try{return JSON.parse(localStorage.getItem(CART_KEY))||{}}catch{return {}}};

/* ---------- hash router ---------- */
const parseHash=()=>{const path=(location.hash.replace(/^#/,'')||'/home').split('?')[0];return {path,parts:path.split('/').filter(Boolean)}};
function useRouter(){
  const [route,setRoute]=useState(parseHash);
  const depth=useRef(0);
  useEffect(()=>{const on=()=>setRoute(parseHash());window.addEventListener('hashchange',on);return()=>window.removeEventListener('hashchange',on)},[]);
  const navigate=useCallback((path,{replace=false}={})=>{
    if(replace){history.replaceState(null,'',`#${path}`);setRoute(parseHash());return}
    depth.current+=1;location.hash=path;
  },[]);
  // Fall back to a parent route when the page was opened directly (no in-app history).
  const back=useCallback(fallback=>{if(depth.current>0){depth.current-=1;history.back()}else navigate(fallback,{replace:true})},[navigate]);
  return {route,navigate,back};
}

/* ---------- shared UI ---------- */
function Pill({children,className=''}){return <span className={'pill '+className}>{children}</span>}
function BottomNav({active,navigate}){return <nav className="bottom-nav">
  {[['home','首页',HomeIcon],['orders','订单',ClipboardList],['me','我的',UserRound]].map(([id,label,Icon])=><button key={id} className={active===id?'active':''} onClick={()=>active!==id&&navigate(`/${id}`,{replace:true})}><Icon size={24} strokeWidth={active===id?2.5:1.7}/><span>{label}</span></button>)}
</nav>}
function Toast({message}){return message?<div className="order-status">{message}</div>:null}

function AccountCard({user,onClick}){return <div className="account-card" onClick={onClick}><div className="avatar">{(user.registered?user.nickname:'未').slice(0,1)}</div><div className="account-main"><b>{user.registered?user.nickname:'未授权'}</b><span>{user.phone||'未绑定手机号'}</span></div><div className="metric"><b>{Number(user.balance||0).toFixed(2)}</b><span>余额</span></div><div className="metric"><b>{user.availableCoupons??0}</b><span>可用券</span></div></div>}

/* ---------- pages ---------- */
function Home({user,store,navigate,toast}){return <div className="page home-page"><div className="hero"><div className="hero-art"><div className="hero-glow"/><div className="hero-people">🍱🥗🍉</div><div className="hero-copy"><strong>如一</strong><span>商务餐</span></div></div><AccountCard user={user} onClick={()=>navigate('/me',{replace:true})}/></div><main className="home-content"><button className="delivery-card" onClick={()=>navigate('/menu')}><strong>外卖订餐</strong><small>delivery</small></button><div className="feature-grid"><button className="feature qr" onClick={()=>navigate('/info/wechat')}><div className="qr-code">▦</div><b>老板微信</b></button><button className="feature" onClick={()=>navigate('/invite')}><Gift size={34}/><b>推荐朋友</b><small>INVITE</small></button><a className="feature" href={`tel:${store.phone}`} onClick={()=>toast(`正在拨打 ${store.phone}`)}><Phone size={34}/><b>订餐电话</b><small>{store.phone}</small></a><button className="feature wide" onClick={()=>navigate('/partner')}><UsersRound size={32}/><b>共享股东</b><small>COUPON</small></button><button className="feature wide" onClick={()=>navigate('/info/mall')}><Coins size={32}/><b>积分商城</b><small>COUPON</small></button></div><div className="banner"><span>科技让美味</span><b>[随手可得]¹</b><div>🍕　🥗　🍷</div></div><div className="tech"><img src="/assets/ruyi-logo.png" alt=""/><span>餐帮提供技术支持 &gt;</span></div></main></div>}

function ProductCard({product,count,onAdd,onRemove,onOpen}){return <div className={"product-card"+(count>0?" has-count":"")}><button className="product-image" onClick={onOpen}><span>{product.emoji}</span><em>如一</em></button><div className="product-info" onClick={onOpen}><h3>{product.name}</h3><p>{product.desc}</p><div className="price-line"><strong>{money(product.price)}</strong>{product.old!=null&&<del>¥{product.old}</del>}</div></div><div className="counter">{count>0&&<button onClick={(e)=>{e.stopPropagation();onRemove()}}><Minus size={16}/></button>}{count>0&&<span>{count}</span>}<button onClick={(e)=>{e.stopPropagation();onAdd()}}><Plus size={20}/></button></div></div>}

function ProductDetail({product,count,onClose,onAdd,onRemove,toast}){return <div className="modal detail-modal"><div className="detail-sheet"><button className="detail-close" onClick={onClose}><ArrowLeft size={23}/></button><div className="detail-image">{product.emoji}<small>1/1</small></div><div className="detail-body"><h2>{product.name}</h2><p>{product.desc}</p><div className="detail-tabs"><b>商品详情</b><span>暂无详情</span></div></div><div className="detail-footer"><strong>{money(product.price)}</strong><div className="counter big">{count>0&&<button onClick={onRemove}><Minus/></button>}{count>0&&<span>{count}</span>}<button onClick={onAdd}><Plus/></button></div><button className="share" onClick={()=>toast('分享需在小程序内使用')}><MessageCircle size={19}/>分享</button><button className="add-detail" onClick={()=>{onAdd();onClose()}}>加入购物车</button></div></div></div>}

function Bag({products,cart,update,clear,onClose,onCheckout}){const items=products.filter(p=>cart[p.id]);const total=items.reduce((s,p)=>s+p.price*cart[p.id],0);return <div className="modal" onClick={onClose}><div className="bag-drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><b>已选{Object.values(cart).reduce((a,b)=>a+b,0)}件</b><button onClick={()=>{clear();onClose()}}><Trash2 size={16}/>清空购物车</button></div>{items.map(p=><div className="bag-item" key={p.id}><span className="bag-emoji">{p.emoji}</span><div><b>{p.name}</b><span>{money(p.price)}</span></div><div className="counter"><button onClick={()=>update(p.id,-1)}><Minus size={16}/></button><span>{cart[p.id]}</span><button onClick={()=>update(p.id,1)}><Plus size={18}/></button></div></div>)}<div className="drawer-total"><strong>{money(total)}</strong><button onClick={onCheckout}>去结账</button></div><button className="drawer-close" onClick={onClose}><X size={18}/></button></div></div>}

function RegisterDrawer({onRegister,onSkip}){
  const [nickname,setNickname]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');
  const submit=async()=>{const name=nickname.trim();if(!name){setErr('请输入昵称');return}setBusy(true);setErr('');try{await onRegister(name)}catch(e){setErr(e.message);setBusy(false)}};
  return <div className="modal" onClick={onSkip}><div className="register-drawer" onClick={e=>e.stopPropagation()}><div className="register-avatar">如一</div><h2>欢迎加入如一商务餐</h2><p>注册后可同步订单、积分和优惠券</p><label>昵称<span>*</span></label><input className="register-input" placeholder="请输入昵称" maxLength={30} value={nickname} onChange={e=>setNickname(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} autoFocus/>{err&&<div className="form-error">{err}</div>}<button className="quick-register" disabled={busy} onClick={submit}>{busy?'注册中…':'快速注册'}</button><button className="skip-register" onClick={onSkip}>暂时跳过</button></div></div>;
}

function FoodOrder({products,categories,store,cart,updateCart,clearCart,user,onRegister,navigate,back,toast}){
  const [cat,setCat]=useState('recommend');const [selected,setSelected]=useState(null);const [showBag,setShowBag]=useState(false);const [showRegister,setShowRegister]=useState(false);
  const [query,setQuery]=useState(null);const [showStore,setShowStore]=useState(false);
  const total=products.reduce((sum,p)=>sum+(cart[p.id]||0)*p.price,0);const count=Object.values(cart).reduce((a,b)=>a+b,0);
  const keyword=(query||'').trim();
  const list=keyword?products.filter(p=>`${p.name}${p.desc}`.includes(keyword)):products.filter(p=>cat==='recommend'||p.categoryId===cat);
  const title=keyword?`搜索“${keyword}”`:categories.find(c=>c.id===cat)?.label||'推荐';
  const goCheckout=()=>{setShowBag(false);if(!count)return;if(!user.registered){setShowRegister(true);return}navigate('/checkout')};
  return <div className="page order-page"><Header title="点单" onBack={()=>back('/home')}/>
    <div className="store-head"><div><b>{store.name}</b><span><MapPin size={14}/>{store.distanceText}</span></div><div className="store-actions"><Pill>配送</Pill><button className="link-btn" onClick={()=>setShowStore(s=>!s)}>门店信息{showStore?'⌃':'⌄'}</button></div></div>
    {showStore&&<div className="store-info"><div><span>门店电话</span><a href={`tel:${store.phone}`}><Phone size={13}/> 联系商家 {store.phone}</a></div><div><span>配送方式</span><b>商家配送</b></div><div><span>营业时间</span><b>10:00 - 20:00</b></div></div>}
    <div className="menu-layout"><aside>{query===null?<button className="search" onClick={()=>setQuery('')}><Search size={17}/>搜索</button>:<div className="search"><input value={query} placeholder="搜索" autoFocus onChange={e=>setQuery(e.target.value)} onBlur={()=>!query&&setQuery(null)}/></div>}{categories.map(c=><button key={c.id} className={!keyword&&cat===c.id?'selected':''} onClick={()=>{setQuery(null);setCat(c.id)}}>{c.emoji&&<span>{c.emoji}</span>}<b>{c.label}</b></button>)}</aside>
      <section className="products"><div className="section-title">{title}</div>{list.length?list.map(p=><ProductCard key={p.id} product={p} count={cart[p.id]||0} onAdd={()=>updateCart(p.id,1)} onRemove={()=>updateCart(p.id,-1)} onOpen={()=>setSelected(p)}/>):<div className="list-empty">没有找到相关商品</div>}</section></div>
    {count>0&&<div className="checkout-bar"><button className="bag-btn" onClick={()=>setShowBag(true)}><ShoppingBag size={22}/><span>购物袋</span><i>{count}</i></button><div><small>合计</small><strong>{money(total)}</strong></div><button className="checkout" onClick={goCheckout}>去结账</button></div>}
    {selected&&<ProductDetail product={selected} count={cart[selected.id]||0} onClose={()=>setSelected(null)} onAdd={()=>updateCart(selected.id,1)} onRemove={()=>updateCart(selected.id,-1)} toast={toast}/>}
    {showBag&&count>0&&<Bag products={products} cart={cart} update={updateCart} clear={clearCart} onClose={()=>setShowBag(false)} onCheckout={goCheckout}/>}
    {showRegister&&<RegisterDrawer onSkip={()=>setShowRegister(false)} onRegister={async name=>{await onRegister(name);setShowRegister(false);navigate('/checkout')}}/>}
  </div>;
}

function PickerSheet({title,options,value,onPick,onClose}){return <div className="modal" onClick={onClose}><div className="picker-sheet" onClick={e=>e.stopPropagation()}><div className="drawer-head"><b>{title}</b><button onClick={onClose}><X size={18}/></button></div>{options.map(o=><button key={o.value??'none'} className={'picker-option'+(o.value===value?' active':'')} disabled={o.disabled} onClick={()=>{onPick(o.value);onClose()}}><span>{o.label}</span>{o.hint&&<small>{o.hint}</small>}</button>)}</div></div>}

function Checkout({products,store,user,cart,clearCart,navigate,back,refreshUser,toast}){
  const cartItems=useMemo(()=>products.filter(p=>cart[p.id]).map(p=>({productId:p.id,quantity:cart[p.id]})),[products,cart]);
  const [quote,setQuote]=useState(null);const [quoteError,setQuoteError]=useState('');
  const [phone,setPhone]=useState(user.phone||'');const [schedule,setSchedule]=useState(SCHEDULES[0]);const [note,setNote]=useState('');
  const [coupons,setCoupons]=useState([]);const [couponId,setCouponId]=useState(null);
  const [addresses,setAddresses]=useState([]);const [addressId,setAddressId]=useState(null);
  const [picker,setPicker]=useState(null);const [submitting,setSubmitting]=useState(false);
  useEffect(()=>{getCoupons().then(d=>setCoupons(d.coupons.filter(c=>c.status==='available'))).catch(()=>{});getAddresses().then(d=>{setAddresses(d.addresses);if(d.addresses[0])setAddressId(d.addresses[0].id)}).catch(()=>{})},[]);
  useEffect(()=>{
    let cancelled=false;if(!cartItems.length)return;
    setQuote(null);setQuoteError('');
    quoteCart(cartItems,couponId).then(d=>{if(!cancelled)setQuote(d)}).catch(e=>{if(cancelled)return;if(couponId){setCouponId(null);toast(e.message)}else setQuoteError(e.message)});
    return()=>{cancelled=true};
  },[cartItems,couponId]);
  if(!cartItems.length)return <div className="page checkout-page"><Header title="确认订单" onBack={()=>back('/menu')}/><div className="empty"><div className="empty-icon">🛍</div><p>购物袋是空的</p><button onClick={()=>navigate('/menu',{replace:true})}>去点单</button></div></div>;
  // Coupon thresholds apply to the amount after the member discount.
  const subtotal=quote?quote.subtotal-quote.discount:cartItems.reduce((s,i)=>s+(products.find(p=>p.id===i.productId)?.price||0)*i.quantity,0);
  const address=addresses.find(a=>a.id===addressId);const coupon=coupons.find(c=>c.id===couponId);
  const usable=coupons.filter(c=>subtotal>=c.threshold);
  const submit=async()=>{
    if(!quote||submitting)return;
    if(!/^1\d{10}$/.test(phone)){toast('请填写有效的 11 位手机号');return}
    setSubmitting(true);
    try{
      const data=await createOrder({items:cartItems,customer:{phone,nickname:user.nickname},fulfillment:'delivery',schedule,note,couponId,addressId});
      clearCart();refreshUser();navigate(`/orders/${data.order.id}`,{replace:true});
    }catch(e){toast(`下单失败：${e.message}`);setSubmitting(false)}
  };
  return <div className="page checkout-page"><Header title="确认订单" onBack={()=>back('/menu')}/>
    <div className="delivery-tag">配送</div>
    <div className="checkout-card store-card"><b>{store.name}</b><span><MapPin size={15}/>{store.distanceText}</span><Map size={20}/></div>
    <div className="checkout-card">
      <label>收货地址</label><button className="row row-btn" onClick={()=>addresses.length?setPicker('address'):navigate('/addresses')}><b>{address?`${address.name} ${maskPhone(address.phone)}`:'选择收货地址'}</b><span>{address?address.detail:addresses.length?'':'去添加'}<ChevronRight size={16}/></span></button>
      <label>预留电话</label><div className="row"><input className="inline-input" inputMode="numeric" maxLength={11} value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))} placeholder="请输入手机号"/><span>{phone===user.phone?'自动填写':''}</span></div>
      <label>预约时间</label><button className="row row-btn" onClick={()=>setPicker('schedule')}><b>{schedule}</b><ChevronRight size={18}/></button>
      <label>订单备注</label><textarea className="note-input" maxLength={200} rows={2} placeholder="口味、餐具等特殊要求" value={note} onChange={e=>setNote(e.target.value)}/>
    </div>
    <div className="checkout-card"><h3>商品清单</h3>{(quote?.items||cartItems.map(i=>({...i,name:products.find(p=>p.id===i.productId)?.name,lineTotal:null}))).map(item=><div className="summary-row" key={item.productId}><span>{item.name} × {item.quantity}</span><b>{item.lineTotal==null?'—':money(item.lineTotal)}</b></div>)}
      <div className="summary-row muted"><span>会员优惠{quote?.memberName?`（${quote.memberName}）`:''}</span><b>-{money(quote?.discount)}</b></div>
      <button className="summary-row muted row-btn" onClick={()=>setPicker('coupon')}><span>使用券</span><span className={coupon?'coupon-on':''}>{coupon?`${coupon.title} -${money(coupon.amount)}`:usable.length?`${usable.length}张可用`:'无可用券'}　›</span></button>
    </div>
    {quoteError&&<div className="form-error center">金额获取失败：{quoteError}</div>}
    <div className="confirm-bar"><span>共计 <b>{quote?money(quote.total):'计算中…'}</b></span><button onClick={submit} disabled={!quote||submitting}>{submitting?'提交中…':!quote?'计算中…':'确认下单'}</button></div>
    {picker==='schedule'&&<PickerSheet title="预约时间" value={schedule} options={SCHEDULES.map(s=>({value:s,label:s}))} onPick={setSchedule} onClose={()=>setPicker(null)}/>}
    {picker==='coupon'&&<PickerSheet title="选择优惠券" value={couponId} options={[{value:null,label:'不使用优惠券'},...coupons.map(c=>({value:c.id,label:`${c.title}`,hint:subtotal>=c.threshold?`有效期至 ${c.validTo.slice(0,10)}`:`还差 ${money(c.threshold-subtotal)} 可用`,disabled:subtotal<c.threshold}))]} onPick={setCouponId} onClose={()=>setPicker(null)}/>}
    {picker==='address'&&<PickerSheet title="收货地址" value={addressId} options={[...addresses.map(a=>({value:a.id,label:`${a.name} ${maskPhone(a.phone)}`,hint:a.detail})),{value:'__new',label:'+ 新增地址'}]} onPick={v=>v==='__new'?navigate('/addresses'):setAddressId(v)} onClose={()=>setPicker(null)}/>}
  </div>;
}

function OrderTabs({active,setActive}){return <div className="order-tabs">{['点单','商城','会员','拼团','礼品卡'].map((x,i)=><button key={x} className={active===i?'active':''} onClick={()=>setActive(i)}>{x}</button>)}</div>}
function Orders({navigate}){
  const [active,setActive]=useState(0);const [orders,setOrders]=useState(null);const [err,setErr]=useState('');
  useEffect(()=>{getOrders().then(d=>setOrders(d.orders)).catch(e=>{setErr(e.message);setOrders([])})},[]);
  const list=active===0?orders:[];
  return <div className="page"><Header title="我的订单"/><OrderTabs active={active} setActive={setActive}/>
    {list===null?<Loading/>:list.length?<div className="order-list">{list.map(o=><button key={o.id} className="order-card" onClick={()=>navigate(`/orders/${o.id}`)}><div className="order-card-head"><b>如一商务餐</b><span className={`status-${o.status}`}>{o.statusText}</span></div><div className="order-card-items">{o.items.map(i=>`${i.name}×${i.quantity}`).join('、')}</div><div className="order-card-foot"><span>{formatTime(o.createdAt)}</span><span>共{o.items.reduce((s,i)=>s+i.quantity,0)}件 实付<b>{money(o.totals.total)}</b></span></div></button>)}</div>
    :<div className="empty"><div className="empty-icon">▤</div><p>{err||'您当前还没有订单'}</p><button onClick={()=>navigate('/menu')}>去点单</button></div>}
  </div>;
}

function OrderDetail({id,products,store,updateCart,navigate,back,toast,refreshUser}){
  const [order,setOrder]=useState(null);const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{getOrder(id).then(d=>setOrder(d.order)).catch(e=>setErr(e.message))},[id]);
  const act=async(fn,msg)=>{setBusy(true);try{const d=await fn(id);setOrder(d.order);refreshUser();toast(d.payment?'微信支付请在小程序内完成':msg)}catch(e){toast(e.message)}setBusy(false)};
  const reorder=()=>{order.items.forEach(i=>products.some(p=>p.id===i.productId)&&updateCart(i.productId,i.quantity));navigate('/menu')};
  if(err)return <div className="page"><Header title="订单详情" onBack={()=>back('/orders')}/><div className="empty"><p>{err}</p><button onClick={()=>navigate('/orders',{replace:true})}>返回订单列表</button></div></div>;
  if(!order)return <div className="page"><Header title="订单详情" onBack={()=>back('/orders')}/><Loading/></div>;
  return <div className="page checkout-page"><Header title="订单详情" onBack={()=>back('/orders')}/>
    <div className={`order-hero status-${order.status}`}><b>{order.statusText}</b><span>{order.status==='pending_payment'?'请尽快完成支付（本地为模拟支付）':order.status==='paid'?'商家正在备餐，请耐心等待':order.status==='cancelled'?'订单已取消，优惠券已退回':'感谢您的光临'}</span></div>
    <div className="checkout-card"><h3>如一商务餐</h3>{order.items.map(i=><div className="summary-row" key={i.productId}><span>{i.name} × {i.quantity}</span><b>{money(i.lineTotal)}</b></div>)}
      <div className="summary-row muted"><span>商品小计</span><b>{money(order.totals.subtotal)}</b></div>
      <div className="summary-row muted"><span>会员优惠</span><b>-{money(order.totals.discount)}</b></div>
      {order.coupon&&<div className="summary-row muted"><span>{order.coupon.title}</span><b>-{money(order.totals.couponDiscount)}</b></div>}
      <div className="summary-row"><span>实付</span><b className="price">{money(order.totals.total)}</b></div></div>
    <div className="checkout-card detail-list">
      <div><span>订单编号</span><b>{order.id}</b></div><div><span>下单时间</span><b>{formatTime(order.createdAt)}</b></div><div><span>配送方式</span><b>{order.fulfillment==='pickup'?'自取':'配送'}</b></div><div><span>预约时间</span><b>{order.schedule}</b></div><div><span>预留电话</span><b>{order.customer.phone}</b></div>{order.address&&<div><span>收货地址</span><b>{order.address.name} {order.address.detail}</b></div>}<div><span>订单备注</span><b>{order.note||'无'}</b></div>
    </div>
    <div className="confirm-bar detail-actions">
      <a className="contact-btn" href={`tel:${store.phone}`}><Phone size={16}/>联系商家</a>
      {['pending_payment','paid'].includes(order.status)&&<button className="ghost" disabled={busy} onClick={()=>act(cancelOrder,'订单已取消')}>取消订单</button>}
      {order.status==='pending_payment'?<button disabled={busy} onClick={()=>act(payOrder,'支付成功（模拟）')}>去支付 {money(order.totals.total)}</button>:<button onClick={reorder}>再来一单</button>}
    </div>
  </div>;
}

function Me({user,store,navigate,onRegister}){
  const [showRegister,setShowRegister]=useState(false);
  const rows=[['我的积分',`${user.points||0}分`,Coins,'/points'],['我的订单','',ClipboardList,'/orders'],['我的券包',user.availableCoupons?`${user.availableCoupons}张可用`:'',Ticket,'/coupons'],['我的预约','',CalendarDays,'/bookings'],['我的地址','',MapPin,'/addresses'],['我的分销','',UsersRound,'/partner']];
  return <div className="page me-page"><Header title="我的"/>
    <button className="profile" onClick={()=>!user.registered&&setShowRegister(true)}><div className="avatar big-avatar">{user.registered?user.nickname.slice(0,1):'未'}</div><div><h2>{user.registered?user.nickname:'未授权'}</h2><span>{maskPhone(user.phone)}</span></div>{!user.registered&&<em className="profile-hint">点击注册 ›</em>}</button>
    <button className="member" onClick={()=>navigate('/member')}><Crown size={19}/><b>{user.member?.name||'会员中心'}</b><span>查看详情　›</span></button>
    <div className="balance"><span>账户余额</span><strong>{Number(user.balance||0).toFixed(2)}</strong><button onClick={()=>navigate('/info/recharge')}>充值</button></div>
    <div className="me-list">{rows.map(([t,v,I,to])=><button key={t} onClick={()=>navigate(to)}><span><I size={19}/>{t}</span><span>{v}<ChevronRight size={18}/></span></button>)}<a className="me-contact" href={`tel:${store.phone}`}><span><Phone size={19}/>联系商家</span><span>{store.phone}<ChevronRight size={18}/></span></a></div>
    {showRegister&&<RegisterDrawer onSkip={()=>setShowRegister(false)} onRegister={async name=>{await onRegister(name);setShowRegister(false)}}/>}
  </div>;
}

function Addresses({back,toast}){
  const [list,setList]=useState(null);const [form,setForm]=useState(null);const [busy,setBusy]=useState(false);
  const load=()=>getAddresses().then(d=>setList(d.addresses)).catch(e=>{toast(e.message);setList([])});
  useEffect(()=>{load()},[]);
  const save=async()=>{setBusy(true);try{await createAddress(form);setForm(null);await load();toast('地址已保存')}catch(e){toast(e.message)}setBusy(false)};
  const remove=async id=>{try{await deleteAddress(id);await load()}catch(e){toast(e.message)}};
  return <div className="page"><Header title="我的地址" onBack={()=>back('/me')}/>
    {list===null?<Loading/>:<div className="address-list">{list.map(a=><div key={a.id} className="address-item"><div><b>{a.name}　{a.phone}</b><span>{a.detail}</span></div><button onClick={()=>remove(a.id)} aria-label="删除"><Trash2 size={18}/></button></div>)}{!list.length&&!form&&<div className="list-empty">还没有收货地址</div>}</div>}
    {form?<div className="checkout-card address-form"><input placeholder="联系人" maxLength={20} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input placeholder="手机号" inputMode="numeric" maxLength={11} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/\D/g,'')})}/><textarea placeholder="详细地址（楼栋、门牌号）" maxLength={100} rows={2} value={form.detail} onChange={e=>setForm({...form,detail:e.target.value})}/><div className="form-actions"><button className="ghost" onClick={()=>setForm(null)}>取消</button><button disabled={busy} onClick={save}>{busy?'保存中…':'保存'}</button></div></div>
    :<button className="primary-block" onClick={()=>setForm({name:'',phone:'',detail:''})}>+ 新增地址</button>}
  </div>;
}

function InfoPage({kind,back}){const info=PLACEHOLDERS[kind]||{title:'功能建设中',text:'该功能暂未开放。'};return <div className="page"><Header title={info.title} onBack={()=>back('/home')}/><div className="info-page">{info.qr?<div className="info-qr">▦</div>:<Construction size={56}/>}<h2>{info.title}</h2><p>{info.text}</p></div></div>}

/* ---------- app ---------- */
function App(){
  const {route,navigate,back}=useRouter();
  const [products,setProducts]=useState(DEFAULT_PRODUCTS);const [categories,setCategories]=useState(DEFAULT_CATEGORIES);const [store,setStore]=useState(DEFAULT_STORE);
  const [user,setUser]=useState(DEFAULT_USER);const [cart,setCart]=useState(loadCart);const [apiStatus,setApiStatus]=useState('loading');
  const [toastMsg,setToastMsg]=useState('');const toastTimer=useRef();
  const toast=useCallback(msg=>{setToastMsg(msg);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToastMsg(''),2200)},[]);

  useEffect(()=>{localStorage.setItem(CART_KEY,JSON.stringify(cart))},[cart]);
  const updateCart=useCallback((id,delta)=>setCart(c=>{const n={...c,[id]:Math.min(99,Math.max(0,(c[id]||0)+delta))};if(!n[id])delete n[id];return n}),[]);
  const clearCart=useCallback(()=>setCart({}),[]);
  const refreshUser=useCallback(()=>getMe().then(d=>setUser(d.user)).catch(()=>{}),[]);

  // Web replica has no wx.login; in mock mode exchange a throwaway dev code
  // for a server session so orders/coupons/addresses are scoped to it.
  useEffect(()=>{(async()=>{
    try{
      let me=getToken()?await getMe():null;
      if(!me?.authenticated){
        const {auth}=await getAuthConfig();
        if(auth.mock){const login=await wechatLogin(`web-dev-${Date.now()}`);setToken(login.session.token)}
        else setToken('');
      }
      const data=await getBootstrap();
      if(Array.isArray(data.products)&&data.products.length){const list=data.products.map(normalizeProduct);setProducts(list);setCart(c=>Object.fromEntries(Object.entries(c).filter(([id])=>list.some(p=>p.id===id))))}
      if(Array.isArray(data.categories)&&data.categories.length)setCategories(data.categories);
      if(data.store)setStore(data.store);
      if(data.user)setUser(data.user);
      setApiStatus('connected');
    }catch{setApiStatus('offline')}
  })()},[]);

  const onRegister=useCallback(async nickname=>{const d=await registerSession(nickname);setUser(d.user);toast('注册成功')},[toast]);
  const common={navigate,back,toast};
  const [section,param]=route.parts;
  let content;let tab=null;
  if(section==='menu')content=<FoodOrder {...common} products={products} categories={categories} store={store} cart={cart} updateCart={updateCart} clearCart={clearCart} user={user} onRegister={onRegister}/>;
  else if(section==='checkout')content=<Checkout {...common} products={products} store={store} user={user} cart={cart} clearCart={clearCart} refreshUser={refreshUser}/>;
  else if(section==='orders'&&param)content=<OrderDetail {...common} id={decodeURIComponent(param)} products={products} store={store} updateCart={updateCart} refreshUser={refreshUser}/>;
  else if(section==='orders'){content=<Orders key={route.path} {...common}/>;tab='orders'}
  else if(section==='me'){content=<Me {...common} user={user} store={store} onRegister={onRegister}/>;tab='me'}
  else if(section==='coupons')content=<Coupons {...common} refreshUser={refreshUser}/>;
  else if(section==='member')content=<MemberCenter {...common} refreshUser={refreshUser}/>;
  else if(section==='partner')content=<Partner {...common}/>;
  else if(section==='invite')content=<Invite {...common}/>;
  else if(section==='points')content=<Points {...common}/>;
  else if(section==='bookings')content=<Bookings {...common}/>;
  else if(section==='addresses')content=<Addresses {...common}/>;
  else if(section==='info')content=<InfoPage {...common} kind={param}/>;
  else{content=<Home {...common} user={user} store={store}/>;tab='home'}
  useEffect(()=>{window.scrollTo(0,0)},[route.path]);
  return <div className="app-shell">{content}{tab&&<BottomNav active={tab} navigate={navigate}/>}<Toast message={toastMsg}/>{apiStatus!=='connected'&&<div className="api-badge">本地 mock · API {apiStatus==='loading'?'连接中':'离线回退'}</div>}</div>;
}

createRoot(document.getElementById('root')).render(<App/>);
