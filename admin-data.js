/* ============================================================
   ADMIN DATA LAYER
   ------------------------------------------------------------
   Every screen in admin.js gets and saves data ONLY through the
   functions in `AdminData` below. Right now they use SAMPLE DATA
   kept in this browser (localStorage), so the interface can be
   viewed and tested without a backend.

   To connect a real backend (e.g. Supabase), replace the body of
   each function with an API call that returns the same shape.
   The screens don't need to change.

   Shapes
     Order   { id, ref, createdAt, customer:{name, phone, email},
               orderType, location, address, review,
               items:[{productId, name, type, qty, price}],
               total, status, paymentRef, history:[{status, at}] }
     Product { id, name, group, price, weight, desc, image, available }

   Order status:  pending   → customer says paid, payment to confirm
                  confirmed → payment confirmed
                  out       → out for delivery
                  delivered → delivered
                  cancelled → cancelled
   ============================================================ */
const AdminData = (() => {
  const STORE_KEY = 'dg-admin-demo-v1';
  const SESSION_KEY = 'dg-admin-session';

  // ⚠ DEMO SIGN-IN ONLY. A front-end password is not secure: real sign-in
  //   must happen on the backend (e.g. Supabase Auth). Remove before going live.
  const DEMO_LOGIN = { email: 'admin@divinegrace.ng', password: 'demo1234' };

  const DAY = 86400000;
  const LOCATIONS = ['UNILAG', 'Charity Pavilion', 'Home Delivery'];
  const ORDER_TYPES = ['Personal', 'Event', 'Reseller'];
  const FIRST = ['Ada', 'Tunde', 'Chidinma', 'Ibrahim', 'Blessing', 'Kemi', 'Emeka', 'Fatima', 'Segun', 'Ngozi', 'Bola', 'Uche', 'Halima', 'Femi', 'Zainab', 'Tobi', 'Ifeoma', 'Musa', 'Yetunde', 'Chuka'];
  const LAST = ['Okafor', 'Adeyemi', 'Eze', 'Bello', 'Nwosu', 'Balogun', 'Okeke', 'Ibrahim', 'Adebayo', 'Obi', 'Lawal', 'Okonkwo', 'Sani', 'Afolabi', 'Umeh'];
  const AREAS = ['Akoka, Yaba', 'Bariga', 'Gbagada Phase 2', 'Surulere', 'Ikeja GRA', 'Lekki Phase 1', 'Ogudu', 'Shomolu'];
  const REVIEWS = ['The unripe ones are my favourite!', 'Crunchy as always.', 'My kids finished the jar in two days.', 'Fresh and well packed.', 'Perfect for our office meetings.', 'Great taste, fast delivery.'];

  /* ---------- storage (falls back to memory if the browser blocks it) ---------- */
  let memory = null;
  const load = () => {
    if (memory) return memory;
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) memory = JSON.parse(raw); } catch (e) {}
    if (!memory) { memory = seed(); save(); }
    return memory;
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(memory)); } catch (e) {} };
  const clone = v => JSON.parse(JSON.stringify(v));
  const wait = (ms = 150) => new Promise(r => setTimeout(r, ms));   // feels like a network call

  /* ---------- sample data (deterministic, so it looks the same every time) ---------- */
  function seed() {
    let s = 20261120;
    const rand = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const pick = arr => arr[Math.floor(rand() * arr.length)];

    const productList = (typeof products !== 'undefined' ? products : []).map(p => ({
      id: p.id, name: p.name, group: p.group, price: p.price, weight: p.weight || '', desc: p.desc, image: p.image, available: true
    }));

    const orders = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let refCounter = 0;
    for (let d = 119; d >= 0; d--) {
      const day = new Date(today.getTime() - d * DAY);
      const weekday = day.getDay();
      const growth = 1 + (119 - d) / 119 * 0.8;                       // business slowly growing
      const base = (weekday === 5 || weekday === 6 ? 4.2 : weekday === 0 ? 1.6 : 2.6) * growth;
      const count = Math.max(0, Math.round(base + (rand() - 0.5) * 3));
      for (let i = 0; i < count; i++) {
        const created = new Date(day.getTime() + (8 + rand() * 12) * 3600000);
        if (created > new Date()) continue;
        const nItems = rand() < 0.65 ? 1 : rand() < 0.8 ? 2 : 3;
        const items = [];
        for (let k = 0; k < nItems; k++) {
          const p = pick(productList);
          const type = /potato/i.test(p.name) ? '' : (rand() < 0.6 ? 'Ripe' : 'Unripe');
          const same = items.find(it => it.productId === p.id && it.type === type);
          const qty = 1 + (rand() < 0.25 ? Math.floor(rand() * 4) : 0);
          if (same) same.qty += qty; else items.push({ productId: p.id, name: p.name, type, qty, price: p.price });
        }
        const orderType = rand() < 0.7 ? 'Personal' : rand() < 0.6 ? 'Event' : 'Reseller';
        if (orderType === 'Reseller') items.forEach(it => { it.qty += 4; });
        const location = rand() < 0.45 ? 'UNILAG' : rand() < 0.55 ? 'Home Delivery' : 'Charity Pavilion';
        const first = pick(FIRST), last = pick(LAST);
        const mmdd = String(created.getMonth() + 1).padStart(2, '0') + String(created.getDate()).padStart(2, '0');
        const ref = `DG-${mmdd}-${1000 + Math.floor(rand() * 9000)}`;

        // status follows age: older orders are mostly delivered
        const ageDays = (Date.now() - created.getTime()) / DAY;
        let status;
        if (ageDays > 3) status = rand() < 0.06 ? 'cancelled' : 'delivered';
        else if (ageDays > 1.5) status = rand() < 0.7 ? 'delivered' : 'out';
        else if (ageDays > 0.6) status = pick(['confirmed', 'out', 'delivered']);
        else status = rand() < 0.75 ? 'pending' : 'confirmed';

        const history = [{ status: 'pending', at: created.toISOString() }];
        const step = (st, hours) => history.push({ status: st, at: new Date(created.getTime() + hours * 3600000).toISOString() });
        if (status === 'cancelled') step('cancelled', 2 + rand() * 6);
        if (['confirmed', 'out', 'delivered'].includes(status)) step('confirmed', 0.5 + rand() * 3);
        if (['out', 'delivered'].includes(status)) step('out', 4 + rand() * 18);
        if (status === 'delivered') step('delivered', 6 + rand() * 30);

        orders.push({
          id: 'o' + (++refCounter),
          ref,
          createdAt: created.toISOString(),
          customer: { name: `${first} ${last}`, phone: '080' + String(10000000 + Math.floor(rand() * 89999999)), email: rand() < 0.4 ? `${first.toLowerCase()}.${last.toLowerCase()}@example.com` : '' },
          orderType,
          location,
          address: location === 'Home Delivery' ? `${Math.ceil(rand() * 40)} ${pick(['Palm', 'Church', 'Market', 'Oduduwa', 'Herbert Macaulay'])} Street, ${pick(AREAS)}` : '',
          review: rand() < 0.25 ? pick(REVIEWS) : '',
          items,
          total: items.reduce((sum, it) => sum + it.price * it.qty, 0),
          status,
          paymentRef: ref,
          history
        });
      }
    }
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    // the newest orders are still in progress: 5 payments to confirm, 3 confirmed, 3 out for delivery
    const plan = ['pending', 'pending', 'pending', 'pending', 'pending', 'confirmed', 'confirmed', 'confirmed', 'out', 'out', 'out'];
    plan.forEach((status, i) => {
      const o = orders[i]; if (!o) return;
      const t = new Date(o.createdAt).getTime();
      o.status = status;
      o.history = [{ status: 'pending', at: o.createdAt }];
      if (status !== 'pending') o.history.push({ status: 'confirmed', at: new Date(t + 40 * 60000).toISOString() });
      if (status === 'out') o.history.push({ status: 'out', at: new Date(t + 3 * 3600000).toISOString() });
    });
    return { products: productList, orders };
  }

  /* ---------- API (replace these with backend calls) ---------- */
  return {
    LOCATIONS, ORDER_TYPES, DEMO_LOGIN,

    async signIn(email, password) {
      await wait(400);
      // BACKEND: supabase.auth.signInWithPassword({ email, password })
      const ok = email.trim().toLowerCase() === DEMO_LOGIN.email && password === DEMO_LOGIN.password;
      if (!ok) throw new Error('Incorrect email or password.');
      const session = { email: DEMO_LOGIN.email, name: 'Admin' };
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
      return session;
    },

    getSession() {
      // BACKEND: supabase.auth.getSession()
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    },

    async signOut() {
      // BACKEND: supabase.auth.signOut()
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    },

    async getOrders() {
      await wait();
      // BACKEND: select * from orders (with order_items) order by created_at desc
      return clone(load().orders);
    },

    async updateOrderStatus(orderId, status) {
      await wait();
      // BACKEND: update orders set status = … ; insert into order_status_history …
      const order = load().orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found.');
      order.status = status;
      order.history.push({ status, at: new Date().toISOString() });
      save();
      return clone(order);
    },

    async getProducts() {
      await wait();
      // BACKEND: select * from products order by group, price
      return clone(load().products);
    },

    async saveProduct(product) {
      await wait();
      // BACKEND: upsert into products …
      const data = load();
      const i = data.products.findIndex(p => p.id === product.id);
      if (i >= 0) data.products[i] = { ...data.products[i], ...product };
      else data.products.push(product);
      save();
      return clone(product);
    },

    async resetDemoData() {
      memory = seed(); save();
    }
  };
})();
