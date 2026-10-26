import React, {useMemo, useState} from 'react';
import {Maximize, Search, Keyboard, ShoppingCart, ChevronUp, Users} from 'lucide-react';
import {Card, Btn, Lnk, Input, Addon, Select, DateRange, DateTime, Quick, Tabs, Table, Pager, KV, Check, Form, F, Radios, useFormDialog, pending, toast} from '../ui';
import {AREAS, TABLES, PRODUCTS, CATEGORIES} from '../mock';
import {go} from '../router';

export function Cashier() {
  const [amount, setAmount] = useState('');
  return (
    <>
      <Card title="收银管理">
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 20}}>
          {['今日收银(笔)', '今日收银金额', '今日微信支付收银', '今日支付宝收银', '今日余额收银', '今日现金收银'].map((k) => <KV key={k} k={k} v="0" />)}
        </div>
        <div className="ad-row" style={{borderTop: '1px solid #ebeef5', paddingTop: 20, marginBottom: 0}}>
          <label className="l">收款金额</label><Addon pre="¥" value={amount} onChange={(v) => setAmount(v.replace(/[^\d.]/g, ''))} />
          <Btn type="primary" onClick={() => (Number(amount) > 0 ? pending(`收款 ¥${amount}`) : toast('请输入收款金额', 'info'))}>提交</Btn>
        </div>
      </Card>
      <Card>
        <div className="ad-row"><label className="l">日期</label><DateRange start="2026-10-14" end="2026-10-14" sep="–" /><Quick items={['今天', '昨天', '近1个月', '本月', '上个月']} /><label className="l">搜索</label><Input placeholder="搜索昵称/手机号码" /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn></div>
        <Table columns={['用户', '金额', '类型', '支付时间', '状态'].map((t) => ({title: t, key: t}))} data={[]} />
        <Pager total={0} sizes jumper align="left" />
      </Card>
    </>
  );
}

const STATUS = [['空闲中', '#2bad5b'], ['已扫码未下单', '#4b7bec'], ['未结账', '#f56c6c'], ['已结账', '#f5a742']];

export function TableManage() {
  const [area, setArea] = useState('全部');
  const [status, setStatus] = useState('全部');
  const [collapsed, setCollapsed] = useState(false);
  const [openAdd, addDialog] = useFormDialog('添加桌台', [{label: '桌台名称', required: true}, {label: '所属区域', render: () => <Select options={AREAS} />}, {label: '座位数', placeholder: '1'}]);
  const [openType, typeDialog] = useFormDialog('新增类型', [{label: '区域名称', required: true}]);
  const list = TABLES.filter((t) => area === '全部' || t.area === area);
  return (
    <Card>
      <div className="ad-row" style={{marginBottom: 18}}>
        <span className="ad-card-title" style={{margin: 0}}>桌台管理 <Maximize size={15} style={{cursor: 'pointer'}} onClick={() => document.documentElement.requestFullscreen?.()} /></span>
        <span className="inp-wrap" style={{marginLeft: 16}}><Input w="m" placeholder="搜索" /><Search size={14} style={{position: 'absolute', right: 10, color: '#c0c4cc'}} /></span>
        <span style={{marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}>
          <span className="btn-group"><Btn type="primary" onClick={openAdd}>添加桌台</Btn><Btn type="primary" onClick={() => pending('批量添加')}>▾</Btn></span>
          <Btn onClick={() => go('/setting/qrCode')}>批量生成桌码</Btn><Btn onClick={() => pending('拖拽排序')}>拖拽排序</Btn><Btn onClick={() => pending('桌台设置')}>设置</Btn>
          <Lnk color="blue" onClick={() => setCollapsed(!collapsed)}><ChevronUp size={13} style={{transform: collapsed ? 'rotate(180deg)' : ''}} /> {collapsed ? '展开' : '收起'}</Lnk>
        </span>
      </div>
      {!collapsed && (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '18px 10px', marginBottom: 20}}>
          <KV k="全部 (有空位)" v={`0/${TABLES.length}`} />
          {AREAS.map((a) => { const n = TABLES.filter((t) => t.area === a).length; return <KV key={a} k={`${a.length > 7 ? `${a.slice(0, 6)}…` : a} (${n ? '有空位' : '无桌'})`} v={`0/${n}`} />; })}
          <Lnk color="blue" onClick={openType}>⊕ 新增类型</Lnk>
        </div>
      )}
      <Tabs items={['全部', ...AREAS]} value={area} onChange={setArea} />
      <div className="ad-row">
        {[['全部', null, list.length], ...STATUS.map(([s, c], i) => [s, c, i === 0 ? list.length : 0])].map(([s, c, n]) => <span key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{c && <i style={{background: c}} />}{s}({n})</span>)}
        <span style={{marginLeft: 'auto'}}><Btn type="primary" onClick={() => pending('更多操作')}>更多 ▾</Btn></span>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
        {(status === '全部' || status === '空闲中' ? list : []).map((t) => (
          <div key={t.id} className="desk">
            <div className="h"><span>{t.name}丨{t.area}</span><b style={{cursor: 'pointer'}} onClick={() => pending('桌台操作')}>•••</b></div>
            <div className="b"><Btn type="primary" size="sm" onClick={() => go(`/tool/Instead?table=${encodeURIComponent(t.name)}`)}>开始点餐</Btn><div className="f"><Users size={11} /> {t.used}/{t.seats}</div></div>
          </div>
        ))}
      </div>
      {addDialog}{typeDialog}
    </Card>
  );
}

const POS_ACTIONS = ['删除', '规格', '菜品打折', '转菜', '赠菜', '打包', '等叫', '整单等叫', '单品备注', '整单备注', '打印预览单', '退菜', '附加费', '存单', '取单', '修改价格', '撤单'];

export function Instead({query}) {
  const [mode, setMode] = useState('堂食');
  const [cat, setCat] = useState('全部');
  const [cart, setCart] = useState([]);
  const [sel, setSel] = useState(null);
  const [kw, setKw] = useState('');
  const goods = useMemo(() => PRODUCTS.filter((p) => p.price > 0 && (cat === '全部' || cat === '推荐' || p.category === cat) && p.name.includes(kw)), [cat, kw]);
  const add = (p) => setCart((c) => { const i = c.findIndex((x) => x.id === p.id); if (i < 0) return [...c, {...p, qty: 1}]; const n = [...c]; n[i] = {...n[i], qty: n[i].qty + 1}; return n; });
  const change = (d) => sel != null && setCart((c) => c.map((x) => (x.id === sel ? {...x, qty: Math.max(1, x.qty + d)} : x)));
  const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const keepOn = ['存单', '取单', '整单等叫', '整单备注'];
  return (
    <Card tight>
      <div className="ad-row" style={{marginBottom: 12}}>
        <span className="ad-card-title" style={{margin: 0}}>代客下单 <Select options={['先付费', '后付费']} style={{minWidth: 80, height: 24, color: '#2bad5b', borderColor: '#bfe6cc'}} /> <Maximize size={15} /></span>
        <span style={{marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}><span className="inp-wrap"><Input w="l" placeholder="搜索全部商品" value={kw} onChange={setKw} /><Search size={14} style={{position: 'absolute', right: 10, color: '#c0c4cc'}} /></span><Keyboard size={22} color="#606266" /><Select options={['经典布局', '大图布局']} /></span>
      </div>
      <div className="pos">
        <div className="pos-left">
          <div><Btn type="primary" onClick={() => pending('选择用户')}>选择用户</Btn></div>
          <Tabs variant="bar" items={['堂食', '自取', '配送']} value={mode} onChange={setMode} style={{marginTop: 12, marginBottom: 10}} />
          <div className="ad-row" style={{justifyContent: 'space-between'}}><Btn size="sm">{query.table ? `桌台：${query.table}` : '桌台号/取餐号'}</Btn><Lnk color="gray" onClick={() => { setCart([]); setSel(null); }}>清空</Lnk></div>
          <div style={{flex: 1, overflowY: 'auto'}}>
            {cart.length === 0 ? <div className="empty" style={{padding: '30px 0'}}><ShoppingCart size={34} color="#c0c4cc" /><div style={{marginTop: 8}}>点餐列表为空</div></div>
              : cart.map((x) => <div key={x.id} onClick={() => setSel(x.id)} style={{padding: '10px 8px', borderBottom: '1px solid #f0f0f0', background: sel === x.id ? '#eaf7ef' : '', cursor: 'pointer', display: 'flex', gap: 8}}><span style={{flex: 1, fontSize: 13}}>{x.name}</span><span>×{x.qty}</span><b>¥{(x.price * x.qty).toFixed(2)}</b></div>)}
          </div>
          <div className="ad-row" style={{justifyContent: 'space-between', margin: '10px 0'}}><Check>打印制作单</Check><span>共{count}件 <b style={{fontSize: 18}}>¥{total.toFixed(2)}</b></span></div>
          <div style={{display: 'flex', gap: 8}}><Btn type="primary" style={{flex: 1}} disabled={!cart.length} onClick={() => pending('微信/支付宝收款')}>微信/支付宝</Btn><Btn type="primary" style={{flex: 1}} disabled={!cart.length} onClick={() => pending('现金收款')}>现金</Btn><Btn style={{flex: 1}} onClick={() => pending('更多支付')}>更多支付</Btn></div>
        </div>
        <div className="pos-mid">
          <button type="button" disabled={sel == null} onClick={() => change(-1)}>−</button>
          <button type="button" disabled style={{fontSize: 18}}>{cart.find((x) => x.id === sel)?.qty || 1}</button>
          <button type="button" disabled={sel == null} onClick={() => change(1)}>+</button>
          {POS_ACTIONS.map((a) => <button type="button" key={a} disabled={!cart.length && !keepOn.includes(a)} onClick={() => (a === '删除' ? (setCart(cart.filter((x) => x.id !== sel)), setSel(null)) : pending(a))}>{a}</button>)}
        </div>
        <div className="pos-right">
          <div className="ad-row">{['全部', '推荐', ...CATEGORIES.filter((c) => !['推荐', '了解我们'].includes(c.name)).map((c) => c.name)].map((c) => <Btn key={c} type={cat === c ? 'primary' : 'default'} onClick={() => setCat(c)}>{c}</Btn>)}</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 10}}>
            {goods.map((p) => <div key={p.id} className="goods-tile" onClick={() => add(p)}><b>{p.name}</b><span style={{fontSize: 30, alignSelf: 'center', lineHeight: 1}}>{p.emoji}</span><span>¥{p.price.toFixed(2)}</span></div>)}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ChargeAccount() {
  const [tab, setTab] = useState('挂账汇总');
  const [openNew, newDialog] = useFormDialog('新建挂账', [{label: '挂账名称', required: true}, {label: '类型', render: () => <Radios options={['个人', '单位']} />}, {label: '手机号'}, {label: '额度（元）'}]);
  const cols = {
    挂账汇总: ['名称', '类型', '手机号', '额度（元）', '已挂账金额(元)', '剩余额度(元)', '操作'],
    挂账记录: ['挂账名称', '订单号', '挂账金额(元)', '挂账时间', '操作员', '备注'],
    还款记录: ['挂账名称', '还款金额(元)', '还款方式', '还款时间', '操作员', '备注'],
  }[tab];
  return (
    <Card title="挂账管理">
      <div style={{marginBottom: 16}}><Btn type="primary" onClick={openNew}>新建挂账</Btn></div>
      <Tabs variant="seg" items={['挂账汇总', '挂账记录', '还款记录']} value={tab} onChange={setTab} />
      <div className="ad-row"><label className="l">挂账用户</label><Input placeholder="输入用户名/电话" /><label className="l">用户类型</label><Select options={['全部', '个人', '单位']} /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn>重置</Btn></div>
      {tab === '挂账汇总' && <div className="ad-gray"><b>统计数据</b><div style={{display: 'flex', gap: 60, marginTop: 10}}><div className="kv"><span className="k">用户总数(个)</span><b>0</b></div><div className="kv"><span className="k">待还款用户数(个)</span><b>0</b></div><div className="kv"><span className="k">待还款总额(元)</span><b>0</b></div></div></div>}
      <Table columns={cols.map((t) => ({title: t, key: t, fixed: t === '操作' ? 'right' : undefined}))} data={[]} />
      <Pager total={0} size={15} sizes jumper align="left" />
      {newDialog}
    </Card>
  );
}

export function ShiftHandover() {
  const [tab, setTab] = useState('交班');
  return (
    <Card title="交接班">
      <Tabs items={['交班', '交班记录', '设置']} value={tab} onChange={setTab} />
      {tab === '交班' && (
        <Form narrow>
          <F label="班次"><Select placeholder="请选择班次" options={['早班', '中班', '晚班']} style={{width: 200}} /></F>
          <F label="开班时间"><DateTime value="2026-10-14 00:00:00" /></F>
          <F label="交班时间"><DateTime value="2026-10-14 13:38:59" /></F>
          <F label=""><Btn type="primary" onClick={() => pending('开始交班')}>开始交班</Btn></F>
        </Form>
      )}
      {tab === '交班记录' && <><Table columns={['班次', '交班人', '开班时间', '交班时间', '订单数', '营业额', '操作'].map((t) => ({title: t, key: t}))} data={[]} /><Pager total={0} sizes jumper /></>}
      {tab === '设置' && (
        <Form narrow>
          <F label="班次设置"><Btn type="primary" onClick={() => pending('添加班次')}>添加班次</Btn></F>
          <F label="交班打印"><Radios options={['打印交班小票', '不打印']} /></F>
          <F label=""><Btn type="primary" onClick={() => pending('保存设置')}>保存</Btn></F>
        </Form>
      )}
    </Card>
  );
}
