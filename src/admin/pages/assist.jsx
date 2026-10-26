import React, {useState} from 'react';
import {Card, Btn, Lnk, Input, Tabs, Table, Radios, Form, F, Tip, Tag, Q, useFormDialog, pending, toast} from '../ui';
import {MP_PATHS} from '../mock';

export function Customer() {
  const [openAdd, dialog] = useFormDialog('添加客服', [{label: '客服微信号', required: true}, {label: '客服昵称'}]);
  return (
    <Card title="客服设置" style={{minHeight: 560}}>
      <div className="ad-row"><label className="l">客服类型</label><Radios options={['小程序客服', '企业微信客服']} /></div>
      <Tip>提示：绑定后的客服账号，可以登录 <Lnk color="blue">网页端客服</Lnk> 或 <Lnk color="blue">移动端小程序客服</Lnk> 进行客服沟通。</Tip>
      <div className="ad-row"><Btn type="primary" onClick={openAdd}>添加客服</Btn><span className="ad-muted">还可以添加100个</span></div>
      {dialog}
    </Card>
  );
}

export function Express() {
  const [tab, setTab] = useState('物流账号');
  const action = {物流账号: '绑定物流账号', 物流运单: null, 打印员: '添加打印员', 发单设置: null}[tab];
  return (
    <Card title="物流助手" style={{minHeight: 560}}>
      <Tabs items={['物流账号', '物流运单', '打印员', '发单设置']} value={tab} onChange={setTab} />
      {action && <Btn type="primary" onClick={() => pending(action)}>{action}</Btn>}
      {tab === '物流运单' && <Table columns={['运单号', '快递公司', '订单号', '收件人', '状态', '创建时间'].map((t) => ({title: t, key: t}))} data={[]} />}
      {tab === '发单设置' && <Form narrow><F label="默认快递公司"><Input placeholder="请选择" /></F><F label="寄件人信息"><Input w="l" placeholder="姓名 / 电话 / 地址" /></F><F label=""><Btn type="primary" onClick={() => pending('保存发单设置')}>保存</Btn></F></Form>}
    </Card>
  );
}

export function Derived() {
  const [v, setV] = useState('');
  return (
    <Card title="订单来源码" style={{minHeight: 560}}>
      <Tip>提示：该功能一般作用于统计业务员业绩，订单列表会显示该订单的来源</Tip>
      <Form narrow>
        <F label="输入来源"><Input w="m" placeholder="请输入来源" value={v} onChange={(x) => setV(x.slice(0, 12))} suffix={`${v.length}/12`} /><span className="ad-muted">1个汉字占用2个字符</span></F>
        <F label="进入页面"><Radios options={['进入首页', '进入点餐页']} /></F>
        <F label="历史来源"><Tag>无</Tag></F>
        <F label=""><Btn type="primary" onClick={() => (v ? pending('生成来源码') : toast('请输入来源', 'info'))}>生成来源码</Btn></F>
      </Form>
    </Card>
  );
}

function PathGenerator({title, withTitle}) {
  return (
    <Card title={title}>
      <Form narrow>
        <F label="小程序页面路径"><Input w="m" /></F>
        {withTitle && <F label="小程序页面标题"><Input w="m" /></F>}
        <F label=""><Btn type="primary" onClick={() => pending(title)} style={{width: 80}}>生成</Btn></F>
      </Form>
      <div style={{borderTop: '1px solid #ebeef5', paddingTop: 18}}>
        {MP_PATHS.map(([label, path]) => (
          <div key={label} style={{display: 'flex', gap: 14, fontSize: 13, marginBottom: 16}}>
            <span style={{width: 150, textAlign: 'right', color: '#909399'}}>{label}路径</span>
            <span style={{color: '#606266', cursor: 'pointer'}} onClick={() => { navigator.clipboard?.writeText(path).catch(() => {}); toast('路径已复制'); }}>{path}</span>
            {path.includes('=') && <Q tip="可替换参数" />}
          </div>
        ))}
      </div>
    </Card>
  );
}
export const Applet = () => <PathGenerator title="生成小程序码" />;
export const ShortLink = () => <PathGenerator title="生成Short Link" withTitle />;
export const UrlLink = () => <PathGenerator title="生成Url Link" />;

export function Domain() {
  const [openAdd, dialog] = useFormDialog('添加业务域名', [{label: '业务域名', required: true, placeholder: 'https://'}]);
  return (
    <Card title="外部业务域名" style={{minHeight: 560}}>
      <Tip>说明:如需配置外部业务域名实现小程序访问外部网页的目的，可根据如下步骤配置。</Tip>
      <div style={{fontSize: 13, lineHeight: 2.4, marginBottom: 18}}>
        <div>1、请先 <Lnk color="blue" onClick={() => pending('下载检验文件')}>下载检验文件</Lnk> 放到要设置的域名服务器根目录。</div>
        <div>2、确认检验文件正确放置以后，添加业务域名。</div>
        <div>3、请提交小程序版本 <Lnk color="blue" onClick={() => pending('重新提交审核')}>重新提交审核</Lnk>，审核通过以后生效。</div>
      </div>
      <div style={{fontWeight: 600, marginBottom: 8}}>小程序已绑定业务域名</div>
      <div style={{width: 520}}><Table columns={[{title: '#', key: 'i', render: (_, i) => i + 1}, {title: '域名', key: 'd'}, {title: '操作', key: 'op', render: () => '-'}]} data={[{id: 1, d: 'https://admin.example.com(系统域名)'}]} /></div>
      <div style={{marginTop: 10}}><Lnk color="blue" onClick={openAdd}>⊕ 添加新业务域名</Lnk></div>
      {dialog}
    </Card>
  );
}
