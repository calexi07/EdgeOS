let __allTrades = [];

async function loadJournal() {
  const [{ data: trades }, { data: accounts }, { data: pairs }] = await Promise.all([
    supabaseClient.from('trades').select('*, accounts(id, name), pairs(id, symbol)').order('entry_at', { ascending: false }),
    supabaseClient.from('accounts').select('id, name').order('name'),
    supabaseClient.from('pairs').select('id, symbol').order('symbol'),
  ]);
  __allTrades = trades || [];

  populateFilterOptions('filter-account', accounts || [], a => a.id, a => a.name);
  populateFilterOptions('filter-pair', pairs || [], p => p.id, p => p.symbol);

  window.__afterTradeDelete = loadJournal;
  renderJournalTable();
}

function populateFilterOptions(selectId, items, valFn, labelFn) {
  const el = document.getElementById(selectId);
  const current = el.value;
  el.innerHTML = '<option value="">Toate</option>' + items.map(i => `<option value="${valFn(i)}">${labelFn(i)}</option>`).join('');
  el.value = current;
}

['filter-account', 'filter-pair', 'filter-result'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', renderJournalTable);
});

function renderJournalTable() {
  const accountFilter = document.getElementById('filter-account').value;
  const pairFilter = document.getElementById('filter-pair').value;
  const resultFilter = document.getElementById('filter-result').value;

  let rows = __allTrades;
  if (accountFilter) rows = rows.filter(t => t.account_id === accountFilter);
  if (pairFilter) rows = rows.filter(t => t.pair_id === pairFilter);
  if (resultFilter) rows = rows.filter(t => t.result === resultFilter);

  const el = document.getElementById('journal-table');
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun trade \u00eenc\u0103</div>Apas\u0103 "+ Trade" pentru a ad\u0103uga primul.</div>`;
    return;
  }

  el.innerHTML = `
    <table>
      <thead><tr><th>Data</th><th>Cont</th><th>Pereche</th><th>Direc\u021bie</th><th>Rezultat</th><th>P&L</th><th>R</th><th>Setup tags</th></tr></thead>
      <tbody>
        ${rows.map(t => `
          <tr onclick='openTradeModal({trade: ${JSON.stringify(t).replace(/'/g, "&#39;")}, onSaved: loadJournal})' style="cursor:pointer;">
            <td>${fmtDate(t.entry_at)}</td>
            <td>${t.accounts?.name || '—'}</td>
            <td class="mono" style="font-weight:600;">${t.pairs?.symbol || '—'}</td>
            <td>${t.direction}</td>
            <td><span class="badge ${t.result}">${t.result}</span></td>
            <td class="mono ${t.pnl > 0 ? 'win-text' : t.pnl < 0 ? 'loss-text' : ''}">${fmtMoney(t.pnl)}</td>
            <td class="mono">${fmtR(t.r_multiple)}</td>
            <td>${(t.setup_tags || []).join(', ') || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
