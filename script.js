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
   One 10-second loop:
   wait at the Divine Grace shop → walk to Mini Mart with a pouch → hand it over
   ("Delivered") → walk back empty-handed → pick up the next pouch.
   Only runs while the scene is on screen. */
function setupDelivery() {
  const scene = document.querySelector('[data-delivery]');
  if (!scene) return;
  const q = sel => scene.querySelector(sel);
  const walker = q('[data-dl-walker]');
  const face = q('[data-dl-face]');
  const body = q('[data-dl-body]');
  const legF = q('[data-dl-leg-front]');
  const legB = q('[data-dl-leg-back]');
  const armF = q('[data-dl-arm-front]');
  const armB = q('[data-dl-arm-back]');
  const carried = q('[data-dl-carried]');
  const stock = q('[data-dl-stock]');
  const bubble = q('[data-dl-bubble]');
  const shadow = q('[data-dl-shadow]');
  const caption = q('[data-dl-caption] span');
  if (!walker || !legF) return;

  const LOOP = 10000;            // ms
  const START_X = 150;           // in front of the Divine Grace door
  const END_X = 452;             // in front of the Mini Mart door
  const STEP = 720;              // ms per full stride
  // timeline (fractions of the loop)
  const T = { leave: 0.06, arrive: 0.44, handOver: 0.49, turn: 0.56, back: 0.58, home: 0.92, pickUp: 0.96 };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = t => t * t * (3 - 2 * t);
  const walkEase = t => 0.75 * t + 0.25 * ease(t);   // mostly steady, soft start and stop

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = null, startTime = null, visible = false, lastCaption = '';

  const pose = (x, facingRight, walking, walkMs, carrying) => {
    const phase = walking ? (walkMs / STEP) * Math.PI * 2 : 0;
    const swing = walking ? Math.sin(phase) : 0;
    const bob = walking ? -Math.abs(Math.sin(phase)) * 2.4 : 0;

    walker.setAttribute('transform', `translate(${x.toFixed(1)} 344)`);
    face.setAttribute('transform', facingRight ? '' : 'scale(-1 1)');
    body.setAttribute('transform', `translate(0 ${bob.toFixed(2)})`);
    legF.setAttribute('transform', `translate(0 -50) rotate(${(swing * 26).toFixed(1)})`);
    legB.setAttribute('transform', `translate(0 -50) rotate(${(-swing * 26).toFixed(1)})`);
    armB.setAttribute('transform', `translate(-2 -92) rotate(${(swing * 24).toFixed(1)})`);
    // carrying: front arm held forward, holding the pouch; otherwise it swings
    const front = carrying ? -58 + swing * 3 : -swing * 24;
    armF.setAttribute('transform', `translate(2 -92) rotate(${front.toFixed(1)})`);
    carried.style.opacity = carrying ? 1 : 0;
    carried.setAttribute('transform', `translate(0 ${(carrying ? swing * 0.8 : 0).toFixed(2)})`);
    shadow.setAttribute('rx', (22 - Math.abs(bob) * 0.8).toFixed(1));
  };

  const render = now => {
    const t = ((now - startTime) % LOOP) / LOOP;
    const ms = t * LOOP;
    let x = START_X, right = true, walking = false, walkMs = 0, carrying = true;

    if (t < T.leave) {                          // waiting at the Divine Grace shop
      x = START_X;
    } else if (t < T.arrive) {                  // walking to Mini Mart with the pouch
      const k = (t - T.leave) / (T.arrive - T.leave);
      x = START_X + (END_X - START_X) * walkEase(k);
      walking = true; walkMs = ms - T.leave * LOOP;
    } else if (t < T.back) {                    // handing over
      x = END_X;
      carrying = t < T.handOver;
      right = t < T.turn;
    } else if (t < T.home) {                    // walking back, empty-handed
      const k = (t - T.back) / (T.home - T.back);
      x = END_X + (START_X - END_X) * walkEase(k);
      walking = true; walkMs = ms - T.back * LOOP;
      right = false; carrying = false;
    } else {                                    // back home: turn round, pick up the next pouch
      x = START_X;
      right = t >= T.pickUp - 0.02;
      carrying = t >= T.pickUp;
    }
    pose(x, right, walking, walkMs, carrying);

    // pouch on Mini Mart's shelf: appears at hand-over, fades just before the loop restarts
    const stockOn = t >= T.handOver && t < 0.985;
    stock.style.opacity = stockOn ? 1 : 0;

    // "Delivered" bubble pops in after the hand-over
    const b = clamp((t - T.handOver) / 0.03, 0, 1) * (1 - clamp((t - 0.64) / 0.04, 0, 1));
    bubble.style.opacity = b.toFixed(2);
    bubble.setAttribute('transform', `translate(497 ${(110 - 8 * ease(clamp((t - T.handOver) / 0.04, 0, 1))).toFixed(1)})`);

    const text = t >= T.handOver && t < 0.7 ? 'Delivered fresh!' : 'Fresh chips on the way';
    if (caption && text !== lastCaption) { caption.textContent = text; lastCaption = text; }
  };

  const loop = now => {
    if (startTime === null) startTime = now;
    render(now);
    rafId = requestAnimationFrame(loop);
  };

  const start = () => {
    if (rafId || reduce.matches || !visible || document.hidden) return;
    // resume where we left off
    startTime = startTime === null ? null : performance.now() - pausedAt;
    rafId = requestAnimationFrame(loop);
  };
  let pausedAt = 0;
  const stop = () => {
    if (!rafId) return;
    cancelAnimationFrame(rafId); rafId = null;
    pausedAt = (performance.now() - startTime) % LOOP;
  };

  const staticFrame = () => {      // reduced motion: a still mid-delivery picture
    pose(300, true, false, 0, true);
    stock.style.opacity = 0; bubble.style.opacity = 0;
  };

  if (reduce.matches) staticFrame(); else pose(START_X, true, false, 0, true);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }, { threshold: 0.15 }).observe(scene);
  } else { visible = true; start(); }

  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if (reduce.addEventListener) reduce.addEventListener('change', () => { stop(); reduce.matches ? staticFrame() : start(); });
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

/* ---------- PRODUCT DATA ---------- */
const products = [
  { id: 'ziploc', name: 'Ziploc', price: 1000, group: 'sachet', image: 'asset/clear/Ziploc.png', desc: 'A convenient, crunchy pack for a quick snack or little treat.' },
  { id: 'refill-2000', name: 'Refill Pack', price: 2000, group: 'sachet', image: 'asset/clear/refill.png', desc: 'Light, crispy and satisfying — perfect to keep stocked.' },
  { id: 'plantain-dozen', name: 'Plantain Chips — Dozen', price: 3000, group: 'sachet', image: 'asset/clear/refill.png', desc: 'A generous plantain option for sharing, events and resellers.' },
  { id: 'potato-dozen', name: 'Potato Chips — Dozen', price: 3000, group: 'sachet', image: 'asset/clear/potato.png', desc: 'Crunchy potato chips for something a little different.' },
  { id: 'small-jar', name: 'Small Jar', price: 3500, group: 'jar', image: 'asset/clear/small-jar.png', desc: 'A handy jar filled with crispy plantain goodness.' },
  { id: 'refill-4000', name: 'Refill Pack', price: 4000, group: 'jar', image: 'asset/clear/refill-2.png', desc: 'A larger refill for your jar or for sharing.' },
  { id: 'big-jar', name: 'Big Jar', price: 5500, group: 'jar', image: 'asset/clear/Big-Jar.png', desc: 'A generous jar for homes, offices, parties and serious snackers.' },
  { id: 'refill-6000', name: 'Refill Pack', price: 6000, group: 'jar', image: 'asset/clear/Big-refill.png', desc: 'A large refill option for bigger orders and regular customers.' }
];

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });
const getProduct = id => products.find(p => p.id === id) || products[0];

/* ---------- PRODUCT CARD TEMPLATE ---------- */
const card = p => `
  <article class="product-card">
    <div class="product-image">
      <button class="image-viewer-trigger" type="button" data-image="${p.image}" data-name="${p.name}" aria-label="View ${p.name} image">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
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
    date: 'March 2026',
    rating: 5,
    text: 'The crunch is unbeatable. Every pack tastes fresh, and my family finishes them so fast. The big jar is now a permanent fixture in our home.'
  },
  {
    name: 'Tunde A.',
    date: 'February 2026',
    rating: 5,
    text: 'I order for my office every month. Clean packaging, great taste, and the refill packs make it easy to keep stocked without waste.'
  },
  {
    name: 'Chidinma E.',
    date: 'February 2026',
    rating: 5,
    text: 'Ordered for a small party and everyone asked where I got them from. Divine Grace chips never disappoint — fresh and perfectly seasoned.'
  },
  {
    name: 'Ibrahim M.',
    date: 'January 2026',
    rating: 5,
    text: 'The plantain chips taste like they were made that morning. You can tell the difference — it\'s the freshness that keeps me coming back.'
  },
  {
    name: 'Blessing N.',
    date: 'January 2026',
    rating: 5,
    text: 'Quick response on WhatsApp, fast delivery, and the chips arrived crisp and well packed. Will definitely order again.'
  }
];

/* ---------- REVIEWS CAROUSEL ---------- */
function setupReviewsCarousel() {
  const root = document.querySelector('[data-reviews-carousel]');
  const track = document.querySelector('[data-reviews-track]');
  const dotsWrap = document.querySelector('[data-reviews-dots]');
  if (!root || !track || !dotsWrap) return;

  /* --- Build the review cards from data --- */
  const buildStars = (rating) => {
    let html = '';
    for (let i = 0; i < 5; i++) {
      const filled = i < rating;
      html += `<i class="${filled ? 'fa-solid' : 'fa-regular'} fa-star" aria-hidden="true"></i>`;
    }
    return html;
  };

  const escapeHtml = (str) =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const buildCard = (r) => `
    <article class="review-card">
      <div class="review-stars" aria-label="${r.rating} out of 5 stars">
        ${buildStars(r.rating)}
      </div>
      <p class="review-text">&ldquo;${escapeHtml(r.text)}&rdquo;</p>
      <div class="review-author">
        <span class="review-name">${escapeHtml(r.name)}</span>
        <span class="review-date">${escapeHtml(r.date)}</span>
      </div>
    </article>
  `;

  /* Empty state — no reviews */
  if (!reviews.length) {
    root.innerHTML = '<p class="reviews-empty">No reviews yet — check back soon.</p>';
    return;
  }

  track.innerHTML = reviews.map(buildCard).join('');

  const slides = Array.from(track.children);
  const prevBtn = root.querySelector('.reviews-prev');
  const nextBtn = root.querySelector('.reviews-next');

  let index = 0;
  let autoplayTimer = null;
  let isPaused = false;

  /* Build dots */
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Go to review ${i + 1}`);
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => go(i));
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.children);

  function go(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, n) => d.classList.toggle('active', n === index));
  }

  function next() { go(index + 1); }
  function prev() { go(index - 1); }

  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); restartAutoplay(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { next(); restartAutoplay(); });

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(() => {
      if (!isPaused) next();
    }, 6000);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
  }

  root.addEventListener('mouseenter', () => { isPaused = true; });
  root.addEventListener('mouseleave', () => { isPaused = false; });

  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
  });

  /* Touch swipe */
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  root.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = true;
    isPaused = true;
  }, { passive: true });

  root.addEventListener('touchmove', (e) => {
    if (!isSwiping) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) isSwiping = false;
  }, { passive: true });

  root.addEventListener('touchend', (e) => {
    if (!isSwiping) { isPaused = false; return; }
    isSwiping = false;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 50) prev();
    else if (dx < -50) next();
    isPaused = false;
  });

  /* Keyboard */
  root.setAttribute('tabindex', '0');
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { prev(); restartAutoplay(); }
    if (e.key === 'ArrowRight') { next(); restartAutoplay(); }
  });

  /* Start */
  go(0);
  startAutoplay();
}

/* ---------- PRODUCT IMAGE VIEWER ---------- */
function setupProductImageViewer() {
  const triggers = document.querySelectorAll('.image-viewer-trigger');
  if (!triggers.length) return;

  const modal = document.createElement('div');
  modal.className = 'image-viewer';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Product image viewer');
  modal.innerHTML = `
    <button class="image-viewer-close" type="button" aria-label="Close image viewer">&times;</button>
    <figure>
      <img class="image-viewer-preview" alt="">
      <figcaption class="image-viewer-caption"></figcaption>
    </figure>
  `;
  document.body.appendChild(modal);

  const preview = modal.querySelector('.image-viewer-preview');
  const caption = modal.querySelector('.image-viewer-caption');
  const close = modal.querySelector('.image-viewer-close');

  const hide = () => {
    modal.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
  };

  triggers.forEach(trigger => trigger.addEventListener('click', () => {
    preview.src = trigger.dataset.image;
    preview.alt = trigger.dataset.name;
    caption.textContent = trigger.dataset.name;
    modal.classList.add('is-open');
    document.body.classList.add('viewer-open');
    close.focus();
  }));

  close.addEventListener('click', hide);
  modal.addEventListener('click', event => {
    if (event.target === modal) hide();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
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