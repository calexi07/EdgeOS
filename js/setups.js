let __setups = [];
let __setupPairs = [];

async function loadSetups() {
  const [{ data: setups }, { data: pairs }] = await Promise.all([
    supabaseClient.from('pair_setups').select('*, pairs(id, symbol)').order('created_at', { ascending: false }),
    supabaseClient.from('pairs').select('id, symbol').order('symbol'),
  ]);
  __setups = setups || [];
  __setupPairs = pairs || [];

  const pairSelect = document.getElementById('filter-setup-pair');
  const current = pairSelect.value;
  pairSelect.innerHTML = '<option value="">Toate</option>' + __setupPairs.map(p => `<option value="${p.id}">${p.symbol}</option>`).join('');
  pairSelect.value = current;

  document.getElementById('filter-setup-pair').onchange = renderSetups;
  document.getElementById('filter-setup-verdict').onchange = renderSetups;

  renderSetups();
}

function renderSetups() {
  const pairFilter = document.getElementById('filter-setup-pair').value;
  const verdictFilter = document.getElementById('filter-setup-verdict').value;

  let rows = __setups;
  if (pairFilter) rows = rows.filter(s => s.pair_id === pairFilter);
  if (verdictFilter) rows = rows.filter(s => s.verdict === verdictFilter);

  const el = document.getElementById('setups-list');
  if (!rows.length) {
    el.innerHTML = `<div class="card"><div class="empty-state"><div class="display">Niciun setup încă</div>Apasă "+ Setup nou" pentru prima analiză.</div></div>`;
    return;
  }

  el.innerHTML = rows.map(s => renderSetupCard(s)).join('');
}

function tfBlock(label, notes, url) {
  return `
    <div class="setup-tf-block">
      <div class="setup-tf-label">${label}</div>
      <div class="setup-tf-notes">${notes ? escapeHtmlSetup(notes) : '<span style="color:var(--text-muted)">— fără notițe —</span>'}</div>
      ${url ? `<a href="${escapeHtmlSetup(url)}" target="_blank" rel="noopener" class="setup-tf-link">Chart TradingView →</a>` : ''}
    </div>
  `;
}

function escapeHtmlSetup(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderSetupCard(s) {
  const verdictBadgeClass = s.verdict === 'correct' ? 'win' : s.verdict === 'wrong' ? 'loss' : 'open';
  const verdictLabel = s.verdict === 'correct' ? 'Corect' : s.verdict === 'wrong' ? 'Greșit' : 'În așteptare';

  return `
    <div class="setup-card">
      <div class="setup-card-head">
        <div>
          <span class="mono" style="font-weight:700; font-size:16px;">${s.pairs?.symbol || '—'}</span>
          <span style="color:var(--text-muted); font-size:12px; margin-left:10px;">${fmtDate(s.created_at)}</span>
          <span class="badge ${verdictBadgeClass}" style="margin-left:10px;">${verdictLabel}</span>
        </div>
        <div class="setup-actions">
          <button class="btn secondary" onclick="setVerdict('${s.id}', 'correct')">✓ Corect</button>
          <button class="btn secondary" onclick="setVerdict('${s.id}', 'wrong')">✕ Greșit</button>
          <button class="btn danger" onclick="deleteSetup('${s.id}')">Șterge</button>
        </div>
      </div>

      <div class="setup-tf-grid">
        ${tfBlock('Daily', s.daily_notes, s.daily_chart_url)}
        ${tfBlock('4H', s.h4_notes, s.h4_chart_url)}
        ${tfBlock('1H', s.h1_notes, s.h1_chart_url)}
      </div>

      <div class="confluence-row">
        <div class="confluence-col">
          <div class="confluence-col-label">Confluențe pro</div>
          ${(s.confluences_pro || []).length ? s.confluences_pro.map(t => `<span class="confluence-tag pro">${escapeHtmlSetup(t)}</span>`).join('') : '<span style="color:var(--text-muted); font-size:12px;">—</span>'}
        </div>
        <div class="confluence-col">
          <div class="confluence-col-label">Confluențe contra</div>
          ${(s.confluences_against || []).length ? s.confluences_against.map(t => `<span class="confluence-tag against">${escapeHtmlSetup(t)}</span>`).join('') : '<span style="color:var(--text-muted); font-size:12px;">—</span>'}
        </div>
      </div>
    </div>
  `;
}

async function setVerdict(id, verdict) {
  const { error } = await supabaseClient.from('pair_setups').update({ verdict }).eq('id', id);
  if (error) { toast('Eroare: ' + error.message); return; }
  toast('Verdict salvat');
  loadSetups();
}

async function deleteSetup(id) {
  if (!confirm('Sigur ștergi acest setup?')) return;
  const { error } = await supabaseClient.from('pair_setups').delete().eq('id', id);
  if (error) { toast('Eroare: ' + error.message); return; }
  toast('Setup șters');
  loadSetups();
}

function openNewSetupModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
    <div class="modal-backdrop" onclick="if(event.target===this) this.remove()">
      <div class="modal" style="max-width:680px;">
        <h3 class="display" style="margin-top:0;">Setup nou</h3>
        <form id="new-setup-form">
          <label>Pereche</label>
          <select name="pair_id" required style="margin-bottom:16px;">
            ${__setupPairs.map(p => `<option value="${p.id}">${p.symbol}</option>`).join('')}
          </select>

          ${['daily', 'h4', 'h1'].map(tf => `
            <div style="border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:12px;">
              <div class="setup-tf-label" style="margin-bottom:8px;">${tf === 'daily' ? 'Daily' : tf === 'h4' ? '4H' : '1H'}</div>
              <label>Notițe</label>
              <textarea name="${tf}_notes" rows="3" style="margin-bottom:8px;"></textarea>
              <label>Link chart TradingView</label>
              <input name="${tf}_chart_url" placeholder="https://www.tradingview.com/x/...">
            </div>
          `).join('')}

          <label>Confluențe pro (separate prin virgulă)</label>
          <input name="confluences_pro" style="margin-bottom:12px;" placeholder="CHoCH, order block, liquidity sweep">
          <label>Confluențe contra (separate prin virgulă)</label>
          <input name="confluences_against" style="margin-bottom:16px;" placeholder="news risc, contra-trend">

          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn secondary" onclick="document.getElementById('modal-root').innerHTML=''">Anulează</button>
            <button type="submit" class="btn">Salvează</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('new-setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      pair_id: fd.get('pair_id'),
      daily_notes: fd.get('daily_notes') || null,
      daily_chart_url: fd.get('daily_chart_url') || null,
      h4_notes: fd.get('h4_notes') || null,
      h4_chart_url: fd.get('h4_chart_url') || null,
      h1_notes: fd.get('h1_notes') || null,
      h1_chart_url: fd.get('h1_chart_url') || null,
      confluences_pro: fd.get('confluences_pro').split(',').map(s => s.trim()).filter(Boolean),
      confluences_against: fd.get('confluences_against').split(',').map(s => s.trim()).filter(Boolean),
    };
    const { error } = await supabaseClient.from('pair_setups').insert(payload);
    if (error) { toast('Eroare: ' + error.message); return; }
    document.getElementById('modal-root').innerHTML = '';
    toast('Setup salvat');
    loadSetups();
  });
}
