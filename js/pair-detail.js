let __pair = null;
let __pairTrades = [];

function getPairSymbol() {
  return new URLSearchParams(location.search).get('symbol');
}

async function loadPairDetail() {
  const symbol = getPairSymbol();
  const { data: pair } = await supabaseClient.from('pairs').select('*').eq('symbol', symbol).single();
  if (!pair) {
    document.querySelector('main.content').innerHTML = `<div class="empty-state"><div class="display">Pereche inexistent\u0103</div></div>`;
    return;
  }
  __pair = pair;
  document.getElementById('pair-symbol').textContent = pair.symbol;
  document.getElementById('pair-symbol-crumb').textContent = pair.symbol;
  document.getElementById('pair-display-name').textContent = pair.display_name || '';

  document.getElementById('fundamental-view').textContent = pair.fundamental_analysis || 'Nicio analiz\u0103 fundamental\u0103 \u00eenc\u0103. Apas\u0103 "Editeaz\u0103" pentru a ad\u0103uga notitele tale.';
  document.getElementById('characteristics-view').textContent = pair.characteristics || 'Nicio caracteristic\u0103 notat\u0103 \u00eenc\u0103.';
  document.getElementById('notes-view').textContent = pair.notes || 'Nicio notit\u0103 \u00eenc\u0103.';

  const { data: trades } = await supabaseClient
    .from('trades')
    .select('*, accounts(name)')
    .eq('pair_id', pair.id)
    .order('entry_at', { ascending: false });
  __pairTrades = trades || [];

  const stats = computeStats(__pairTrades);
  renderStatGrid(document.getElementById('pair-stats'), stats);

  const points = buildEquityCurve(__pairTrades, 0);
  drawEquityChart('equity-chart', points, pair.symbol);

  renderPairTradesTable();
  window.__afterTradeDelete = loadPairDetail;
}

function renderPairTradesTable() {
  const el = document.getElementById('pair-trades-table');
  if (!__pairTrades.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun trade logat pe aceast\u0103 pereche</div>Apas\u0103 "+ Trade" pentru a ad\u0103uga primul.</div>`;
    return;
  }
  const rows = __pairTrades.map(t => `
    <tr onclick='openTradeModal({trade: ${JSON.stringify(t).replace(/'/g, "&#39;")}, lockPairId: __pair.id, onSaved: loadPairDetail})' style="cursor:pointer;">
      <td>${t.accounts?.name || '—'}</td>
      <td>${t.direction}</td>
      <td>${fmtDate(t.entry_at)}</td>
      <td><span class="badge ${t.result}">${t.result}</span></td>
      <td class="mono ${t.pnl > 0 ? 'win-text' : t.pnl < 0 ? 'loss-text' : ''}">${fmtMoney(t.pnl)}</td>
      <td class="mono">${fmtR(t.r_multiple)}</td>
      <td>${(t.setup_tags || []).join(', ') || '—'}</td>
    </tr>
  `).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Cont</th><th>Direc\u021bie</th><th>Data</th><th>Rezultat</th><th>P&L</th><th>R</th><th>Setup tags</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function switchPairTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  ['journal', 'fundamental', 'characteristics', 'notes'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? '' : 'none';
  });
}

function toggleFieldEdit(field) {
  const editEl = document.getElementById(fieldKeyToEditId(field));
  const saveRow = document.getElementById(fieldKeyToSaveRowId(field));
  const viewEl = document.getElementById(fieldKeyToViewId(field));

  const showingEdit = editEl.style.display !== 'none';
  if (showingEdit) {
    editEl.style.display = 'none';
    saveRow.style.display = 'none';
    viewEl.style.display = '';
  } else {
    editEl.value = __pair[field] || '';
    editEl.style.display = '';
    saveRow.style.display = '';
    viewEl.style.display = 'none';
  }
}

function fieldKeyToViewId(field) {
  return { fundamental_analysis: 'fundamental-view', characteristics: 'characteristics-view', notes: 'notes-view' }[field];
}
function fieldKeyToEditId(field) {
  return { fundamental_analysis: 'fundamental-edit', characteristics: 'characteristics-edit', notes: 'notes-edit' }[field];
}
function fieldKeyToSaveRowId(field) {
  return { fundamental_analysis: 'fundamental-save-row', characteristics: 'characteristics-save-row', notes: 'notes-save-row' }[field];
}

async function savePairField(field) {
  const editEl = document.getElementById(fieldKeyToEditId(field));
  const value = editEl.value;
  const { error } = await supabaseClient.from('pairs').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', __pair.id);
  if (error) { toast('Eroare: ' + error.message); return; }
  __pair[field] = value;
  document.getElementById(fieldKeyToViewId(field)).textContent = value || '—';
  toggleFieldEdit(field);
  toast('Salvat');
}
