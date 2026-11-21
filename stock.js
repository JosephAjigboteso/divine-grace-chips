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
   DELIVERY BATCH — when the current orders will be delivered
   ------------------------------------------------------------
   Orders are delivered together in batches. The admin sets:
     date    expected delivery date, 'YYYY-MM-DD' (e.g. a Saturday)
     note    optional time / details, e.g. 'Between 10am and 4pm'
     closes  optional last day to order for this batch, 'YYYY-MM-DD'
     show    whether customers see the announcement
   Same demo storage as Stock (this browser); with a backend,
   replace load() / save() with a call to a `settings` table.
   ============================================================ */
const Batch = (() => {
  const KEY = 'dg-delivery-v1';
  const DEFAULT = { date: '', note: '', closes: '', show: true };
  let memory = null;
  const load = () => {
    if (memory) return memory;
    try { memory = { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch (e) { memory = { ...DEFAULT }; }
    return memory;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) {} };

  // 'YYYY-MM-DD' → a local date (no time-zone shift)
  const parse = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const format = (iso, long = true) => {
    const d = parse(iso);
    return d ? d.toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  };

  const get = () => ({ ...load() });
  const set = data => {
    memory = { ...DEFAULT, ...data, show: data.show !== false };
    save();
    return get();
  };

  // what customers should see right now
  const current = () => {
    const b = load();
    const date = parse(b.date);
    if (!b.show || !date || date < today()) return null;          // nothing set, switched off, or the date has passed
    const closes = parse(b.closes);
    return {
      date: b.date,
      dateText: format(b.date),
      shortDate: format(b.date, false),
      note: (b.note || '').trim(),
      closes: closes ? b.closes : '',
      closesText: closes ? format(b.closes) : '',
      closed: !!closes && closes < today()                        // past the last order day
    };
  };

  const onChange = fn => window.addEventListener('storage', e => { if (e.key === KEY) { memory = null; fn(); } });

  return { get, set, current, format, parse, onChange };
})();
