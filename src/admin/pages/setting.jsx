import React, {useState} from 'react';
import {Search, Settings as SettingsIcon, Menu as MenuIcon, PlusCircle, MapPin} from 'lucide-react';
import {Card, Section, Btn, Lnk, Input, Select, Tabs, Table, Switch, Check, Radios, Form, F, Upload, TextArea, Tip, Tag, Q, Stepper, SaveBar, ErrorBar, useFormDialog, pending, toast} from '../ui';
import {api, useApi} from '../api';
import {ALERT_KEY} from '../Layout';
import {STORE, MP_PATHS} from '../mock';
import {go} from '../router';

export function MiniAuth() {
  const [openExp, expDialog] = useFormDialog('添加体验者', [{label: '微信号', required: true, placeholder: '请输入体验者微信号'}]);
  return (
    <div className="ad-split">
      <Card style={{flex: 1, minHeight: 560}} title={<span style={{fontSize: 15}}>小程序信息</span>}><div style={{borderTop: '1px solid #ebeef5', margin: '-4px -24px 0'}} /></Card>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <Card title={<span style={{fontSize: 15}}>授权小程序</span>}>
          <div style={{textAlign: 'center', borderTop: '1px solid #ebeef5', margin: '0 -24px', paddingTop: 18}}>
            <div style={{width: 56, height: 56, borderRadius: '50%', border: '2px solid #333', margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700}}>如</div>
            <span className="qr" style={{margin: 0}} />
            <div style={{fontSize: 17, fontWeight: 600, margin: '6px 0'}}>{STORE.name}</div>
            <div className="ad-muted">appid: wx0000000000000000</div>
            <div style={{margin: '14px 0 10px', fontSize: 13}}>当前版本号：7.8.9</div>
            <div style={{display: 'inline-flex', gap: 10, background: '#f5f6f8', padding: '6px 12px', fontSize: 12, color: '#606266', borderRadius: 3}}>隐私设置保护指引： <Lnk color="blue">查询</Lnk> | 地理位置接口权限： 已开通 | 小程序备案： 已备案 <Lnk color="blue">查看详情</Lnk></div>
            <div style={{display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14}}><Btn onClick={() => pending('预览小程序')}>预览小程序</Btn><Btn type="primary" onClick={() => pending('更新小程序版本')}>更新到 7.9.4</Btn><Btn onClick={() => pending('版本回退')}>版本回退</Btn></div>
          </div>
        </Card>
        <Card title={<span style={{fontSize: 15}}>绑定体验者</span>} extra={<Btn size="sm" onClick={openExp}>添加体验者</Btn>} style={{flex: 1}}>
          <Tip>如果想查看所有体验者，请到微信公众平台-登录小程序-用户身份中设置，<Lnk color="blue">点击这里跳转</Lnk>。</Tip>
          <div style={{textAlign: 'center', padding: '20px 0'}}><div style={{fontSize: 17, fontWeight: 600, marginBottom: 8}}>添加体验者后，即可体验未发布的小程序</div><div className="ad-muted" style={{marginBottom: 16}}>如果想查看所有体验者，请到微信公众平台-登录小程序-用户身份中设置，<Lnk color="blue">点击这里跳转</Lnk>。</div><Btn type="primary" onClick={openExp}>添加体验者</Btn></div>
        </Card>
      </div>
      {expDialog}
    </div>
  );
}

const TOGGLES = [['自取功能', false], ['配送功能', true], ['快递功能', false], ['堂食功能', false, true], ['无桌码堂食', false, true], ['预点餐', false, true], ['自取保留桌码', false, true], ['预售可多件下单', false, true], ['堂食可选打包外带', false, true]];

function StoreBasic() {
  const {data, error, reload} = useApi(() => api.settings().then((d) => d.settings.store), []);
  const [form, setForm] = useState(null);
  React.useEffect(() => { if (data) setForm(data); }, [data]);
  if (!form) return <><ErrorBar error={error} onRetry={reload} /><div className="empty">加载中…</div></>;
  const set = (k) => (v) => setForm({...form, [k]: v});
  const setHours = (k) => (e) => setForm({...form, hours: {...form.hours, [k]: e.target.value === '23:59' && k === 'close' ? '24:00' : e.target.value}});
  const save = async () => {
    try { await api.saveSetting('store', form); toast('门店设置已保存'); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  return (
    <Form>
      <F label="门店头像"><div style={{width: 84, height: 84, borderRadius: 4, border: '1px solid #ebeef5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700}}>{form.name.slice(0, 1)}</div></F>
      <F label="门店图片" help="用于附近门店组件显示，建议大图分辨率：1126x750 像素，小图：240*240（图片上传待接入）"><Upload wide text="点击上传" /></F>
      <F label="门店名称" required><Input w="l" value={form.name} onChange={set('name')} /></F>
      <F label="门店编码"><Input w="l" placeholder="可为空" /></F>
      <F label="门店地址" help="小程序点单页显示的距离文案，接入定位后改为自动计算"><Input w="l" value={form.distanceText} onChange={set('distanceText')} placeholder="如：距离 1.2km" /></F>
      <F label="商家电话" required help="小程序“联系商家”“订餐电话”拨打此号码"><Input w="m" value={form.phone} onChange={set('phone')} /></F>
      <F label="营业状态"><Select value={form.accepting ? 'open' : 'closed'} onChange={(v) => set('accepting')(v === 'open')} options={[{value: 'open', label: '正常营业'}, {value: 'closed', label: '暂停营业'}]} /></F>
      <F label="当前营业状态"><Tag color={form.accepting ? '' : 'gray'}>{form.accepting ? '营业中' : '已暂停接单'}</Tag></F>
      <F label="营业时间" help="不在营业时间内顾客无法下单；结束时间选 23:59 表示营业到当天结束"><div style={{display: 'flex', gap: 10, alignItems: 'center', background: '#f5f6f8', padding: '8px 12px', borderRadius: 3, fontSize: 13}}><Tag>正常</Tag>周一至周日<input type="time" className="inp" style={{width: 120}} value={form.hours.open} onChange={setHours('open')} />至<input type="time" className="inp" style={{width: 120}} value={form.hours.close === '24:00' ? '23:59' : form.hours.close} onChange={setHours('close')} /></div></F>
      <F label="门店公告" help={form.accepting ? '暂停营业时顾客下单会看到这条提示' : '顾客下单时会看到这条提示'}><Input w="l" value={form.notice} onChange={set('notice')} placeholder="如：今日休息，明天 10:00 恢复营业" /></F>
      <F label="开启商品详情"><Switch defaultChecked label="开启" /></F>
      <F label="加购后返回"><Switch defaultChecked label="开启" /></F>
      <F label="订单详情客服"><Check defaultChecked>联系电话</Check><Check>在线客服</Check></F>
      <SaveBar onSave={save} />
    </Form>
  );
}

export function StoreSetting({query}) {
  const tabs = ['门店基本设置', '门店下单设置', '门店WIFI'];
  const tab = tabs[Number(query.tabIndex) || 0];
  const setTab = (t) => go(`/setting/storeSetting?tabIndex=${tabs.indexOf(t)}`);
  return (
    <Card>
      <Tabs items={tabs} value={tab} onChange={setTab} />
      {tab === '门店基本设置' && <StoreBasic />}
      {tab === '门店下单设置' && (
        <Form>
          <F label="下单优先"><Radios options={['堂食优先', '外卖优先', '自取优先', '快递优先']} defaultValue="自取优先" disabled={['堂食优先', '快递优先']} /></F>
          {TOGGLES.map(([label, on, q]) => <F key={label} label={label}><Switch defaultChecked={on} onLabel="开启" offLabel={label.endsWith('功能') ? '开启' : '关闭'} />{q && <Q />}</F>)}
          <F label="等待支付时间(分钟)"><Stepper defaultValue={15} /></F>
          <F label="库存规则"><Radios options={['支付减库存', '下单减库存']} /><Q /></F>
          <F label="添加临时菜"><Switch defaultChecked label="开启" /></F>
          <F label="下单完成跳转"><Radios options={['订单详情', '取单页']} /></F>
          <F label="显示取单二维码"><Switch label="关闭" /></F>
          <F label="小程序单品备注"><Btn size="sm" onClick={() => pending('设置单品备注')}>设置</Btn></F>
          <F label="下单强制阅读提醒"><Btn size="sm" onClick={() => pending('设置下单提醒')}>设置</Btn></F>
          <F label="附加费"><div style={{width: 700}}><Table columns={['费用名称', '价格', '配送', '自取', '堂食', '快递', '按件收取'].map((t) => ({title: t, key: t})).concat([{title: <Lnk color="blue" onClick={() => pending('添加附加费')}>添加附加费</Lnk>, key: 'op'}])} data={[]} /></div></F>
          <F label="用户可申请退款"><Switch defaultChecked label="开启" /></F>
          <F label="申请退款期限"><Input w="s" /><span>天(0为不限制)</span></F>
          {[['堂食最低消费', true], ['自取最低消费', false], ['配送最低消费', true], ['快递最低消费', true]].map(([label, on]) => <F key={label} label={label}><Switch defaultChecked={on} onLabel="开启" offLabel="不设置" />{on && <Lnk color="blue">设置{label}</Lnk>}</F>)}
          <F label="敏感操作统计"><Switch label="不设置" /></F>
          <F label="下单显示下单人和时间"><Switch /><Lnk color="blue">查看示例</Lnk></F>
          <F label="就餐模式"><Radios options={['取单模式', '正餐模式']} /></F>
          <F label="提示弹框开启"><Check>订单列表点击已领取时提示确认</Check></F>
          <SaveBar text="保存设置" />
        </Form>
      )}
      {tab === '门店WIFI' && (
        <Form>
          <F label="WIFI名称"><Input w="l" placeholder="请输入WIFI名称" /></F>
          <F label="WIFI密码"><Input w="l" placeholder="请输入WIFI密码" /></F>
          <F label="小程序显示"><Switch label="显示" /></F>
          <SaveBar />
        </Form>
      )}
    </Card>
  );
}

export function Inform() {
  const [tab, setTab] = useState('微信通知');
  const [openAdd, dialog] = useFormDialog('添加用户', [{label: '姓名', required: true}, {label: '绑定方式', render: () => <span className="ad-muted">保存后使用微信扫描二维码完成绑定</span>}]);
  return (
    <Card title="订单提醒">
      <div className="ad-gray" style={{display: 'flex', alignItems: 'center', gap: 14}}><b>后台新订单提醒</b><Switch defaultChecked={localStorage.getItem(ALERT_KEY) !== 'off'} onChange={(on) => { localStorage.setItem(ALERT_KEY, on ? 'on' : 'off'); toast(on ? '已开启声音提醒' : '已关闭声音提醒'); }} label="有新订单待接单时播放提示音（后台页面需保持打开）" /></div>
      <Tabs items={['微信通知', '短信通知', '邮箱通知']} value={tab} onChange={setTab} />
      {tab !== '邮箱通知' && <Tip>{tab}需要在微信小程序后台申请订阅消息模板{tab === '短信通知' ? '并开通短信服务' : ''}后接入，当前请使用上方的后台声音提醒。</Tip>}
      <div className="ad-row"><Btn type="primary" onClick={openAdd}>添加{tab === '邮箱通知' ? '邮箱' : '用户'}</Btn><span style={{fontSize: 13}}>当前还可以添加10个{tab === '邮箱通知' ? '邮箱' : '用户'}</span></div>
      <Table columns={(tab === '微信通知' ? ['姓名', 'openid', '绑定时间', '操作'] : tab === '短信通知' ? ['姓名', '手机号', '添加时间', '操作'] : ['姓名', '邮箱', '添加时间', '操作']).map((t) => ({title: t, key: t}))} data={[]} />
      {dialog}
    </Card>
  );
}

export function Helper() {
  const [tab, setTab] = useState('员工管理');
  return (
    <Card title="小程序助手">
      <Tabs items={['员工管理', '角色管理']} value={tab} onChange={setTab} />
      {tab === '员工管理' ? (
        <>
          <Btn type="primary" onClick={() => pending('绑定管理员（生成绑定二维码）')}>绑定管理员</Btn><div style={{height: 14}} />
          <Table columns={[{title: '#', key: 'i', render: (_, i) => i + 1}, {title: '用户头像', key: 'a', render: () => <span className="thumb">👤</span>}, {title: '用户姓名', key: 'name'}, {title: '用户角色', key: 'role'}, {title: '绑定时间', key: 'time'}, {title: '操作', key: 'op', render: () => <><Lnk onClick={() => pending('编辑权限')}>编辑权限</Lnk><Lnk color="red" onClick={() => pending('删除管理员')}>删除</Lnk></>}]} data={[{id: 1, name: '店长', role: '-', time: '2024-01-03 15:15:18'}]} />
        </>
      ) : (
        <><Btn type="primary" onClick={() => pending('添加角色')}>添加角色</Btn><div style={{height: 14}} /><Table columns={['角色名称', '权限', '操作'].map((t) => ({title: t, key: t}))} data={[]} /></>
      )}
    </Card>
  );
}

const SIMPLE_WIDGETS = ['焦点入口', '集章/集点卡', '领取优惠券', '储值余额', '悬浮窗口', '会员积分', '客服入口', '附近门店'];
const WIDGETS = ['轮播图', '导航', '门店列表', '商品列表', '营销模块', '集点卡', '公众号组件', '套餐推广', '搜索模块', '门店标题', '购物车', '公告栏', '微信小店商品', '微信小店', '微信图文'];
const FREE = ['自由容器', '悬浮容器', '图片', '文本', '就餐方式标识', '昵称', '头像', '手机号', '积分', '余额', '可用券数量', '礼品卡可用数量', '已集章数', '门店名称', '门店距离', '门店信息', '就餐方式', '会员标识', '会员进度', '会员进度说明', '会员等级说明'];

export function NewHome() {
  const [page, setPage] = useState('首页');
  const [sub, setSub] = useState('首页');
  const [layers, setLayers] = useState(['轮播图', '自由容器', '自由容器', '自由容器', '自由容器', '轮播图']);
  const add = (w) => { setLayers([...layers, w]); toast(`已添加组件：${w}`); };
  const block = (title, list) => (
    <>
      <div style={{fontWeight: 600, padding: '10px 6px 8px', display: 'flex', alignItems: 'center', gap: 4}}>{title}</div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6}}>{list.map((w) => <div key={w} onClick={() => add(w)} style={{background: '#fff', border: '1px solid #ebeef5', borderRadius: 3, height: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: '#606266', cursor: 'pointer'}}><span style={{fontSize: 16}}>▣</span>{w}</div>)}</div>
    </>
  );
  return (
    <Card tight>
      <Tabs items={['首页', '点餐页', '商品详情页', '订单中心', '个人中心', '会员页', '用户下单弹幕', '底部导航设计', '专题页面', '充值页面']} value={page} onChange={setPage} />
      <div className="ad-row"><Tabs variant="seg" items={['首页', '加载页']} value={sub} onChange={setSub} style={{margin: 0}} /><span style={{marginLeft: 'auto', display: 'flex', gap: 10}}><Btn type="primary" onClick={() => pending('保存装修')} style={{width: 90}}>保存</Btn><Btn onClick={() => pending('保存到记录')}>保存到记录</Btn><Btn onClick={() => pending('查看模板')}>查看模板</Btn></span></div>
      <div className="ad-row"><span>开启{page}</span><Switch defaultChecked /></div>
      <div style={{display: 'flex', gap: 30, alignItems: 'flex-start'}}>
        <div style={{width: 230, flex: '0 0 230px', background: '#f5f6f8', borderRadius: 4, padding: 8, maxHeight: 640, overflowY: 'auto'}}>
          {block(<>极简组件 <Q /></>, SIMPLE_WIDGETS)}{block('组件', WIDGETS)}{block('自由容器组件', FREE)}
          <div style={{fontWeight: 600, padding: '14px 6px 6px'}}>记录最近保存</div><div className="ad-muted" style={{padding: '0 6px 10px'}}>暂无记录</div>
        </div>
        <div className="phone">
          <div style={{height: 300, background: 'linear-gradient(135deg,#6b4a3a,#c98a55 50%,#3e2a22)', position: 'relative', color: '#fff'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 12}}><b>9:41</b><span>••• ◉</span></div>
            <div style={{position: 'absolute', left: 18, top: 60, fontSize: 28, fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,.4)'}}>如一<div style={{fontSize: 14, letterSpacing: 6}}>商务餐</div></div>
          </div>
          <div style={{margin: '-30px 12px 0', position: 'relative', background: '#fff', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', padding: 10, gap: 8, fontSize: 12}}><span className="thumb" style={{borderRadius: '50%', width: 36, height: 36, flexBasis: 36}}>👤</span><div style={{flex: 1}}><b>微信昵称</b><div className="ad-muted">手机号码</div></div><div style={{textAlign: 'center'}}><b>0.00</b><div className="ad-muted">余额</div></div><div style={{textAlign: 'center', marginLeft: 10}}><b>0</b><div className="ad-muted">可用券</div></div></div>
          <div style={{margin: 12, height: 80, borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}><b style={{fontSize: 24, letterSpacing: 3}}>外卖订餐</b><span className="ad-muted">delivery</span></div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '0 12px'}}>{['老板微信', '推荐朋友', '订餐电话'].map((t) => <div key={t} style={{height: 70, borderRadius: 4, boxShadow: '0 1px 5px rgba(0,0,0,.12)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{t}</div>)}</div>
        </div>
        <div style={{width: 200, background: '#f5f6f8', borderRadius: 4, padding: 10}}>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontWeight: 600}}>图层列表<span><Lnk color="blue" onClick={() => pending('导入')}>导入</Lnk><Lnk color="blue" onClick={() => pending('全部导出')}>全部导出</Lnk></span></div>
          <div style={{background: '#fff', borderRadius: 3}}>
            <div style={{padding: '12px', fontSize: 13, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0'}}>全局配置 <SettingsIcon size={14} color="#909399" /></div>
            {layers.map((l, i) => <div key={`${l}${i}`} style={{padding: '12px', fontSize: 13, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0'}}>{l}<span style={{display: 'flex', gap: 8}}><span className="lnk red" onClick={() => setLayers(layers.filter((_, j) => j !== i))}>✕</span><MenuIcon size={14} color="#909399" /></span></div>)}
            <div style={{padding: '12px', fontSize: 13, display: 'flex', justifyContent: 'space-between'}}>页面设置 <PlusCircle size={14} color="#909399" /></div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const SYS_MENU = ['基础设置', '转发设置', '支付设置', '配送设置', '快递设置', '等单提醒', '座位预约', '下单预约', '下单表单', '常用备注', '加载图标', '模板消息', '副屏设置'];

function SysBasic() {
  return (
    <Form>
      <F label="版权图标"><div style={{width: 100, height: 48, border: '1px solid #ebeef5', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700}}>如一</div><span className="ad-muted">建议尺寸：100*48px ,留空则为默认</span></F>
      <F label="首次授权头像昵称"><Switch defaultChecked label="新用户在首次使用时弹出授权头像昵称" /><Q /></F>
      <F label="首页提示收藏小程序"><Switch defaultChecked label="设置" /></F>
      <F label="强制获取GPS"><Switch label="不设置" /><Q /></F>
      <F label="选择门店模式"><Radios options={['传统排列', '按城市排列']} /></F>
      <F label="显示月销量"><Switch label="不显示" /></F>
      <F label="选择就餐人数/桌位费"><Switch label="关闭" /></F>
      <F label="开启最近购买"><Switch label="关闭" /><Q /></F>
      <F label="手机号码前缀"><Select options={['中国大陆', '中国香港', '中国澳门', '中国台湾']} /></F>
      <F label="预留电话必填" warn="可能会导致小程序违规，获取手机号码将不可用，请谨慎开启！"><Switch label="关闭" /><Q /></F>
      <F label="多门店下单提醒"><Switch label="关闭" /><Q /></F>
      <F label="转发商品不可售提醒"><Radios options={['提示选购其他商品', '提示选择其他门店', '提示跳转至其他门店']} /></F>
      <F label="提示选择下单方式"><Switch label="关闭" /></F>
      <F label="配送标签"><Input w="m" placeholder="如：外卖、配送，默认：配送" /></F>
      <F label="自取标签"><Input w="m" placeholder="如：自取、打包，默认：自取" /></F>
      <F label="快递标签"><Input w="m" placeholder="如：邮寄、快递，默认：快递" /></F>
      <F label="包装费标签"><Input w="m" placeholder="默认：包装费" /></F>
      <F label="自取单号前缀"><Input w="m" /></F>
      <F label="配送单号前缀"><Input w="m" /></F>
      <F label="取单号模式" help="切换模式，计号规则即刻生效"><Radios options={['统一取单号', '独立取单号']} /></F>
      <F label="取单号" help="输入0则每天随机开始，改动次日生效"><span>从</span><Input w="s" defaultValue="1" /><span>开始</span></F>
      <F label="快递显示取单号"><Radios options={['显示', '不显示']} /></F>
      <SaveBar />
    </Form>
  );
}

function SysGeneric({name}) {
  return (
    <Form>
      <F label={`启用${name}`}><Switch /></F>
      <F label="说明"><TextArea placeholder={`${name}说明`} /></F>
      <SaveBar />
    </Form>
  );
}

export function MiniGram() {
  const [item, setItem] = useState('基础设置');
  return (
    <Card style={{display: 'flex', gap: 20, padding: '16px 20px'}}>
      <div className="vmenu">{SYS_MENU.map((m) => <div key={m} className={item === m ? 'on' : ''} onClick={() => setItem(m)}>{m}</div>)}</div>
      <div style={{flex: 1, minWidth: 0, paddingTop: 4}}>{item === '基础设置' ? <SysBasic /> : <SysGeneric key={item} name={item} />}</div>
    </Card>
  );
}

const DELIVERY = ['真省钱配送', '达达配送', '美团配送', '蜂鸟配送', '快跑配送', '闪送设置', '顺丰同城', 'UU跑腿', '闪时送', '麦芽田', '青云配送', '云喇叭聚合配送', '东海速送', '立即送', '易象配送'];

export function Delivery() {
  const [item, setItem] = useState(DELIVERY[0]);
  return (
    <Card>
      <Tabs variant="line" items={['第三方配送']} value="第三方配送" onChange={() => {}} />
      <div style={{display: 'flex', gap: 18}}>
        <div style={{width: 110, background: '#f5f6f8', borderRadius: 4, padding: '6px 4px', minHeight: 560}}>
          {DELIVERY.map((d) => <div key={d} onClick={() => setItem(d)} style={{position: 'relative', textAlign: 'center', padding: '10px 4px', fontSize: 12, cursor: 'pointer', borderRadius: 3, background: item === d ? '#eaf7ef' : '', color: item === d ? '#2bad5b' : '#303133'}}>{d}{d === '真省钱配送' && <span className="tag solid-red" style={{position: 'absolute', right: -2, top: -2, fontSize: 9, lineHeight: '13px', padding: '0 3px'}}>推荐</span>}{d === '易象配送' && <span className="tag" style={{position: 'absolute', right: -2, top: -2, fontSize: 9, lineHeight: '13px', padding: '0 3px', background: '#2bad5b', color: '#fff', border: 0}}>自己送</span>}</div>)}
        </div>
        <div>
          <div style={{width: 470, height: 280, background: '#f5f6f8', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc'}}>{item} 介绍</div>
          <div style={{marginTop: 30}}><Btn type="primary" onClick={() => pending(`开通 ${item}`)}>开通 / 绑定手机号</Btn></div>
        </div>
      </div>
    </Card>
  );
}

export function PrinterBox() {
  const [openAdd, dialog] = useFormDialog('添加打印机', [{label: '打印机品牌', render: () => <Select options={['飞鹅', '易联云', '芯烨', '佳博']} />}, {label: '打印机编号(SN)', required: true}, {label: '打印机密钥(KEY)', required: true}, {label: '备注名称'}]);
  return <><div style={{fontSize: 13, marginBottom: 12}}>当前还可以添加 20 台打印机</div><div className="addbox" onClick={openAdd}><PlusCircle size={22} />添加打印机</div>{dialog}</>;
}
export const PrintList = () => <Card style={{minHeight: 560}}><PrinterBox /></Card>;

export function QrCodePage() {
  const [tab, setTab] = useState('微信小程序码');
  return (
    <Card style={{minHeight: 560}}>
      <Tabs items={['微信小程序码', '微信公众号桌码']} value={tab} onChange={setTab} />
      <Form narrow>
        <F label="桌码"><Radios options={['自定义桌码', '自取', '外卖']} /></F>
        <F label="输入自定义桌号"><Input w="l" placeholder="请输入自定义桌号" /></F>
        <F label="桌码类型"><Radios options={['小程序码', '样式1', '样式2']} defaultValue="样式1" /></F>
        <F label="进入页面"><Radios options={['进入首页', '进入点餐页']} /></F>
        <F label=""><Btn type="primary" onClick={() => pending('生成桌码')}>生成桌码</Btn></F>
      </Form>
    </Card>
  );
}

export function Screen() {
  const url = (p) => `https://admin.example.com/screen/#/${p}?key=xxxxxxxxxxxxxxxx`;
  const ops = (extra) => <><Lnk onClick={() => pending('打开大屏幕')}>打开</Lnk><Lnk onClick={() => toast('地址已复制')}>复制</Lnk><Lnk onClick={() => pending('重置地址')}>重置地址</Lnk>{extra}</>;
  return (
    <Card style={{minHeight: 560}}>
      <table className="tbl">
        <thead><tr><th>类型</th><th>类型</th><th>大屏幕地址</th><th>操作</th></tr></thead>
        <tbody>
          <tr><td>叫号大屏幕</td><td>叫号显示</td><td>{url('')}</td><td>{ops(<Lnk color="red" onClick={() => pending('清空屏幕')}>清空屏幕</Lnk>)}</td></tr>
          <tr><td rowSpan={3}>后厨大屏幕</td><td>备菜员 <Q /></td><td>已禁用备菜员角色</td><td>{ops(<Lnk onClick={() => pending('启用备菜员')}>启用备菜员</Lnk>)}</td></tr>
          <tr><td>后厨界面</td><td>{url('kitchen')}</td><td>{ops()}</td></tr>
          <tr><td>传菜员</td><td>{url('passer')}</td><td>{ops()}</td></tr>
        </tbody>
      </table>
    </Card>
  );
}

export function Development() {
  return (
    <Card>
      <Form narrow>
        <F label="门店ID">36782</F>
        <F label="应用ID">app_xxxxxxxx</F>
        <F label="开发key">••••••••••••••••••••••••<Lnk onClick={() => pending('重置开发key')}>重置</Lnk></F>
        <F label="订单回调地址"><Input w="l" placeholder="设置订单回调地址" style={{width: 640}} /></F>
        <F label=""><Btn type="primary" onClick={() => pending('保存回调地址')}>保存</Btn></F>
        <F label="数据备份" help="在服务器 data/backups/ 目录生成一份数据库备份；建议另外每天自动备份并复制到服务器之外"><Btn onClick={() => api.backup().then((d) => toast(`备份完成：${d.file}`)).catch((e) => toast(e.message, 'info'))}>立即备份数据库</Btn></F>
        {MP_PATHS.map(([label, path]) => <F key={label} label={label}><span style={{fontSize: 13}}>/{path}</span><span className="qr" onClick={() => pending('生成页面二维码')} /></F>)}
      </Form>
    </Card>
  );
}
