const money = (value) => Number(value || 0).toFixed(2);
const maskPhone = (phone) => (phone ? String(phone).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2') : '未绑定');
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (iso) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatDateTime = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toast = (title) => wx.showToast({ title: String(title).slice(0, 40), icon: 'none' });

module.exports = { money, maskPhone, formatTime, formatDateTime, toast };
