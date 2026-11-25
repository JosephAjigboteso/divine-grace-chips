/* ============================================================
   STOCK — what can be ordered right now
   ------------------------------------------------------------
   Shared by the shop (products + order pages) and the admin.
   For each product the admin chooses:

     status  'full'     Fully available: plenty of stock, no limit
             'limited'  Limited: only the quantities in `qty` are left
             'out'      Unavailable: sold out, can't be ordered
     types   'both' | 'Ripe' | 'Unripe'   (plantain products only)
     qty     { Ripe: 12, Unripe: 4 }      packs left when 'limited'
             { '': 10 }                   for products without ripe/unripe (potato)

   Products with no entry are treated as fully available, ripe and unripe.

   ⚠ DEMO STORAGE: saved in this browser (localStorage), so admin changes
   only show in the shop on the same browser. With a backend, replace
   load() / save() with database calls (e.g. a Supabase `stock` table)
   and every page keeps working unchanged.
   ============================================================ */
const Stock = (() => {
  const KEY = 'dg-stock-v1';
  const TYPES = ['Ripe', 'Unripe'];
  let memory = null;

  const load = () => {
    if (memory) return memory;
    try { memory = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { memory = {}; }
    return memory;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {} };

  const hasTypes = product => !/potato/i.test(product.name);   // plantain packs come ripe or unripe
  const DEFAULT = { status: 'full', types: 'both', qty: {} };

  const get = id => ({ ...DEFAULT, ...(load()[id] || {}), qty: { ...((load()[id] || {}).qty || {}) } });

  const set = (id, entry) => {
    load()[id] = {
      status: ['full', 'limited', 'out'].includes(entry.status) ? entry.status : 'full',
      types: ['both', 'Ripe', 'Unripe'].includes(entry.types) ? entry.types : 'both',
      qty: Object.fromEntries(Object.entries(entry.qty || {}).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]))
    };
    save();
    return get(id);
  };

  // which types can be offered at all ('' for products without ripe/unripe)
  const typesFor = product => {
    if (!hasTypes(product)) return [''];
    const t = get(product.id).types;
    return t === 'both' ? TYPES.slice() : [t];
  };

  // packs left for a type (Infinity when fully available)
  const left = (product, type = '') => {
    const s = get(product.id);
    if (s.status === 'out') return 0;
    if (!typesFor(product).includes(type)) return 0;
    if (s.status === 'full') return Infinity;
    return s.qty[type] || 0;
  };

  const orderableTypes = product => typesFor(product).filter(t => left(product, t) > 0);
  const soldOut = product => orderableTypes(product).length === 0;
  const totalLeft = product => orderableTypes(product).reduce((n, t) => n + left(product, t), 0);

  // short label for the shop, e.g. "Sold out", "Only 6 left", "Ripe only"
  const label = product => {
    if (soldOut(product)) return { text: 'Sold out', tone: 'out' };
    const s = get(product.id);
    const parts = [];
    if (s.status === 'limited') parts.push(`Only ${totalLeft(product)} left`);
    const types = orderableTypes(product);
    if (hasTypes(product) && types.length === 1) parts.push(`${types[0]} only`);
    return parts.length ? { text: parts.join(' · '), tone: s.status === 'limited' ? 'low' : 'info' } : null;
  };

  // after an order is placed: take the packs off limited stock
  const take = (lines, productList) => {
    lines.forEach(line => {
      const product = productList.find(p => p.id === line.id);
      if (!product) return;
      const s = get(product.id);
      if (s.status !== 'limited') return;
      const k = line.type || '';
      s.qty[k] = Math.max(0, (s.qty[k] || 0) - line.qty);
      if (Object.keys(s.qty).length && typesFor(product).every(t => (s.qty[t] || 0) <= 0)) s.status = 'out';
      set(product.id, s);
    });
  };

  // another tab (e.g. the admin) changed the stock
  const onChange = fn => window.addEventListener('storage', e => { if (e.key === KEY) { memory = null; fn(); } });

  return { get, set, hasTypes, typesFor, left, orderableTypes, soldOut, totalLeft, label, take, onChange };
})();

/* ============================================================
   DELIVERY BATCHES — orders are delivered together in batches
   ------------------------------------------------------------
   The admin opens one batch at a time:
     number  Batch 1, 2, 3 …            date    expected delivery 'YYYY-MM-DD'
     closes  last day to order (opt.)   note    e.g. 'Between 10am and 4pm' (opt.)
     show    customers see the pop-up   status  'open' | 'closed'
     pickups ['UNILAG', 'Charity Pavilion']  pickup points for this batch
     home    true/false                       home delivery offered
   An order placed while a batch is open (and before it closes) belongs to it.
   An order placed after it closes, or when no batch is open, is tagged
   "awaiting new batch" until the admin sends that customer the new date.
   Demo storage: this browser. BACKEND: a `batches` table.
   ============================================================ */
const Batch = (() => {
  const KEY = 'dg-batches-v1';
  let memory = null;
  const load = () => {
    if (memory) return memory;
    try { memory = JSON.parse(localStorage.getItem(KEY)) || { list: [] }; } catch (e) { memory = { list: [] }; }
    if (!Array.isArray(memory.list)) memory.list = [];
    return memory;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {} };
  const clone = v => JSON.parse(JSON.stringify(v));

  // 'YYYY-MM-DD' → a local date (no time-zone shift)
  const parse = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const format = (iso, long = true) => {
    const d = parse(iso);
    return d ? d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  };

  const all = () => clone(load().list);
  const byId = id => clone(load().list.find(b => b.id === id) || null);
  const open = () => clone(load().list.find(b => b.status === 'open') || null);
  const label = b => (b ? `Batch ${b.number} · ${format(b.date, false)}` : '');

  // where customers can get their order (batches saved before this existed use the usual places)
  const DEFAULT_PICKUPS = ['UNILAG', 'Charity Pavilion'];
  const HOME = 'Home Delivery';
  const cleanPickups = list => [...new Set((list || []).map(x => String(x).trim()).filter(x => x && x !== HOME))];
  const placesOf = b => ({ pickups: b && Array.isArray(b.pickups) ? cleanPickups(b.pickups) : DEFAULT_PICKUPS.slice(), home: !b || b.home !== false });
  // the places offered right now: the open batch, else the most recent one
  const places = () => {
    const list = load().list;
    const b = list.find(x => x.status === 'open') || list.slice().sort((x, y) => y.number - x.number)[0];
    return placesOf(b);
  };
  // the options for the order form, e.g. ['UNILAG', 'Charity Pavilion', 'Home Delivery']
  const locationOptions = (p = places()) => [...p.pickups, ...(p.home ? [HOME] : [])];
  const join = arr => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} or ${arr[arr.length - 1]}`);
  // e.g. "Pick up at UNILAG or Charity Pavilion, or choose home delivery"
  const placesText = (p = places()) => {
    if (!p.pickups.length) return p.home ? 'Home delivery only' : '';
    return `Pick up at ${join(p.pickups)}${p.home ? ', or choose home delivery' : ''}`;
  };

  // still taking orders for this batch today?
  const taking = b => !!b && parse(b.date) >= today() && (!b.closes || parse(b.closes) >= today());

  const create = ({ date, closes = '', note = '', show = true, pickups, home = true }) => {
    if (load().list.some(b => b.status === 'open')) throw new Error('Close the current batch first.');
    const number = load().list.reduce((n, b) => Math.max(n, b.number), 0) + 1;
    const b = { id: 'b' + Date.now().toString(36), number, date, closes, note: (note || '').trim(), show: show !== false,
      pickups: pickups ? cleanPickups(pickups) : places().pickups, home: home !== false, status: 'open', openedAt: new Date().toISOString() };
    load().list.push(b); save();
    return clone(b);
  };

  const update = (id, fields) => {
    const b = load().list.find(x => x.id === id); if (!b) return null;
    ['date', 'closes', 'note', 'show', 'home'].forEach(k => { if (k in fields) b[k] = k === 'note' ? (fields[k] || '').trim() : fields[k]; });
    if ('pickups' in fields) b.pickups = cleanPickups(fields.pickups);
    save(); return clone(b);
  };

  const close = id => {
    const b = load().list.find(x => x.id === id); if (!b) return null;
    b.status = 'closed'; b.closedAt = new Date().toISOString(); save();
    return clone(b);
  };

  // sample history for the admin demo (only if there is none yet)
  const seedIfEmpty = list => { if (!load().list.length) { memory = { list: clone(list) }; save(); } };

  // which batch a new order belongs to
  const assign = () => {
    const b = load().list.find(x => x.status === 'open');
    if (taking(b)) return { batchId: b.id, awaiting: false, text: format(b.date) + (b.note ? `, ${b.note}` : '') };
    return { batchId: null, awaiting: true, text: 'Next batch: delivery date to be confirmed' };
  };

  // what customers see in the pop-up (null = nothing to show)
  const current = () => {
    const list = load().list; if (!list.length) return null;
    const b = list.find(x => x.status === 'open');
    if (b && !b.show) return null;
    const base = b ? { batchId: b.id, number: b.number, date: b.date, dateText: format(b.date), shortDate: format(b.date, false), note: b.note || '',
      closes: b.closes || '', closesText: b.closes ? format(b.closes) : '' } : { dateText: '', closesText: '', note: '' };
    base.places = places();
    return { ...base, closed: !taking(b), hasOpen: !!b };
  };

  const onChange = fn => window.addEventListener('storage', e => { if (e.key === KEY) { memory = null; fn(); } });

  return { HOME, DEFAULT_PICKUPS, places, placesOf, locationOptions, placesText, all, byId, open, label, taking, create, update, close, seedIfEmpty, assign, current, format, parse, onChange };
})();

/* ============================================================
   NEW ORDERS INBOX (demo) — orders placed in the shop show up in
   the admin in the same browser. BACKEND: insert into `orders`.
   ============================================================ */
const ShopOrders = (() => {
  const KEY = 'dg-shop-orders-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  return {
    add: order => { const list = read(); list.push(order); write(list); },
    drain: () => { const list = read(); if (list.length) write([]); return list; },   // admin takes them in
    onChange: fn => window.addEventListener('storage', e => { if (e.key === KEY && e.newValue && e.newValue !== '[]') fn(); })
  };
})();

/* ============================================================
   PRODUCT CATALOGUE — the list of products the shop sells
   ------------------------------------------------------------
   The admin adds, edits and deletes products here; the shop reads it.
   Each product: { id, name, price, group, weight, desc,
                   photos: [image addresses, first = main],
                   placeholders: true/false (top up the slider with stand-in photos) }
   Until the admin changes something, the shop uses the built-in list
   in script.js. Demo storage: this browser (photos are saved inside it,
   so space is limited). BACKEND: a `products` table + photo storage.
   ============================================================ */
const Catalog = (() => {
  const KEY = 'dg-catalog-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } };
  return {
    // the saved list, or the built-in one if the admin hasn't changed anything
    list: defaults => JSON.parse(JSON.stringify(read() || defaults || [])),
    // returns false when the browser has no room left (photos are large)
    saveAll: list => { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } },
    isCustom: () => !!read(),
    onChange: fn => window.addEventListener('storage', e => { if (e.key === KEY) fn(); })
  };
})();
