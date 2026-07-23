function getAccountId() {
  return new URLSearchParams(location.search).get('id');
}

let __account = null;
let __accountTrades = [];
let __accountTx = [];

async function loadAccountDetail() {
  const id = getAccountId();
  const { data: account } = await supabaseClient.from('accounts').select('*').eq('id', id).single();
  if (!account) {
    document.querySelector('main.content').innerHTML = `<div class="empty-state"><div class="display">Cont inexistent</div></div>`;
    return;
  }
  __account = account;
  document.getElementById('account-name').textContent = account.name;
  document.getElementById('account-name-crumb').textContent = account.name;

  const [{ data: trades }, { data: tx }] = await Promise.all([
    supabaseClient.from('trades').select('*, pairs(symbol)').eq('account_id', id).order('entry_at', { ascending: false }),
    supabaseClient.from('account_transactions').select('*').eq('account_id', id).order('occurred_at', { ascending: false }),
  ]);
  __accountTrades = trades || [];
  __accountTx = tx || [];

  const stats = computeStats(__accountTrades);
  renderStatGrid(document.getElementById('account-stats'), stats);

  const deposits = __accountTx.filter(x => x.type === 'deposit').reduce((s, x) => s + Number(x.amount), 0);
  const withdrawals = __accountTx.filter(x => x.type === 'withdrawal').reduce((s, x) => s + Number(x.amount), 0);
  const points = buildEquityCurve(__accountTrades, Number(account.starting_balance) + deposits - withdrawals);
  drawEquityChart('equity-chart', points, account.name);

  renderTradesTable();
  renderTxTable();

  window.__afterTradeDelete = loadAccountDetail;
}

function renderTradesTable() {
  const el = document.getElementById('trades-table');
  if (!__accountTrades.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun trade \u00eenc\u0103</div>Apas\u0103 "+ Trade" pentru a ad\u0103uga primul trade pe acest cont.</div>`;
    return;
  }
  const rows = __accountTrades.map(t => `
    <tr onclick='openTradeModal({trade: ${JSON.stringify(t).replace(/'/g, "&#39;")}, onSaved: loadAccountDetail})' style="cursor:pointer;">
      <td class="mono" style="font-weight:600;">${t.pairs?.symbol || '—'}</td>
      <td>${t.direction}</td>
      <td>${fmtDate(t.entry_at)}</td>
      <td><span class="badge ${t.result}">${t.result}</span></td>
      <td class="mono ${t.pnl > 0 ? 'win-text' : t.pnl < 0 ? 'loss-text' : ''}">${fmtMoney(t.pnl)}</td>
      <td class="mono">${fmtR(t.r_multiple)}</td>
    </tr>
  `).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Pereche</th><th>Direc\u021bie</th><th>Data</th><th>Rezultat</th><th>P&L</th><th>R</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderTxTable() {
  const el = document.getElementById('tx-table');
  if (!__accountTx.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun deposit / withdraw \u00eenc\u0103</div></div>`;
    return;
  }
  const rows = __accountTx.map(x => `
    <tr>
      <td>${fmtDate(x.occurred_at)}</td>
      <td><span class="badge ${x.type === 'deposit' ? 'win' : 'loss'}">${x.type}</span></td>
      <td class="mono">${fmtMoney(x.amount)}</td>
      <td>${x.note || '—'}</td>
    </tr>
  `).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Tip</th><th>Sum\u0103</th><th>Notit\u0103</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function switchAccTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-trades').style.display = tab === 'trades' ? '' : 'none';
  document.getElementById('tab-tx').style.display = tab === 'tx' ? '' : 'none';
}

function openTxModal(type) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3 class="display" style="margin-top:0;">${type === 'deposit' ? 'Deposit nou' : 'Withdraw nou'}</h3>
        <form id="tx-form">
          <label>Sum\u0103</label>
          <input name="amount" type="number" step="0.01" required style="margin-bottom:12px;">
          <label>Data</label>
          <input name="occurred_at" type="date" value="${new Date().toISOString().slice(0,10)}" style="margin-bottom:12px;">
          <label>Notit\u0103 (op\u021bional)</label>
          <input name="note" style="margin-bottom:16px;">
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anuleaz\u0103</button>
            <button type="submit" class="btn">Salveaz\u0103</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await supabaseClient.from('account_transactions').insert({
      account_id: __account.id,
      type,
      amount: Number(fd.get('amount')),
      occurred_at: fd.get('occurred_at'),
      note: fd.get('note') || null,
    });
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Salvat');
    loadAccountDetail();
  });
}
