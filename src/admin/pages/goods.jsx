import React, {useState} from 'react';
import {ChevronLeft, Menu as MenuIcon, Search, ArrowUpDown, Settings, Pencil, Clock} from 'lucide-react';
import {Card, Section, Btn, Lnk, Input, Select, Tabs, Table, Pager, Switch, Check, Radios, Form, F, Upload, TextArea, Tip, Tag, Q, SaveBar, Dialog, ErrorBar, confirmBox, useFormDialog, pending, toast} from '../ui';
import {api, useApi, money} from '../api';
import {UNITS} from '../mock';
import {go, back} from '../router';

function CategoryDialog({value, onClose, onSaved}) {
  const [form, setForm] = useState(value || {});
  React.useEffect(() => setForm(value || {}), [value]);
  const save = async () => {
    try {
      await api.saveCategory(value?.id, {label: form.label, emoji: form.emoji, sort: Number(form.sort) || 0, ...(value?.id ? {} : {id: form.id || undefined})});
      toast('分类已保存'); onSaved(); return true;
    } catch (e) { toast(e.message, 'info'); return false; }
  };
  return (
    <Dialog title={value?.id ? '编辑分类' : '添加分类'} open={Boolean(value)} onClose={onClose} onOk={save} width={480}>
      <Form narrow>
        <F label="分类名称" required><Input w="m" value={form.label || ''} onChange={(v) => setForm({...form, label: v})} /></F>
        {!value?.id && <F label="分类ID" help="可选，字母/数字，留空自动生成"><Input w="m" value={form.id || ''} onChange={(v) => setForm({...form, id: v})} /></F>}
        <F label="分类图标" help="暂用表情图标，图片上传接入后替换"><Input w="s" value={form.emoji || ''} onChange={(v) => setForm({...form, emoji: v})} placeholder="如 🍱" /></F>
        <F label="排序" help="越小越靠前"><Input w="s" value={String(form.sort ?? '')} onChange={(v) => setForm({...form, sort: v})} /></F>
      </Form>
    </Dialog>
  );
}

export function Classify() {
  const {data, loading, error, reload} = useApi(() => api.categories().then((d) => d.categories), []);
  const [editing, setEditing] = useState(null);
  const remove = async (c) => {
    if (!(await confirmBox({title: '删除分类', content: `确定删除“${c.label}”吗？分类下的商品会变为未分类。`, danger: true}))) return;
    try { await api.deleteCategory(c.id); toast('已删除'); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  const channel = (t) => ({title: `${t} ▾`, key: t, render: () => <Switch size="sm" defaultChecked label="显示" onChange={() => pending(`${t}显示设置`)} />});
  return (
    <Card>
      <ErrorBar error={error} onRetry={reload} />
      <div className="ad-row"><Btn type="primary" onClick={() => setEditing({sort: (data?.length || 0)})}>添加分类</Btn><Check>性能模式 <Q tip="分类较多时开启，加快加载" /></Check></div>
      <Table loading={loading} rowKey="id" columns={[{title: '展开', key: 'x', width: 50, render: () => ''}, {title: '分类ID', key: 'id'}, {title: '分类图标', key: 'emoji', render: (r) => (r.emoji ? <span className="thumb">{r.emoji}</span> : '')}, {title: '分类名称', key: 'label'}, channel('自取'), channel('外卖'), channel('堂食'), channel('快递'), {title: '排序（越小越靠前）', key: 'sort'}, {title: '操作', key: 'op', render: (c) => <><Lnk onClick={() => setEditing(c)}>编辑</Lnk>{c.id !== 'recommend' && <Lnk color="red" onClick={() => remove(c)}>删除</Lnk>}</>}]} data={data || []} />
      <CategoryDialog value={editing} onClose={() => setEditing(null)} onSaved={reload} />
    </Card>
  );
}

export function GoodsManage() {
  const {data, loading, error, reload} = useApi(() => api.products(), []);
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('全部商品');
  const [kw, setKw] = useState('');
  const [applied, setApplied] = useState('');
  const [selected, setSelected] = useState([]);
  const categories = data?.categories || [];
  const catName = Object.fromEntries(categories.map((c) => [c.id, c.label]));
  const list = (data?.products || []).filter((p) => (cat === 'all' || p.categoryId === cat)
    && (status === '全部商品' || (status === '在售商品' && p.available) || (status === '已下架商品' && !p.available))
    && (!applied || p.name.includes(applied)));
  const edit = (p) => go(`/goods/goodsAdd?action=edit&id=${encodeURIComponent(p.id)}`);
  const toggle = async (p, available) => {
    try { await api.saveProduct(p.id, {available}); toast(available ? '已上架' : '已下架'); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  const batch = async (available) => {
    if (!selected.length) { toast('请先勾选商品', 'info'); return; }
    try { for (const id of selected) await api.saveProduct(id, {available}); toast(`已${available ? '上架' : '下架'} ${selected.length} 个商品`); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  const remove = async (p) => {
    if (!(await confirmBox({title: '删除商品', content: `确定删除“${p.name}”吗？历史订单不受影响。`, danger: true}))) return;
    try { await api.deleteProduct(p.id); toast('已删除'); reload(); } catch (e) { toast(e.message, 'info'); }
  };
  return (
    <>
      <Card>
        <ErrorBar error={error} onRetry={reload} />
        <div className="ad-row"><label className="l">商品名称</label><Input placeholder="商品名称" value={kw} onChange={setKw} onKeyDown={(e) => e.key === 'Enter' && setApplied(kw)} /><label className="l" style={{marginLeft: 30}}>售卖方式</label><Select placeholder="请选择" options={['现售']} /><Btn type="primary" onClick={() => setApplied(kw)}>查询</Btn></div>
        <div className="ad-row" style={{marginBottom: 0}}>
          <Btn type="primary" onClick={() => go('/goods/goodsAdd?action=add')}>发布新商品</Btn>
          {['批量发布商品', 'excel导入', '批量传图', '导出', '导出记录', '导入出库', '导入第三方平台商品'].map((b) => <Btn key={b} onClick={() => pending(b)}>{b}</Btn>)}
        </div>
      </Card>
      <Card style={{padding: 0, display: 'flex'}}>
        <div className="side-list">
          <div className="t">商品分类 <MenuIcon size={14} color="#909399" style={{cursor: 'pointer'}} onClick={() => go('/goods/classify')} /></div>
          {[{id: 'all', label: '所有分类'}, ...categories].map((c) => <div key={c.id} className={`i ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</div>)}
        </div>
        <div style={{flex: 1, minWidth: 0, padding: '16px 18px'}}>
          <div className="ad-row"><Tabs variant="seg" items={['全部商品', '在售商品', '已售罄商品', '已下架商品']} value={status} onChange={setStatus} style={{margin: 0}} /><span style={{marginLeft: 'auto', display: 'flex', gap: 16}}><Lnk color="gray" onClick={() => pending('商品排序：请在编辑商品时设置排序值')}><ArrowUpDown size={13} /> 商品排序</Lnk><Lnk color="blue" onClick={reload}><Settings size={13} /> 刷新</Lnk></span></div>
          <Table loading={loading} selectable onSelect={setSelected} minWidth={1100} empty={status === '已售罄商品' ? '库存功能暂未开通' : '暂无商品'} columns={[
            {title: '商品名', key: 'name', minWidth: 260, render: (p) => <div style={{display: 'flex', gap: 10}}><span className="thumb">{p.emoji || '🍽'}</span><div><div style={{color: '#303133', cursor: 'pointer'}} onClick={() => edit(p)}>{p.name.length > 18 ? `${p.name.slice(0, 18)}...` : p.name} <Pencil size={11} color="#909399" /></div><div className="ad-muted">ID: {p.id}</div><div style={{marginTop: 4}}><Tag>外卖</Tag><Tag>自取</Tag></div></div></div>},
            {title: '商品底价', key: 'oldPrice', render: (p) => <>{money(p.oldPrice)}<div className="ad-muted">会员价 {money(p.price)}</div></>},
            {title: '所属分类', key: 'categoryId', render: (p) => catName[p.categoryId] || '未分类'},
            {title: '库存', key: 'stock', render: () => '–'}, {title: '排序', key: 'sort'},
            {title: '商品描述', key: 'description', minWidth: 220, render: (p) => <span style={{fontSize: 12}}>{p.description || '-'}</span>},
            {title: '上架', key: 'on', fixed: 'right', right: 160, shadow: true, width: 60, minWidth: 60, render: (p) => <Switch size="sm" checked={p.available} onChange={(v) => toggle(p, v)} />},
            {title: '售罄', key: 'out', fixed: 'right', right: 100, width: 60, minWidth: 60, render: () => <Switch size="sm" checked={false} onChange={() => pending('售罄（库存功能）')} />},
            {title: '操作', key: 'op', fixed: 'right', width: 100, minWidth: 100, render: (p) => <><Lnk onClick={() => edit(p)}>编辑</Lnk><Lnk color="red" onClick={() => remove(p)}>删除</Lnk></>},
          ]} data={list} />
          <div className="tbl-foot"><Btn size="sm" onClick={() => batch(true)}>批量上架</Btn><Btn size="sm" onClick={() => batch(false)}>批量下架</Btn>{['会员折扣', '批量设置规格'].map((b) => <Btn key={b} size="sm" onClick={() => pending(b)}>{b}</Btn>)}<span className="ad-muted" style={{marginLeft: 'auto'}}>共 {list.length} 个商品</span></div>
        </div>
      </Card>
    </>
  );
}

const EMPTY = {name: '', categoryId: '', emoji: '🍱', description: '', oldPrice: '', price: '', sort: '0', available: true};

export function GoodsAdd({query}) {
  const [tab, setTab] = useState('基本信息');
  const isEdit = query.action === 'edit' && query.id;
  const {data} = useApi(() => api.products(), []);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const editing = isEdit ? data?.products.find((p) => p.id === query.id) : null;
  React.useEffect(() => {
    if (editing) setForm({name: editing.name, categoryId: editing.categoryId || '', emoji: editing.emoji, description: editing.description, oldPrice: String(editing.oldPrice), price: String(editing.price), sort: String(editing.sort), available: editing.available});
  }, [editing?.id]);
  const set = (k) => (v) => setForm((f) => ({...f, [k]: v}));
  const categories = (data?.categories || []).filter((c) => c.id !== 'recommend');
  const title = isEdit ? '编辑商品' : '添加商品';
  const save = async () => {
    const list = Number(form.oldPrice);
    if (!form.name.trim()) return toast('请输入商品名称', 'info');
    if (!form.categoryId) return toast('请选择所属分类', 'info');
    if (!(list > 0)) return toast('请填写售价', 'info');
    // 会员价留空时按白银会员 98 折展示（结算时仍按会员等级计算）。
    const member = form.price === '' ? Math.round(list * 98) / 100 : Number(form.price);
    setSaving(true);
    try {
      await api.saveProduct(isEdit ? query.id : null, {name: form.name, categoryId: form.categoryId, emoji: form.emoji, description: form.description, oldPrice: list, price: member, sort: Number(form.sort) || 0, available: form.available});
      toast(isEdit ? '商品已保存' : '商品已发布');
      go('/goods/goodsManage');
    } catch (e) {
      toast(e.message, 'info');
      setSaving(false);
    }
  };
  if (isEdit && data && !editing) return <Card><div className="empty">商品不存在或已删除 · <Lnk onClick={() => go('/goods/goodsManage')}>返回商品列表</Lnk></div></Card>;
  return (
    <Card>
      <div className="ad-card-title"><ChevronLeft size={18} style={{cursor: 'pointer'}} onClick={() => back('/goods/goodsManage')} />{title}</div>
      <Tabs items={['基本信息', '分销设置', '库存设置']} value={tab} onChange={setTab} />
      {tab === '基本信息' && (
        <Form>
          <Section>基础信息</Section>
          <F label="商品类型" required><Radios options={['普通商品', '称重商品', '套餐', '优惠券']} /></F>
          <F label="商品名称" required><Input w="l" placeholder="请输入商品名称" suffix={`${form.name.length}/50`} value={form.name} onChange={(v) => set('name')(v.slice(0, 50))} /></F>
          <F label="所属分类" required><Select placeholder="请选择" options={categories.map((c) => ({value: c.id, label: c.label}))} value={form.categoryId} onChange={set('categoryId')} /><Lnk color="blue" onClick={() => go('/goods/classify')}>新建分类</Lnk></F>
          <F label="商品主图" help="建议尺寸：小图500*500px，大图550*280px，最多8张（图片上传待接入对象存储，暂用表情图标）"><Upload /><span className="thumb" style={{width: 64, height: 64, fontSize: 34}}>{form.emoji || '🍽'}</span><Input w="xs" value={form.emoji} onChange={set('emoji')} placeholder="图标" /></F>
          <F label="商品规格图" q="点餐页规格弹窗展示" help="建议尺寸：738 * 396px，最多7张"><Upload /></F>
          <F label="商品标签" help="建议使用：最多5个"><Btn onClick={() => go('/goods/goods_label')}>未设置标签，去设置 ›</Btn></F>
          <F label="商品描述"><textarea className="ta" rows={3} placeholder="请输入商品描述" value={form.description} onChange={(e) => set('description')(e.target.value.slice(0, 300))} /></F>
          <F label="商品编码"><Input w="l" suffix="0/30" /></F>
          <Section>价格设置</Section>
          <F label="商品价格" required help="售价为原价；结算时按顾客会员等级打折"><span>售价</span><Input w="s" value={form.oldPrice} onChange={(v) => set('oldPrice')(v.replace(/[^\d.]/g, ''))} /><span>元</span><span style={{marginLeft: 16}}>折后售价</span><Input w="s" placeholder="暂不支持" disabled /><span>元</span><span className="ad-muted" style={{marginLeft: 10}}>{form.oldPrice ? '' : '未填写价格'}</span></F>
          <F label="附加项目"><span>包装费</span><Input w="s" /><span>元</span><span className="ad-muted">仅自取、配送收取</span></F>
          <F label="会员优惠"><Radios options={['参与会员优惠', '不参与会员优惠']} /></F>
          <F label="优惠规则"><Radios options={['按各会员等级', '按统一价格']} /></F>
          <F label="会员价" help="点餐页展示的会员价，留空按 98 折自动计算"><Input w="s" value={form.price} onChange={(v) => set('price')(v.replace(/[^\d.]/g, ''))} placeholder={form.oldPrice ? (Math.round(Number(form.oldPrice) * 98) / 100).toFixed(2) : ''} /><span>元</span></F>
          <Section>商品规格</Section>
          <F label="可选规格"><Radios options={['无规格', '文字规格', '带图规格', '使用规格模板']} /></F>
          <F label="商品单位"><Select placeholder="请选择" options={UNITS.map((u) => u.name)} /></F>
          <F label="重量" help="用于快递或配送运费计重时，忽略“商品单位”统一按“千克”计算"><Input w="s" /><span>千克</span></F>
          <Section>售卖规则</Section>
          <F label="售卖方式"><Radios options={['现售', '预售', '仅展示商品']} /></F>
          <F label="就餐方式">{['堂食显示', '自取显示', '配送显示', '快递显示'].map((t) => <Check key={t} defaultChecked>{t}</Check>)}</F>
          <F label="支付方式"><Radios options={['全部允许', '不允许余额支付']} /></F>
          <F label="最低起售数量"><span>商品最低</span><Input w="xs" /><span>件起售</span></F>
          <F label="单点下单售卖"><Radios options={['允许', '不允许']} /></F>
          <F label="收银时手动打折"><Radios options={['参与', '不参与']} /></F>
          <F label="收银时临时改价"><Radios options={['允许', '不允许']} /></F>
          <Section>商品时效</Section>
          <F label="制作时长" help="设置后将延长原订单的最早送出时间；如按件制作，将按此设置计入等待时间"><span>商品下单后需要制作</span><Input w="xs" /><Select options={['分钟', '小时']} style={{minWidth: 80}} /></F>
          <F label="可售时间"><Radios options={['全天可售', '指定时间可售']} /></F>
          <F label="定时上下架"><Radios options={['不设置', '设置']} /></F>
          <Section>限购设置</Section>
          {['每人限购', '每日限购', '每单限购', '每人每日限购'].map((t) => <F key={t} label={t}><Input w="s" /><span>件</span></F>)}
          <Section>其他设置</Section>
          <F label="单品包邮"><Radios options={['关闭', '开启']} /></F>
          <F label="单品免配送费"><Radios options={['关闭', '开启']} /></F>
          <F label="赠送积分"><span>每售出1件商品赠送</span><Input w="xs" /><span>积分</span></F>
          <F label="虚拟销量" help="显示销量 = 虚拟销量 + 实际销量"><Input w="s" /><span>件</span></F>
          <F label="设为推荐" help="设置后商品在点餐页会带“推荐”标签"><Radios options={['设置', '不设置']} defaultValue="不设置" /></F>
          <F label="出品部门"><Radios options={['与商品分类一致', '自定义出品部门']} /></F>
          <F label="小程序显示"><Radios options={['显示', '不显示']} value={form.available ? '显示' : '不显示'} onChange={(v) => set('available')(v === '显示')} /></F>
          <F label="排序" help="越小越靠前"><Input w="s" value={form.sort} onChange={set('sort')} /></F>
          <Section>商品详情</Section>
          <F label="图文详情"><div style={{width: 620, border: '1px solid #dcdfe6', borderRadius: 3}}><div style={{borderBottom: '1px solid #ebeef5', padding: '6px 10px', color: '#909399', fontSize: 12, display: 'flex', gap: 14}}>{['B', 'I', 'U', 'H1', '≡', '🖼', '🔗'].map((b) => <span key={b} style={{cursor: 'pointer'}}>{b}</span>)}</div><div contentEditable suppressContentEditableWarning style={{minHeight: 160, padding: 10, outline: 0}} /></div></F>
        </Form>
      )}
      {tab === '分销设置' && (
        <Form>
          <F label="参与分销"><Radios options={['不参与', '参与']} /></F>
          <F label="一级分成" help="不填写则按共享模式中的默认比例"><Input w="s" /><span>%</span></F>
        </Form>
      )}
      {tab === '库存设置' && (
        <Form>
          <F label="库存"><Radios options={['不限库存', '设置库存']} /></F>
          <F label="每日库存" help="每日 00:00 自动恢复"><Input w="s" /><span>件</span></F>
          <F label="预警值" q="低于预警值时在库存预警中提示"><Input w="s" /><span>件</span></F>
        </Form>
      )}
      <SaveBar text={saving ? '保存中…' : '保存'} onSave={save}><Btn size="lg" onClick={() => back('/goods/goodsManage')}>返回</Btn></SaveBar>
    </Card>
  );
}

export function InventoryAlert() {
  const [tab, setTab] = useState('预警商品');
  const [cat, setCat] = useState('all');
  const {data} = useApi(() => api.products(), []);
  const cats = data?.categories || [];
  const catName = Object.fromEntries(cats.map((c) => [c.id, c.label]));
  const list = (data?.products || []).filter((p) => cat === 'all' || p.categoryId === cat).map((p) => ({...p, category: catName[p.categoryId] || '未分类'}));
  return (
    <Card>
      <Tabs items={['预警商品', '通知提醒']} value={tab} onChange={setTab} />
      {tab === '预警商品' ? (
        <>
          <div className="ad-gray"><b>预警信息</b><div style={{display: 'flex', gap: 60, marginTop: 8}}><div className="kv"><span className="k">正常商品</span><b>{data?.products.length ?? 0}</b></div><div className="kv"><span className="k">低于预警值</span><b>0</b></div></div></div>
          <div style={{display: 'flex', gap: 16}}>
            <div className="side-list" style={{background: '#fafafa', borderRadius: 4}}><div className="t">商品分类</div>{[{id: 'all', label: '所有分类'}, ...cats].map((c) => <div key={c.id} className={`i ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.label}</div>)}</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div className="ad-row"><label className="l">搜索</label><Input placeholder="商品名称" /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Check>只看预警商品</Check></div>
              <Table selectable columns={[{title: '商品分类', key: 'category'}, {title: '商品名称', key: 'name'}, {title: '预警值', key: 'w', render: () => '–'}, {title: '当前库存', key: 's', render: () => '关闭库存'}, {title: '操作', key: 'op', render: () => <Clock size={14} color="#909399" style={{cursor: 'pointer'}} onClick={() => pending('设置预警')} />}]} data={list} />
              <div className="tbl-foot"><Btn size="sm" onClick={() => pending('批量编辑')}>批量编辑</Btn><Pager total={list.length} /></div>
            </div>
          </div>
        </>
      ) : (
        <Form narrow><F label="预警通知"><Switch label="开启后低于预警值时通知管理员" /></F><F label="通知方式"><Check defaultChecked>微信通知</Check><Check>短信通知</Check></F><F label=""><Btn type="primary" onClick={() => pending('保存')}>保存</Btn></F></Form>
      )}
    </Card>
  );
}

export function OptionTemplate() {
  const [openAdd, dialog] = useFormDialog('添加规格组', [{label: '规格组名称', required: true}, {label: '规格值', placeholder: '多个用逗号分隔，如：大份,小份'}]);
  return <Card><Btn type="primary" onClick={openAdd}>添加规格组</Btn><div style={{height: 16}} /><Table columns={['ID', '规格组', '添加时间', '已关联商品', '操作'].map((t) => ({title: t, key: t}))} data={[]} /><Pager total={0} size={15} sizes jumper align="center" />{dialog}</Card>;
}

export function GoodsMust() {
  const [openAdd, dialog] = useFormDialog('添加必点方案', [{label: '方案名称', required: true}, {label: '必点类型', render: () => <Radios options={['按人数', '按订单']} />}, {label: '必点商品', render: () => <Select placeholder="请选择商品" options={[]} />}, {label: '适用方式', render: () => <><Check defaultChecked>堂食</Check><Check>自取</Check><Check>外卖</Check></>}]);
  return (
    <Card>
      <Btn type="primary" onClick={openAdd}>添加必点方案</Btn>
      <div className="ad-row" style={{marginTop: 16}}><label className="l">方案名称</label><Input w="m" placeholder="请输入方案名称" /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn>重置</Btn></div>
      <Table grayHead columns={['序号', '方案名称', '必点类型', '必点商品', '生效日期', '生效时间', '适用方式', '状态', '操作'].map((t) => ({title: t, key: t}))} data={[]} empty={<>暂无数据，您可以 <Lnk onClick={openAdd}>新增必点商品方案</Lnk></>} />
      <div className="tbl-foot"><span>共 0 条</span><Pager total={0} sizes showTotal={false} /></div>
      {dialog}
    </Card>
  );
}

export function Stock() {
  const [tab, setTab] = useState('库存列表');
  const [rec, setRec] = useState('查看货品列表');
  const [sub, setSub] = useState('全部');
  const [openAdd, dialog] = useFormDialog('添加货品', [{label: '货品名称', required: true}, {label: '货品类别', render: () => <Select placeholder="请选择" options={['原料', '包材', '饮品']} />}, {label: '货品编码'}, {label: '供应商'}]);
  return (
    <Card>
      <Tabs items={['库存列表', '类别管理']} value={tab} onChange={setTab} />
      {tab === '库存列表' ? (
        <>
          <div className="ad-row"><Btn type="primary" onClick={openAdd}>添加货品</Btn>{['导入货品', '导出货品', '入库', '出库', '报损'].map((b) => <Btn key={b} type="primary" onClick={() => pending(b)}>{b}</Btn>)}<Btn onClick={() => pending('清点库存')}>清点库存</Btn><Btn onClick={() => pending('进销存设置')}>设置</Btn></div>
          <div className="ad-gray" style={{display: 'flex', gap: 60}}><div className="kv"><span className="k">货品种数(种)</span><b>0种</b></div><div className="kv"><span className="k">货品总价值(元)</span><b>0元</b></div></div>
          <Tabs variant="seg" items={['查看货品列表', '入库记录', '出库记录', '报损记录', '清点记录']} value={rec} onChange={setRec} />
          <div className="ad-row"><label className="l">货品类别</label><Select options={['全部', '原料', '包材', '饮品']} /><label className="l">搜索</label><Input placeholder="货品名称/货品编码" /><Btn type="primary" onClick={() => pending('查询')}>查询</Btn><Btn onClick={() => pending('导出')}>导出</Btn></div>
          <Tabs variant="line" items={['全部', '库存预警']} value={sub} onChange={setSub} />
          <Table selectable columns={[{title: '序号'}, {title: '货品类别'}, {title: '货品ID'}, {title: '货品名称'}, {title: '货品编码'}, {title: '当前库存'}, {title: '货品价值', q: '当前库存×成本价'}, {title: '供应商'}, {title: '云订货商城', q: '说明'}, {title: '操作', fixed: 'right'}].map((c) => ({...c, key: c.title}))} data={[]} />
          <div className="tbl-foot"><Btn size="sm" onClick={() => pending('批量删除')}>批量删除</Btn><Btn size="sm" type="plain" onClick={() => pending('批量入库')}>批量入库</Btn><Pager total={0} sizes /></div>
        </>
      ) : (
        <><Btn type="primary" onClick={() => pending('添加类别')}>添加类别</Btn><div style={{height: 16}} /><Table columns={['类别名称', '货品数', '操作'].map((t) => ({title: t, key: t}))} data={[]} /></>
      )}
      {dialog}
    </Card>
  );
}

export function GoodsLabel() {
  const [tab, setTab] = useState('商品标签');
  const [openAdd, dialog] = useFormDialog('添加标签', [{label: '标签名称', required: true}, {label: '标签样式', render: () => <Radios options={['绿色', '红色', '橙色', '灰色']} />}]);
  return (
    <Card title="标签管理">
      <Tabs items={['商品标签', '分类标签']} value={tab} onChange={setTab} />
      <Tip inline>商品描述标签展示在手机点餐端的商品名称下方，用于含乳制品、可做热饮等商品信息或其他卖点说明。 <Lnk color="blue" onClick={() => pending('查看示例')}>查看示例</Lnk></Tip>
      <div className="ad-row" style={{marginTop: 16}}><Btn type="primary" onClick={openAdd}>添加标签</Btn><span className="ad-muted">最多可添加150个</span></div>
      <Table columns={['ID', '标签名称', '标签样式', '已关联商品', '操作'].map((t) => ({title: t, key: t}))} data={[]} />
      <div className="tbl-foot"><span>共 0 个</span><Pager total={0} showTotal={false} /></div>
      {dialog}
    </Card>
  );
}

export function GoodsUnits() {
  const [openAdd, dialog] = useFormDialog('添加单位', [{label: '单位名称', required: true}]);
  return (
    <Card title="单位管理">
      <div style={{marginBottom: 16}}><Btn type="primary" onClick={openAdd}>添加单位</Btn></div>
      <Table bordered columns={[{title: '序号', key: 'i', render: (_, i) => i + 1}, {title: '单位名称', key: 'name'}, {title: 'ID', key: 'id'}, {title: '操作', key: 'op', render: () => <><Lnk color="blue" onClick={openAdd}>编辑</Lnk><Lnk color="red" onClick={() => pending('删除单位')}>删除</Lnk></>}]} data={UNITS} />
      <div className="tbl-foot"><span>共 {UNITS.length} 个</span><Pager total={UNITS.length} showTotal={false} /></div>
      {dialog}
    </Card>
  );
}
