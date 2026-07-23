// ============================================================
// Shared "add/edit trade" modal.
// Call openTradeModal({ lockAccountId, lockPairId, onSaved }).
// If lockAccountId/lockPairId is passed, that field is preselected and disabled.
// ============================================================
async function openTradeModal(opts = {}) {
  const { lockAccountId, lockPairId, onSaved, trade } = opts;
  const [{ data: accounts }, { data: pairs }] = await Promise.all([
    supabaseClient.from('accounts').select('id, name').order('name'),
    supabaseClient.from('pairs').select('id, symbol').order('symbol'),
  ]);

  const root = document.getElementById('modal-root');
  const accountOptions = (accounts || []).map(a =>
    `<option value="${a.id}" ${(trade?.account_id || lockAccountId) === a.id ? 'selected' : ''}>${a.name}</option>`
  ).join('');
  const pairOptions = (pairs || []).map(p =>
    `<option value="${p.id}" ${(trade?.pair_id || lockPairId) === p.id ? 'selected' : ''}>${p.symbol}</option>`
  ).join('');

  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal" style="max-width:640px;">
        <h3 class="display" style="margin-top:0;">${trade ? 'Editeaz\u0103 trade' : 'Trade nou'}</h3>
        <form id="trade-form">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label>Cont</label>
              <select name="account_id" required ${lockAccountId ? 'disabled' : ''}>${accountOptions}</select>
              ${lockAccountId ? `<input type="hidden" name="account_id_hidden" value="${lockAccountId}">` : ''}
            </div>
            <div>
              <label>Pereche</label>
              <select name="pair_id" required ${lockPairId ? 'disabled' : ''}>${pairOptions}</select>
              ${lockPairId ? `<input type="hidden" name="pair_id_hidden" value="${lockPairId}">` : ''}
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label>Direc\u021bie</label>
              <select name="direction">
                <option value="long" ${trade?.direction === 'long' ? 'selected' : ''}>Long</option>
                <option value="short" ${trade?.direction === 'short' ? 'selected' : ''}>Short</option>
              </select>
            </div>
            <div>
              <label>Sesiune</label>
              <select name="session">
                <option value="asian" ${trade?.session === 'asian' ? 'selected' : ''}>Asian</option>
                <option value="london" ${trade?.session === 'london' ? 'selected' : ''}>London</option>
                <option value="ny" ${trade?.session === 'ny' ? 'selected' : ''}>NY</option>
                <option value="other" ${trade?.session === 'other' ? 'selected' : ''}>Alta</option>
              </select>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
            <div><label>Entry</label><input name="entry_price" type="number" step="any" value="${trade?.entry_price ?? ''}"></div>
            <div><label>Stop Loss</label><input name="stop_loss" type="number" step="any" value="${trade?.stop_loss ?? ''}"></div>
            <div><label>Take Profit</label><input name="take_profit" type="number" step="any" value="${trade?.take_profit ?? ''}"></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div><label>Exit</label><input name="exit_price" type="number" step="any" value="${trade?.exit_price ?? ''}"></div>
            <div><label>Size (lots)</label><input name="size" type="number" step="any" value="${trade?.size ?? ''}"></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div><label>Intrare (data/ora)</label><input name="entry_at" type="datetime-local" value="${trade?.entry_at ? trade.entry_at.slice(0,16) : ''}"></div>
            <div><label>Ie\u0219ire (data/ora)</label><input name="exit_at" type="datetime-local" value="${trade?.exit_at ? trade.exit_at.slice(0,16) : ''}"></div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label>Rezultat</label>
              <select name="result">
                <option value="open" ${trade?.result === 'open' ? 'selected' : ''}>Deschis</option>
                <option value="win" ${trade?.result === 'win' ? 'selected' : ''}>Win</option>
                <option value="loss" ${trade?.result === 'loss' ? 'selected' : ''}>Loss</option>
                <option value="breakeven" ${trade?.result === 'breakeven' ? 'selected' : ''}>Breakeven</option>
              </select>
            </div>
            <div><label>P&L ($)</label><input name="pnl" type="number" step="any" value="${trade?.pnl ?? ''}"></div>
            <div><label>R multiple</label><input name="r_multiple" type="number" step="any" value="${trade?.r_multiple ?? ''}"></div>
          </div>
          <label>Setup tags (separate prin virgul\u0103)</label>
          <input name="setup_tags" value="${(trade?.setup_tags || []).join(', ')}" style="margin-bottom:12px;" placeholder="CHoCH, order block, liquidity sweep">
          <label>Notite</label>
          <textarea name="notes" rows="3" style="margin-bottom:16px;">${trade?.notes || ''}</textarea>
          <div style="display:flex; gap:8px; justify-content:space-between;">
            <div>${trade ? `<button type="button" class="btn danger" onclick="deleteTrade('${trade.id}')">\u0218terge</button>` : ''}</div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anuleaz\u0103</button>
              <button type="submit" class="btn">Salveaz\u0103</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('trade-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      account_id: lockAccountId || fd.get('account_id'),
      pair_id: lockPairId || fd.get('pair_id'),
      direction: fd.get('direction'),
      session: fd.get('session'),
      entry_price: numOrNull(fd.get('entry_price')),
      stop_loss: numOrNull(fd.get('stop_loss')),
      take_profit: numOrNull(fd.get('take_profit')),
      exit_price: numOrNull(fd.get('exit_price')),
      size: numOrNull(fd.get('size')),
      entry_at: fd.get('entry_at') || null,
      exit_at: fd.get('exit_at') || null,
      result: fd.get('result'),
      pnl: numOrNull(fd.get('pnl')),
      r_multiple: numOrNull(fd.get('r_multiple')),
      setup_tags: fd.get('setup_tags').split(',').map(s => s.trim()).filter(Boolean),
      notes: fd.get('notes') || null,
    };

    let error;
    if (trade) {
      ({ error } = await supabaseClient.from('trades').update(payload).eq('id', trade.id));
    } else {
      ({ error } = await supabaseClient.from('trades').insert(payload));
    }
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Trade salvat');
    if (onSaved) onSaved();
  });
}

async function deleteTrade(id) {
  if (!confirm('Sigur \u0219tergi acest trade?')) return;
  const { error } = await supabaseClient.from('trades').delete().eq('id', id);
  if (error) { toast('Eroare: ' + error.message); return; }
  document.getElementById('modal-root').innerHTML = '';
  toast('Trade \u0219ters');
  if (window.__afterTradeDelete) window.__afterTradeDelete();
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
