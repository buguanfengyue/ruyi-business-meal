import React, {useState} from 'react';
import {RefreshCw, ChevronLeft, ChevronRight, X} from 'lucide-react';
import {Card, Btn, Lnk, Input, Select, DateRange, Quick, Tabs, Table, Pager, Stat, Donut, Legend, Q, Check, Empty, DateRangeInput, QuickPick, ErrorBar, pending, toast} from '../ui';
import {api, useApi, quickRange, fmtTime, money as m2} from '../api';
import {REPORT_COLUMNS} from '../mock';
import {go} from '../router';

const C4 = ['#7ed36b', '#4b7bec', '#f5a742', '#8fa9f2'];
const C5 = ['#f5c242', '#f2643d', '#ee8a4b', '#f0b54a', '#e9573f'];

export function Banner() {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div className="banner">
      <div><b><span style={{color: '#2bad5b'}}>●</span>微信生态营销能力升级</b><small>摇优惠投放/商家名片/交易连接名片<span className="go" onClick={() => go('/weChatPayBrand/index')}>一键投放 ›</span></small></div>
      <div className="phones">{Array.from({length: 6}, (_, i) => <i key={i} />)}</div>
      <span className="x" onClick={() => setShow(false)}><X size={12} /></span>
    </div>
  );
}

function DonutCard({title, data, money}) {
  return (
    <div style={{flex: 1, minWidth: 0}}>
      <div style={{fontWeight: 600, marginBottom: 10}}>{title}</div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#606266', marginBottom: 12}}>
        {data.map((d) => <span key={d.label} style={{display: 'flex', flexDirection: 'column', gap: 4}}>{d.label}<b style={{color: '#303133'}}>{money ? d.value.toFixed(2) : d.value}</b></span>)}
      </div>
      <div className="donut-wrap"><Donut data={data} size={120} /><Legend data={data} percent /></div>
    </div>
  );
}

export function Dashboard() {
  const [label, setLabel] = useState('今天');
  const [range, setRange] = useState(quickRange('今天'));
  const [scroll, setScroll] = useState(0);
  const {data, error, reload} = useApi(() => api.dashboard(range).then((r) => r.dashboard), [range.from, range.to]);
  const d = data || {byFulfillment: {}, byPayment: {}};
  const f = (k) => d.byFulfillment[k] || {orders: 0, amount: 0};
  const pick = (l) => { setLabel(l); if (l !== '自定义') setRange(quickRange(l)); };
  const channels = [['堂食', 'dinein'], ['自取', 'pickup'], ['外卖', 'delivery'], ['快递', 'express']];
  const money = channels.map(([label, k], i) => ({label, value: f(k).amount, color: C4[i]}));
  const counts = channels.map(([label, k], i) => ({label, value: f(k).orders, color: C4[i]}));
  const payShare = [['微信支付', 'wechat'], ['模拟支付', 'mock'], ['余额支付', 'balance'], ['线下支付', 'offline']].map(([label, k], i) => ({label, value: d.byPayment[k] || 0, color: C5[i]}));
  const collect = [['收银', '0 笔', '0'], ['挂账还款', '0 笔', '0'], ['拼团', '0 笔', '0'], ['余额充值', '0 笔', '0.00'], ['礼品卡', '0 笔', '0'], ['会员开通', '0 笔', '0']];
  const payDetail = payShare.map((x, i) => ({...x, color: ['#6fcf97', '#4b7bec', '#f5c242', '#f2643d'][i]}));
  return (
    <>
      <Banner />
      <Card title="数据统计" extra={<Lnk color="gray" onClick={() => pending('返回旧版')}>返回旧版</Lnk>}>
        <ErrorBar error={error} onRetry={reload} />
        <div className="ad-row" style={{marginBottom: 6}}><Tabs variant="line" items={['今天', '昨天', '本周', '本月', '上个月', '自定义']} value={label} onChange={pick} style={{borderBottom: 0, margin: 0}} />{label === '自定义' && <DateRangeInput value={range} onChange={setRange} />}</div>
        <div className="ad-row" style={{fontSize: 12, color: '#606266'}}>统计区间 {range.from} 至 {range.to}（00:00:00 起） 最后更新时间：{fmtTime(new Date().toISOString())} <RefreshCw size={13} color="#409eff" style={{cursor: 'pointer'}} onClick={() => { reload(); toast('已刷新'); }} />{d.waitingAccept > 0 && <Lnk color="red" onClick={() => go('/order/list?tab=accept')}>　有 {d.waitingAccept} 笔订单待接单 ›</Lnk>}<span style={{marginLeft: 'auto'}}><Lnk onClick={() => pending('显示设置')}>显示设置</Lnk></span></div>
        <div className="stat-grid" style={{gridTemplateColumns: 'repeat(6, 1fr)'}}>
          <Stat k="营业实收" v={<span style={{color: '#409eff'}}>{m2(d.revenue)}</span>} d="营业实收=订单实收+收款实收" />
          <Stat k="访问量" q="暂未统计小程序访问量" v="-" /><Stat k="支付顾客数" v={d.customers ?? 0} /><Stat k="会员占比" v={`${d.memberShare ?? 0}%`} /><Stat k="人均" v={m2(d.perCustomer)} q="实收/支付顾客数" /><Stat k="翻台率" v="-" q="暂未开通堂食桌台" />
        </div>
      </Card>
      <Card>
        <div style={{display: 'flex', gap: 24}}>
          <div className="stat" style={{width: 200, flex: '0 0 200px'}}>
            <div className="k">订单实收<Q tip="订单实收金额不包含用户使用余额支付和挂账支付所产生的收入" /></div>
            <div className="v" style={{color: '#409eff'}}>{m2(d.revenue)}</div>
            <div className="d">订单实收金额不包含用户使用余额支付和挂账支付所产生的收入</div>
            <div style={{display: 'flex', gap: 30, marginTop: 16, borderTop: '1px solid #ebeef5', paddingTop: 12}}><div className="kv"><span className="k">订单额</span><b>{m2(d.orderAmount)}</b></div><div className="kv"><span className="k">退款 <Q /></span><b>{m2(d.refund)}</b></div></div>
          </div>
          <DonutCard title="订单金额" data={money} money />
          <DonutCard title="订单数量" data={counts} />
          <div style={{width: 200}}><div style={{fontWeight: 600, marginBottom: 10}}>订单支付占比</div><Donut data={payShare} size={120} /><div style={{marginTop: 10}}><Legend data={payShare.map((x) => ({...x, value: m2(x.value)}))} /></div></div>
        </div>
      </Card>
      <Card>
        <div style={{display: 'flex', gap: 20, alignItems: 'flex-start'}}>
          <div className="stat" style={{width: 200, flex: '0 0 200px'}}>
            <div className="k">收款实收合计<Q tip="收银台收款，暂未开通" /></div><div className="v" style={{color: '#409eff'}}>0</div>
            <div style={{display: 'flex', gap: 30, marginTop: 16}}><div className="kv"><span className="k">收款</span><b>0.00</b></div><div className="kv"><span className="k">退款</span><b>0</b></div></div>
          </div>
          <Btn size="sm" round onClick={() => setScroll(Math.max(0, scroll - 1))}><ChevronLeft size={12} /></Btn>
          <div style={{flex: 1, overflow: 'hidden'}}>
            <div style={{display: 'flex', gap: 14, transform: `translateX(-${scroll * 174}px)`, transition: 'transform .3s'}}>
              {collect.map(([k, n, v]) => <div key={k} className="stat" style={{flex: '0 0 160px'}}><div className="k" style={{fontWeight: 400}}>{k}<span style={{marginLeft: 'auto', color: '#909399'}}>{n}</span></div><div className="v" style={{fontSize: 18}}>{v}</div></div>)}
            </div>
          </div>
          <Btn size="sm" round onClick={() => setScroll(Math.min(collect.length - 3, scroll + 1))}><ChevronRight size={12} /></Btn>
          <div style={{width: 210}}><div style={{fontWeight: 600, marginBottom: 10}}>营业收款明细</div><Donut data={payDetail} size={110} /><div style={{marginTop: 10}}><Legend data={payDetail.map((x) => ({...x, value: m2(x.value)}))} /></div></div>
        </div>
      </Card>
    </>
  );
}

export function Sale() {
  const [kind, setKind] = useState('全部商品');
  const [label, setLabel] = useState('本月');
  const [range, setRange] = useState(quickRange('本月'));
  const [applied, setApplied] = useState(range);
  const {data, loading, error, reload} = useApi(() => api.salesReport(applied).then((r) => r.report), [applied.from, applied.to]);
  const t = data?.totals || {};
  const rows = kind === '套餐' ? (data?.rows || []).filter((r) => r.name.includes('套餐')) : (data?.rows || []);
  return (
    <Card title="销售统计">
      <ErrorBar error={error} onRetry={reload} />
      <Tabs variant="seg" items={['全部商品', '套餐']} value={kind} onChange={setKind} />
      <div className="ad-row"><Select options={['支付时间']} /><DateRangeInput value={range} onChange={(r) => { setRange(r); setLabel(''); }} /><QuickPick items={['今天', '昨天', '本周', '本月', '上个月']} active={label} onPick={(l) => { setLabel(l); const r = quickRange(l); setRange(r); setApplied(r); }} /><label className="l">类型</label><Select options={['全部', '外卖', '自取']} /><Btn type="primary" onClick={() => setApplied(range)}>查询</Btn><Btn onClick={() => api.exportOrders(applied).catch((e) => toast(e.message, 'info'))}>导出</Btn><Check>按分类显示</Check></div>
      <div className="ad-gray">
        <div style={{marginBottom: 10}}><b>统计</b> <span className="ad-muted">（支付时间：{applied.from} 00:00:00 至 {applied.to} 23:59:59 / 全时段 / 全部）</span></div>
        <div style={{display: 'flex', gap: 60}}>{[['商品销售总额(元)', t.sales, '按原价计算'], ['优惠总额(元)', t.discount, '会员优惠 + 优惠券，按商品金额分摊'], ['退款总额(元)', t.refund], ['实际销售额(元)', t.actual, '销售额 - 优惠 - 退款']].map(([k, v, q]) => <div key={k} className="kv"><span className="k">{k}</span><span className="v" style={{fontSize: 16}}>{m2(v)} {q && <Q tip={q} />}</span></div>)}</div>
      </div>
      <Table loading={loading} minWidth={1100} columns={[{title: '#', key: 'i', width: 40, render: (_, i) => i + 1}, {title: '商品名称', key: 'name', minWidth: 220}, {title: '分类', key: 'category'}, {title: '规格', key: 's', render: () => '-'}, {title: '总数量', key: 'quantity', sort: true}, {title: '退款退菜数', key: 'refundQuantity', sort: true}, {title: '实际销量', key: 'actualQuantity', sort: true}, {title: '优惠金额', key: 'discount', sort: true, render: (r) => m2(r.discount)}, {title: '退款金额', key: 'refund', sort: true, render: (r) => m2(r.refund)}, {title: '销售额', key: 'sales', sort: true, render: (r) => m2(r.sales)}, {title: '实际销售额', key: 'actual', sort: true, render: (r) => m2(r.actual)}]} rowKey="productId" data={rows} />
    </Card>
  );
}

// 营业报表 columns we can fill from our data; the rest of the original columns show 0.
const REPORT_MAP = {
  新访客: 'newVisitors', 总收款: 'collected', 微信实际到账: 'wechatReceived', 订单实收: 'orderNet', 订单总数: 'orders', 订单总额: 'orderGross',
  订单微信支付额: 'orderWechat', 订单退款成功数: 'refunds', 订单退款成功额: 'refundAmount', 微信退款金额: 'wechatRefund', 外卖订单数: 'deliveryOrders',
  外卖订单额: 'deliveryAmount', 自取订单数: 'pickupOrders', 自取订单额: 'pickupAmount', 会员抵扣金额: 'memberDiscount', 优惠券抵扣金额: 'couponDiscount',
};
const COUNT_COL = /数|笔数|核销总数|核销量/;

export function Report() {
  const [hidden, setHidden] = useState(true);
  const [range, setRange] = useState(quickRange('本月'));
  const [applied, setApplied] = useState(range);
  const {data, loading, error, reload} = useApi(() => api.dailyReport(applied).then((r) => r.report), [applied.from, applied.to]);
  const cols = hidden ? REPORT_COLUMNS.filter((c) => c in REPORT_MAP) : REPORT_COLUMNS;
  const cell = (day, c) => { const k = REPORT_MAP[c]; if (c === '总访客') return '-'; if (k) return COUNT_COL.test(c) ? day[k] : m2(day[k]); return COUNT_COL.test(c) ? 0 : '0.00'; };
  const days = data?.days || [];
  const rows = days.map((day) => ({id: day.date, date: day.date, ...Object.fromEntries(cols.map((c) => [c, cell(day, c)]))}));
  const total = {id: 'sum', ...Object.fromEntries(cols.map((c) => { const k = REPORT_MAP[c]; if (!k) return [c, cell({}, c)]; const v = days.reduce((acc, d) => acc + Number(d[k] || 0), 0); return [c, COUNT_COL.test(c) ? v : m2(v)]; }))};
  return (
    <Card>
      <ErrorBar error={error} onRetry={reload} />
      <div className="ad-row"><Select options={['按日期']} /><DateRangeInput value={range} onChange={setRange} /><label className="l">门店</label><Select options={['如一商务餐']} /><Btn type="primary" onClick={() => setApplied(range)}>查询</Btn><Btn onClick={() => setHidden(!hidden)}>{hidden ? '显示全部列' : '隐藏无数据列'}</Btn><Btn onClick={() => api.exportOrders(applied).catch((e) => toast(e.message, 'info'))}>导出</Btn></div>
      <div className="ad-muted" style={{marginBottom: 14, fontSize: 13}}>营业报表按营业结算时间 00:00 统计每个营业日的营业数据；{hidden ? '当前只显示本系统有数据的列，' : ''}访客数暂未统计。</div>
      <Table loading={loading} bordered minWidth={cols.length * 110 + 170} columns={[{title: <span>日期<div className="ad-muted" style={{fontWeight: 400}}>按订单支付时间查询</div></span>, key: 'date', fixed: 'left', minWidth: 170, render: (r) => (r.id === 'sum' ? <b>合计</b> : <span>{r.date}<br /><span className="ad-muted">00:00:00~23:59:59</span></span>)}, ...cols.map((c) => ({title: c, key: c, minWidth: 100}))]} data={rows.length ? [...rows, total] : []} />
    </Card>
  );
}

export function TableStatistics() {
  const [tab, setTab] = useState('统计');
  return (
    <Card title="桌台统计">
      <Tabs items={['统计', '区域设置']} value={tab} onChange={setTab} />
      {tab === '统计' ? (
        <>
          <div className="ad-row"><Select options={['下单时间', '支付时间']} /><DateRange start="2026-10-14" end="2026-10-14" /><Check>筛选每天时段</Check><DateRange time="clock" placeholder={['开始时间', '结束时间']} /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn>重置</Btn><Btn onClick={() => pending('导出')}>导出</Btn></div>
          <div className="ad-row"><Quick outline items={['今天', '昨天', '本月', '上个月']} /></div>
          <Table columns={[{title: '区域', key: 'a'}, {title: '桌台', key: 't'}, {title: '开台次数', key: 'o'}, {title: '订单数', key: 'n'}, {title: '订单金额', key: 'm'}, {title: '翻台率', key: 'r'}]} data={[]} />
        </>
      ) : (
        <><Btn type="primary" onClick={() => go('/tool/table')}>新增区域</Btn><div style={{height: 14}} /><Table columns={[{title: '区域名称', key: 'a'}, {title: '桌台数', key: 'n'}, {title: '操作', key: 'op', render: () => <><Lnk>编辑</Lnk><Lnk color="red">删除</Lnk></>}]} data={[]} /></>
      )}
    </Card>
  );
}

export function BalanceStatistics() {
  const [tab, setTab] = useState('记录明细');
  return (
    <Card title="余额统计">
      <div className="ad-row"><label className="l">筛选时间</label><DateRange time start="2026-10-13 00:00:00" end="2026-10-13 23:59:59" /><Quick items={['今天', '昨天', '本月', '上个月', '近1个月', '近3个月']} defaultValue="昨天" /></div>
      <div className="ad-row"><label className="l">记录类型</label><Select options={['全部', '充值', '消费', '退款', '后台调整']} /><label className="l" style={{marginLeft: 20}}>搜索</label><Input w="m" placeholder="ID/昵称/手机号码" /></div>
      <div className="ad-row"><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn>重置</Btn><Btn onClick={() => pending('导出')}>导出</Btn><Btn onClick={() => pending('导出记录')}>导出记录</Btn></div>
      <div className="stat-grid" style={{gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 16}}>
        <Stat k="期初余额" q v="0.00" /><Stat k="期末余额" q v="0.00" /><Stat k="本期余额增加" q more v="0.00" /><Stat k="本期余额减扣" q more v="0.00" /><Stat k="本期变动余额" q v="0.00" />
      </div>
      <Tabs variant="line" items={['记录明细', '记录汇总']} value={tab} onChange={setTab} />
      <Empty />
    </Card>
  );
}

export function CommissionStatistics() {
  const [tab, setTab] = useState('提成明细');
  return (
    <Card title="提成统计">
      <div className="ad-row"><label className="l">支付时间</label><DateRange time start="2026-10-08 00:00:00" end="2026-10-14 23:59:59" /><label className="l">提成人</label><Select placeholder="请选择提成人" options={[]} /></div>
      <div className="ad-row"><label className="l">提成方案</label><Select placeholder="请选择提成方案" options={[]} /><label className="l">桌号</label><Select placeholder="请选择桌号" options={[]} /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn onClick={() => pending('导出')}>导出</Btn></div>
      <div className="ad-gray" style={{display: 'flex', gap: 60}}><div className="kv"><span className="k">提成总人数</span><b>0</b></div><div className="kv"><span className="k">提成总金额(元)</span><b>0</b></div><div className="kv"><span className="k">订单实收合计(元)</span><b>0</b></div></div>
      <Tabs variant="line" items={['提成明细', '提成汇总']} value={tab} onChange={setTab} />
      <Table columns={['序号', '支付时间', '提成人', '提成方案', '订单号', '桌号', '订单实收金额(元)', '提成金额(元)', '操作'].map((t) => ({title: t, key: t}))} data={[]} />
      <Pager total={0} size={15} sizes jumper align="center" />
    </Card>
  );
}
