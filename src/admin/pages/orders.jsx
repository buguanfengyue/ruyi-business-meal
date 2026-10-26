import React, {useState} from 'react';
import {Store} from 'lucide-react';
import {Card, Btn, Lnk, Input, Select, DateRange, Quick, Tabs, Table, Pager, Check, Switch, Tip, Tag, Q, Donut, Dialog, Form, F, Radios, DateRangeInput, QuickPick, ErrorBar, confirmBox, pending, toast} from '../ui';
import {api, useApi, quickRange, fmtTime, money} from '../api';
import {useEffect} from 'react';
import {ORDERS, USERS} from '../mock';
import {go} from '../router';

// Console tab label -> backend `tab` filter ('none' = feature we don't run).
const ORDER_TABS = [['全部', ''], ['待接单', 'accept'], ['支付成功', 'paid'], ['未支付', 'unpaid'], ['退款中', 'refunding'], ['退款成功', 'refunded'], ['已取消/撤单', 'cancelled'], ['待配送', 'delivery'], ['待骑手接单', 'none'], ['配送中', 'none'], ['配送完成', 'none'], ['未发货', 'none'], ['已发货', 'none'], ['部分结账', 'none'], ['待完成', 'todo']];
const TYPE_TEXT = {delivery: '外卖', pickup: '自取'};
const STATUS_TAG = {pending_payment: 'orange', paid: 'red', preparing: '', completed: 'gray', cancelled: 'gray'};

async function runAction(order, action, after) {
  try {
    if (action === 'cancel') {
      const reason = await confirmBox({title: '取消订单', content: order.paidAt ? `订单已支付 ¥${money(order.totals.total)}，取消后将原路退款。` : '确定取消该订单吗？', input: {placeholder: '取消原因（选填，顾客可见）'}, okText: '确定取消', danger: true});
      if (reason === false) return;
      const data = await api.orderAction(order.id, 'cancel', {reason: typeof reason === 'string' ? reason : ''});
      toast(data.order.refundStatus ? `已取消，${data.order.refundStatusText}` : '订单已取消');
    } else {
      const text = {accept: '已接单', complete: '已出餐完成', refund: '已重新发起退款'}[action];
      await api.orderAction(order.id, action);
      toast(text);
    }
    after?.();
    window.dispatchEvent(new Event('ruyi:orders-changed'));
  } catch (error) {
    toast(error.message, 'info');
  }
}

function OrderActions({order, after, detail}) {
  const s = order.status;
  return (
    <>
      {detail && <Lnk onClick={detail}>详情</Lnk>}
      {s === 'paid' && <Lnk onClick={() => runAction(order, 'accept', after)}>接单</Lnk>}
      {(s === 'paid' || s === 'preparing') && <Lnk color="blue" onClick={() => runAction(order, 'complete', after)}>出餐完成</Lnk>}
      {['pending_payment', 'paid', 'preparing'].includes(s) && <Lnk color="red" onClick={() => runAction(order, 'cancel', after)}>{order.paidAt ? '取消退款' : '取消'}</Lnk>}
      {['pending', 'failed'].includes(order.refundStatus) && <Lnk color="red" onClick={() => runAction(order, 'refund', after)}>重试退款</Lnk>}
    </>
  );
}

function OrderDetail({id, onClose, onChanged}) {
  const {data, reload} = useApi(() => (id ? api.order(id) : Promise.resolve(null)), [id]);
  const o = data?.order;
  const after = () => { reload(); onChanged(); };
  return (
    <Dialog title="订单详情" open={Boolean(id)} onClose={onClose} okText="关闭" onOk={() => {}} width={680}>
      {!o ? <div className="empty" style={{padding: 30}}>加载中…</div> : (
        <Form narrow>
          <F label="订单号">{o.id}<span className="ad-muted">取餐号 {o.pickupNo}</span></F>
          <F label="订单状态"><Tag color={STATUS_TAG[o.status]}>{o.statusText}</Tag>{o.refundStatusText && <Tag color="red">{o.refundStatusText}</Tag>}<span style={{marginLeft: 'auto'}}><OrderActions order={o} after={after} /></span></F>
          <F label="顾客">{o.customer.nickname || '-'} · {o.customer.phone || '-'}</F>
          <F label="配送方式">{TYPE_TEXT[o.fulfillment] || o.fulfillment} · 预约 {o.schedule}</F>
          {o.address && <F label="收货地址">{o.address.name} {o.address.phone} {o.address.detail}</F>}
          <F label="备注">{o.note || '无'}</F>
          <F label="商品"><div style={{width: '100%'}}>{o.items.map((i) => <div key={i.productId} style={{display: 'flex', justifyContent: 'space-between', padding: '3px 0'}}><span>{i.name} × {i.quantity}</span><span>¥{money(i.lineTotal)}</span></div>)}</div></F>
          <F label="金额">原价 ¥{money(o.totals.subtotal)} − 会员优惠 ¥{money(o.totals.discount)}{o.coupon ? ` − ${o.coupon.title} ¥${money(o.totals.couponDiscount)}` : ''} = <b style={{color: '#f56c6c'}}>实付 ¥{money(o.totals.total)}</b></F>
          <F label="支付">{o.paymentMethod === 'wechat' ? '微信支付' : o.paymentMethod === 'mock' ? '模拟支付（测试）' : '未支付'}{o.transactionId && <span className="ad-muted">交易号 {o.transactionId}</span>}</F>
          <F label="时间"><div style={{fontSize: 12, lineHeight: 1.9}}>下单 {fmtTime(o.createdAt)}{o.paidAt && <><br />支付 {fmtTime(o.paidAt)}</>}{o.acceptedAt && <><br />接单 {fmtTime(o.acceptedAt)}</>}{o.completedAt && <><br />完成 {fmtTime(o.completedAt)}</>}{o.cancelledAt && <><br />取消 {fmtTime(o.cancelledAt)}（{o.cancelReason}）</>}</div></F>
          {data.paymentEvents.length > 0 && <F label="支付记录"><div style={{fontSize: 12, lineHeight: 1.9}}>{data.paymentEvents.map((e, i) => <div key={i}>{fmtTime(e.at)} · {e.kind}</div>)}</div></F>}
        </Form>
      )}
    </Dialog>
  );
}

export function OrderList({query}) {
  const initialTab = ORDER_TABS.find(([, k]) => k === query.tab)?.[0] || '全部';
  const [tab, setTab] = useState(initialTab);
  // Coming from the 待接单 badge or a customer's history: look further back.
  const initialLabel = query.tab || query.q ? '近3个月' : '近7天';
  const [label, setLabel] = useState(initialLabel);
  const [range, setRange] = useState(quickRange(initialLabel));
  const [q, setQ] = useState(query.q || '');
  const [filters, setFilters] = useState({...quickRange(initialLabel), q: query.q || ''});
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [auto, setAuto] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [detail, setDetail] = useState(null);
  const tabKey = ORDER_TABS.find(([l]) => l === tab)[1];
  const {data, loading, error, reload} = useApi(() => api.orders({...filters, tab: tabKey, page, pageSize: size}), [filters, tabKey, page, size]);
  useEffect(() => { if (!auto) return undefined; const t = setInterval(reload, 10000); return () => clearInterval(t); }, [auto, reload]);
  const search = () => { setPage(1); setFilters({...range, q}); };
  const sum = data?.summary || {};
  const counts = data?.tabCounts || {};
  return (
    <Card>
      <div className="ad-card-title">订单列表<span style={{marginLeft: 'auto'}}><Btn size="sm" round onClick={reload}><Store size={14} /></Btn></span></div>
      <ErrorBar error={error} onRetry={reload} />
      <div className="ad-row"><label className="l">订单号</label><Input w="m" placeholder="输入订单编号/取单号/商品名/手机号" value={q} onChange={setQ} onKeyDown={(e) => e.key === 'Enter' && search()} /><label className="l" style={{marginLeft: 24}}>下单时间</label><DateRangeInput value={range} onChange={(r) => { setRange(r); setLabel(''); }} /><QuickPick items={['今天', '昨天', '近7天', '近1个月', '近3个月', '本月', '上个月']} active={label} onPick={(l) => { setLabel(l); const r = quickRange(l); setRange(r); setPage(1); setFilters({...r, q}); }} /></div>
      <div className="ad-row"><label className="l">分销员ID</label><Input placeholder="输入分销员id" /><Btn type="primary" onClick={search} style={{marginLeft: 12, width: 96}}>查询</Btn><Btn onClick={() => api.exportOrders({from: filters.from, to: filters.to}).then(() => toast('已开始下载')).catch((e) => toast(e.message, 'info'))}>导出</Btn><Btn onClick={() => go('/worker/list?log=1')}>导出记录</Btn></div>
      {advanced && <div className="ad-gray" style={{fontSize: 13, color: '#606266'}}>订单号、取餐号、商品名、顾客昵称和手机号都可以在上方“订单号”输入框中搜索；按状态筛选请使用下方标签。</div>}
      <div className="ad-row" style={{borderTop: '1px solid #ebeef5', paddingTop: 14}}>
        <Btn type="plain" size="sm" onClick={() => setAdvanced(!advanced)}>高级筛选 {advanced ? '▴' : '▾'}</Btn><Check checked={auto} onChange={setAuto}>自动刷新</Check><Check>显示取单二维码 <Q /></Check><Tip inline>新订单会在后台自动提醒（声音 + 左侧红点），可在 配置管理 → 订单提醒 中关闭声音</Tip>
      </div>
      <div style={{display: 'flex', gap: 60, margin: '6px 0 18px'}}>
        <div className="kv"><span className="k">总订单数 ›</span><span className="v">{sum.orders ?? 0}</span></div>
        <div className="kv"><span className="k">已支付金额</span><span className="v">{money(sum.paid)}</span></div>
        <div className="kv"><span className="k">未支付金额 <Q tip="待支付订单金额，超时未支付会自动取消" /></span><span className="v">{money(sum.unpaid)}</span></div>
        <div className="kv"><span className="k">退款金额</span><span className="v">{money(sum.refund)}</span></div>
      </div>
      <Tabs items={ORDER_TABS.map(([l, k]) => ({key: l, label: k && k !== 'none' && counts[k] ? `${l}(${counts[k]})` : l}))} value={tab} onChange={(t) => { setTab(t); setPage(1); }} />
      <Table loading={loading} minWidth={1250} empty={tabKey === 'none' ? '本系统暂未开通该配送方式' : '暂无数据'} columns={[
        {title: '商品', key: 'items', minWidth: 230, render: (o) => o.items.map((i) => <div key={i.productId} style={{color: '#303133'}}>{i.name}</div>)},
        {title: '单价(元) / 数量', key: 'q', render: (o) => o.items.map((i) => <div key={i.productId}>{money(i.unitPrice)} × {i.quantity}</div>)},
        {title: '取单号', key: 'pickupNo'}, {title: '桌码', key: 'table', render: () => '-'},
        {title: '支付总额', key: 'total', render: (o) => <b style={{color: '#303133'}}>{money(o.totals.total)}</b>},
        {title: '优惠', key: 'discount', render: (o) => money(o.totals.discount + o.totals.couponDiscount)},
        {title: '信息', key: 'info', minWidth: 170, render: (o) => <><div>{o.customer.nickname || '-'} {o.customer.phone}</div><div className="ad-muted">{fmtTime(o.createdAt)}</div><div className="ad-muted">预约 {o.schedule}{o.note ? ` · ${o.note}` : ''}</div></>},
        {title: '上级分销员', key: 'p', render: () => '无'}, {title: '类型', key: 'type', render: (o) => <Tag>{TYPE_TEXT[o.fulfillment] || o.fulfillment}</Tag>},
        {title: '来源', key: 'source', q: '订单来源', render: () => '小程序'},
        {title: '订单状态', key: 'status', render: (o) => <><Tag color={STATUS_TAG[o.status]}>{o.statusText}</Tag>{o.refundStatusText && <div><Tag color="red">{o.refundStatusText}</Tag></div>}</>},
        {title: '操作', key: 'op', fixed: 'right', minWidth: 170, render: (o) => <OrderActions order={o} after={reload} detail={() => setDetail(o.id)} />},
      ]} data={data?.orders || []} />
      <Pager total={data?.total || 0} page={page} size={size} sizes onChange={setPage} onSize={(n) => { setSize(n); setPage(1); }} align="left" />
      <OrderDetail id={detail} onClose={() => setDetail(null)} onChanged={reload} />
    </Card>
  );
}

function CouponDialog({targets, onClose, onDone}) {
  const [form, setForm] = useState({title: '老客回馈券', amount: '5', threshold: '30', validDays: '7', count: '1'});
  const set = (k) => (v) => setForm({...form, [k]: v});
  const submit = async () => {
    try {
      for (const id of targets) await api.issueCoupons(id, {...form, amount: Number(form.amount), threshold: Number(form.threshold), validDays: Number(form.validDays), count: Number(form.count)});
      toast(`已向 ${targets.length} 位顾客发券`);
      onDone?.();
      return true;
    } catch (e) { toast(e.message, 'info'); return false; }
  };
  return (
    <Dialog title={`赠送优惠券（${targets.length} 人）`} open={targets.length > 0} onClose={onClose} onOk={submit} width={480}>
      <Form narrow>
        <F label="券名称" required><Input w="m" value={form.title} onChange={set('title')} /></F>
        <F label="使用门槛"><span>满</span><Input w="xs" value={form.threshold} onChange={set('threshold')} /><span>元减</span><Input w="xs" value={form.amount} onChange={set('amount')} /><span>元</span></F>
        <F label="有效期"><span>发放后</span><Input w="xs" value={form.validDays} onChange={set('validDays')} /><span>天内有效</span></F>
        <F label="每人张数"><Input w="xs" value={form.count} onChange={set('count')} /></F>
      </Form>
    </Dialog>
  );
}

function CustomerDrawer({id, onClose, onCoupon}) {
  const {data} = useApi(() => (id ? api.customer(id) : Promise.resolve(null)), [id]);
  const c = data?.customer;
  return (
    <Dialog title="顾客详情" open={Boolean(id)} onClose={onClose} okText="赠送优惠券" onOk={() => { onCoupon(id); }} width={720}>
      {!c ? <div className="empty" style={{padding: 30}}>加载中…</div> : (
        <>
          <Form narrow>
            <F label="顾客">{c.registered ? c.nickname : '未注册'}<span className="ad-muted">ID {c.id}</span>{c.deletedAt && <Tag color="gray">已注销</Tag>}</F>
            <F label="手机号">{c.phone || '未绑定'}</F>
            <F label="会员">{c.member.name || '非会员'} · 累计消费 ¥{money(c.member.totalSpent)} · 积分 {c.points}</F>
            <F label="注册时间">{fmtTime(c.createdAt)}{data.invitedBy && <span className="ad-muted">邀请人 {data.invitedBy}</span>}</F>
          </Form>
          <div style={{fontWeight: 600, margin: '6px 0 8px'}}>最近订单</div>
          <Table columns={[{title: '订单号', key: 'id'}, {title: '实付', key: 't', render: (o) => money(o.totals.total)}, {title: '状态', key: 's', render: (o) => o.statusText}, {title: '时间', key: 'c', render: (o) => fmtTime(o.createdAt)}]} data={data.orders.slice(0, 8)} empty="暂无订单" />
          <div style={{fontWeight: 600, margin: '14px 0 8px'}}>优惠券</div>
          <Table columns={[{title: '名称', key: 'title'}, {title: '门槛', key: 'r', render: (x) => `满${x.threshold}减${x.amount}`}, {title: '状态', key: 'statusText'}, {title: '有效期至', key: 'v', render: (x) => fmtTime(x.validTo).slice(0, 10)}]} data={data.coupons} empty="暂无优惠券" />
        </>
      )}
    </Dialog>
  );
}

export function UserList() {
  const [tab, setTab] = useState('用户列表');
  const [form, setForm] = useState({q: '', member: '', phone: '', from: '', to: ''});
  const [filters, setFilters] = useState(form);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [couponTargets, setCouponTargets] = useState([]);
  const [detail, setDetail] = useState(null);
  const {data, loading, error, reload} = useApi(() => api.customers({...filters, page, pageSize: size}), [filters, page, size]);
  const st = data?.stats || {users: 0, members: 0, balance: 0, points: 0, ordered: 0};
  const pies = [
    {labels: ['下单用户', '未下单用户'], colors: ['#5470c6', '#52c46b'], values: [st.ordered, st.users - st.ordered]},
    {labels: ['普通', '会员'], colors: ['#f5c242', '#e67a53'], values: [st.users - st.members, st.members]},
    {labels: ['男', '女', '未知'], colors: ['#5b8ff9', '#5ad8a6', '#5d7092'], values: [0, 0, st.users]},
    {labels: ['充值过', '未充值'], colors: ['#ee6b4d', '#e8608f'], values: [0, st.users]},
  ];
  const set = (k) => (v) => setForm({...form, [k]: v});
  return (
    <>
      <Card>
        <Tabs items={['用户列表', '用户标签', '导入用户', '设置']} value={tab} onChange={setTab} />
        <ErrorBar error={error} onRetry={reload} />
        {tab === '用户列表' && (
          <>
            <div className="ad-row"><label className="l">搜索用户</label><Input w="m" placeholder="ID/昵称/手机号码" value={form.q} onChange={set('q')} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setFilters(form))} /><label className="l" style={{marginLeft: 18}}>会员</label><Select value={form.member} onChange={set('member')} options={[{value: '', label: '全部用户'}, {value: 'yes', label: '会员'}, {value: 'no', label: '非会员'}]} /><label className="l" style={{marginLeft: 18}}>已授手机号</label><Select value={form.phone} onChange={set('phone')} options={[{value: '', label: '全部'}, {value: 'yes', label: '已授权'}, {value: 'no', label: '未授权'}]} /></div>
            <div className="ad-row" style={{marginBottom: 0}}><label className="l">注册时间</label><DateRangeInput value={{from: form.from, to: form.to}} onChange={(r) => setForm({...form, ...r})} /><Btn type="primary" onClick={() => { setPage(1); setFilters(form); }} style={{width: 96}}>查询</Btn><Btn onClick={() => { const empty = {q: '', member: '', phone: '', from: '', to: ''}; setForm(empty); setFilters(empty); }}>重置</Btn><Btn onClick={() => pending('导出用户')}>导出</Btn></div>
          </>
        )}
        {tab === '用户标签' && <><Btn type="primary" onClick={() => pending('新建标签')}>新建标签</Btn><div style={{height: 14}} /><Table columns={['标签名称', '用户数', '创建时间', '操作'].map((t) => ({title: t, key: t}))} data={[]} empty="用户标签暂未开通" /></>}
        {tab === '导入用户' && <Form narrow><F label="说明">顾客通过小程序微信登录后自动成为用户，暂不支持批量导入。</F></Form>}
        {tab === '设置' && <Form narrow><F label="禁止登录提示"><Input w="l" placeholder="账号已被禁止登录，请联系商家" /></F><F label=""><Btn type="primary" onClick={() => pending('保存设置')}>保存</Btn></F></Form>}
      </Card>
      {tab === '用户列表' && (
        <>
          <div className="ad-split" style={{marginBottom: 14}}>
            <Card style={{width: 380, flex: '0 0 380px', margin: 0}} title="统计数据">
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22}}><div className="kv"><span className="k">用户数</span><span className="v">{st.users}</span></div><div className="kv"><span className="k">会员数</span><span className="v">{st.members}</span></div><div className="kv"><span className="k">总余额</span><span className="v">{money(st.balance)} ›</span></div><div className="kv"><span className="k">总积分</span><span className="v">{st.points}</span></div></div>
            </Card>
            <Card style={{flex: 1, margin: 0}} title="数据分析">
              <div style={{display: 'flex', justifyContent: 'space-around'}}>
                {pies.map((p) => { const d = p.labels.map((label, i) => ({label, value: p.values[i], color: p.colors[i]})); return <div key={p.labels[0]} style={{textAlign: 'center'}}><div className="legend" style={{flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 8}}>{d.map((x) => <span key={x.label}><i style={{background: x.color}} />{x.label} {x.value}</span>)}</div><Donut data={d} size={110} hole={0} /></div>; })}
              </div>
            </Card>
          </div>
          <Card>
            <Table loading={loading} selectable onSelect={setSelected} minWidth={1500} columns={[
              {title: 'ID', key: 'id'}, {title: '头像', key: 'a', render: () => <span className="thumb">👤</span>},
              {title: '用户昵称', key: 'nickname', render: (u) => (u.registered ? u.nickname : <span className="ad-muted">未注册</span>)},
              {title: '上级分销员', key: 'p', render: () => '无'},
              {title: '性别', key: 'gender', render: () => <Tag>未知</Tag>},
              {title: '余额', key: 'balance', render: (u) => <span style={{color: '#2bad5b'}}>{money(u.balance)}</span>},
              {title: '积分', key: 'points'},
              {title: '手机号', key: 'phone', render: (u) => (u.phone ? u.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : <span className="ad-muted">未绑定</span>)},
              {title: '会员', key: 'member', render: (u) => (u.member.name ? <Tag color="orange">{u.member.name}</Tag> : '否')},
              {title: '持有券', key: 'coupons', render: (u) => <>{u.availableCoupons} | <Lnk onClick={() => setDetail(u.id)}>详情</Lnk></>},
              {title: '总消费', key: 'spent', render: (u) => money(u.member.totalSpent)},
              {title: '订单数', key: 'orderCount'},
              {title: '注册时间', key: 'createdAt', minWidth: 150, render: (u) => fmtTime(u.createdAt)},
              {title: '最近下单', key: 'lastOrderAt', minWidth: 150, render: (u) => (u.lastOrderAt ? fmtTime(u.lastOrderAt) : '-')},
              {title: '操作', key: 'op', fixed: 'right', minWidth: 190, render: (u) => <><Lnk onClick={() => go(`/order/list?q=${u.phone || ''}`)}>历史订单</Lnk><Lnk onClick={() => setCouponTargets([u.id])}>发券</Lnk><Lnk onClick={() => setDetail(u.id)}>更多</Lnk></>},
            ]} data={data?.customers || []} empty="暂无用户" />
            <div className="tbl-foot"><Btn size="sm" onClick={() => pending('批量增减积分')}>批量增减积分</Btn><Btn size="sm" disabled={!selected.length} onClick={() => setCouponTargets(selected)}>批量赠送优惠券{selected.length ? `(${selected.length})` : ''}</Btn><Btn size="sm" onClick={() => pending('批量设置会员')}>批量设置会员</Btn><Pager total={data?.total || 0} page={page} size={size} sizes jumper onChange={setPage} onSize={(n) => { setSize(n); setPage(1); }} /></div>
          </Card>
        </>
      )}
      <CouponDialog targets={couponTargets} onClose={() => setCouponTargets([])} onDone={reload} />
      <CustomerDrawer id={detail} onClose={() => setDetail(null)} onCoupon={(id) => setCouponTargets([id])} />
    </>
  );
}
