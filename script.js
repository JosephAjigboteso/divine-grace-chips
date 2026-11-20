/* ---------- THEME MANAGEMENT ---------- */
function setupThemeToggle() {
  /* There can be more than one toggle (header + mobile bottom nav). */
  const toggles = document.querySelectorAll('.theme-toggle');
  if (!toggles.length) return;

  const STORAGE_KEY = 'dg-theme';

  const updateIcons = () => {
    const current = document.documentElement.getAttribute('data-theme');
    toggles.forEach(toggle => {
      const icon = toggle.querySelector('i');
      if (icon) icon.className = current === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      toggle.setAttribute('aria-label', current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  };

  toggles.forEach(toggle => toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { sessionStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    updateIcons();
  }));

  updateIcons();
}

/* ---------- DELIVERY ANIMATION (about section) ----------
   Delivery-tracker loop (12 s): picked up at Divine Grace → travels along the
   route on the map → delivered to the customer → short pause → repeat.
   Runs only while the scene is on screen. */
function setupDelivery() {
  const scene = document.querySelector('[data-delivery]');
  if (!scene) return;
  const q = sel => scene.querySelector(sel);
  const route = q('[data-dl-route]');
  const courier = q('[data-dl-courier]');
  const ring = q('[data-dl-ring]');
  const statusEl = q('[data-dl-status]');
  const subEl = q('[data-dl-sub]');
  const etaEl = q('[data-dl-eta]');
  const fill = q('[data-dl-fill]');
  const steps = [...scene.querySelectorAll('[data-dl-step]')];
  if (!route || !courier) return;

  const LOOP = 12000;
  const T = { leave: 0.1, arrive: 0.78, reset: 0.96 };   // fractions of the loop
  const ETA_START = 8;                                    // minutes shown at pick-up
  const length = route.getTotalLength();
  route.style.strokeDasharray = `${length} ${length}`;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // smooth start and stop
  const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

  const render = t => {
    const travel = ease(clamp((t - T.leave) / (T.arrive - T.leave), 0, 1));
    const fade = 1 - clamp((t - T.reset) / (1 - T.reset), 0, 1);   // fade out before restarting

    // courier position and travelled route
    const pt = route.getPointAtLength(length * travel);
    // pops in at pick-up, fades into the customer pin on arrival
    const appear = ease(clamp((t - 0.02) / 0.06, 0, 1));
    const vanish = clamp((t - T.arrive) / 0.05, 0, 1);
    const scale = 0.6 + 0.4 * appear - 0.25 * vanish;
    courier.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${scale.toFixed(3)})`);
    courier.style.opacity = (appear * (1 - vanish)).toFixed(2);
    route.style.strokeDashoffset = (length * (1 - travel)).toFixed(1);
    route.style.opacity = fade;

    // status card
    const delivered = t >= T.arrive;
    const stage = delivered ? 2 : (t >= T.leave ? 1 : 0);
    scene.classList.toggle('is-delivered', delivered);
    ring.classList.toggle('is-on', delivered);
    setText(statusEl, ['Order picked up', 'On the way', 'Delivered'][stage]);
    setText(subEl, delivered ? 'Fresh and crunchy, enjoy!' : 'Plantain chips · Ziploc pack');
    setText(etaEl, String(Math.max(1, Math.ceil(ETA_START * (1 - travel)))));
    steps.forEach((li, i) => li.classList.toggle('is-active', i <= stage));
    fill.style.width = `${((stage === 0 ? 0.04 : 0.04 + 0.92 * travel + (delivered ? 0.04 : 0)) * 100 * fade).toFixed(1)}%`;
  };

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = null, elapsed = 0, last = null, visible = false;

  const frame = now => {
    if (last !== null) elapsed = (elapsed + (now - last)) % LOOP;
    last = now;
    render(elapsed / LOOP);
    rafId = requestAnimationFrame(frame);
  };
  const start = () => {
    if (rafId || reduce.matches || !visible || document.hidden) return;
    last = null;
    rafId = requestAnimationFrame(frame);
  };
  const stop = () => { if (rafId) { cancelAnimationFrame(rafId); rafId = null; } };

  render(reduce.matches ? 0.5 : 0);   // reduced motion: a still "on the way" picture

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.2 }).observe(scene);
  } else { visible = true; start(); }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (reduce.addEventListener) reduce.addEventListener('change', () => { stop(); if (reduce.matches) render(0.5); else start(); });
}

/* ---------- MOBILE BOTTOM NAV ---------- */
function setupBottomNav() {
  const bar = document.querySelector('.bottom-nav');
  if (!bar) return;

  /* Slide the bar in once the visitor starts scrolling. */
  const SHOW_AFTER = 80;
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      bar.classList.toggle('visible', window.scrollY > SHOW_AFTER);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Highlight the section currently on screen. */
  const links = bar.querySelectorAll('[data-spy]');
  const setActive = id => links.forEach(l => l.classList.toggle('active', l.dataset.spy === id));
  links.forEach(l => l.addEventListener('click', () => setActive(l.dataset.spy)));

  const sections = [...links].map(l => document.getElementById(l.dataset.spy)).filter(Boolean);
  if (!('IntersectionObserver' in window) || !sections.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(section => observer.observe(section));
}

/* ---------- NAV ACTIVE STATE ON CLICK ---------- */
function setupNavActiveOnClick() {
  const navLinks = document.querySelectorAll('.desktop-nav a');
  if (!navLinks.length) return;

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      /* Only handle in-page anchor links and same-page links.
         Cross-page links: the class is preserved visually until
         the new page loads, which happens instantly. */
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

/* ---------- ORDER TYPE ---------- */
function setupOrderType() {
  const typeSelect = document.getElementById('productType');
  const typeField = document.getElementById('typeField');
  if (!typeSelect || !typeField) return;
  const syncType = () => {
    typeField.value = typeSelect.value;
  };
  typeSelect.addEventListener('change', syncType);
  syncType();
}

/* ---------- PRODUCT OPTIONS ---------- */
function setupProductOptions() {
  const options = document.getElementById('productOptions');
  const picker = document.getElementById('additionalProduct');
  const panel = document.getElementById('addProductPicker');
  if (!options || !picker || !panel) return;
  products.forEach(product => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'product-option';
    button.innerHTML = `<img src="${product.image}" alt=""><span>${product.name}<small>${money.format(product.price)}</small></span>`;
    button.addEventListener('click', () => {
      picker.value = product.id;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      panel.hidden = true;
    });
    options.appendChild(button);
  });
}

/* ---------- ORDER ITEM SIZING ---------- */
function setupOrderItemSizing() {
  const list = document.getElementById('addedProducts');
  const summary = list?.closest('.order-summary');
  if (!list || !summary) return;
  const update = () => {
    const count = list.querySelectorAll('.added-product').length;
    summary.classList.toggle('has-additions', count > 0);
    summary.classList.toggle('many-additions', count > 1);
  };
  new MutationObserver(update).observe(list, { childList: true });
  update();
}

/* ---------- ADDITIONAL PRODUCTS ---------- */
function setupAdditionalProducts() {
  const picker = document.getElementById('additionalProduct');
  const pickerPanel = document.getElementById('addProductPicker');
  const addButton = document.getElementById('addProductBtn');
  const addedList = document.getElementById('addedProducts');
  const productSelect = document.getElementById('productSelect');
  const typeSelect = document.getElementById('productType');
  const total = document.getElementById('total');
  const productField = document.getElementById('productField');
  const quantityField = document.getElementById('quantityField');
  const typeField = document.getElementById('typeField');
  const qty = document.getElementById('qty');
  if (!picker || !pickerPanel || !addButton || !addedList || !productSelect || !typeSelect) return;

  const additions = [];
  products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} — ${money.format(product.price)}`;
    picker.appendChild(option);
  });

  const syncOrder = () => {
    const primary = getProduct(productSelect.value);
    const primaryQuantity = Number(qty?.textContent) || 1;
    const primaryType = typeSelect.value;
    const items = [{ product: primary, quantity: primaryQuantity, type: primaryType }, ...additions];
    const combinedTotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    if (total) total.textContent = money.format(combinedTotal);
    if (productField) productField.value = items.map(item => `${item.product.name} (${item.type})`).join(', ');
    if (quantityField) quantityField.value = items.map(item => item.quantity).join(', ');
    if (typeField) typeField.value = items.map(item => item.type).join(', ');
    addedList.innerHTML = additions.map((item, index) => `
      <div class="added-product">
        <div class="added-product-header">
          <div class="selected-product">
            <img src="${item.product.image}" alt="${item.product.name}">
            <div>
              <strong>${item.product.name}</strong>
              <span>${money.format(item.product.price)}</span>
            </div>
          </div>
          <button type="button" class="remove-added-product" data-index="${index}" aria-label="Remove ${item.product.name}">
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>
        <div class="quantity-box">
          <span>Quantity</span>
          <div class="quantity-control">
            <button type="button" class="added-minus" data-index="${index}">−</button>
            <strong>${item.quantity}</strong>
            <button type="button" class="added-plus" data-index="${index}">+</button>
          </div>
        </div>
        <div class="product-type">
          <label>Type</label>
          <select class="added-type" data-index="${index}">
            <option value="Ripe"${item.type === 'Ripe' ? ' selected' : ''}>Ripe</option>
            <option value="Unripe"${item.type === 'Unripe' ? ' selected' : ''}>Unripe</option>
          </select>
        </div>
      </div>
    `).join('');
  };

  addButton.addEventListener('click', () => {
    pickerPanel.hidden = !pickerPanel.hidden;
    if (!pickerPanel.hidden) picker.focus();
  });

  picker.addEventListener('change', () => {
    if (!picker.value) return;
    additions.push({ product: getProduct(picker.value), quantity: 1, type: typeSelect.value });
    picker.value = '';
    syncOrder();
  });

  typeSelect.addEventListener('change', syncOrder);
  productSelect.addEventListener('change', syncOrder);

  addedList.addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const item = additions[index];
    if (!item) return;
    if (button.classList.contains('remove-added-product')) {
      additions.splice(index, 1);
      syncOrder();
      return;
    }
    if (button.classList.contains('added-minus')) item.quantity = Math.max(1, item.quantity - 1);
    if (button.classList.contains('added-plus')) item.quantity = Math.min(50, item.quantity + 1);
    syncOrder();
  });

  addedList.addEventListener('change', event => {
    if (!event.target.classList.contains('added-type')) return;
    additions[Number(event.target.dataset.index)].type = event.target.value;
    syncOrder();
  });

  const observer = qty ? new MutationObserver(syncOrder) : null;
  if (observer) observer.observe(qty, { childList: true });
  syncOrder();
}

/* ---------- PRODUCT DATA ----------
   images: the first one is shown on the card; all of them appear in the
           product details slider (add more photos per product here).
   weight: shown in the product details when filled in, e.g. '150 g'. */
const RANGE_PHOTOS = ['asset/gallery/range-studio.jpg', 'asset/gallery/range-outdoor.jpg'];

const products = [
  { id: 'ziploc', name: 'Ziploc', price: 1000, group: 'sachet', weight: '', image: 'asset/clear/Ziploc.png', images: ['asset/clear/Ziploc.png', ...RANGE_PHOTOS], desc: 'A convenient, crunchy pack for a quick snack or little treat.' },
  { id: 'refill-2000', name: 'Refill Pack', price: 2000, group: 'sachet', weight: '', image: 'asset/clear/refill.png', images: ['asset/clear/refill.png', ...RANGE_PHOTOS], desc: 'Light, crispy and satisfying — perfect to keep stocked.' },
  { id: 'plantain-dozen', name: 'Plantain Chips — Dozen', price: 3000, group: 'sachet', weight: '', image: 'asset/clear/refill.png', images: ['asset/clear/refill.png', ...RANGE_PHOTOS], desc: 'A generous plantain option for sharing, events and resellers.' },
  { id: 'potato-dozen', name: 'Potato Chips — Dozen', price: 3000, group: 'sachet', weight: '', image: 'asset/clear/potato.png', images: ['asset/clear/potato.png', ...RANGE_PHOTOS], desc: 'Crunchy potato chips for something a little different.' },
  { id: 'small-jar', name: 'Small Jar', price: 3500, group: 'jar', weight: '', image: 'asset/clear/small-jar.png', images: ['asset/clear/small-jar.png', ...RANGE_PHOTOS], desc: 'A handy jar filled with crispy plantain goodness.' },
  { id: 'refill-4000', name: 'Refill Pack', price: 4000, group: 'jar', weight: '', image: 'asset/clear/refill-2.png', images: ['asset/clear/refill-2.png', ...RANGE_PHOTOS], desc: 'A larger refill for your jar or for sharing.' },
  { id: 'big-jar', name: 'Big Jar', price: 5500, group: 'jar', weight: '', image: 'asset/clear/Big-Jar.png', images: ['asset/clear/Big-Jar.png', ...RANGE_PHOTOS], desc: 'A generous jar for homes, offices, parties and serious snackers.' },
  { id: 'refill-6000', name: 'Refill Pack', price: 6000, group: 'jar', weight: '', image: 'asset/clear/Big-refill.png', images: ['asset/clear/Big-refill.png', ...RANGE_PHOTOS], desc: 'A large refill option for bigger orders and regular customers.' }
];

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const getProduct = id => products.find(p => p.id === id) || products[0];

/* ---------- PRODUCT CARD TEMPLATE ---------- */
const card = p => `
  <article class="product-card">
    <div class="product-image">
      <button class="image-viewer-trigger" type="button" data-product="${p.id}" aria-label="View details and photos of ${p.name}" aria-haspopup="dialog">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="quick-view" aria-hidden="true"><i class="fa-solid fa-expand"></i> View details</span>
      </button>
    </div>
    <div class="product-body">
      <div class="product-title-row">
        <h3>${p.name}</h3>
        <span class="price">${money.format(p.price)}</span>
      </div>
      <p>${p.desc}</p>
      <a class="btn btn-primary order-btn" href="order.html?product=${encodeURIComponent(p.id)}">
        Order this pack <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </article>
`;

/* ---------- RENDER PRODUCTS ---------- */
function renderProducts() {
  const a = document.getElementById('sachetGrid');
  const b = document.getElementById('jarGrid');
  if (a) a.innerHTML = products.filter(p => p.group === 'sachet').map(card).join('');
  if (b) b.innerHTML = products.filter(p => p.group === 'jar').map(card).join('');
}

/* ---------- ORDER PAGE ---------- */
function setupOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  const select = document.getElementById('productSelect');
  select.innerHTML = products.map(p => `<option value="${p.id}">${p.name} — ${money.format(p.price)}</option>`).join('');

  const params = new URLSearchParams(location.search);
  let product = getProduct(params.get('product'));
  select.value = product.id;

  let quantity = 1;
  const els = {
    name: document.getElementById('selectedName'),
    price: document.getElementById('selectedPrice'),
    qty: document.getElementById('qty'),
    total: document.getElementById('total'),
    product: document.getElementById('productField'),
    quantity: document.getElementById('quantityField'),
    totalField: document.getElementById('totalField'),
    mini: document.getElementById('miniArt'),
    message: document.getElementById('formMessage'),
    submit: document.getElementById('submitBtn')
  };

  function update() {
    const total = product.price * quantity;
    els.name.textContent = product.name;
    els.price.textContent = money.format(product.price);
    els.qty.textContent = quantity;
    els.total.textContent = money.format(total);
    els.product.value = product.name;
    els.quantity.value = quantity;
    els.totalField.value = money.format(total);
    els.mini.src = product.image;
    els.mini.alt = product.name;
    select.value = product.id;
  }

  select.addEventListener('change', () => {
    product = getProduct(select.value);
    quantity = 1;
    update();
  });

  document.getElementById('minus').addEventListener('click', () => {
    if (quantity > 1) {
      quantity--;
      update();
    }
  });

  document.getElementById('plus').addEventListener('click', () => {
    if (quantity < 50) {
      quantity++;
      update();
    }
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    els.message.className = 'form-message';
    els.message.textContent = '';

    const key = form.querySelector('[name="access_key"]').value.trim();
    if (!key || key === 'YOUR_WEB3FORMS_ACCESS_KEY') {
      els.message.className = 'form-message error';
      els.message.textContent = 'Add your Web3Forms access key in order.html before testing submissions.';
      return;
    }

    els.submit.disabled = true;
    els.submit.innerHTML = 'Sending order…';

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      const result = await response.json();
      if (response.ok && result.success) {
        els.message.className = 'form-message success';
        els.message.textContent = 'Order received successfully! We will contact you shortly.';
        form.reset();
        quantity = 1;
        product = products[0];
        update();
      } else {
        throw new Error(result.message || 'Unable to submit order.');
      }
    } catch (err) {
      els.message.className = 'form-message error';
      els.message.textContent = 'We could not send the order. Please check your connection and try again.';
    } finally {
      els.submit.disabled = false;
      els.submit.innerHTML = 'Submit Order <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
    }
  });

  update();
}

/* ---------- CAROUSEL (kept for compatibility — no-ops when no carousel exists) ---------- */
function setupCarousel() {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const track = root.querySelector('.carousel-track');
  const slides = [...track.children];
  const dots = root.querySelector('.dots');
  let index = 0;

  slides.forEach((_, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', `Go to image ${i + 1}`);
    if (i === 0) d.classList.add('active');
    d.onclick = () => go(i);
    dots.appendChild(d);
  });

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll('button').forEach((d, n) => d.classList.toggle('active', n === index));
  }

  root.querySelector('.prev').onclick = () => go(index - 1);
  root.querySelector('.next').onclick = () => go(index + 1);
  setInterval(() => go(index + 1), 5000);
}

/* ---------- MOBILE MENU ---------- */
function setupMenu() {
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.desktop-nav');
  if (!btn || !nav) return;
  btn.onclick = () => {
    const isOpen = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    const icon = btn.querySelector('i');
    if (icon) icon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars-staggered';
  };
}

/* ---------- BADGE ROTATION ---------- */
function setupBadgeRotation() {
  const badge = document.querySelector('.floating-badge');
  const title = badge?.querySelector('.badge-title');
  const icon = badge?.querySelector('.badge-icon i');
  if (!badge || !title || !icon) return;

  const messages = [
    { text: 'Always Fresh', icon: 'fa-leaf' },
    { text: 'Good Quality', icon: 'fa-circle-check' },
    { text: 'Customers Fav', icon: 'fa-heart' }
  ];
  let index = 0;

  setInterval(() => {
    badge.classList.remove('badge-switch-in');
    badge.classList.add('badge-switch-out');
    setTimeout(() => {
      index = (index + 1) % messages.length;
      title.textContent = messages[index].text;
      icon.className = `fa-solid ${messages[index].icon}`;
      badge.classList.remove('badge-switch-out');
      badge.classList.add('badge-switch-in');
    }, 260);
  }, 3600);
}
/* ---------- BRAND COLLAGE (scroll-locked fan-out, contained) ---------- */
/* ---------- BRAND COLLAGE (scroll-locked fan-out) ---------- */
/* ---------- BRAND COLLAGE (scroll-locked fan-out) ---------- */
function setupCollage() {
  const section = document.querySelector('[data-collage]');
  const stage = document.querySelector('[data-collage-stage]');
  const title = document.querySelector('[data-collage-title]');
  const header = document.querySelector('.site-header');
  if (!section || !stage) return;

  const items = Array.from(stage.querySelectorAll('.collage-item'));
  if (!items.length) return;

  /*
   * Scroll-driven fan-out.
   * The section is taller than the screen and its inner box is position:sticky,
   * so the browser itself pins it while you scroll through. Scroll position
   * inside that pinned stretch becomes the animation progress (0 → 1).
   * Nothing intercepts wheel/touch events, so scrolling never feels blocked.
   */
  const SPREAD_END = 0.82;   // cards reach their final spot at 82% of the pinned scroll; the rest is a short rest
  const TITLE_AT = 0.7;      // title fades in once the cards have moved clear of it
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Final tilt for each card, for a relaxed, hand-placed look */
  const tilt = { top: -3, topright: 5, bottomright: -4, bottom: 3, bottomleft: 5, topleft: -5 };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const smooth = t => t * t * (3 - 2 * t);   // smoothstep easing

  let targets = {};
  let target = 0;     // progress from the scroll position
  let current = 0;    // progress currently drawn (eases toward target)
  let rafId = null;

  let fit = 1;   // card scale in the final layout (below 1 only when space is tight)

  /* Work out where each card ends up, using the real space available */
  const layout = () => {
    const headerH = header ? header.offsetHeight : 0;
    section.style.setProperty('--header-h', headerH + 'px');

    const w = stage.clientWidth;
    const h = stage.clientHeight;
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const margin = isMobile ? 14 : 56;   // breathing room from the section edges
    const gap = isMobile ? 10 : 18;      // minimum space between cards and the title

    // size of the actual title text (not its whole box)
    let tw = 0, th = 0;
    if (title) {
      const range = document.createRange();
      range.selectNodeContents(title);
      const r = range.getBoundingClientRect();
      tw = r.width; th = r.height;
    }

    const place = k => {
      const res = {};
      let ok = true;
      items.forEach(el => {
        const pos = el.dataset.pos;
        const iw = el.offsetWidth * k;
        const ih = el.offsetHeight * k;
        // furthest the card's centre may travel and still stay fully inside the stage
        const maxX = Math.max(0, w / 2 - iw / 2 - margin);
        const maxY = Math.max(0, h / 2 - ih / 2 - margin);
        const side = isMobile ? 0.6 : 0.5;   // how high/low the side cards sit
        // side cards: never closer than one card height (+ a gap) to their partner
        const sideY = Math.min(maxY, Math.max(maxY * side, ih / 2 + gap));

        const map = {
          top:         { x: 0,     y: -maxY },
          bottom:      { x: 0,     y:  maxY },
          topleft:     { x: -maxX, y: -sideY },
          topright:    { x:  maxX, y: -sideY },
          bottomleft:  { x: -maxX, y:  sideY },
          bottomright: { x:  maxX, y:  sideY }
        };
        const d = map[pos] || { x: 0, y: 0 };
        res[pos] = d;

        // keep every card clear of the title: beside it, or above/below it
        const clearX = Math.abs(d.x) - iw / 2 >= tw / 2 + gap;
        const clearY = Math.abs(d.y) - ih / 2 >= th / 2 + gap;
        if (!clearX && !clearY) ok = false;
        if (sideY < ih / 2 + gap / 2) ok = false;   // side pair would touch
      });
      return { res, ok };
    };

    // shrink the cards a little (never below 70%) only if they can't fit at full size
    fit = 1;
    let result = place(1);
    while (!result.ok && fit > 0.7) {
      fit = Math.round((fit - 0.05) * 100) / 100;
      result = place(fit);
    }
    targets = result.res;
  };

  const draw = progress => {
    const t = smooth(clamp(progress / SPREAD_END, 0, 1));
    if (title) title.classList.toggle('is-visible', progress >= TITLE_AT);

    items.forEach(el => {
      const pos = el.dataset.pos;
      const d = targets[pos] || { x: 0, y: 0 };
      const rot = (tilt[pos] || 0) * t;
      const scale = fit * (0.84 + 0.16 * t);
      el.style.transform =
        `translate3d(calc(-50% + ${(d.x * t).toFixed(1)}px), calc(-50% + ${(d.y * t).toFixed(1)}px), 0) ` +
        `rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    });
  };

  const readScroll = () => {
    const rect = section.getBoundingClientRect();
    const headerH = header ? header.offsetHeight : 0;
    const sticky = section.querySelector('.collage-sticky');
    const travel = Math.max(1, section.offsetHeight - (sticky ? sticky.offsetHeight : window.innerHeight));
    target = clamp((headerH - rect.top) / travel, 0, 1);
  };

  /* Ease the drawn progress toward the scroll progress, so motion feels smooth */
  const tick = () => {
    const diff = target - current;
    if (Math.abs(diff) < 0.0008) {
      current = target;
      draw(current);
      rafId = null;
      return;
    }
    current += diff * 0.2;
    draw(current);
    rafId = requestAnimationFrame(tick);
  };

  const onScroll = () => {
    if (reduceMotion.matches) return;
    readScroll();
    if (!rafId) rafId = requestAnimationFrame(tick);
  };

  const refresh = () => {
    layout();
    if (reduceMotion.matches) {
      section.classList.add('collage-static');
      current = target = 1;
      draw(1);
      return;
    }
    section.classList.remove('collage-static');
    readScroll();
    current = target;   // no catch-up animation after a resize / first load
    draw(current);
  };

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refresh, 120);
  };

  requestAnimationFrame(refresh);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('load', refresh);
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', refresh);
}
/* ---------- COUNTERS ---------- */
function setupCounters() {
  document.querySelectorAll('[data-counter]').forEach(counter => {
    const target = Number(counter.dataset.counter);
    const prefix = counter.dataset.prefix || '';
    const suffix = counter.dataset.suffix || '';
    const duration = Number(counter.dataset.duration) || 1200;
    const started = performance.now();

    function update(now) {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.max(1, Math.round(target * eased));
      counter.textContent = `${prefix}${value.toLocaleString('en-NG')}${suffix}`;
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  });
}

/* ---------- CUSTOMER REVIEWS DATA ---------- */
/*
 * Reviews are rendered from this array.
 * Later, replace the array with a `fetch('/api/reviews')` call
 * and pass the resulting array into `renderReviews()`.
 */
const reviews = [
  {
    name: 'Amaka O.',
    tag: 'Big Jar regular',
    date: 'March 2026',
    text: 'The crunch is unbeatable. Every pack tastes fresh, and my family finishes them so fast. The big jar is now a permanent fixture in our home.'
  },
  {
    name: 'Tunde A.',
    tag: 'Office orders',
    date: 'February 2026',
    text: 'I order for my office every month. Clean packaging, great taste, and the refill packs make it easy to keep stocked without waste.'
  },
  {
    name: 'Chidinma E.',
    tag: 'Party order',
    date: 'February 2026',
    text: 'Ordered for a small party and everyone asked where I got them from. Divine Grace chips never disappoint — fresh and perfectly seasoned.'
  },
  {
    name: 'Ibrahim M.',
    tag: 'Plantain chips',
    date: 'January 2026',
    text: 'The plantain chips taste like they were made that morning. You can tell the difference — it\'s the freshness that keeps me coming back.'
  },
  {
    name: 'Blessing N.',
    tag: 'Ordered on WhatsApp',
    date: 'January 2026',
    text: 'Quick response on WhatsApp, fast delivery, and the chips arrived crisp and well packed. Will definitely order again.'
  }
];

/* ---------- REVIEWS CAROUSEL ----------
   Featured quote that cross-fades; story-style progress bars advance
   every 6 s. Pauses on hover / focus / touch, off screen and in hidden tabs. */
function setupReviewsCarousel() {
  const root = document.querySelector('[data-reviews-carousel]');
  const stage = document.querySelector('[data-reviews-track]');
  const bars = document.querySelector('[data-reviews-dots]');
  if (!root || !stage || !bars) return;

  const section = root.closest('.reviews-section') || root;
  const prevBtn = section.querySelector('.reviews-prev');
  const nextBtn = section.querySelector('.reviews-next');
  const currentEl = section.querySelector('[data-reviews-current]');
  const totalEl = section.querySelector('[data-reviews-total]');

  const escapeHtml = str => String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const initials = name => name.split(/\s+/).map(w => w[0]).join('').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
  const pad = n => String(n).padStart(2, '0');

  if (!reviews.length) {
    section.querySelector('.reviews-layout').innerHTML = '<p class="reviews-empty">No reviews yet — check back soon.</p>';
    return;
  }

  stage.innerHTML = reviews.map((r, i) => `
    <figure class="review-card" aria-hidden="true" id="review-${i}">
      <span class="review-mark" aria-hidden="true">&ldquo;</span>
      <blockquote class="review-text">${escapeHtml(r.text)}</blockquote>
      <figcaption class="review-author">
        <span class="review-avatar" aria-hidden="true">${initials(r.name)}</span>
        <span class="review-who">
          <span class="review-name">${escapeHtml(r.name)}</span>
          ${r.tag ? `<span class="review-tag">${escapeHtml(r.tag)}</span>` : ''}
        </span>
        <span class="review-date">${escapeHtml(r.date)}</span>
      </figcaption>
    </figure>`).join('');

  bars.innerHTML = reviews.map((r, i) =>
    `<button type="button" aria-label="Show review ${i + 1} of ${reviews.length}" aria-controls="review-${i}"><span></span></button>`).join('');

  const cards = Array.from(stage.children);
  const barBtns = Array.from(bars.children);
  if (totalEl) totalEl.textContent = pad(cards.length);

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 6000;
  let index = 0;
  let timer = null;
  const pauses = new Set();   // reasons the autoplay is paused (hover, focus, touch, offscreen, hidden)

  const go = i => {
    index = (i + cards.length) % cards.length;
    cards.forEach((c, n) => {
      c.classList.toggle('is-active', n === index);
      c.setAttribute('aria-hidden', n === index ? 'false' : 'true');
    });
    barBtns.forEach((b, n) => {
      b.classList.toggle('is-done', n < index);
      b.classList.remove('is-active');
      if (n === index) { void b.offsetWidth; b.classList.add('is-active'); }   // restart the fill
      b.setAttribute('aria-current', n === index ? 'true' : 'false');
    });
    if (currentEl) currentEl.textContent = pad(index + 1);
  };

  /* Autoplay follows the active bar's fill animation, so pausing the
     animation (hover etc.) pauses the slideshow at exactly the same point. */
  bars.addEventListener('animationend', e => {
    if (e.target.parentElement === barBtns[index] && !reduce.matches) go(index + 1);
  });

  const setPaused = (reason, on) => {
    on ? pauses.add(reason) : pauses.delete(reason);
    root.classList.toggle('is-paused', pauses.size > 0);
  };

  root.style.setProperty('--review-time', `${DURATION}ms`);

  if (prevBtn) prevBtn.addEventListener('click', () => go(index - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => go(index + 1));
  barBtns.forEach((b, i) => b.addEventListener('click', () => go(i)));

  root.addEventListener('mouseenter', () => setPaused('hover', true));
  root.addEventListener('mouseleave', () => setPaused('hover', false));
  root.addEventListener('focusin', () => setPaused('focus', true));
  root.addEventListener('focusout', () => setPaused('focus', false));
  document.addEventListener('visibilitychange', () => setPaused('hidden', document.hidden));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => setPaused('offscreen', !entries[0].isIntersecting), { threshold: 0.3 }).observe(root);
  }

  /* Swipe */
  let sx = 0, sy = 0, swiping = false;
  root.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; setPaused('touch', true);
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (!swiping) return;
    if (Math.abs(e.touches[0].clientY - sy) > Math.abs(e.touches[0].clientX - sx)) swiping = false;
  }, { passive: true });
  root.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (swiping && Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
    swiping = false; setPaused('touch', false);
  });

  /* Keyboard */
  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') go(index - 1);
    if (e.key === 'ArrowRight') go(index + 1);
  });

  go(0);
}

/* ---------- PRODUCT IMAGE VIEWER ---------- */
function setupProductImageViewer() {
  const triggers = document.querySelectorAll('.image-viewer-trigger');
  if (!triggers.length) return;

  const GROUP_LABEL = { sachet: 'Sachets & everyday snacks', jar: 'Jars & refills' };

  const modal = document.createElement('div');
  modal.className = 'image-viewer';
  modal.innerHTML = `
    <div class="pv" role="dialog" aria-modal="true" aria-labelledby="pv-title">
      <button class="pv-close" type="button" aria-label="Close product details"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>

      <div class="pv-gallery">
        <div class="pv-stage" tabindex="0" aria-roledescription="carousel" aria-label="Product photos">
          <div class="pv-track"></div>
          <button class="pv-arrow pv-prev" type="button" aria-label="Previous photo"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
          <button class="pv-arrow pv-next" type="button" aria-label="Next photo"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
          <span class="pv-count" aria-live="polite"></span>
        </div>
        <div class="pv-thumbs"></div>
      </div>

      <div class="pv-info">
        <span class="pv-group eyebrow"></span>
        <h2 class="pv-title" id="pv-title"></h2>
        <strong class="pv-price"></strong>
        <p class="pv-desc"></p>
        <dl class="pv-specs"></dl>
        <a class="btn btn-primary pv-order" href="order.html">Order this pack <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
        <p class="pv-note"><i class="fa-solid fa-truck-fast" aria-hidden="true"></i> We confirm every order and delivery by phone or WhatsApp.</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const $ = sel => modal.querySelector(sel);
  const dialog = $('.pv'), stage = $('.pv-stage'), track = $('.pv-track'), thumbs = $('.pv-thumbs');
  const prev = $('.pv-prev'), next = $('.pv-next'), count = $('.pv-count'), closeBtn = $('.pv-close');
  let photos = [], index = 0, lastTrigger = null;

  const go = i => {
    index = (i + photos.length) % photos.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    [...thumbs.children].forEach((t, n) => {
      t.classList.toggle('is-active', n === index);
      t.setAttribute('aria-current', n === index ? 'true' : 'false');
    });
    [...track.children].forEach((s, n) => s.setAttribute('aria-hidden', n === index ? 'false' : 'true'));
    count.textContent = `${index + 1} / ${photos.length}`;
  };

  const open = (product, trigger) => {
    lastTrigger = trigger;
    photos = (product.images && product.images.length ? product.images : [product.image]);
    const single = photos.length < 2;
    dialog.classList.toggle('is-single', single);

    track.innerHTML = photos.map((src, i) => `
      <div class="pv-slide${src.includes('/clear/') ? ' is-cutout' : ''}" role="group" aria-label="Photo ${i + 1} of ${photos.length}">
        <img src="${src}" alt="${product.name}${i ? ` — photo ${i + 1}` : ''}" draggable="false">
      </div>`).join('');
    thumbs.innerHTML = single ? '' : photos.map((src, i) => `
      <button type="button" class="pv-thumb${src.includes('/clear/') ? ' is-cutout' : ''}" aria-label="Show photo ${i + 1}">
        <img src="${src}" alt="">
      </button>`).join('');
    [...thumbs.children].forEach((t, i) => t.addEventListener('click', () => go(i)));

    $('.pv-group').textContent = GROUP_LABEL[product.group] || 'Divine Grace Chips';
    $('.pv-title').textContent = product.name;
    $('.pv-price').textContent = money.format(product.price);
    $('.pv-desc').textContent = product.desc;
    $('.pv-order').href = `order.html?product=${encodeURIComponent(product.id)}`;

    const specs = [];
    if (product.weight) specs.push(['Weight', product.weight]);
    specs.push(['Pack', product.group === 'jar' ? 'Jar / refill range' : 'Sachet range']);
    if (!/potato/i.test(product.name)) {
      specs.push(['Ingredients', 'Plantain, vegetable oil, chilli pepper, salt']);   // from the pack label
      specs.push(['Plantain', 'Ripe or unripe — choose when ordering']);
    }
    $('.pv-specs').innerHTML = specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    track.style.transition = 'none'; go(0); void track.offsetWidth; track.style.transition = '';
    modal.classList.add('is-open');
    document.body.classList.add('viewer-open');
    closeBtn.focus({ preventScroll: true });
  };

  const hide = () => {
    if (!modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
  };

  triggers.forEach(trigger => trigger.addEventListener('click', () => {
    const product = products.find(p => p.id === trigger.dataset.product);
    if (product) open(product, trigger);
  }));

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  closeBtn.addEventListener('click', hide);
  modal.addEventListener('click', e => { if (e.target === modal) hide(); });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowLeft' && photos.length > 1) go(index - 1);
    if (e.key === 'ArrowRight' && photos.length > 1) go(index + 1);
    if (e.key === 'Tab') {            // keep keyboard focus inside the window
      const f = [...dialog.querySelectorAll('button, a[href], [tabindex="0"]')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  /* swipe between photos */
  let sx = 0, sy = 0, dx = 0, dragging = false;
  stage.addEventListener('touchstart', e => {
    if (photos.length < 2) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; dragging = true;
    track.style.transition = 'none';
  }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (!dragging) return;
    dx = e.touches[0].clientX - sx;
    if (Math.abs(e.touches[0].clientY - sy) > Math.abs(dx) + 10) { dragging = false; track.style.transition = ''; go(index); return; }
    track.style.transform = `translateX(calc(-${index * 100}% + ${dx}px))`;
  }, { passive: true });
  stage.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false; track.style.transition = '';
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1)); else go(index);
  });
}

/* ---------- INITIALIZATION ---------- */
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  renderProducts();
  setupOrderPage();
  setupCarousel();
  setupCollage();
  setupReviewsCarousel()
  setupMenu();
  setupBottomNav();
  setupDelivery();
  setupBadgeRotation();
  setupCounters();
  setupProductImageViewer();
  setupNavActiveOnClick();
  document.querySelectorAll('#year').forEach(el => el.textContent = new Date().getFullYear());
});

document.addEventListener('DOMContentLoaded', setupOrderType);
document.addEventListener('DOMContentLoaded', setupProductOptions);
document.addEventListener('DOMContentLoaded', setupAdditionalProducts);
document.addEventListener('DOMContentLoaded', setupOrderItemSizing);

/* ---------- EMPTY STATE FOR ORDER PAGE (no product in URL) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const select = document.getElementById('productSelect');
  if (!form || !select || new URLSearchParams(location.search).has('product')) return;

  const name = document.getElementById('selectedName');
  const price = document.getElementById('selectedPrice');
  const mini = document.getElementById('miniArt');
  const total = document.getElementById('total');
  const productField = document.getElementById('productField');
  const quantityField = document.getElementById('quantityField');
  const totalField = document.getElementById('totalField');
  const typeField = document.getElementById('typeField');
  const message = document.getElementById('formMessage');
  const controls = [
    document.getElementById('minus'),
    document.getElementById('plus'),
    document.getElementById('productType'),
    document.getElementById('addProductBtn')
  ];

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a product';
  placeholder.selected = true;
  select.insertBefore(placeholder, select.firstChild);
  select.required = false;

  const resetEmptyState = () => {
    if (select.value) return;
    name.textContent = 'Click a product to order';
    price.textContent = '';
    mini.removeAttribute('src');
    mini.alt = 'No product selected';
    total.textContent = '₦0';
    productField.value = '';
    quantityField.value = '';
    totalField.value = '';
    typeField.value = '';
    controls.forEach(control => { if (control) control.disabled = true; });
  };

  const enableSelectedState = () => controls.forEach(control => {
    if (control) control.disabled = false;
  });

  select.addEventListener('change', () => {
    if (select.value) {
      select.required = true;
      enableSelectedState();
    } else {
      select.required = false;
      resetEmptyState();
    }
  }, true);

  resetEmptyState();

  document.getElementById('submitBtn').addEventListener('click', event => {
    if (select.value) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    message.className = 'form-message error';
    message.textContent = 'Click a product to order before submitting.';
  }, true);

  form.addEventListener('submit', event => {
    if (select.value) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    message.className = 'form-message error';
    message.textContent = 'Click a product to order before submitting.';
  }, true);
});