const KEY = 'my_ledger_v1';
let records = JSON.parse(localStorage.getItem(KEY) || '[]');
const CATS = {
  expense: ['餐饮','交通','购物','居住','娱乐','医疗','学习','人情','其他'],
  income:  ['工资','兼职','理财','红包','其他']
};
const COLORS = ['#2f7cf6','#ff922b','#845ef7','#20c997','#f06595','#ffd43b','#5c7cfa','#e5484d','#868e96'];
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const fmt = n => n.toFixed(2);
function save() { localStorage.setItem(KEY, JSON.stringify(records)); }
let viewMonth = today().slice(0, 7);
let currentTab = 'list'; 
let editingId = null;    
let sheetType = 'expense';
function renderList() {
  const [y, m] = viewMonth.split('-');
  $('monthLabel').textContent = `${y}年${Number(m)}月`;
  const list = records.filter(r => r.date.startsWith(viewMonth)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  let exp = 0, inc = 0;
  list.forEach(r => r.type === 'expense' ? exp += r.amount : inc += r.amount);
  $('sumExp').textContent = '¥' + fmt(exp);
  $('sumInc').textContent = '¥' + fmt(inc);
  $('sumBal').textContent = '¥' + fmt(inc - exp);
  if (!list.length) {
    $('list').innerHTML = '<div class="empty">这个月还没有记录<br>在底部输入金额记一笔吧</div>';
    return;
  }
  const groups = {};
  list.forEach(r => (groups[r.date] ||= []).push(r));
  $('list').innerHTML = Object.entries(groups).map(([date, items]) => {
    const dayExp = items.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const dayInc = items.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const dayLabel = date === today() ? '今天' : date.slice(5);
    const total = [dayExp ? `支出 ¥${fmt(dayExp)}` : '', dayInc ? `收入 ¥${fmt(dayInc)}` : ''].filter(Boolean).join(' · ');
    return `<div class="day-group">
      <div class="day-head"><span>${dayLabel}</span><span>${total}</span></div>
      ${items.map(r => `
        <div class="item ${r.type}" data-id="${r.id}">
          <div class="cat">${r.category}</div>
          <div class="info">
            <div class="note">${escapeHtml(r.note || r.category)}</div>
            <div class="sub">${r.category}</div>
          </div>
          <div class="amt">${r.type === 'expense' ? '-' : '+'}¥${fmt(r.amount)}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}
function renderStats() {
  const list = records.filter(r => r.date.startsWith(viewMonth));
  const expList = list.filter(r => r.type === 'expense');
  const totalExp = expList.reduce((s, r) => s + r.amount, 0);
  if (!totalExp) {
    $('stats').innerHTML = '<div class="stats-card"><div class="empty">本月暂无支出数据</div></div>';
    return;
  }
  const byCat = {};
  expList.forEach(r => byCat[r.category] = (byCat[r.category] || 0) + r.amount);
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const pieHtml = `<canvas id="pieChart" width="260" height="260"></canvas>
    <div class="legend">${sorted.map(([cat], i) => `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${cat}</span>`).join('')}</div>`;
  const barsHtml = sorted.map(([cat, amt], i) => {
    const pct = (amt / totalExp * 100);
    return `<div class="bar-row">
      <span class="name">${cat}</span>
      <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${COLORS[i % COLORS.length]}"></div></div>
      <span class="pct">¥${fmt(amt)}<br><small>${pct.toFixed(1)}%</small></span>
    </div>`;
  }).join('');
  $('stats').innerHTML = `
    <div class="stats-card"><h3>本月支出总额</h3><div style="font-size:26px;font-weight:700;color:#e5484d">¥${fmt(totalExp)}</div></div>
    <div class="stats-card"><h3>分类占比</h3>${pieHtml}</div>
    <div class="stats-card"><h3>分类明细</h3>${barsHtml}</div>
  `;
  drawPie(sorted, totalExp);
}
function drawPie(sorted, total) {
  const canvas = $('pieChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 130, cy = 130, R = 110;
  let start = -Math.PI / 2;
  sorted.forEach(([cat, amt], i) => {
    const angle = (amt / total) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, start, start + angle); ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length]; ctx.fill();
    start += angle;
  });
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
}
function openSheet(amountOrRecord) {
  editingId = null; sheetType = 'expense'; let amount = '', note = '', date = today(), category = CATS.expense[0];
  if (amountOrRecord && typeof amountOrRecord === 'object') {
    const r = amountOrRecord; editingId = r.id; sheetType = r.type; amount = r.amount; note = r.note || ''; date = r.date; category = r.category;
  } else if (typeof amountOrRecord === 'number') { amount = amountOrRecord; }
  $('sAmount').value = amount; $('sNote').value = note; $('sDate').value = date;
  $('sheetTitle').textContent = editingId ? '编辑记录' : '记一笔';
  $('btnDelete').style.display = editingId ? 'block' : 'none';
  document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.type === sheetType));
  refreshCats(category);
  $('mask').classList.add('show');
  if (!amount) setTimeout(() => $('sAmount').focus(), 100);
}
function refreshCats(selected) {
  $('sCat').innerHTML = CATS[sheetType].map(c => `<option${c === selected ? ' selected' : ''}>${c}</option>`).join('');
}
document.querySelectorAll('.seg button').forEach(btn => {
  btn.onclick = () => {
    sheetType = btn.dataset.type;
    document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b === btn));
    refreshCats();
  };
});
$('sOk').onclick = () => {
  const amt = parseFloat($('sAmount').value);
  if (!amt || amt <= 0) { alert('请输入有效金额'); return; }
  const rec = { id: editingId || Date.now(), date: $('sDate').value || today(), amount: amt, type: sheetType, category: $('sCat').value, note: $('sNote').value.trim() };
  if (editingId) { records = records.map(r => r.id === editingId ? rec : r); } else { records.push(rec); }
  save(); viewMonth = rec.date.slice(0, 7); $('mask').classList.remove('show'); $('quickAmt').value = ''; renderAll();
};
$('btnDelete').onclick = () => {
  if (!editingId) return; if (!confirm('删除这条记录？')) return;
  records = records.filter(r => r.id !== editingId); save(); $('mask').classList.remove('show'); renderAll();
};
$('sCancel').onclick = () => $('mask').classList.remove('show');
$('mask').onclick = e => { if (e.target === $('mask')) $('mask').classList.remove('show'); };
$('quickAdd').onclick = () => { const v = $('quickAmt').value; openSheet(v ? parseFloat(v) : null); };
$('list').onclick = e => {
  const el = e.target.closest('.item'); if (!el) return;
  const rec = records.find(r => r.id === Number(el.dataset.id)); if (rec) openSheet(rec);
};
$('prevM').onclick = () => changeMonth(-1);
$('nextM').onclick = () => changeMonth(1);
function changeMonth(delta) {
  const [y, m] = viewMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  viewMonth = `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
  renderAll();
}
$('tabList').onclick = () => switchTab('list');
$('tabStats').onclick = () => switchTab('stats');
function switchTab(tab) {
  currentTab = tab;
  $('tabList').classList.toggle('on', tab === 'list');
  $('tabStats').classList.toggle('on', tab === 'stats');
  $('list').style.display = tab === 'list' ? '' : 'none';
  $('stats').style.display = tab === 'stats' ? '' : 'none';
  renderAll();
}
$('btnExport').onclick = () => {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `记账备份-${today()}.json`; a.click(); URL.revokeObjectURL(url);
};
$('btnImport').onclick = () => $('fileInput').click();
$('fileInput').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result); const imported = Array.isArray(data) ? data : data.records;
      if (!Array.isArray(imported)) throw new Error('格式错误');
      if (!confirm(`将导入 ${imported.length} 条记录，是否覆盖当前数据？\n（取消则合并去重）`)) {
        const ids = new Set(records.map(r => r.id)); const merged = [...records];
        imported.forEach(r => { if (!ids.has(r.id)) merged.push(r); }); records = merged;
      } else { records = imported; }
      save(); renderAll(); alert('导入成功');
    } catch (err) { alert('导入失败：' + err.message); }
  };
  reader.readAsText(file); e.target.value = '';
};
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function renderAll() { renderList(); if (currentTab === 'stats') renderStats(); }
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js').catch(console.warn); }
renderAll();