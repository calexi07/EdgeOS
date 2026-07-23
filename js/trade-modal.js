// ============================================================
// Shared "add/edit trade" modal.
// NEW trade: call openTradeModal({ onSaved }) — lets you pick one or
//   several accounts (same trade gets inserted once per account) and one pair.
// EDIT trade: call openTradeModal({ trade, onSaved }) — account & pair are
//   shown read-only (a trade already belongs to a specific account/pair),
//   everything else stays editable.
// ============================================================
async function openTradeModal(opts = {}) {
  const { onSaved, trade } = opts;
  const [{ data: accounts }, { data: pairs }] = await Promise.all([
    supabaseClient.from('accounts').select('id, name').order('name'),
    supabaseClient.from('pairs').select('id, symbol').order('symbol'),
  ]);

  const root = document.getElementById('modal-root');

  const accountField = trade
    ? `<div><label>Cont</label><input value="${trade.accounts?.name || '—'}" disabled></div>`
    : `<div>
        <label>Cont(uri) — bifează unul sau mai multe dacă ai luat același trade pe mai multe conturi</label>
        <div style="max-height:130px; overflow-y:auto; border:1px solid var(--line); border-radius:6px; padding:8px; background:var(--panel-raised);">
          ${(accounts || []).map(a => `
            <label style="display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text); margin-bottom:4px; cursor:pointer;">
              <input type="checkbox" name="account_ids" value="${a.id}" style="width:auto;"> ${a.name}
            </label>
          `).join('') || '<div style="color:var(--text-muted); font-size:12px;">Niciun cont — adaugă unul din pagina Conturi.</div>'}
        </div>
      </div>`;

  const pairField = trade
    ? `<div><label>Pereche</label><input value="${trade.pairs?.symbol || '—'}" disabled></div>`
    : `<div>
        <label>Pereche</label>
        <select name="pair_id" required>${(pairs || []).map(p => `<option value="${p.id}">${p.symbol}</option>`).join('')}</select>
      </div>`;

  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal" style="max-width:640px;">
        <h3 class="display" style="margin-top:0;">${trade ? 'Editează trade' : 'Trade nou'}</h3>
        <form id="trade-form">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            ${accountField}
            ${pairField}
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
            <div>
              <label>Direcție</label>
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
            <div><label>Ieșire (data/ora)</label><input name="exit_at" type="datetime-local" value="${trade?.exit_at ? trade.exit_at.slice(0,16) : ''}"></div>
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
          <label>Setup tags (separate prin virgulă)</label>
          <input name="setup_tags" value="${(trade?.setup_tags || []).join(', ')}" style="margin-bottom:12px;" placeholder="CHoCH, order block, liquidity sweep">
          <label>Notite</label>
          <textarea name="notes" rows="3" style="margin-bottom:16px;">${trade?.notes || ''}</textarea>
          <div style="display:flex; gap:8px; justify-content:space-between;">
            <div>${trade ? `<button type="button" class="btn danger" onclick="deleteTrade('${trade.id}')">Șterge</button>` : ''}</div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anulează</button>
              <button type="submit" class="btn">Salvează</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('trade-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const basePayload = {
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
      // Edit: account_id and pair_id never change here — only content fields.
      ({ error } = await supabaseClient.from('trades').update(basePayload).eq('id', trade.id));
    } else {
      const accountIds = Array.from(e.target.querySelectorAll('input[name="account_ids"]:checked')).map(cb => cb.value);
      const pairId = fd.get('pair_id');
      if (!accountIds.length) { toast('Selectează cel puțin un cont'); return; }
      if (!pairId) { toast('Selectează o pereche'); return; }
      // Same trade replicated once per selected account (e.g. taken on several funded accounts at once)
      const rows = accountIds.map(accId => ({ ...basePayload, account_id: accId, pair_id: pairId }));
      ({ error } = await supabaseClient.from('trades').insert(rows));
    }
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Trade salvat');
    if (onSaved) onSaved();
  });
}

async function deleteTrade(id) {
  if (!confirm('Sigur ștergi acest trade?')) return;
  const { error } = await supabaseClient.from('trades').delete().eq('id', id);
  if (error) { toast('Eroare: ' + error.message); return; }
  document.getElementById('modal-root').innerHTML = '';
  toast('Trade șters');
  if (window.__afterTradeDelete) window.__afterTradeDelete();
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
