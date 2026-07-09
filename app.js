/* ==========================================================
   TradeFlow — Application logic (LIVE DATA via Finnhub API)
   ========================================================== */



/* ---------- Symbols tracked (name is local metadata, price is live) ---------- */
const SEED_STOCKS = [
  { symbol:'AAPL', name:'Apple Inc.' },
  { symbol:'TSLA', name:'Tesla, Inc.' },
  { symbol:'MSFT', name:'Microsoft Corp.' },
  { symbol:'NVDA', name:'NVIDIA Corp.' },
  { symbol:'AMZN', name:'Amazon.com, Inc.' },
  { symbol:'GOOGL',name:'Alphabet Inc.' },
  { symbol:'META', name:'Meta Platforms' },
  { symbol:'NFLX', name:'Netflix, Inc.' },
];

const SEED_INDICES = [
  { name:'S&P 500',   value:5487.03, pct:0.42 },
  { name:'Nasdaq',    value:17862.10, pct:0.68 },
  { name:'Dow Jones', value:39112.55, pct:-0.15 },
  { name:'Russell 2000', value:2043.77, pct:-0.31 },
];

const SEED_NOTIFS = [
  { text:'Your order for 10 AAPL shares was filled.', time:'2m ago' },
  { text:'Live prices are streaming from Finnhub.', time:'just now' },
  { text:'Weekly portfolio summary is ready.', time:'3h ago' },
];

/* ---------- State ---------- */
let state = loadState();
let apiHealthy = true;
let hasWarnedAboutKey = false;

function loadState(){
  const saved = JSON.parse(localStorage.getItem('tradeflow_state') || 'null');
  if (saved) {
    saved.stocks = SEED_STOCKS.map(s => {
      const prior = saved.stocks?.find(p => p.symbol === s.symbol);
      return { ...s, price: prior?.price ?? null, prevPrice: prior?.price ?? null, changePct: prior?.changePct ?? 0, vol: prior?.vol ?? '--' };
    });
    return saved;
  }
  return {
    theme: 'dark',
    stocks: SEED_STOCKS.map(s => ({ ...s, price:null, prevPrice:null, changePct:0, vol:'--' })),
    activeSymbol: 'AAPL',
    watchlistFilter: 'all',
    cash: 24500.75,
    positions: [
      { symbol:'AAPL', qty:10, avgPrice:198.40 },
      { symbol:'NVDA', qty:25, avgPrice:110.10 },
    ],
    orders: [
      { symbol:'AAPL', side:'buy', qty:10, price:198.40, time:'Yesterday 3:41 PM', status:'Filled' },
      { symbol:'NVDA', side:'buy', qty:25, price:110.10, time:'Mon 10:02 AM', status:'Filled' },
      { symbol:'TSLA', side:'sell', qty:5, price:255.00, time:'Fri 1:15 PM', status:'Filled' },
    ],
  };
}

function saveState(){
  localStorage.setItem('tradeflow_state', JSON.stringify(state));
}

/* ---------- DOM refs ---------- */
const $ = sel => document.querySelector(sel);
const summaryGrid   = $('#summaryGrid');
const symbolTabs    = $('#symbolTabs');
const watchlistBody = $('#watchlistBody');
const ordersBody    = $('#ordersBody');
const indexGrid     = $('#indexGrid');
const tickerTrack   = $('#tickerTrack');
const toastStack    = $('#toastStack');
const notifPanel    = $('#notifPanel');

/* ---------- Theme ---------- */
function applyTheme(){
  document.body.setAttribute('data-theme', state.theme);
  $('#themeLabel').textContent = state.theme === 'dark' ? 'Dark mode' : 'Light mode';
}
$('#themeToggle').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  saveState();
});

/* ---------- Sidebar (mobile) ---------- */
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('#sidebar').classList.remove('open');
  });
});

/* ---------- Notifications ---------- */
function renderNotifs(){
  notifPanel.innerHTML = SEED_NOTIFS.map(n => `
    <div class="notif-item">
      <div>${n.text}</div>
      <div class="t">${n.time}</div>
    </div>`).join('');
}
$('#notifBtn').addEventListener('click', e => {
  e.stopPropagation();
  notifPanel.classList.toggle('open');
});
document.addEventListener('click', () => notifPanel.classList.remove('open'));

function showToast(message, side='buy'){
  const el = document.createElement('div');
  el.className = `toast ${side === 'sell' ? 'sell' : ''}`;
  el.textContent = message;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------- Summary cards ---------- */
function portfolioValue(){
  return state.positions.reduce((sum, p) => {
    const stock = state.stocks.find(s => s.symbol === p.symbol);
    return sum + ((stock?.price || 0) * p.qty);
  }, 0);
}
function todaysPL(){
  return state.positions.reduce((sum, p) => {
    const stock = state.stocks.find(s => s.symbol === p.symbol);
    if (!stock || stock.price == null) return sum;
    return sum + (stock.price - (stock.prevPrice ?? stock.price)) * p.qty;
  }, 0);
}
function totalPL(){
  return state.positions.reduce((sum, p) => {
    const stock = state.stocks.find(s => s.symbol === p.symbol);
    if (!stock || stock.price == null) return sum;
    return sum + (stock.price - p.avgPrice) * p.qty;
  }, 0);
}

function renderSummary(){
  const pv = portfolioValue();
  const dayPL = todaysPL();
  const allPL = totalPL();
  const total = pv + state.cash;
  const cards = [
    { label:'Total portfolio value', value:`$${total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, delta:null },
    { label:"Today's P/L", value:`${dayPL>=0?'+':''}$${dayPL.toFixed(2)}`, delta:dayPL },
    { label:'Total gain / loss', value:`${allPL>=0?'+':''}$${allPL.toFixed(2)}`, delta:allPL },
    { label:'Buying power', value:`$${state.cash.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`, delta:null },
  ];
  summaryGrid.innerHTML = cards.map(c => `
    <div class="summary-card">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
      ${c.delta !== null ? `<div class="delta ${c.delta>=0?'up':'down'}">${c.delta>=0?'▲':'▼'} ${Math.abs(c.delta).toFixed(2)} today</div>` : ''}
    </div>
  `).join('');
}

/* ---------- Symbol tabs ---------- */
function renderSymbolTabs(){
  symbolTabs.innerHTML = state.stocks.slice(0,5).map(s => `
    <button class="sym-tab ${s.symbol===state.activeSymbol?'active':''}" data-symbol="${s.symbol}">${s.symbol}</button>
  `).join('');
  symbolTabs.querySelectorAll('.sym-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeSymbol = btn.dataset.symbol;
      renderSymbolTabs();
      renderChart();
      $('#ticketSymbol').value = state.activeSymbol;
      updateTicketPrice();
      saveState();
    });
  });
}

/* ---------- Chart (built live from real quotes as they stream in) ---------- */
let priceChart = null;
let chartHistory = {}; // symbol -> rolling array of real prices seen so far

function pushHistory(symbol, price){
  if (price == null) return;
  if (!chartHistory[symbol]) chartHistory[symbol] = [];
  const hist = chartHistory[symbol];
  hist.push(price);
  if (hist.length > 60) hist.shift();
}

function renderChart(){
  const stock = state.stocks.find(s => s.symbol === state.activeSymbol);
  if (!stock) return;
  const history = chartHistory[state.activeSymbol] || (stock.price != null ? [stock.price] : []);
  const isUp = stock.changePct >= 0;
  const lineColor = isUp ? '#00D9A3' : '#FF5C5C';

  $('#chartPrice').textContent = stock.price != null ? `$${stock.price.toFixed(2)}` : 'Loading…';
  const changeEl = $('#chartChange');
  changeEl.textContent = stock.price != null ? `${isUp?'+':''}${stock.changePct.toFixed(2)}%` : '--';
  changeEl.className = `chart-change ${isUp?'up':'down'}`;

  if (history.length < 2) return; // wait until we have at least two real data points

  const ctx = document.getElementById('priceChart').getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,260);
  gradient.addColorStop(0, isUp ? 'rgba(0,217,163,.28)' : 'rgba(255,92,92,.28)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  const data = {
    labels: history.map((_,i)=>i),
    datasets: [{
      data: history,
      borderColor: lineColor,
      backgroundColor: gradient,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      borderWidth: 2,
    }]
  };

  if (priceChart){
    priceChart.data = data;
    priceChart.update('none');
  } else {
    priceChart = new Chart(ctx, {
      type:'line',
      data,
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{enabled:false} },
        scales:{ x:{ display:false }, y:{ display:false } },
        animation:false,
      }
    });
  }
}

$('#rangeTabs').addEventListener('click', e => {
  const btn = e.target.closest('.range-btn');
  if (!btn) return;
  document.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  showToast('Free-tier data shows the live streaming session only — historical ranges need a paid plan.', 'buy');
});

/* ---------- Watchlist ---------- */
function renderWatchlist(flashSymbol=null, direction=null){
  let list = [...state.stocks];
  if (state.watchlistFilter === 'gainers') list = list.filter(s => s.changePct >= 0);
  if (state.watchlistFilter === 'losers')  list = list.filter(s => s.changePct < 0);

  const query = $('#searchInput').value.trim().toLowerCase();
  if (query) list = list.filter(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));

  watchlistBody.innerHTML = list.map(s => {
    const isUp = s.changePct >= 0;
    const flashClass = (s.symbol === flashSymbol) ? (direction === 'up' ? 'row-flash-up' : 'row-flash-down') : '';
    const priceText = s.price != null ? `$${s.price.toFixed(2)}` : '…';
    return `
      <tr class="${flashClass}">
        <td class="sym-cell">${s.symbol}<small>${s.name}</small></td>
        <td class="price-cell">${priceText}</td>
        <td class="change-cell ${isUp?'up':'down'}">${s.price!=null ? `${isUp?'▲':'▼'} ${Math.abs(s.changePct).toFixed(2)}%` : '--'}</td>
        <td class="vol-cell hide-sm">${s.vol}</td>
        <td><button class="mini-btn" data-sym="${s.symbol}">Trade</button></td>
      </tr>`;
  }).join('') || `<tr><td colspan="5" style="color:var(--text-faint);padding:20px 10px;">No matches found.</td></tr>`;

  watchlistBody.querySelectorAll('.mini-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeSymbol = btn.dataset.sym;
      $('#ticketSymbol').value = state.activeSymbol;
      updateTicketPrice();
      renderSymbolTabs();
      renderChart();
      window.scrollTo({top:0, behavior:'smooth'});
    });
  });
}

$('#filterChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  chip.classList.add('active');
  state.watchlistFilter = chip.dataset.filter;
  renderWatchlist();
});

$('#searchInput').addEventListener('input', () => renderWatchlist());

/* ---------- Market overview (static reference values — Finnhub free tier
   doesn't expose live index quotes, so these are shown as context, not live) ---------- */
function renderIndices(){
  indexGrid.innerHTML = SEED_INDICES.map(i => `
    <div class="index-item">
      <span class="index-name">${i.name}</span>
      <span class="index-vals">${i.value.toLocaleString()}<span class="pct ${i.pct>=0?'delta up':'delta down'}">${i.pct>=0?'+':''}${i.pct}%</span></span>
    </div>
  `).join('');
}

/* ---------- Orders ---------- */
function renderOrders(){
  ordersBody.innerHTML = state.orders.slice(0,8).map(o => `
    <tr>
      <td class="sym-cell">${o.symbol}</td>
      <td style="text-transform:capitalize;color:${o.side==='buy'?'var(--up)':'var(--down)'};font-weight:600;">${o.side}</td>
      <td>${o.qty}</td>
      <td class="price-cell">$${o.price.toFixed(2)}</td>
      <td class="hide-sm">${o.time}</td>
      <td><span class="status-pill ${o.status==='Filled'?'filled':'pending'}">${o.status}</span></td>
    </tr>
  `).join('');
}

/* ---------- Trade ticket ---------- */
let ticketSide = 'buy';
document.querySelectorAll('.ticket-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ticket-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    ticketSide = tab.dataset.side;
    const submitBtn = $('#ticketSubmit');
    submitBtn.textContent = ticketSide === 'buy' ? 'Buy shares' : 'Sell shares';
    submitBtn.classList.toggle('sell', ticketSide === 'sell');
  });
});

function updateTicketPrice(){
  const symbol = $('#ticketSymbol').value.toUpperCase();
  const stock = state.stocks.find(s => s.symbol === symbol);
  const qty = +$('#ticketQty').value || 0;
  $('#ticketPrice').textContent = stock?.price != null ? `$${stock.price.toFixed(2)}` : '--';
  $('#ticketTotal').textContent = stock?.price != null ? `$${(stock.price*qty).toFixed(2)}` : '--';
}
$('#ticketSymbol').addEventListener('input', updateTicketPrice);
$('#ticketQty').addEventListener('input', updateTicketPrice);

$('#tradeForm').addEventListener('submit', e => {
  e.preventDefault();
  const symbol = $('#ticketSymbol').value.toUpperCase().trim();
  const qty = +$('#ticketQty').value;
  const stock = state.stocks.find(s => s.symbol === symbol);
  if (!stock || stock.price == null || qty <= 0){
    showToast('Enter a valid symbol and quantity (price still loading?).', 'sell');
    return;
  }
  const cost = stock.price * qty;

  if (ticketSide === 'buy'){
    if (cost > state.cash){
      showToast('Not enough buying power for this order.', 'sell');
      return;
    }
    state.cash -= cost;
    const existing = state.positions.find(p => p.symbol === symbol);
    if (existing){
      const totalQty = existing.qty + qty;
      existing.avgPrice = ((existing.avgPrice*existing.qty) + cost) / totalQty;
      existing.qty = totalQty;
    } else {
      state.positions.push({ symbol, qty, avgPrice: stock.price });
    }
  } else {
    const existing = state.positions.find(p => p.symbol === symbol);
    if (!existing || existing.qty < qty){
      showToast('You do not own enough shares to sell.', 'sell');
      return;
    }
    existing.qty -= qty;
    state.cash += cost;
    if (existing.qty === 0) state.positions = state.positions.filter(p => p.symbol !== symbol);
  }

  state.orders.unshift({
    symbol, side: ticketSide, qty, price: stock.price,
    time: 'Just now', status: 'Filled'
  });

  showToast(`${ticketSide === 'buy' ? 'Bought' : 'Sold'} ${qty} shares of ${symbol} at $${stock.price.toFixed(2)}`, ticketSide);
  renderSummary();
  renderOrders();
  saveState();
});

/* ---------- LIVE DATA: Finnhub quote polling ---------- */
async function fetchQuote(symbol){
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);
  const data = await res.json();
  // Finnhub /quote fields: c=current, d=change, dp=percent change, h=high, l=low, o=open, pc=prev close, t=timestamp
  if (data.c == null || data.t === 0) throw new Error(`No data for ${symbol}`);
  return data;
}

async function refreshAllQuotes(){
  if (!CONFIG.API_KEY || CONFIG.API_KEY === 'YOUR_FINNHUB_API_KEY'){
    if (!hasWarnedAboutKey){
      showToast('Add your free Finnhub API key at the top of app.js to load live prices.', 'sell');
      hasWarnedAboutKey = true;
    }
    return;
  }

  let flashSymbol = null, direction = null;
  let anySucceeded = false;

  for (const stock of state.stocks){
    try {
      const q = await fetchQuote(stock.symbol);
      stock.prevPrice = stock.price ?? q.pc;
      stock.price = q.c;
      stock.changePct = q.dp ?? 0;
      anySucceeded = true;
      if (stock.symbol === state.activeSymbol) pushHistory(stock.symbol, stock.price);
      direction = stock.price >= stock.prevPrice ? 'up' : 'down';
      flashSymbol = stock.symbol;
    } catch (err){
      console.warn('Quote fetch failed:', err.message);
    }
  }

  if (anySucceeded){
    if (!apiHealthy){ showToast('Live prices are back online.', 'buy'); }
    apiHealthy = true;
  } else if (apiHealthy){
    apiHealthy = false;
    showToast('Could not reach Finnhub — check your API key or connection.', 'sell');
  }

  renderWatchlist(flashSymbol, direction);
  renderChart();
  renderSummary();
  renderTicker();
  updateTicketPrice();
  saveState();
}

/* ---------- Ticker tape ---------- */
function renderTicker(){
  const ready = state.stocks.filter(s => s.price != null);
  if (!ready.length){
    tickerTrack.innerHTML = `<span style="font-family:var(--font-mono);font-size:12.5px;color:var(--text-faint);">Connecting to live market data…</span>`;
    return;
  }
  const items = [...ready, ...ready];
  tickerTrack.innerHTML = items.map(s => {
    const isUp = s.changePct >= 0;
    return `<span><span class="sym">${s.symbol}</span><span class="${isUp?'up':'down'}">$${s.price.toFixed(2)} ${isUp?'▲':'▼'}${Math.abs(s.changePct).toFixed(2)}%</span></span>`;
  }).join('');
}

/* ---------- Init ---------- */
function init(){
  applyTheme();
  renderNotifs();
  renderSummary();
  renderSymbolTabs();
  renderChart();
  renderWatchlist();
  renderIndices();
  renderOrders();
  renderTicker();
  updateTicketPrice();

  refreshAllQuotes(); // first load
  setInterval(refreshAllQuotes, CONFIG.POLL_INTERVAL_MS);
}

init();
