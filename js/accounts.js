async function loadAccounts() {
  const [{ data: accounts }, { data: trades }, { data: accTx }] = await Promise.all([
    supabaseClient.from('accounts').select('*').order('created_at'),
    supabaseClient.from('trades').select('*'),
    supabaseClient.from('account_transactions').select('*'),
  ]);

  const el = document.getElementById('accounts-table');
  if (!accounts || !accounts.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun cont \u00eenc\u0103</div>Apas\u0103 "+ Cont nou" pentru a ad\u0103uga primul t\u0103u cont de trading.</div>`;
    return;
  }

  const rows = accounts.map(a => {
    const t = (trades || []).filter(tr => tr.account_id === a.id);
    const s = computeStats(t);
    const tx = (accTx || []).filter(x => x.account_id === a.id);
    const deposits = tx.filter(x => x.type === 'deposit').reduce((s2, x) => s2 + Number(x.amount), 0);
    const withdrawals = tx.filter(x => x.type === 'withdrawal').reduce((s2, x) => s2 + Number(x.amount), 0);
    const balance = Number(a.starting_balance) + deposits - withdrawals + s.totalPnl;
    return `
      <tr onclick="location.href='account.html?id=${a.id}'" style="cursor:pointer;">
        <td style="font-weight:600;">${a.name}</td>
        <td><span class="badge open">${a.account_type}</span></td>
        <td>${a.broker || '—'}</td>
        <td class="mono">${fmtMoney(balance)}</td>
        <td>${s.totalTrades}</td>
        <td><span class="badge ${a.status === 'active' ? 'win' : a.status === 'failed' ? 'loss' : 'breakeven'}">${a.status}</span></td>
      </tr>
    `;
  }).join('');

  el.innerHTML = `
    <table>
      <thead><tr><th>Nume</th><th>Tip</th><th>Broker</th><th>Balan\u021b\u0103 curent\u0103</th><th>Trade-uri</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function openAddAccountModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3 class="display" style="margin-top:0;">Cont nou</h3>
        <form id="add-account-form">
          <label>Nume cont</label>
          <input name="name" required style="margin-bottom:12px;" placeholder="ex: The5ers Phase 1" />
          <label>Tip cont</label>
          <select name="account_type" style="margin-bottom:12px;">
            <option value="personal">Personal</option>
            <option value="propfirm_phase1">Propfirm — Phase 1</option>
            <option value="propfirm_phase2">Propfirm — Phase 2</option>
            <option value="propfirm_live">Propfirm — Live</option>
            <option value="other">Altul</option>
          </select>
          <label>Broker</label>
          <input name="broker" style="margin-bottom:12px;" />
          <label>Balan\u021b\u0103 ini\u021bial\u0103</label>
          <input name="starting_balance" type="number" step="0.01" value="0" style="margin-bottom:12px;" />
          <label>Moned\u0103</label>
          <input name="currency" value="USD" style="margin-bottom:16px;" />
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anuleaz\u0103</button>
            <button type="submit" class="btn">Salveaz\u0103</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('add-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { error } = await supabaseClient.from('accounts').insert({
      name: fd.get('name'),
      account_type: fd.get('account_type'),
      broker: fd.get('broker') || null,
      starting_balance: Number(fd.get('starting_balance')) || 0,
      currency: fd.get('currency') || 'USD',
    });
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Cont ad\u0103ugat');
    loadAccounts();
  });
}
