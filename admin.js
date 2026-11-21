/* ============================================================
   ADMIN DASHBOARD — screens
   All data comes from AdminData (admin-data.js).
   ============================================================ */
(() => {
  const $ = id => document.getElementById(id);
  const DAY = 86400000;
  const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
  const compactNaira = v => (v >= 1e6 ? `₦${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e4 ? `₦${Math.round(v / 1e3)}K` : naira.format(v));

  // everything customers typed (names, addresses, reviews) is escaped before display
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STATUS = {
    pending:   { label: 'Payment to confirm', icon: 'fa-hourglass-half', tone: 'warning' },
    confirmed: { label: 'Confirmed',          icon: 'fa-circle-check',   tone: 'info' },
    out:       { label: 'Out for delivery',   icon: 'fa-truck-fast',     tone: 'info' },
    delivered: { label: 'Delivered',          icon: 'fa-house-circle-check', tone: 'good' },
    cancelled: { label: 'Cancelled',          icon: 'fa-ban',            tone: 'critical' },
    date_sent: { label: 'Delivery date sent on WhatsApp', icon: 'fa-paper-plane', tone: 'info' }
  };
  const pill = status => {
    const s = STATUS[status] || STATUS.pending;
    return `<span class="status-pill tone-${s.tone}"><i class="fa-solid ${s.icon}" aria-hidden="true"></i>${s.label}</span>`;
  };

  const fmtDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const fmtDateTime = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const deliveredAt = o => (o.history.find(h => h.status === 'delivered') || {}).at;
  // products that share a name (e.g. three "Refill Pack" sizes) get their price added so they can be told apart
  const sharedNames = () => {
    const count = {};
    (productsData.length ? productsData : []).forEach(p => { count[p.name] = (count[p.name] || 0) + 1; });
    return count;
  };
  const itemName = it => (sharedNames()[it.name] > 1 ? `${it.name} ${naira.format(it.price)}` : it.name);
  const itemsSummary = o => o.items.map(it => `${itemName(it)}${it.type ? ` (${it.type})` : ''} × ${it.qty}`).join(', ');

  let orders = [], productsData = [];

  /* ---------- delivery batch helpers ---------- */
  const batchOf = o => (o.batchId ? Batch.byId(o.batchId) : null);
  const awaiting = o => !!o.awaitingBatch && o.status !== 'cancelled';
  const batchTag = o => (awaiting(o)
    ? '<span class="batch-tag"><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> New batch</span>'
    : (batchOf(o) ? `<span class="batch-label">${esc(Batch.label(batchOf(o)))}</span>` : ''));

  // the ready-made WhatsApp message with the delivery date
  const dateMessage = (o, b) => {
    const first = o.customer.name.trim().split(/\s+/)[0];
    const place = o.location === 'Home Delivery' ? `Delivery to: ${o.address || 'your address'}.` : `Pickup: ${o.location}.`;
    return `Hi ${first} 👋, your Divine Grace order ${o.paymentRef || o.ref} will be delivered on ${Batch.format(b.date)}${b.note ? `, ${b.note.charAt(0).toLowerCase() + b.note.slice(1)}` : ''}. ${place}`;
  };
  const waLink = (o, text) => `https://wa.me/${'234' + o.customer.phone.replace(/\D/g, '').replace(/^234/, '').replace(/^0/, '')}?text=${encodeURIComponent(text)}`;
  let range = 30;

  /* ======================= toast ======================= */
  let toastTimer;
  const toast = (text, tone = 'good') => {
    const t = $('toast');
    t.innerHTML = `<i class="fa-solid ${tone === 'good' ? 'fa-circle-check' : 'fa-circle-exclamation'}" aria-hidden="true"></i> ${esc(text)}`;
    t.className = `toast tone-${tone}`; t.hidden = false;
    requestAnimationFrame(() => t.classList.add('is-on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('is-on'); setTimeout(() => { t.hidden = true; }, 250); }, 2600);
  };

  /* ======================= sign in ======================= */
  const showApp = session => {
    $('loginView').hidden = true;
    $('appView').hidden = false;
    $('adminEmail').textContent = session.email;
    loadAll();
  };

  const showLogin = () => {
    $('appView').hidden = true;
    $('loginView').hidden = false;
    $('loginEmail').focus();
  };

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('loginMessage'); msg.className = 'form-message'; msg.textContent = '';
    const email = $('loginEmail').value, password = $('loginPassword').value;
    if (!email || !password) { msg.className = 'form-message error'; msg.textContent = 'Enter your email and password.'; return; }
    const btn = $('loginSubmit'); const idle = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Signing in…';
    try { showApp(await AdminData.signIn(email, password)); }
    catch (err) { msg.className = 'form-message error'; msg.textContent = err.message; }
    finally { btn.disabled = false; btn.innerHTML = idle; }
  });

  $('passwordToggle').addEventListener('click', () => {
    const input = $('loginPassword'); const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('passwordToggle').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    $('passwordToggle').innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>`;
  });

  $('demoFill').addEventListener('click', () => {
    $('loginEmail').value = AdminData.DEMO_LOGIN.email;
    $('loginPassword').value = AdminData.DEMO_LOGIN.password;
    $('loginSubmit').focus();
  });

  $('signOut').addEventListener('click', async () => { await AdminData.signOut(); showLogin(); });

  /* ======================= navigation ======================= */
  const VIEWS = {
    overview: ['Overview', 'How the business is doing.'],
    orders: ['Orders', 'Confirm payments and track deliveries.'],
    products: ['Products', 'Prices, weights and what customers can order.']
  };
  const go = view => {
    document.querySelectorAll('.admin-view').forEach(v => { v.hidden = v.dataset.view !== view; });
    document.querySelectorAll('.admin-nav-link').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
    $('viewTitle').textContent = VIEWS[view][0];
    $('viewSub').textContent = VIEWS[view][1];
    if (view === 'overview') renderOverview();
    try { history.replaceState(null, '', '#' + view); } catch (e) {}
    window.scrollTo({ top: 0 });
  };
  document.querySelectorAll('.admin-nav-link').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  document.addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) go(g.dataset.goto); });

  async function loadAll() {
    [orders, productsData] = await Promise.all([AdminData.getOrders(), AdminData.getProducts()]);
    updateBadge();
    renderOrders();
    renderProducts();
    startBatchCard();
    const start = (location.hash || '').slice(1);
    go(VIEWS[start] ? start : 'overview');
  }

  // a new order was placed in the shop (another tab): pull it in
  if (typeof ShopOrders !== 'undefined') ShopOrders.onChange(async () => {
    if ($('appView').hidden) return;
    orders = await AdminData.getOrders();
    updateBadge(); renderOrders(); renderBatchCard();
    if (!document.querySelector('[data-view="overview"].admin-view').hidden) renderOverview();
    toast('New order received');
  });

  const updateBadge = () => {
    const n = orders.filter(o => o.status === 'pending').length;
    const b = $('pendingBadge'); b.hidden = !n; b.textContent = n;
  };

  /* ======================= overview ======================= */
  document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
    range = Number(b.dataset.range);
    document.querySelectorAll('.range-btn').forEach(x => x.classList.toggle('is-active', x === b));
    renderOverview();
  }));

  function periodOrders(days, offset = 0) {
    const end = Date.now() - offset * days * DAY, start = end - days * DAY;
    return orders.filter(o => { const t = new Date(o.createdAt).getTime(); return t > start && t <= end; });
  }

  function renderOverview() {
    const cur = periodOrders(range), prev = periodOrders(range, 1);
    const revenue = list => list.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
    const delivered = list => list.filter(o => o.status === 'delivered').length;
    const delta = (a, b) => (b ? Math.round((a - b) / b * 100) : null);

    const tiles = [
      { label: 'Revenue', value: compactNaira(revenue(cur)), delta: delta(revenue(cur), revenue(prev)) },
      { label: 'Orders', value: cur.length.toLocaleString(), delta: delta(cur.length, prev.length) },
      { label: 'Delivered', value: delivered(cur).toLocaleString(), delta: delta(delivered(cur), delivered(prev)) },
      { label: 'Payments to confirm', value: orders.filter(o => o.status === 'pending').length, note: 'right now', attention: true }
    ];
    $('kpis').innerHTML = tiles.map(t => `
      <div class="kpi${t.attention ? ' kpi-attention' : ''}">
        <span class="kpi-label">${t.label}</span>
        <strong class="kpi-value">${t.value}</strong>
        ${t.delta === null || t.delta === undefined
          ? `<span class="kpi-note">${t.note || `last ${range} days`}</span>`
          : `<span class="kpi-delta ${t.delta >= 0 ? 'up' : 'down'}"><i class="fa-solid ${t.delta >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}" aria-hidden="true"></i>${t.delta >= 0 ? '+' : ''}${t.delta}% <span>vs previous ${range} days</span></span>`}
      </div>`).join('');

    // deliveries per day
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const series = [];
    for (let i = range - 1; i >= 0; i--) series.push({ date: new Date(today.getTime() - i * DAY), value: 0 });
    const index = Object.fromEntries(series.map((p, i) => [dayKey(p.date), i]));
    orders.forEach(o => { const at = deliveredAt(o); if (at && index[dayKey(at)] !== undefined) series[index[dayKey(at)]].value++; });
    const total = series.reduce((s, p) => s + p.value, 0);
    $('deliveriesSub').textContent = `${total} orders delivered in the last ${range} days`;
    drawLineChart($('deliveriesChart'), series);
    $('deliveriesTable').innerHTML = `<table><thead><tr><th>Date</th><th class="num">Deliveries</th></tr></thead><tbody>${
      series.slice().reverse().map(p => `<tr><td>${p.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td><td class="num">${p.value}</td></tr>`).join('')}</tbody></table>`;

    // by location (ranked bars, one hue)
    const del = cur.filter(o => o.status === 'delivered');
    const byLoc = AdminData.LOCATIONS.map(l => ({ name: l, value: del.filter(o => o.location === l).length }))
      .sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...byLoc.map(b => b.value));
    const sum = byLoc.reduce((s, b) => s + b.value, 0) || 1;
    $('locationBars').innerHTML = byLoc.map(b => `
      <div class="bar-row" tabindex="0" data-tip="${esc(b.name)}|${b.value} deliveries · ${Math.round(b.value / sum * 100)}%">
        <span class="bar-name">${esc(b.name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(b.value / max * 100).toFixed(1)}%"></span></span>
        <span class="bar-value">${b.value}</span>
      </div>`).join('');

    // needs attention
    const att = [...orders.filter(awaiting), ...orders.filter(o => !awaiting(o) && ['pending', 'confirmed', 'out'].includes(o.status))].slice(0, 6);
    $('attentionList').innerHTML = att.length ? att.map(o => `
      <li><button type="button" class="attention-item" data-order="${o.id}">
        <span class="att-main"><strong>${esc(o.customer.name)}</strong><span>${esc(o.ref)} · ${naira.format(o.total)} · ${esc(o.location)}</span></span>
        ${awaiting(o) ? batchTag(o) : pill(o.status)}
      </button></li>`).join('') : '<li class="att-empty">All caught up 🎉</li>';
  }

  $('deliveriesTableToggle').addEventListener('click', e => {
    const on = $('deliveriesTable').hidden;
    $('deliveriesTable').hidden = !on; $('deliveriesChart').hidden = on;
    e.currentTarget.setAttribute('aria-pressed', String(on));
    e.currentTarget.innerHTML = on ? '<i class="fa-solid fa-chart-line" aria-hidden="true"></i> Chart' : '<i class="fa-solid fa-table" aria-hidden="true"></i> Table';
  });

  /* ---------- line chart (single series: no legend, the title names it) ---------- */
  const tip = $('chartTooltip');
  const showTip = (html, x, y) => {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    tip.style.left = `${left}px`; tip.style.top = `${top}px`;
  };
  const hideTip = () => { tip.hidden = true; };

  function drawLineChart(el, data) {
    const w = el.clientWidth || 600, h = 240;
    const m = { top: 18, right: 34, bottom: 30, left: 34 };
    const iw = w - m.left - m.right, ih = h - m.top - m.bottom;
    const maxV = Math.max(...data.map(d => d.value), 1);
    const step = maxV <= 4 ? 1 : maxV <= 8 ? 2 : maxV <= 20 ? 5 : 10;
    const top = Math.ceil(maxV / step) * step;
    const x = i => m.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = v => m.top + ih - (v / top) * ih;

    const ticks = []; for (let v = 0; v <= top; v += step) ticks.push(v);
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
    const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const xEvery = Math.ceil(data.length / (w < 480 ? 4 : 6));
    const xLabels = data.map((d, i) => ((data.length - 1 - i) % xEvery === 0 ? `<text class="axis-text" x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${fmtDate(d.date)}</text>` : '')).join('');
    const last = data[data.length - 1];

    el.innerHTML = `
      <svg class="line-chart" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" tabindex="0"
           aria-label="Deliveries per day, last ${data.length} days. Use left and right arrow keys to read each day.">
        ${ticks.map(v => `<line class="grid" x1="${m.left}" x2="${w - m.right}" y1="${y(v)}" y2="${y(v)}"/>
                          <text class="axis-text" x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        <line class="baseline" x1="${m.left}" x2="${w - m.right}" y1="${y(0)}" y2="${y(0)}"/>
        ${xLabels}
        <path class="area" d="${area}"/>
        <path class="line" d="${line}"/>
        <circle class="end-dot" cx="${x(data.length - 1)}" cy="${y(last.value)}" r="4"/>
        <text class="end-label" x="${x(data.length - 1) + 8}" y="${y(last.value) + 4}">${last.value}</text>
        <line class="crosshair" y1="${m.top}" y2="${y(0)}" x1="0" x2="0" visibility="hidden"/>
        <circle class="hover-dot" r="4" visibility="hidden"/>
        <rect class="hit" x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>`;

    const svg = el.querySelector('svg'), cross = svg.querySelector('.crosshair'), dot = svg.querySelector('.hover-dot');
    let focusIdx = data.length - 1;
    const show = (i, clientX, clientY) => {
      const d = data[i]; const cx = x(i);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', y(d.value)); dot.setAttribute('visibility', 'visible');
      const box = svg.getBoundingClientRect();
      showTip(`<strong>${d.value} ${d.value === 1 ? 'delivery' : 'deliveries'}</strong><span>${d.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>`,
        clientX ?? box.left + cx, clientY ?? box.top + y(d.value));
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
    svg.addEventListener('pointermove', e => {
      const box = svg.getBoundingClientRect(); const px = (e.clientX - box.left) * (w / box.width);
      const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - m.left) / iw) * (data.length - 1))));
      focusIdx = i; show(i, e.clientX, e.clientY);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => show(focusIdx));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { focusIdx = Math.max(0, focusIdx - 1); show(focusIdx); e.preventDefault(); }
      if (e.key === 'ArrowRight') { focusIdx = Math.min(data.length - 1, focusIdx + 1); show(focusIdx); e.preventDefault(); }
    });
  }

  // bar tooltips (hover + keyboard)
  $('locationBars').addEventListener('pointermove', e => {
    const row = e.target.closest('.bar-row'); if (!row) return hideTip();
    const [name, val] = row.dataset.tip.split('|');
    showTip(`<strong>${esc(val)}</strong><span>${esc(name)}</span>`, e.clientX, e.clientY);
  });
  $('locationBars').addEventListener('pointerleave', hideTip);
  $('locationBars').addEventListener('focusin', e => {
    const row = e.target.closest('.bar-row'); if (!row) return;
    const [name, val] = row.dataset.tip.split('|'); const r = row.getBoundingClientRect();
    showTip(`<strong>${esc(val)}</strong><span>${esc(name)}</span>`, r.left + r.width / 2, r.top);
  });
  $('locationBars').addEventListener('focusout', hideTip);

  let resizeTimer;
  new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!$('appView').hidden && !document.querySelector('[data-view="overview"].admin-view').hidden) renderOverview(); }, 120); })
    .observe($('deliveriesChart'));

  /* ======================= orders ======================= */
  let statusFilter = 'all', search = '', shown = 20;
  const TABS = [['all', 'All'], ['awaiting', 'Awaiting new batch'], ['pending', 'Payment to confirm'], ['confirmed', 'Confirmed'], ['out', 'Out for delivery'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
  const inTab = (o, k) => (k === 'all' ? true : k === 'awaiting' ? awaiting(o) : o.status === k);

  function renderOrders() {
    $('statusTabs').innerHTML = TABS.map(([k, label]) => {
      const n = orders.filter(o => inTab(o, k)).length;
      if (k === 'awaiting' && !n && statusFilter !== 'awaiting') return '';
      return `<button type="button" role="tab" class="status-tab${statusFilter === k ? ' is-active' : ''}${k === 'awaiting' ? ' tab-awaiting' : ''}" aria-selected="${statusFilter === k}" data-status="${k}">${label}<em>${n}</em></button>`;
    }).join('');

    const q = search.trim().toLowerCase();
    const list = orders.filter(o => inTab(o, statusFilter) &&
      (!q || [o.customer.name, o.customer.phone, o.ref].some(v => v.toLowerCase().includes(q))));

    $('ordersBody').innerHTML = list.slice(0, shown).map(o => `
      <tr data-order="${o.id}" tabindex="0">
        <td data-label="Order"><strong class="mono">${esc(o.ref)}</strong><span class="sub">${fmtDateTime(o.createdAt)}</span>${batchTag(o)}</td>
        <td data-label="Customer"><strong>${esc(o.customer.name)}</strong><span class="sub">${esc(o.customer.phone)}</span></td>
        <td data-label="Items" class="items-cell">${esc(itemsSummary(o))}</td>
        <td data-label="Location">${esc(o.location)}</td>
        <td data-label="Total" class="num"><strong>${naira.format(o.total)}</strong></td>
        <td data-label="Status">${pill(o.status)}</td>
        <td class="chev"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></td>
      </tr>`).join('');
    $('ordersEmpty').hidden = list.length > 0;
    $('ordersMore').hidden = list.length <= shown;
    updateCopyBar();
  }

  /* ---------- copy a WhatsApp-ready summary (Payment to confirm, Confirmed, Out for delivery) ---------- */
  const COPYABLE = {
    pending: { title: 'Payments to confirm', noun: ['payment to confirm', 'payments to confirm'] },
    confirmed: { title: 'Confirmed orders', noun: ['confirmed order', 'confirmed orders'] },
    out: { title: 'Out for delivery', noun: ['order out for delivery', 'orders out for delivery'] }
  };
  const PAYMENT_LINE = { pending: '⏳ Awaiting confirmation', confirmed: '✅ Confirmed', out: '✅ Paid', delivered: '✅ Paid', cancelled: '❌ Cancelled' };

  function updateCopyBar() {
    const cfg = COPYABLE[statusFilter];
    $('copyBar').hidden = !cfg;
    if (!cfg) return;
    const n = orders.filter(o => o.status === statusFilter).length;
    $('copyBarText').textContent = n ? `${n} ${cfg.noun[n === 1 ? 0 : 1]}, ready to share` : `No ${cfg.noun[1]} right now`;
    $('copyWhatsApp').disabled = !n;
  }

  const itemLines = o => o.items.map(it => `${it.qty} × ${itemName(it)}${it.type ? ` (${it.type})` : ''}`);
  const placeLine = o => (o.location === 'Home Delivery' ? `Home Delivery — ${o.address || 'address not given'}` : o.location);
  const stamp = () => new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function whatsappText(status) {
    const list = orders.filter(o => o.status === status).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const value = list.reduce((s, o) => s + o.total, 0);
    const head = [`*Divine Grace Chips — ${COPYABLE[status].title}* (${list.length})`, `_${stamp()}_`, ''];

    if (status === 'out') {
      // delivery summary: by location, packs to take, then each order
      const byLoc = AdminData.LOCATIONS.map(l => [l, list.filter(o => o.location === l).length]).filter(([, n]) => n);
      const packs = {};
      list.forEach(o => o.items.forEach(it => {
        const k = `${itemName(it)}${it.type ? ` (${it.type})` : ''}`;
        packs[k] = (packs[k] || 0) + it.qty;
      }));
      return [
        ...head,
        '*By location*',
        ...byLoc.map(([l, n]) => `• ${l}: ${n} order${n === 1 ? '' : 's'}`),
        '',
        '*Packs to take out*',
        ...Object.entries(packs).sort((a, b) => b[1] - a[1]).map(([k, n]) => `• ${k} × ${n}`),
        '',
        '*Orders*',
        ...list.map((o, i) => `${i + 1}. ${o.customer.name} (${o.customer.phone}) — ${placeLine(o)}\n    ${itemLines(o).join(', ')} · ${naira.format(o.total)} · ${PAYMENT_LINE[o.status]}`),
        '',
        `*Total value:* ${naira.format(value)}`
      ].join('\n');
    }

    // payments to confirm / confirmed: everyone individually
    return [
      ...head,
      ...list.map((o, i) => [
        `${i + 1}. *${o.customer.name}* — ${o.customer.phone}`,
        `    Order: ${itemLines(o).join(', ')}`,
        `    Total: ${naira.format(o.total)} · Ref ${o.paymentRef}`,
        `    Payment: ${PAYMENT_LINE[o.status]}`,
        `    ${o.location === 'Home Delivery' ? 'Delivery' : 'Pickup'}: ${placeLine(o)}`,
        ''
      ].join('\n')),
      `*Total:* ${naira.format(value)} from ${list.length} order${list.length === 1 ? '' : 's'}`
    ].join('\n');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) {}
      t.remove(); return ok;
    }
  }

  $('copyWhatsApp').addEventListener('click', async () => {
    if (!COPYABLE[statusFilter]) return;
    const n = orders.filter(o => o.status === statusFilter).length;
    const ok = await copyText(whatsappText(statusFilter));
    const btn = $('copyWhatsApp');
    if (ok) {
      btn.classList.add('is-copied');
      btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>Copied</span>';
      setTimeout(() => { btn.classList.remove('is-copied'); btn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Copy for WhatsApp</span>'; }, 1800);
      toast(`Copied ${n} order${n === 1 ? '' : 's'}: paste it in WhatsApp`);
    } else {
      toast('Copy didn’t work in this browser. Try again.', 'bad');
    }
  });

  $('statusTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-status]'); if (!b) return;
    statusFilter = b.dataset.status; shown = 20; renderOrders();
  });
  $('orderSearch').addEventListener('input', e => { search = e.target.value; shown = 20; renderOrders(); });
  $('ordersMore').addEventListener('click', () => { shown += 20; renderOrders(); });

  const openFrom = e => {
    const el = e.target.closest('[data-order]');
    if (el) openOrder(el.dataset.order);
  };
  $('ordersBody').addEventListener('click', openFrom);
  $('ordersBody').addEventListener('keydown', e => { if (e.key === 'Enter') openFrom(e); });
  $('attentionList').addEventListener('click', openFrom);

  /* ---------- order drawer ---------- */
  const NEXT = {
    pending: [['confirmed', 'Confirm payment', 'fa-circle-check', 'primary'], ['cancelled', 'Cancel order', 'fa-ban', 'danger']],
    confirmed: [['out', 'Mark out for delivery', 'fa-truck-fast', 'primary'], ['cancelled', 'Cancel order', 'fa-ban', 'danger']],
    out: [['delivered', 'Mark delivered', 'fa-house-circle-check', 'primary']],
    delivered: [], cancelled: []
  };
  let openId = null, lastFocus = null;

  // "Delivery batch" part of the order details, with the Send date on WhatsApp button
  function batchSection(o) {
    const open = Batch.open();
    const sent = o.history.filter(h => h.status === 'date_sent').pop();
    const done = ['delivered', 'cancelled'].includes(o.status);
    if (awaiting(o)) {
      return `<section class="d-section d-batch is-awaiting">
        <h3>Delivery batch</h3>
        <p>${batchTag(o)} Ordered after the last batch closed, so this customer doesn’t have a delivery date yet.</p>
        ${open && Batch.taking(open)
          ? `<a class="btn btn-whatsapp d-send" href="${esc(waLink(o, dateMessage(o, open)))}" target="_blank" rel="noopener" data-send-date="${esc(open.id)}">
               <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Send date on WhatsApp</a>
             <p class="d-muted">Sends <strong>${esc(Batch.label(open))}</strong> and moves this order into that batch.</p>`
          : '<p class="d-muted">Open a new batch (Products → Delivery batch) to send this customer a date.</p>'}
      </section>`;
    }
    const b = batchOf(o);
    if (!b) return '';
    return `<section class="d-section d-batch">
      <h3>Delivery batch</h3>
      <p><strong>${esc(Batch.label(b))}</strong>${b.note ? ` · ${esc(b.note)}` : ''}</p>
      ${!done && Batch.parse(b.date) >= new Date(new Date().setHours(0, 0, 0, 0))
        ? `<a class="btn btn-whatsapp d-send" href="${esc(waLink(o, dateMessage(o, b)))}" target="_blank" rel="noopener" data-send-date="${esc(b.id)}">
             <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${sent ? 'Send date again' : 'Send date on WhatsApp'}</a>` : ''}
      ${sent ? `<p class="d-muted"><i class="fa-solid fa-check" aria-hidden="true"></i> Date sent ${fmtDateTime(sent.at)}</p>` : ''}
    </section>`;
  }

  // tapping "Send date on WhatsApp": WhatsApp opens (link), and the order is updated here
  $('drawerBody').addEventListener('click', async e => {
    const a = e.target.closest('[data-send-date]'); if (!a || !openId) return;
    const wasAwaiting = awaiting(orders.find(o => o.id === openId));
    const updated = await AdminData.sendDate(openId, a.dataset.sendDate);
    orders = orders.map(o => (o.id === updated.id ? updated : o));
    renderOrders();
    if (!document.querySelector('[data-view="overview"].admin-view').hidden) renderOverview();
    setTimeout(() => openOrder(updated.id), 300);
    toast(wasAwaiting ? `${updated.ref} moved to ${Batch.label(Batch.byId(updated.batchId))}` : `${updated.ref}: delivery date sent`);
  });

  function openOrder(id) {
    const o = orders.find(x => x.id === id); if (!o) return;
    openId = id; lastFocus = document.activeElement;
    $('drawerTitle').textContent = o.ref;
    const wa = '234' + o.customer.phone.slice(1);
    $('drawerBody').innerHTML = `
      <div class="drawer-status">${pill(o.status)}<span>Placed ${fmtDateTime(o.createdAt)}</span></div>

      <section class="d-section">
        <h3>Customer</h3>
        <p class="d-strong">${esc(o.customer.name)}</p>
        <div class="d-contacts">
          <a href="tel:${esc(o.customer.phone)}"><i class="fa-solid fa-phone" aria-hidden="true"></i> ${esc(o.customer.phone)}</a>
          <a href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>
          ${o.customer.email ? `<a href="mailto:${esc(o.customer.email)}"><i class="fa-regular fa-envelope" aria-hidden="true"></i> Email</a>` : ''}
        </div>
      </section>

      ${batchSection(o)}

      <section class="d-section d-grid">
        <div><h3>Delivery</h3><p>${esc(o.location)}</p>${o.address ? `<p class="d-muted">${esc(o.address)}</p>` : ''}</div>
        <div><h3>Order type</h3><p>${esc(o.orderType)}</p></div>
      </section>

      <section class="d-section">
        <h3>Items</h3>
        <ul class="d-items">${o.items.map(it => `
          <li><span>${it.qty} × ${esc(itemName(it))}${it.type ? ` <em>${esc(it.type)}</em>` : ''}</span><strong>${naira.format(it.price * it.qty)}</strong></li>`).join('')}
        </ul>
        <div class="d-total"><span>Total</span><strong>${naira.format(o.total)}</strong></div>
      </section>

      <section class="d-section">
        <h3>Payment</h3>
        <p>Bank transfer · reference <strong class="mono">${esc(o.paymentRef)}</strong></p>
        ${o.status === 'pending' ? '<p class="d-warn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Check your bank for a transfer with this reference and amount before confirming.</p>' : ''}
      </section>

      ${o.review ? `<section class="d-section"><h3>Customer review</h3><blockquote>“${esc(o.review)}”</blockquote></section>` : ''}

      <section class="d-section">
        <h3>Timeline</h3>
        <ol class="d-timeline">${o.history.map(h => `<li><span class="tl-dot tone-${(STATUS[h.status] || STATUS.confirmed).tone}"></span><strong>${(STATUS[h.status] || { label: h.status }).label}</strong><span>${fmtDateTime(h.at)}</span></li>`).join('')}</ol>
      </section>`;

    const actions = NEXT[o.status];
    $('drawerActions').innerHTML = actions.length
      ? actions.map(([st, label, icon, kind]) => `<button type="button" class="btn ${kind === 'primary' ? 'btn-primary' : 'btn-light danger-btn'}" data-set-status="${st}"><i class="fa-solid ${icon}" aria-hidden="true"></i> ${label}</button>`).join('')
      : `<p class="d-muted">${o.status === 'delivered' ? 'This order is complete.' : 'This order was cancelled.'}</p>`;

    const ov = $('orderDrawer'); ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('is-open'));
    document.body.classList.add('viewer-open');
    $('drawerClose').focus({ preventScroll: true });
  }

  const closeDrawer = () => {
    const ov = $('orderDrawer'); ov.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
    setTimeout(() => { ov.hidden = true; }, 250);
    openId = null; if (lastFocus) lastFocus.focus({ preventScroll: true });
  };
  $('drawerClose').addEventListener('click', closeDrawer);
  $('orderDrawer').addEventListener('click', e => { if (e.target === $('orderDrawer')) closeDrawer(); });

  $('drawerActions').addEventListener('click', async e => {
    const b = e.target.closest('[data-set-status]'); if (!b || !openId) return;
    const status = b.dataset.setStatus;
    if (status === 'cancelled' && !confirm('Cancel this order?')) return;
    b.disabled = true;
    const updated = await AdminData.updateOrderStatus(openId, status);
    orders = orders.map(o => (o.id === updated.id ? updated : o));
    updateBadge(); renderOrders();
    if (!document.querySelector('[data-view="overview"].admin-view').hidden) renderOverview();
    openOrder(updated.id);
    toast(`${updated.ref}: ${STATUS[status].label}`);
  });

  /* ======================= delivery batch ======================= */
  // modes: 'none' (no batch open), 'new' (starting one), 'open' (a batch is open)
  let batchMode = 'none';

  const waitingCount = () => orders.filter(awaiting).length;

  function renderBatchCard() {
    const open = Batch.open();
    if (open && batchMode !== 'open') batchMode = 'open';
    if (!open && batchMode === 'open') batchMode = 'none';
    const state = $('batchState');
    const cur = Batch.current();
    if (batchMode === 'none') {
      $('batchHeading').textContent = 'Delivery batch';
      const n = waitingCount();
      $('batchNoneNote').innerHTML = n
        ? `<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span><strong>${n} order${n === 1 ? '' : 's'}</strong> ${n === 1 ? 'is' : 'are'} waiting for a delivery date.</span><button type="button" class="link-btn" data-goto-awaiting>Send dates</button>`
        : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i><span>No batch is open. New orders will wait for the next batch.</span>';
      $('batchNoneNote').classList.toggle('is-calm', !n);
    } else if (batchMode === 'new') {
      state.className = 'batch-state is-new'; state.textContent = 'New batch';
      const next = Batch.all().reduce((m, x) => Math.max(m, x.number), 0) + 1;
      $('batchHeading').textContent = `Start Batch ${next}`;
    } else {
      state.className = 'batch-state ' + (!open.show ? 'is-off' : cur && cur.closed ? 'is-closed' : 'is-live');
      state.textContent = !open.show ? 'Hidden from customers' : cur && cur.closed ? 'Orders closed' : 'Live on the shop';
      $('batchHeading').textContent = `Batch ${open.number} is open`;
    }
    $('batchNone').hidden = batchMode !== 'none';
    $('batchSub').hidden = batchMode === 'none';
    state.hidden = batchMode === 'none';
    $('batchCard').classList.toggle('is-none', batchMode === 'none');
    $('batchForm').hidden = batchMode === 'none';
    $('bCancel').hidden = batchMode !== 'new';
    $('bClose').hidden = batchMode !== 'open';
    $('batchResetNote').hidden = batchMode !== 'new';
    $('bSave').innerHTML = batchMode === 'new'
      ? '<i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Open batch'
      : '<i class="fa-solid fa-check" aria-hidden="true"></i> Save changes';
    // waiting orders reminder when a batch is open
    const n = waitingCount();
    $('batchWaiting').hidden = !(batchMode === 'open' && n);
    $('batchWaiting').innerHTML = n ? `<i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> <span><strong>${n} order${n === 1 ? '' : 's'}</strong> placed between batches ${n === 1 ? 'is' : 'are'} waiting for a delivery date.</span> <button type="button" class="link-btn" data-goto-awaiting>Send dates</button>` : '';
    previewBatch();
  }

  const fillForm = b => {
    $('bDate').value = b ? b.date : ''; $('bCloses').value = b ? b.closes : ''; $('bNote').value = b ? b.note : ''; $('bShow').checked = b ? b.show !== false : true;
  };

  // what customers will see, built from the form
  function previewBatch() {
    if (batchMode === 'none') return;
    const date = $('bDate').value, closes = $('bCloses').value, note = $('bNote').value.trim(), show = $('bShow').checked;
    const p = $('batchPreview');
    if (!date) { p.innerHTML = '<i class="fa-regular fa-calendar" aria-hidden="true"></i> Pick a delivery date to see the customer message.'; return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const warn = [];
    if (Batch.parse(date) < today) warn.push('This date has passed.');
    if (closes && Batch.parse(closes) > Batch.parse(date)) warn.push('“Orders close” is after the delivery date.');
    if (closes && Batch.parse(closes) < today) warn.push('Orders for this batch have closed: new orders get the “New batch” tag. Close this batch and start the next one.');
    if (!show) warn.push('The pop-up is switched off.');
    p.innerHTML = `<span class="bp-label">Customers will see</span>
      <strong>Next delivery: ${esc(Batch.format(date))}</strong>
      <span>${note ? esc(note) + ' · ' : ''}${closes ? 'Orders close ' + esc(Batch.format(closes)) : 'No closing date'}</span>
      ${warn.map(w => `<em><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ${w}</em>`).join('')}`;
  }

  ['bDate', 'bCloses', 'bNote', 'bShow'].forEach(id => $(id).addEventListener('input', previewBatch));

  $('bStart').addEventListener('click', () => {
    batchMode = 'new'; fillForm(null);
    renderBatchCard();
    $('bDate').focus();
  });
  $('bCancel').addEventListener('click', () => { batchMode = 'none'; renderBatchCard(); });

  $('batchForm').addEventListener('submit', e => {
    e.preventDefault();
    const date = $('bDate').value, closes = $('bCloses').value;
    if (!date) { toast('Choose the expected delivery date.', 'bad'); $('bDate').focus(); return; }
    if (closes && Batch.parse(closes) > Batch.parse(date)) { toast('“Orders close” must be on or before the delivery date.', 'bad'); return; }
    const fields = { date, closes, note: $('bNote').value.trim(), show: $('bShow').checked };
    if (batchMode === 'new') {
      const b = Batch.create(fields);                                   // BACKEND: insert into batches
      productsData.forEach(p => Stock.set(p.id, { status: 'full', types: 'both', qty: {} }));   // every product back to Fully available
      if (typeof products !== 'undefined') products.forEach(p => Stock.set(p.id, { status: 'full', types: 'both', qty: {} }));
      renderProducts();
      batchMode = 'open';
      const n = waitingCount();
      toast(`Batch ${b.number} is open: delivery ${Batch.format(b.date, false)}${n ? ` · ${n} waiting order${n === 1 ? '' : 's'} to message` : ''}`);
    } else {
      const open = Batch.open(); if (!open) return;
      Batch.update(open.id, fields);                                     // BACKEND: update batches
      toast('Batch saved');
    }
    renderBatchCard(); renderOrders();
  });

  $('bClose').addEventListener('click', () => {
    const open = Batch.open(); if (!open) return;
    if (!confirm(`Close Batch ${open.number}? New orders will be tagged “New batch” until you open the next batch.`)) return;
    Batch.close(open.id);                                               // BACKEND: update batches set status = 'closed'
    batchMode = 'none';
    renderBatchCard(); renderOrders();
    toast(`Batch ${open.number} closed`);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('[data-goto-awaiting]')) return;
    statusFilter = 'awaiting'; shown = 20; go('orders'); renderOrders();
  });

  Batch.onChange(() => { if (batchMode !== 'new') { fillForm(Batch.open()); renderBatchCard(); } });

  const startBatchCard = () => { fillForm(Batch.open()); batchMode = Batch.open() ? 'open' : 'none'; renderBatchCard(); };

  /* ======================= products ======================= */
  /* Stock (stock.js) decides what customers can order:
     Fully available · Limited quantity (packs left per type) · Unavailable,
     and for plantain products: Ripe & Unripe / Ripe only / Unripe only. */
  const STATUS_OPTS = [
    ['full', 'Fully available', '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>'],
    ['limited', 'Limited quantity', '<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>'],
    ['out', 'Unavailable', '<i class="fa-solid fa-ban" aria-hidden="true"></i>']
  ];
  const TYPE_OPTS = [
    ['both', 'Ripe & Unripe', '<span class="dots" aria-hidden="true"><i class="dot ripe"></i><i class="dot unripe"></i></span>'],
    ['Ripe', 'Ripe only', '<span class="dots" aria-hidden="true"><i class="dot ripe"></i></span>'],
    ['Unripe', 'Unripe only', '<span class="dots" aria-hidden="true"><i class="dot unripe"></i></span>']
  ];

  const stockSummary = (p, st) => {
    if (st.status === 'out') return { text: 'Unavailable', tone: 'critical' };
    const types = Stock.hasTypes(p) ? (st.types === 'both' ? ['Ripe', 'Unripe'] : [st.types]) : [''];
    let text = st.status === 'full' ? 'Fully available' : `${types.reduce((n, t) => n + (st.qty[t] || 0), 0)} left`;
    if (st.status === 'limited' && types.every(t => !(st.qty[t] > 0))) return { text: 'Sold out (0 left)', tone: 'critical' };
    // say "… only" when just one type can still be ordered (chosen, or the other has run out)
    const orderable = st.status === 'limited' ? types.filter(t => st.qty[t] > 0) : types;
    if (Stock.hasTypes(p) && orderable.length === 1) text += ` · ${orderable[0]} only`;
    return { text, tone: st.status === 'full' ? 'good' : 'warning' };
  };

  const seg = (name, opts, value, label) => `
    <fieldset class="pa-seg">
      <legend>${label}</legend>
      <div class="pa-seg-opts">${opts.map(([v, t, icon]) => `
        <label class="opt-${v.toLowerCase()}"><input type="radio" name="${name}" value="${v}"${v === value ? ' checked' : ''}><span>${icon || ''}${t}</span></label>`).join('')}
      </div>
    </fieldset>`;

  // the stock controls for one product, drawn from a (possibly unsaved) state
  const stockPanel = (p, st) => {
    const types = Stock.hasTypes(p) ? (st.types === 'both' ? ['Ripe', 'Unripe'] : [st.types]) : [''];
    return `
      ${seg(`status-${p.id}`, STATUS_OPTS, st.status, 'Availability')}
      ${Stock.hasTypes(p) && st.status !== 'out' ? seg(`types-${p.id}`, TYPE_OPTS, st.types, 'Ripe / Unripe') : ''}
      ${st.status === 'limited' ? `
        <div class="pa-qty">${types.map(t => `
          <label class="pa-field"><span>${t ? `${t} packs left` : 'Packs left'}</span>
            <input type="number" min="0" step="1" inputmode="numeric" value="${st.qty[t] ?? ''}" placeholder="0" data-qty="${t}"></label>`).join('')}
        </div>` : ''}`;
  };

  const readStock = row => {
    const id = row.dataset.id;
    const st = Stock.get(id);
    const status = (row.querySelector(`[name="status-${id}"]:checked`) || {}).value || st.status;
    const types = (row.querySelector(`[name="types-${id}"]:checked`) || {}).value || st.types;
    const qty = { ...st.qty };
    row.querySelectorAll('[data-qty]').forEach(i => { qty[i.dataset.qty] = i.value === '' ? 0 : Math.max(0, Math.floor(Number(i.value) || 0)); });
    return { status, types, qty };
  };

  const productRow = p => {
    const st = Stock.get(p.id);
    const sum = stockSummary(p, st);
    return `
      <article class="pa-row stock-${st.status}" data-id="${esc(p.id)}">
        <div class="pa-photo">${p.image ? `<img src="${esc(p.image)}" alt="">` : '<i class="fa-regular fa-image" aria-hidden="true"></i>'}</div>
        <div class="pa-info">
          <strong>${esc(p.name)}</strong>
          <span>${p.group === 'jar' ? 'Jars & refills' : 'Sachets & everyday snacks'}</span>
          <em class="pa-stock-pill tone-${sum.tone}">${esc(sum.text)}</em>
        </div>
        <label class="pa-field pa-price"><span>Price (₦)</span><input type="number" min="0" step="50" value="${Number(p.price)}" data-key="price"></label>
        <label class="pa-field pa-weight"><span>Weight</span><input type="text" value="${esc(p.weight)}" placeholder="e.g. 250 g" data-key="weight"></label>
        <button type="button" class="btn btn-primary pa-save" hidden>Save</button>
        <div class="pa-stock">${stockPanel(p, st)}</div>
      </article>`;
  };

  function renderProducts() {
    $('productList').innerHTML = productsData.map(productRow).join('');
  }

  // redraw just one product (keeps unsaved edits on the others)
  const redrawRow = p => {
    const row = $('productList').querySelector(`.pa-row[data-id="${CSS.escape(p.id)}"]`);
    if (row) row.outerHTML = productRow(p);
  };

  // an order in the shop (another tab) changed the stock: refresh the rows you're not editing
  Stock.onChange(() => productsData.forEach(p => {
    const row = $('productList').querySelector(`.pa-row[data-id="${CSS.escape(p.id)}"]`);
    if (row && !row.classList.contains('is-dirty')) redrawRow(p);
  }));

  const markDirty = row => { row.querySelector('.pa-save').hidden = false; row.classList.add('is-dirty'); };

  $('productList').addEventListener('input', e => {
    const row = e.target.closest('.pa-row'); if (row) markDirty(row);
  });

  // switching availability or ripe/unripe redraws that row's stock controls
  $('productList').addEventListener('change', e => {
    if (e.target.type !== 'radio') return;
    const row = e.target.closest('.pa-row');
    const p = productsData.find(x => x.id === row.dataset.id);
    const st = readStock(row);
    row.querySelector('.pa-stock').innerHTML = stockPanel(p, st);
    const again = row.querySelector(`[name="${e.target.name}"][value="${e.target.value}"]`);
    if (again) again.focus();
    markDirty(row);
  });

  $('productList').addEventListener('click', async e => {
    const btn = e.target.closest('.pa-save'); if (!btn) return;
    const row = btn.closest('.pa-row');
    const p = productsData.find(x => x.id === row.dataset.id);
    const price = Number(row.querySelector('[data-key="price"]').value);
    if (!(price > 0)) { toast('Enter a price above ₦0.', 'bad'); return; }
    const st = readStock(row);
    if (st.status === 'limited') {
      const types = Stock.hasTypes(p) ? (st.types === 'both' ? ['Ripe', 'Unripe'] : [st.types]) : [''];
      if (types.every(t => !(st.qty[t] > 0))) { toast('Enter how many packs are left, or choose Unavailable.', 'bad'); return; }
    }
    btn.disabled = true;
    const saved = await AdminData.saveProduct({ id: p.id, price, weight: row.querySelector('[data-key="weight"]').value.trim() });
    Object.assign(p, saved);
    Stock.set(p.id, st);                                   // BACKEND: save to the stock table
    btn.disabled = false;
    redrawRow(p);
    toast(`${p.name} saved: ${stockSummary(p, Stock.get(p.id)).text}`);
  });

  // add product
  let photoPreview = '';
  const openModal = () => {
    $('productForm').reset(); photoPreview = ''; $('productFormMsg').textContent = '';
    const ov = $('productModal'); ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add('is-open'));
    document.body.classList.add('viewer-open');
    $('pName').focus();
  };
  const closeModal = () => {
    const ov = $('productModal'); ov.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
    setTimeout(() => { ov.hidden = true; }, 250);
  };
  $('addProductBtn').addEventListener('click', openModal);
  $('productModalClose').addEventListener('click', closeModal);
  $('productCancel').addEventListener('click', closeModal);
  $('productModal').addEventListener('click', e => { if (e.target === $('productModal')) closeModal(); });
  $('pPhoto').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { photoPreview = r.result; }; r.readAsDataURL(f);
  });

  $('productForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('pName').value.trim(), price = Number($('pPrice').value);
    const msg = $('productFormMsg');
    if (!name || !(price > 0)) { msg.className = 'form-message error'; msg.textContent = 'Add a name and a price above ₦0.'; return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
    const product = { id, name, price, group: $('pGroup').value, weight: $('pWeight').value.trim(), desc: $('pDesc').value.trim(), image: photoPreview.length < 300000 ? photoPreview : '' };
    const saved = await AdminData.saveProduct(product);
    productsData.push(saved); renderProducts(); closeModal();
    toast(`${name} added`);
  });

  /* ======================= shared keyboard ======================= */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('orderDrawer').hidden) closeDrawer();
    else if (!$('productModal').hidden) closeModal();
  });

  /* ======================= start ======================= */
  const session = AdminData.getSession();
  if (session) showApp(session); else showLogin();
})();
