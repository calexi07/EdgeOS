async function loadDashboard() {
  const [{ data: trades }, { data: pairs }, { data: accounts }, { data: accTx }] = await Promise.all([
    supabaseClient.from('trades').select('*'),
    supabaseClient.from('pairs').select('*').order('symbol'),
    supabaseClient.from('accounts').select('*').order('created_at'),
    supabaseClient.from('account_transactions').select('*'),
  ]);

  const allTrades = trades || [];
  const stats = computeStats(allTrades);
  renderStatGrid(document.getElementById('global-stats'), stats);

  const startingBalance = (accounts || []).reduce((s, a) => s + (Number(a.starting_balance) || 0), 0);
  const points = buildEquityCurve(allTrades, startingBalance);
  drawEquityChart('equity-chart', points, 'Equity');

  renderPerPairTable(allTrades, pairs || []);
  renderPerAccountTable(allTrades, accounts || [], accTx || []);
}

function renderPerPairTable(trades, pairs) {
  const el = document.getElementById('per-pair-table');
  if (!pairs.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Nicio pereche configurat\u0103</div>Adaug\u0103 o pereche pentru a \u00eencepe s\u0103 loghezi trade-uri.</div>`;
    return;
  }
  const rows = pairs.map(p => {
    const t = trades.filter(tr => tr.pair_id === p.id);
    const s = computeStats(t);
    return `
      <tr onclick="location.href='pair.html?symbol=${encodeURIComponent(p.symbol)}'" style="cursor:pointer;">
        <td class="mono" style="font-weight:600;">${p.symbol}</td>
        <td>${s.totalTrades}</td>
        <td>${s.winRate !== null ? s.winRate.toFixed(1) + '%' : '—'}</td>
        <td class="mono ${s.totalPnl > 0 ? 'win-text' : s.totalPnl < 0 ? 'loss-text' : ''}">${fmtMoney(s.totalPnl)}</td>
        <td>${s.avgR !== null ? fmtR(s.avgR) : '—'}</td>
      </tr>
    `;
  }).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Pereche</th><th>Trade-uri</th><th>Win rate</th><th>P&L</th><th>Avg R</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPerAccountTable(trades, accounts, accTx) {
  const el = document.getElementById('per-account-table');
  if (!accounts.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun cont configurat</div>Adaug\u0103 un cont din pagina <a href="accounts.html" style="color:var(--gold)">Conturi</a> pentru a \u00eencepe.</div>`;
    return;
  }
  const rows = accounts.map(a => {
    const t = trades.filter(tr => tr.account_id === a.id);
    const s = computeStats(t);
    const tx = accTx.filter(x => x.account_id === a.id);
    const deposits = tx.filter(x => x.type === 'deposit').reduce((s2, x) => s2 + Number(x.amount), 0);
    const withdrawals = tx.filter(x => x.type === 'withdrawal').reduce((s2, x) => s2 + Number(x.amount), 0);
    const balance = Number(a.starting_balance) + deposits - withdrawals + s.totalPnl;
    return `
      <tr onclick="location.href='account.html?id=${a.id}'" style="cursor:pointer;">
        <td style="font-weight:600;">${a.name}</td>
        <td><span class="badge open">${a.account_type}</span></td>
        <td class="mono">${fmtMoney(balance)}</td>
        <td class="mono">${fmtMoney(deposits)}</td>
        <td class="mono">${fmtMoney(withdrawals)}</td>
        <td class="mono ${s.totalPnl > 0 ? 'win-text' : s.totalPnl < 0 ? 'loss-text' : ''}">${fmtMoney(s.totalPnl)}</td>
      </tr>
    `;
  }).join('');
  el.innerHTML = `
    <table>
      <thead><tr><th>Cont</th><th>Tip</th><th>Balan\u021b\u0103</th><th>Deposit</th><th>Withdraw</th><th>P&L trading</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function openAddPairModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3 class="display" style="margin-top:0;">Pereche nou\u0103</h3>
        <form id="add-pair-form">
          <label>Simbol (ex: EURUSD)</label>
          <input name="symbol" required style="margin-bottom:12px;" />
          <label>Nume afi\u0219at</label>
          <input name="display_name" style="margin-bottom:12px;" />
          <label>Categorie</label>
          <select name="category" style="margin-bottom:16px;">
            <option value="forex">Forex</option>
            <option value="indices">Indices</option>
            <option value="crypto">Crypto</option>
            <option value="metals">Metals</option>
            <option value="other">Other</option>
          </select>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anuleaz\u0103</button>
            <button type="submit" class="btn">Salveaz\u0103</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('add-pair-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await supabaseClient.from('pairs').insert({
      symbol: fd.get('symbol').toUpperCase().trim(),
      display_name: fd.get('display_name') || null,
      category: fd.get('category'),
    });
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Pereche ad\u0103ugat\u0103');
    renderSidebar('dashboard');
    loadDashboard();
  });
}
