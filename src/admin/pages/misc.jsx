import React, {useState} from 'react';
import {Wallet, Users, MessageSquare, Coins, Network, Crown, Disc3, Sparkles, Stamp, BadgePercent, Ticket, Gift, CalendarCheck, Repeat, Send, Timer, Megaphone, HandCoins, UserPlus, KeyRound, CreditCard, QrCode, Cake, Package, Flame, Percent, Star, ShoppingCart, Scissors, Layers, Truck, MoreHorizontal, Store, Wine, Wifi, ClipboardList, Smartphone, Printer, ChefHat, MonitorPlay, Receipt, Image as ImageIcon, ChevronLeft, ChevronRight, PlusCircle} from 'lucide-react';
import {Card, Section, Btn, Lnk, Input, Select, Tabs, Table, Pager, Switch, Check, Radios, Form, F, Upload, TextArea, Tip, Tag, Q, FeatureHead, SaveBar, Dialog, ErrorBar, useFormDialog, pending, toast} from '../ui';
import {api, useApi, fmtTime, money} from '../api';
import {COUPONS, TOPUP, STORE} from '../mock';
import {Banner} from './data';
import {PrinterBox} from './setting';
import {go} from '../router';

export function WeChatPayBrand() {
  const [tab, setTab] = useState('品牌信息');
  const [slide, setSlide] = useState(0);
  const shots = ['支付摇优惠', '摇一摇-今日', '摇一摇-附近', '支付有礼', '支付凭证连接名片', '优惠及会员'];
  return (
    <Card style={{minHeight: 600, padding: '22px 60px'}}>
      <Tabs items={['品牌信息', '交易连接名片']} value={tab} onChange={setTab} />
      <div className="ad-section" style={{fontSize: 18}}>品牌入驻</div>
      <p style={{width: 620, lineHeight: 1.9, fontSize: 13, color: '#303133', textIndent: '2em'}}>品牌入驻是开启品牌经营的第一步。品牌经营平台旨在连接商家经营及服务，建立商家和用户的长连接，面向商家提供商家名片、摇优惠、名片会员等应用产品，助力商家智慧经营。</p>
      <div style={{width: 580, background: '#f5f6f8', borderRadius: 12, padding: '16px 20px', textAlign: 'center'}}>
        <b>微信生态营销能力</b>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 14}}>
          <Btn size="sm" round onClick={() => setSlide((slide + 3) % 6)}><ChevronLeft size={12} /></Btn>
          {shots.slice(slide, slide + 3).map((s) => <div key={s} style={{flex: 1}}><div style={{height: 230, borderRadius: 8, background: 'linear-gradient(180deg,#fff,#fdf3dc)', boxShadow: '0 1px 6px rgba(0,0,0,.1)'}} /><div style={{fontSize: 12, marginTop: 8}}>{s}</div></div>)}
          <Btn size="sm" round onClick={() => setSlide((slide + 3) % 6)}><ChevronRight size={12} /></Btn>
        </div>
      </div>
      <div className="ad-row" style={{marginTop: 26}}><Btn type="primary" onClick={() => pending('申请品牌入驻')}>点击申请</Btn><span className="ad-muted">已有品牌？请联系客服进行绑定</span></div>
    </Card>
  );
}

export function AdTop() {
  const [openAdd, dialog] = useFormDialog('新增广告', [{label: '广告图片', required: true, render: () => <Upload />}, {label: '链接地址', placeholder: '小程序页面路径'}, {label: '轮播图位置', render: () => <Select options={['首页顶部', '点餐页顶部']} />}, {label: '设置排序'}]);
  return (
    <Card style={{minHeight: 600}}>
      <Btn type="primary" onClick={openAdd}>新增广告</Btn>
      <div className="ad-muted" style={{margin: '10px 0 14px 12px', fontSize: 13}}>推荐尺寸：600px * 190px</div>
      <Table columns={['图片', '指定门店可用', '链接地址', '设置排序', '轮播图位置', '显示/隐藏', '操作'].map((t) => ({title: t, key: t, align: 'center'}))} data={[]} />
      <Pager total={0} showTotal={false} align="left" />
      {dialog}
    </Card>
  );
}

// [name, desc, icon, route?]
const MARKET = {
  营销: [
    ['智慧充值', '允许客户充值并使用余额支付', Wallet, '/market/topup'], ['商品拼团', '拼团', Users], ['弹窗广告', '设置弹窗广告', MessageSquare],
    ['积分锁客', '下单可获得积分，再次下单可使用积分抵扣', Coins], ['共享模式', '让每个用户都变成业务员', Network, '/market/distribution'], ['超级会员', '用户会员管理设置', Crown, '/market/member'],
    ['幸运大转盘', '营销抽奖，可通过下单增加次数抽取优惠券或实物奖品', Disc3], ['刮刮乐', '营销抽奖，可通过下单增加次数抽取优惠券或实物奖品', Sparkles], ['集章活动', '下单参与集章，集满可兑换优惠券或实物奖品', Stamp],
    ['满减活动', '达到指定支付金额享受减价', BadgePercent], ['充值兑换码', '兑换码直充余额，可当作礼品赠送', KeyRound], ['券兑换码', '可添加多券组合兑换', Ticket],
    ['签到', '适当的奖励可以提高顾客忠诚度，顾客自己坚持签到得来的会更珍惜', CalendarCheck], ['超级换购', '确认订单页面弹出，可加价换购指定商品，提高客单价', Repeat], ['邀请裂变', '邀请好友领券', Send],
    ['限时折扣', '批量设置商品折扣', Timer], ['套餐推广', '通过用户邀请好友减免金额的方式裂变宣传套餐', Megaphone], ['消费返现', '用户下单后返现一定的金额到余额，可促进复购', HandCoins],
    ['新客立减', '首单下单减免金额', UserPlus], ['口令兑换活动', '通过社群获得的口令，领取对应礼品', KeyRound], ['礼品卡', '组合优惠成礼品卡，可让用户当作礼品互相赠送', CreditCard],
    ['私域引流', '可设置用户下单成功后的群二维码', QrCode], ['生日有礼', '用户生日管理设置', Cake], ['超值券包', '下单加购', Package],
    ['霸王餐', '下单时充值一定金额，当前订单立即享受免单或折扣优惠', Flame], ['第N件优惠', '例：奶茶第二杯半价，可乐第三杯减10元', Percent], ['点单智能推荐', '进入点单页X秒未点自动推荐商品，此推荐设置启用即生效', Star],
    ['买赠', '指定商品，买 X 赠送 Y ，例：可乐买二赠一', Gift], ['买免', '买多份菜品，免其中一份，如买一送一', ShoppingCart], ['满量折扣', '购买指定份数以上的活动商品，活动商品可享指定折扣', Scissors],
    ['保温袋', '用于下单时，收取对应的费用，如:保温袋、礼品盒', Layers], ['免配送费活动', '周期性免配送费，吸引用户下配送单', Truck], ['更多功能', '敬请期待', MoreHorizontal, null, true],
  ],
  券: [
    ['满减优惠券', '用户满足指定金额后，可使用优惠券立减相应金额，如：设置满100-50券，符合要求的订单满100元后，立减50元。', Ticket, '/market/ticket'], ['折扣券', '折扣券', Percent], ['第二件半价券', '设置第二件半价券。', Ticket],
    ['消费送券', '达到消费金额赠送优惠券', Gift], ['买一送一券', '针对营销活动买一送一设置券品', Ticket], ['商品兑换券', '设置可兑换成商品的券', Repeat],
    ['免配送费券', '可设置一张免除订单配送费的券', Truck], ['固定价格券', '设置该券后，允许用户以固定价格兑换指定商品，如：设置一个固定价格9.9的券，商品20元，用户使用券后只需要9.9元兑换该商品。', Ticket], ['包邮券', '设置免除快递费的券', Package],
    ['多次折扣券', '持续使用享优惠，促进用户重复购买', Percent],
  ],
  第三方平台营销: [
    ['微信投放计划', '微信生态的营销投放，如摇一摇、支付有礼等，通过智能算法投放，促进消费转化，提升营销效果', Megaphone, null, false, '推荐'], ['美团团购', '门店堂食、自提订单核销美团团购券', Store], ['抖音团购', '可在小程序兑换、核销在抖音购买的团购券', Smartphone],
    ['发微信图文有奖', '通过微信图文组件发表内容后，获得相应奖励', ImageIcon], ['支付宝团购', '门店可核销支付宝购买的团购券', Wallet],
  ],
  推送: [['推送活动消息', '给用户推送服务通知', Send], ['短信推送', '给用户推送短信消息', MessageSquare]],
  扩展工具: [['微信公众号', '链接公众号，玩转微信生态', MessageSquare]],
};
export const MARKET_INDEX = Object.values(MARKET).flat();

function FeatureGrid({groups, base}) {
  return Object.entries(groups).map(([group, items]) => (
    <div key={group}>
      <div className="feat-group">{group}</div>
      <div className="feat-grid">
        {items.map(([name, desc, Icon, route, off, badge]) => (
          <div key={name} className={`feat ${off ? 'off' : ''}`} onClick={() => (off ? pending(name) : go(route || `${base}?name=${encodeURIComponent(name)}`))}>
            <div className="feat-icon" style={off ? {background: '#c0c4cc'} : undefined}><Icon /></div>
            <div><b>{name}{badge && <span className={`tag ${badge === '推荐' || badge === '限时免费' ? 'solid-red' : 'gray'}`}>{badge}</span>}</b><span title={desc}>{desc}</span></div>
          </div>
        ))}
      </div>
    </div>
  ));
}

export function Market() {
  const [tab, setTab] = useState('营销功能');
  return (
    <Card>
      <Tabs variant="line" items={['营销功能', '同享互斥规则']} value={tab} onChange={setTab} />
      {tab === '营销功能' ? <><div style={{width: 1010, maxWidth: '100%'}}><Banner /></div><FeatureGrid groups={MARKET} base="/market/feature" /></> : (
        <>
          <Tip>设置不同营销活动之间是否可以同时享受，例如会员价与优惠券是否可以叠加使用。</Tip>
          <Table columns={['活动', '会员价', '优惠券', '满减活动', '限时折扣', '积分抵扣'].map((t) => ({title: t, key: t, render: (r) => (t === '活动' ? r.a : <Switch size="sm" defaultChecked={t !== '满减活动'} label={null} />)}))} data={['会员价', '优惠券', '满减活动', '限时折扣', '积分抵扣'].map((a) => ({id: a, a}))} />
          <SaveBar />
        </>
      )}
    </Card>
  );
}

const SOURCE_TEXT = {invite: '邀新奖励(新用户)', invite_reward: '邀新奖励(邀请人)', merchant: '商家发放', gift: '好友转赠'};

/** Edit the two invite-reward coupon templates (settings.rewards). */
function RewardsForm({onSaved}) {
  const {data, error, reload} = useApi(() => api.settings().then((d) => d.settings.rewards), []);
  const [form, setForm] = useState(null);
  React.useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <><ErrorBar error={error} onRetry={reload} /><div className="empty">加载中…</div></>;
  const set = (who, k) => (v) => setForm({...form, [who]: {...form[who], [k]: v}});
  const save = async () => {
    try {
      const num = (r) => ({...r, amount: Number(r.amount), threshold: Number(r.threshold), validDays: Number(r.validDays), count: Number(r.count)});
      await api.saveSetting('rewards', {newUser: num(form.newUser), inviter: num(form.inviter)});
      toast('邀新奖励已保存'); reload(); onSaved?.();
    } catch (e) { toast(e.message, 'info'); }
  };
  const block = (who, label) => (
    <>
      <Section>{label}</Section>
      <F label="券名称" required><Input w="m" value={form[who].title} onChange={set(who, 'title')} /></F>
      <F label="使用门槛"><span>满</span><Input w="xs" value={String(form[who].threshold)} onChange={set(who, 'threshold')} /><span>元减</span><Input w="xs" value={String(form[who].amount)} onChange={set(who, 'amount')} /><span>元</span></F>
      <F label="有效期"><span>领取后</span><Input w="xs" value={String(form[who].validDays)} onChange={set(who, 'validDays')} /><span>天内有效</span></F>
      <F label="发放张数" help="0 表示不发放"><Input w="xs" value={String(form[who].count)} onChange={set(who, 'count')} /><span>张</span></F>
    </>
  );
  return <Form>{block('newUser', '新用户（被邀请人）将获得')}{block('inviter', '每邀请 1 个新用户，邀请人可获得')}<SaveBar onSave={save} /></Form>;
}

export function MarketTicket() {
  const {data, loading, error, reload} = useApi(() => api.couponSummary(), []);
  const [editRewards, setEditRewards] = useState(false);
  return (
    <Card>
      <FeatureHead icon={Ticket} title="满减优惠券" desc="用户满足指定金额后，可使用优惠券立减相应金额，如：设置满100-50券，符合要求的订单满100元后，立减50元。" />
      <ErrorBar error={error} onRetry={reload} />
      <div className="ad-row"><Btn type="primary" onClick={() => setEditRewards(true)}>设置邀新奖励券</Btn><Btn onClick={() => go('/user/userlist')}>给顾客发券</Btn><span className="ad-muted">优惠券通过邀新奖励自动发放，或在用户列表中手动发给顾客；好友转赠的券也会统计在内。</span></div>
      <Table loading={loading} rowKey="key" minWidth={1000} columns={[
        {title: '名称', key: 'title'}, {title: '使用门槛', key: 'rule', render: (c) => `满${money(c.threshold)}元减${money(c.amount)}元`},
        {title: '券类型', key: 't', render: () => '店铺领取可用'}, {title: '来源', key: 'source', render: (c) => SOURCE_TEXT[c.source] || c.source},
        {title: '有效期', key: 'v', render: (c) => (c.source.startsWith('invite') && data?.rewards ? `领券后${data.rewards[c.source === 'invite' ? 'newUser' : 'inviter'].validDays}天过期` : '按发放设置')},
        {title: '已发放', key: 'issued'}, {title: '可使用', key: 'available'}, {title: '已使用', key: 'used'}, {title: '已转赠', key: 'gifted'},
        {title: '操作', key: 'op', fixed: 'right', render: (c) => (c.source.startsWith('invite') ? <Lnk color="blue" onClick={() => setEditRewards(true)}>编辑</Lnk> : <Lnk color="blue" onClick={() => go('/user/userlist')}>发券</Lnk>)},
      ]} data={(data?.coupons || []).map((c, i) => ({...c, key: `${c.title}${c.source}${i}`}))} empty="还没有发放过优惠券" />
      <Dialog title="邀新奖励券" open={editRewards} onClose={() => setEditRewards(false)} okText="关闭" onOk={() => {}} width={680}><RewardsForm onSaved={reload} /></Dialog>
    </Card>
  );
}

export function MarketTopup() {
  const [tab, setTab] = useState('基本设置');
  const [openAdd, dialog] = useFormDialog('添加面额', [{label: '充值金额(元)', required: true}, {label: '赠送余额(元)'}, {label: '赠送优惠券', render: () => <Select placeholder="请选择" options={COUPONS.map((c) => c.name)} />}, {label: '适用门店', render: () => <Radios options={['全部门店', '指定门店']} />}]);
  return (
    <Card>
      <FeatureHead icon={Wallet} title="智慧充值" desc="允许客户充值并使用余额支付" toggle />
      <Tabs items={['基本设置', '充值记录']} value={tab} onChange={setTab} />
      {tab === '基本设置' ? (
        <Form>
          <F label="充值面额"><Btn type="primary" onClick={openAdd}>添加面额</Btn></F>
          <div style={{marginLeft: 140, width: 760, marginTop: -8, marginBottom: 20}}><Table columns={[{title: 'ID', key: 'id'}, {title: '充值金额(元)', key: 'amount', render: (r) => r.amount.toFixed(2)}, {title: '充值赠送', key: 'b', render: (r) => <span style={{fontSize: 12}}>余额 {r.bonus.toFixed(2)}<br />优惠券 {r.coupons}张 <Lnk color="blue">查看</Lnk></span>}, {title: '首充赠送', key: 'f', q: '说明', render: () => ''}, {title: '适用门店', key: 's', render: () => '全部门店'}, {title: '操作', key: 'op', render: () => <><Lnk color="blue" onClick={openAdd}>编辑</Lnk><Lnk color="red">删除</Lnk></>}]} data={TOPUP} /></div>
          <F label="小程序自定义充值" q="说明"><Btn type="primary" onClick={() => pending('添加方案')}>添加方案</Btn></F>
          <div style={{marginLeft: 140, width: 760, marginTop: -8, marginBottom: 20}}><Table columns={['ID', '充值赠送', '最低充值金额', '适用门店', '操作'].map((t) => ({title: t, key: t}))} data={[]} /></div>
          <F label="使用余额设置" help="比例是指用户充值时充值金额与赠送余额的比例"><Radios options={['按比例扣减本金和赠金', '优先使用本金部分']} /></F>
          <F label="充值并下单"><Switch defaultChecked /><Q /></F>
          <F label="下单充值强提醒"><Switch /></F>
          <F label="充值前绑定手机"><Switch /></F>
          <F label="余额变更短信通知" help="每条：0.055元，当前余额：0.000元"><Switch /><Lnk color="blue">去充值</Lnk></F>
          <F label="充值说明"><TextArea max={800} rows={4} defaultValue="1. 充值金额可用于本店消费；2. 充值赠送部分不可提现。" /></F>
          <F label="储值协议"><TextArea max={810} rows={4} defaultValue="储值协议内容由商家自行编辑。" /></F>
          <SaveBar text="保存设置"><Btn size="lg">重置</Btn></SaveBar>
        </Form>
      ) : (
        <><Table columns={['用户', '充值金额', '赠送金额', '支付方式', '充值时间', '状态'].map((t) => ({title: t, key: t}))} data={[]} /><Pager total={0} sizes jumper /></>
      )}
      {dialog}
    </Card>
  );
}

function MemberLevels() {
  const {data, error, reload} = useApi(() => api.settings().then((d) => d.settings), []);
  const [levels, setLevels] = useState(null);
  const [pointsRule, setPointsRule] = useState('');
  React.useEffect(() => { if (data) { setLevels(data.memberLevels); setPointsRule(data.pointsRule); } }, [data]);
  if (!levels) return <><ErrorBar error={error} onRetry={reload} /><div className="empty">加载中…</div></>;
  const set = (i, k) => (v) => setLevels(levels.map((l, j) => (j === i ? {...l, [k]: v} : l)));
  const save = async () => {
    try {
      await api.saveSetting('memberLevels', levels.map((l) => ({...l, rate: Number(l.rate), minSpent: Number(l.minSpent)})));
      await api.saveSetting('pointsRule', pointsRule);
      toast('会员规则已保存'); reload();
    } catch (e) { toast(e.message, 'info'); }
  };
  return (
    <>
      <Tip>会员等级按顾客已支付订单的累计实付金额实时计算；任何等级都需要先绑定手机号。小程序“会员中心”的说明文字来自每个等级的“等级说明”和下方积分规则。</Tip>
      <Table rowKey="level" columns={[
        {title: '等级', key: 'level', render: (l) => `V${l.level}`},
        {title: '名称', key: 'name', render: (l, i) => <Input w="s" value={l.name} onChange={set(i, 'name')} />},
        {title: '升级门槛（累计实付，元）', key: 'minSpent', render: (l, i) => <Input w="s" value={String(l.minSpent)} onChange={set(i, 'minSpent')} />},
        {title: '会员折扣（如 0.95 = 95折）', key: 'rate', render: (l, i) => <Input w="s" value={String(l.rate)} onChange={set(i, 'rate')} />},
        {title: '等级说明', key: 'rule', render: (l, i) => <Input w="l" value={l.rule} onChange={set(i, 'rule')} />},
        {title: '操作', key: 'op', render: (l, i) => (levels.length > 1 && i === levels.length - 1 ? <Lnk color="red" onClick={() => setLevels(levels.slice(0, -1))}>删除</Lnk> : '-')},
      ]} data={levels} />
      <div className="ad-row" style={{marginTop: 12}}>{levels.length < 5 && <Btn size="sm" onClick={() => setLevels([...levels, {level: levels.length + 1, name: '新等级', minSpent: (Number(levels.at(-1).minSpent) || 0) + 1000, rate: 0.9, rule: ''}])}>+ 添加等级</Btn>}</div>
      <Form><F label="积分规则"><textarea className="ta" rows={2} style={{width: 640}} value={pointsRule} onChange={(e) => setPointsRule(e.target.value)} /></F><SaveBar text="保存会员规则" onSave={save} /></Form>
    </>
  );
}

export function MarketMember() {
  const [tab, setTab] = useState('会员等级设置');
  return (
    <Card>
      <FeatureHead icon={Crown} title="超级会员" desc="用户会员管理设置" toggle />
      <Tabs items={['会员基础设置', '会员等级设置', '购买会员订单']} value={tab} onChange={setTab} />
      {tab === '会员基础设置' && (
        <Form>
          <Section>基础设置</Section>
          <F label="会员开通方式"><Radios options={[{value: 'buy', label: <>购买开通 <Q /></>}, {value: 'cond', label: '条件开通'}]} defaultValue="cond" disabled={['buy']} /></F>
          <F label="成为会员条件" help="当前版本：绑定手机号即成为会员，升级按累计实付金额"><Check checked onChange={() => {}}>绑定手机号码</Check><Check checked onChange={() => {}}>消费达到指定金额（见会员等级设置）</Check></F>
          <F label="参与会员价门店"><Radios options={['全部门店']} /></F>
          <F label="享受会员价"><Radios options={['所有支付方式']} /></F>
          <F label=""><Btn type="primary" onClick={() => setTab('会员等级设置')}>前往设置会员等级 ›</Btn></F>
        </Form>
      )}
      {tab === '会员等级设置' && <MemberLevels />}
      {tab === '购买会员订单' && <Table columns={['订单号', '用户', '会员等级', '金额', '支付时间', '状态'].map((t) => ({title: t, key: t}))} data={[]} empty="当前为条件开通，没有购买会员订单" />}
    </Card>
  );
}

function PartnerForm() {
  const {data, error, reload} = useApi(() => api.settings().then((d) => d.settings.partner), []);
  const [form, setForm] = useState(null);
  React.useEffect(() => { if (data) setForm({rate: String(Math.round(data.commissionRate * 1000) / 10), rules: data.rules}); }, [data]);
  if (!form) return <><ErrorBar error={error} onRetry={reload} /><div className="empty">加载中…</div></>;
  const save = async () => {
    try { await api.saveSetting('partner', {commissionRate: Number(form.rate) / 100, rules: form.rules}); toast('共享模式设置已保存'); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  return (
    <Form>
      <F label="页面标题"><Input w="l" defaultValue="共享合伙人" disabled /></F>
      <F label="开通方式"><Radios options={['自动开通', '不开通', '付费开通']} disabled={['不开通', '付费开通']} /></F>
      <F label="粉丝界面说明" help="显示在小程序“共享合伙人”页面顶部"><textarea className="ta" rows={5} style={{width: 640}} value={form.rules} onChange={(e) => setForm({...form, rules: e.target.value})} /></F>
      <div style={{borderTop: '1px solid #ebeef5', margin: '10px 0 20px'}} />
      <F label="订单一级分成" help="被邀请的好友订单完成后，邀请人获得订单实付金额 × 该比例的佣金（0 表示暂不分佣，最高 50%）"><Input w="s" value={form.rate} onChange={(v) => setForm({...form, rate: v.replace(/[^\d.]/g, '')})} /><span>%</span></F>
      <F label="提现到" help="提现需开通微信支付“商家转账到零钱”后接入"><Radios options={['微信零钱']} /></F>
      <SaveBar onSave={save} />
    </Form>
  );
}

export function MarketDistribution() {
  const [tab, setTab] = useState('基础设置');
  return (
    <Card>
      <FeatureHead icon={Network} title="共享模式" desc="让每个用户都变成业务员" />
      <div className="ad-row"><span>功能启用</span><Switch defaultChecked /></div>
      <Tabs items={['基础设置', '二维码设计', '分销员列表', '开通记录', '分销明细', '提现记录']} value={tab} onChange={setTab} />
      {tab === '基础设置' ? <PartnerForm /> : tab === '二维码设计' ? (
        <div style={{display: 'flex', gap: 30}}><div className="phone" style={{height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span className="qr" style={{width: 120, height: 120}} /></div><Form narrow><F label="背景图"><Upload /></F><F label="二维码位置"><Radios options={['居中', '底部']} /></F><F label=""><Btn type="primary" onClick={() => pending('保存海报')}>保存</Btn></F></Form></div>
      ) : (
        <><Tip>顾客通过分享链接邀请好友后自动成为共享合伙人；各合伙人的邀请和佣金可在 用户列表 → 更多 中查看，汇总列表将在下一版本提供。</Tip><Table columns={({分销员列表: ['分销员', '等级', '粉丝数', '累计佣金', '可提现', '开通时间', '操作'], 开通记录: ['用户', '开通方式', '金额', '开通时间'], 分销明细: ['分销员', '订单号', '订单金额', '佣金', '状态', '时间'], 提现记录: ['分销员', '提现金额', '到账方式', '状态', '申请时间', '操作']}[tab]).map((t) => ({title: t, key: t}))} data={[]} /></>
      )}
    </Card>
  );
}

/** Generic page for the remaining marketing features (same header/tabs pattern). */
export function MarketFeature({query}) {
  const name = query.name || '营销活动';
  const item = MARKET_INDEX.find(([n]) => n === name);
  const [tab, setTab] = useState('活动列表');
  const [openAdd, dialog] = useFormDialog(`新建${name}`, [{label: '活动名称', required: true}, {label: '活动时间', render: () => <Input w="m" placeholder="开始时间 至 结束时间" />}, {label: '适用门店', render: () => <Radios options={['全部门店', '指定门店']} />}]);
  return (
    <Card>
      <FeatureHead icon={item?.[2] || Gift} title={name} desc={item?.[1] || ''} toggle />
      <Tabs items={['活动列表', '基本设置', '数据统计']} value={tab} onChange={setTab} />
      {name === '邀请裂变' && tab === '活动列表' && <RewardsForm />}
      {name !== '邀请裂变' && tab === '活动列表' && <><Btn type="primary" onClick={openAdd}>新建活动</Btn><div style={{height: 14}} /><Table columns={['活动名称', '活动时间', '适用门店', '参与人数', '状态', '操作'].map((t) => ({title: t, key: t}))} data={[]} /><Pager total={0} sizes jumper /></>}
      {tab === '基本设置' && <Form><F label="启用"><Switch defaultChecked /></F><F label="活动说明"><TextArea rows={4} placeholder={`${name}活动说明`} /></F><SaveBar /></Form>}
      {tab === '数据统计' && <div className="stat-grid" style={{gridTemplateColumns: 'repeat(4, 1fr)'}}>{['参与人数', '订单数', '带动销售额', '优惠金额'].map((k) => <div key={k} className="stat"><div className="k">{k}</div><div className="v">0</div></div>)}</div>}
      {dialog}
    </Card>
  );
}

const APPS = {
  '': [
    ['存酒', '用户未喝完的酒可暂存在店里', Wine], ['评价', '用户订单评价', MessageSquare], ['门店WIFI', '可设置各个门店WIFI', Wifi, '/setting/storeSetting?tabIndex=2'],
    ['排队取号', '门店在线排队取号', ClipboardList], ['预约订座', '方便预约消费，可设置不同时段的预约方案', CalendarCheck], ['表单工具', '可制作各类报名表、数据收集、商务合作等表单', ClipboardList],
    ['手机号验证组件', '可管理快速获取手机号码验证的功能', Smartphone], ['有效期打印', '管理打印有效期标签小票', Printer], ['实时快递查询', '可实时查询物流动态', Truck, '/assist/express'],
    ['后厨显示系统(KDS)', '后厨可实时接收并展示来自各渠道的订单信息', ChefHat, '/setting/screen'], ['取餐屏', '取餐屏支持自定义字体及标题，品牌可根据品牌的宣传调性进行字体及文案的设计', MonitorPlay, '/setting/screen'], ['开发票管理', '方便用户可直接在订单里面申请开发票', Receipt, null, true, '未开通'],
  ],
  第三方平台: [
    ['京东秒送', '直连京东秒送平台，实现商品、库存、订单、经营数据的实时同步', Store, null, false, '限时免费'],
    ['淘宝闪购', '直连淘宝闪购渠道，实现商品、库存、订单、经营数据同步,有效降低运营成本。', Store, null, true, '未开通'],
    ['美团外卖', '直连美团外卖，实现商品、库存、订单、经营数据同步,有效降低运营成本。', Store, null, true, '未开通'],
  ],
};

export function Application() {
  return <Card title="应用中心" style={{minHeight: 560}}>{Object.entries(APPS).map(([group, items]) => <div key={group}>{group && <div className="feat-group">{group}</div>}<FeatureGrid groups={{'': items}} base="/application/app" /></div>)}</Card>;
}

export function AppDetail({query}) {
  const name = query.name || '应用';
  return (
    <Card>
      <FeatureHead icon={MARKET_INDEX.find(([n]) => n === name)?.[2] || Store} title={name} desc={Object.values(APPS).flat().find(([n]) => n === name)?.[1] || ''} toggle />
      <Tabs items={['基本设置', '记录']} value="基本设置" onChange={() => pending('切换')} />
      <Form><F label="启用"><Switch defaultChecked /></F><F label="说明"><TextArea rows={4} /></F><SaveBar /></Form>
    </Card>
  );
}

function AuditLog({open, onClose}) {
  const {data, loading} = useApi(() => (open ? api.audit(1) : Promise.resolve(null)), [open]);
  return (
    <Dialog title="操作日志" open={open} onClose={onClose} okText="关闭" onOk={() => {}} width={820}>
      <Table loading={loading} columns={[{title: '时间', key: 'at', minWidth: 150, render: (l) => fmtTime(l.at)}, {title: '操作人', key: 'actor'}, {title: '操作', key: 'action'}, {title: '对象', key: 'target', render: (l) => l.target || '-'}, {title: '详情', key: 'detail', render: (l) => <span style={{fontSize: 12}}>{l.detail ? JSON.stringify(l.detail).slice(0, 80) : '-'}</span>}]} data={data?.logs || []} empty="暂无日志" />
    </Dialog>
  );
}

export function Worker({query = {}}) {
  const [tab, setTab] = useState('员工管理');
  const [logOpen, setLogOpen] = useState(query.log === '1');
  const [openAdd, dialog] = useFormDialog('添加员工', [{label: '名称', required: true}, {label: '登录账号', required: true, placeholder: '手机号'}, {label: '登录密码', required: true}, {label: '门店权限', render: () => <Select options={[STORE.name]} />}, {label: '页面权限', render: () => <Select options={['全部页面', '订单与收银', '仅查看数据']} />}]);
  return (
    <Card style={{minHeight: 560}}>
      <Tabs items={['员工管理', '出品部门']} value={tab} onChange={setTab} />
      {tab === '员工管理' ? (
        <>
          <div className="ad-row"><Btn type="primary" onClick={openAdd}>添加员工</Btn><label className="l" style={{marginLeft: 10}}>所属门店</label><Select placeholder="请选择" options={[STORE.name]} /><label className="l" style={{marginLeft: 10}}>搜索员工</label><Input placeholder="名称/账号" /><Btn type="primary" onClick={() => pending('查询')} style={{width: 96}}>查询</Btn><Btn onClick={() => setLogOpen(true)}>日志记录</Btn></div>
          <Tip>当前版本只有一个商户管理员账号（在服务器上用 npm run admin:create 创建），多员工账号与页面权限将在后续版本提供。</Tip>
          <Table columns={['名称', '登录账号', '账号来源', '门店权限', '页面权限', '操作'].map((t) => ({title: t, key: t}))} data={[]} />
          <Pager total={0} sizes align="center" />
        </>
      ) : (
        <><Btn type="primary" onClick={() => pending('添加出品部门')}>添加出品部门</Btn><div style={{height: 14}} /><Table columns={['部门名称', '关联打印机', '关联分类', '操作'].map((t) => ({title: t, key: t}))} data={[]} /></>
      )}
      {dialog}
      <AuditLog open={logOpen} onClose={() => setLogOpen(false)} />
    </Card>
  );
}

export function Device() {
  const [tab, setTab] = useState('打印机');
  return (
    <Card style={{minHeight: 560}}>
      <Tabs items={['打印机', '收银机']} value={tab} onChange={setTab} />
      {tab === '打印机' ? <PrinterBox /> : <><div style={{fontSize: 13, marginBottom: 12}}>当前还可以添加 5 台收银机</div><div className="addbox" onClick={() => pending('添加收银机')}><PlusCircle size={22} />添加收银机</div></>}
    </Card>
  );
}

export function Login({onLogin}) {
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!account || !password) { setErr('请输入账号和密码'); return; }
    setBusy(true);
    setErr('');
    try {
      await onLogin(account.trim(), password);
    } catch (error) {
      setErr(error.message);
      setBusy(false);
    }
  };
  return (
    <div className="login">
      <div className="login-card">
        <h1><span style={{width: 34, height: 34, borderRadius: 8, background: '#2bad5b', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 18}}>如</span>商家管理后台</h1>
        <p>{STORE.name} · 商户登录</p>
        <input className="inp" placeholder="管理员账号" autoComplete="username" value={account} onChange={(e) => setAccount(e.target.value)} />
        <input className="inp" type="password" placeholder="登录密码" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 13}}><Check defaultChecked>自动登录</Check><Lnk color="gray" onClick={() => pending('忘记密码：请在服务器上运行 npm run admin:password -- 用户名')}>忘记密码？</Lnk></div>
        {err && <div style={{color: '#f56c6c', fontSize: 12, marginTop: 10}}>{err}</div>}
        <Btn type="primary" onClick={submit} disabled={busy}>{busy ? '登录中…' : '登录'}</Btn>
      </div>
    </div>
  );
}
