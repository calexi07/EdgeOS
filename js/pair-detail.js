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

  document.getElementById('characteristics-view').textContent = pair.characteristics || 'Nicio caracteristic\u0103 notat\u0103 \u00eenc\u0103.';
  document.getElementById('notes-view').textContent = pair.notes || 'Nicio notit\u0103 \u00eenc\u0103.';

  await loadFundamentalEntries();

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

// ---------------------------------------------------------------
// Fundamental analysis — running log of entries (add/edit/delete, never overwritten)
// ---------------------------------------------------------------
let __fundamentalEntries = [];

async function loadFundamentalEntries() {
  const { data } = await supabaseClient
    .from('pair_fundamental_entries')
    .select('*')
    .eq('pair_id', __pair.id)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  __fundamentalEntries = data || [];
  renderFundamentalEntries();
}

function renderFundamentalEntries() {
  const el = document.getElementById('fundamental-entries-list');
  if (!__fundamentalEntries.length) {
    el.innerHTML = `<div class="empty-state"><div class="display">Niciun jurnal de analiz\u0103 \u00eenc\u0103</div>Apas\u0103 "+ Analiz\u0103 nou\u0103" pentru prima intrare pe aceast\u0103 pereche.</div>`;
    return;
  }
  el.innerHTML = __fundamentalEntries.map(e => `
    <div class="entry-card">
      <div class="entry-card-head">
        <span class="entry-date">${fmtDate(e.entry_date)}</span>
        <span class="entry-actions">
          <button onclick='openFundamentalEntryModal(${JSON.stringify(e).replace(/'/g, "&#39;")})'>Editeaz\u0103</button>
          <button onclick="deleteFundamentalEntry('${e.id}')">\u0218terge</button>
        </span>
      </div>
      <div class="entry-content">${escapeHtml(e.content)}</div>
    </div>
  `).join('');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function openFundamentalEntryModal(entry) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal" style="max-width:560px;">
        <h3 class="display" style="margin-top:0;">${entry ? 'Editeaz\u0103 analiz\u0103' : 'Analiz\u0103 nou\u0103'}</h3>
        <form id="fundamental-entry-form">
          <label>Data</label>
          <input name="entry_date" type="date" value="${entry ? entry.entry_date : new Date().toISOString().slice(0,10)}" style="margin-bottom:12px;">
          <label>Con\u021binut</label>
          <textarea name="content" rows="8" required style="margin-bottom:16px;">${entry ? entry.content : ''}</textarea>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anuleaz\u0103</button>
            <button type="submit" class="btn">Salveaz\u0103</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.getElementById('fundamental-entry-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const payload = {
      pair_id: __pair.id,
      entry_date: fd.get('entry_date'),
      content: fd.get('content'),
    };
    let error;
    if (entry) {
      payload.updated_at = new Date().toISOString();
      ({ error } = await supabaseClient.from('pair_fundamental_entries').update(payload).eq('id', entry.id));
    } else {
      ({ error } = await supabaseClient.from('pair_fundamental_entries').insert(payload));
    }
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Salvat');
    loadFundamentalEntries();
  });
}

async function deleteFundamentalEntry(id) {
  if (!confirm('Sigur \u0219tergi aceast\u0103 intrare din jurnalul de analiz\u0103?')) return;
  const { error } = await supabaseClient.from('pair_fundamental_entries').delete().eq('id', id);
  if (error) { toast('Eroare: ' + error.message); return; }
  toast('\u0218ters');
  loadFundamentalEntries();
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
