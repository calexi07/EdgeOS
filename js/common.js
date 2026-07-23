// ============================================================
// Shared helpers used across all pages
// ============================================================

const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function fmtR(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + Number(n).toFixed(2) + 'R';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ro-RO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

// ---------------------------------------------------------------
// Stat calculations shared by dashboard / account / pair pages
// ---------------------------------------------------------------
function computeStats(trades) {
  const closed = trades.filter(t => t.result && t.result !== 'open');
  const wins = closed.filter(t => t.result === 'win');
  const losses = closed.filter(t => t.result === 'loss');

  const totalPnl = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const grossWin = wins.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.pnl) || 0), 0));
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : null);
  const avgR = closed.length ? closed.reduce((s, t) => s + (Number(t.r_multiple) || 0), 0) / closed.length : null;
  const expectancy = closed.length ? totalPnl / closed.length : null;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    totalPnl,
    winRate,
    profitFactor,
    avgR,
    expectancy,
  };
}

function buildEquityCurve(trades, startingBalance = 0) {
  const closed = trades
    .filter(t => t.result && t.result !== 'open')
    .slice()
    .sort((a, b) => new Date(a.exit_at || a.entry_at) - new Date(b.exit_at || b.entry_at));

  let running = startingBalance;
  const points = [{ x: 'Start', y: running }];
  closed.forEach(t => {
    running += Number(t.pnl) || 0;
    points.push({ x: fmtDate(t.exit_at || t.entry_at), y: running });
  });
  return points;
}

function renderStatGrid(container, stats) {
  const pfDisplay = stats.profitFactor === Infinity ? '∞' : (stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : '—');
  container.innerHTML = `
    <div class="card">
      <div class="stat-label">P&L total</div>
      <div class="stat-value ${stats.totalPnl > 0 ? 'win-text' : stats.totalPnl < 0 ? 'loss-text' : ''}">${fmtMoney(stats.totalPnl)}</div>
    </div>
    <div class="card">
      <div class="stat-label">Win rate</div>
      <div class="stat-value">${stats.winRate !== null ? stats.winRate.toFixed(1) + '%' : '—'}</div>
    </div>
    <div class="card">
      <div class="stat-label">Profit factor</div>
      <div class="stat-value">${pfDisplay}</div>
    </div>
    <div class="card">
      <div class="stat-label">Avg R</div>
      <div class="stat-value">${stats.avgR !== null ? fmtR(stats.avgR) : '—'}</div>
    </div>
    <div class="card">
      <div class="stat-label">Trade-uri (\u00eenchise / total)</div>
      <div class="stat-value">${stats.closedTrades}/${stats.totalTrades}</div>
    </div>
  `;
}

function drawEquityChart(canvasId, points, label) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: points.map(p => p.x),
      datasets: [{
        label: label || 'Equity',
        data: points.map(p => p.y),
        borderColor: '#d4a017',
        backgroundColor: 'rgba(212,160,23,0.08)',
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#232c3a' }, ticks: { color: '#7d8aa0', maxTicksLimit: 8 } },
        y: { grid: { color: '#232c3a' }, ticks: { color: '#7d8aa0' } },
      }
    }
  });
}

// ---------------------------------------------------------------
// Sidebar: nav links + live pairs watchlist. Include on every page
// via <div id="sidebar-mount"></div> then call renderSidebar('active-page').
// ---------------------------------------------------------------
async function renderSidebar(active) {
  const mount = document.getElementById('sidebar-mount');
  if (!mount) return;

  const { data: pairs } = await supabaseClient.from('pairs').select('id, symbol, category').order('symbol');

  mount.innerHTML = `
    <a href="index.html" class="brand"><span class="brand-mark"></span>Pair Journal</a>
    <div class="nav-section-label">Overview</div>
    <a href="index.html" class="nav-link ${active === 'dashboard' ? 'active' : ''}">Dashboard global</a>
    <a href="journal.html" class="nav-link ${active === 'journal' ? 'active' : ''}">Jurnal global</a>
    <a href="accounts.html" class="nav-link ${active === 'accounts' ? 'active' : ''}">Conturi</a>
    <div class="nav-section-label">Perechi</div>
    <div id="pairs-watchlist"></div>
  `;

  const wl = document.getElementById('pairs-watchlist');
  if (!pairs || !pairs.length) {
    wl.innerHTML = `<div style="color:var(--text-muted); font-size:12px; padding: 6px 10px;">Nicio pereche \u00eenc\u0103.</div>`;
  } else {
    wl.innerHTML = pairs.map(p => `
      <a href="pair.html?symbol=${encodeURIComponent(p.symbol)}" class="pair-row">
        <span class="symbol">${p.symbol}</span>
        <span class="pill">${p.category}</span>
      </a>
    `).join('');
  }
}
