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

/* ---------- PAYMENT ACCOUNT (order page) ----------
   ⚠ PLACEHOLDER DETAILS — replace with your real bank account before going live. */
// WhatsApp number orders are sent to (country code, no + or spaces): 0815 725 5322 → 2348157255322
const BUSINESS_WHATSAPP = '2348157255322';

const PAYMENT_ACCOUNT = {
  bank: 'Moniepoint MFB',
  accountName: 'Divine Grace Chips',
  accountNumber: '0123456789'
};

/* ---------- PRODUCT DATA ----------
   PHOTOS — each product has its own folder:  asset/products/<id>/
     • photos: file names inside that folder, in slider order.
       The FIRST photo is the main one (product card, order page, slider).
     • To add photos: put 2.jpg, 3.jpg … in the product's folder and list
       them here, e.g.  photos: ['1.webp', '2.jpg', '3.jpg']
     • Until a product has its own extra photos, the slider is topped up
       with the shared stand-in photos in asset/products/_placeholder/.
       Set  placeholders: false  on a product to turn that off.
     See asset/products/README.md for the full guide.

   weight — shown in the product details.
   ⚠ The weights below are PLACEHOLDERS — replace them with the real ones. */
const PRODUCT_PHOTO_DIR = 'asset/products/';
const PLACEHOLDER_PHOTOS = ['_placeholder/range-studio.jpg', '_placeholder/range-outdoor.jpg', '_placeholder/lifestyle-picnic.jpg'];
const MIN_SLIDER_PHOTOS = 3;   // top up with placeholders until the slider has this many

const products = [
  { id: 'ziploc',         name: 'Ziploc',                 price: 1000, group: 'sachet', weight: '100 g',      photos: ['1.webp'], desc: 'A convenient, crunchy pack for a quick snack or little treat.' },
  { id: 'refill-2000',    name: 'Refill Pack 2k',         price: 2000, group: 'sachet', weight: '250 g',      photos: ['1.webp'], desc: 'Light, crispy and satisfying — perfect to keep stocked.' },
  { id: 'plantain-dozen', name: 'Plantain Chips — Dozen', price: 3000, group: 'sachet', weight: '12 × 50 g',  photos: ['1.webp'], desc: 'A generous plantain option for sharing, events and resellers.' },
  { id: 'potato-dozen',   name: 'Potato Chips — Dozen',   price: 3000, group: 'sachet', weight: '12 × 50 g',  photos: ['1.webp'], desc: 'Crunchy potato chips for something a little different.' },
  { id: 'small-jar',      name: 'Small Jar',              price: 3500, group: 'jar',    weight: '400 g',      photos: ['1.webp'], desc: 'A handy jar filled with crispy plantain goodness.' },
  { id: 'refill-4000',    name: 'Refill Pack 4k',         price: 4000, group: 'jar',    weight: '500 g',      photos: ['1.webp'], desc: 'A larger refill for your jar or for sharing.' },
  { id: 'big-jar',        name: 'Big Jar',                price: 5500, group: 'jar',    weight: '900 g',      photos: ['1.webp'], desc: 'A generous jar for homes, offices, parties and serious snackers.' },
  { id: 'refill-6000',    name: 'Refill Pack 6k',         price: 6000, group: 'jar',    weight: '1 kg',       photos: ['1.webp'], desc: 'A large refill option for bigger orders and regular customers.' }
];

/* Build each product's photo paths from its folder (no need to edit this) */
products.forEach((p, i) => {
  const own = (p.photos || []).map(f => (f.includes('/') ? f : `${p.id}/${f}`));
  const extra = [];
  if (p.placeholders !== false) {
    // rotate the stand-ins so neighbouring products don't all start with the same one
    for (let k = 0; own.length + extra.length < MIN_SLIDER_PHOTOS && k < PLACEHOLDER_PHOTOS.length; k++) {
      extra.push(PLACEHOLDER_PHOTOS[(i + k) % PLACEHOLDER_PHOTOS.length]);
    }
  }
  p.images = [...own, ...extra].map(f => PRODUCT_PHOTO_DIR + f);
  p.image = p.images[0];   // main photo
});

const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

/* ---------- PRODUCT CARD TEMPLATE ---------- */
const hasStock = () => typeof Stock !== 'undefined';
const card = p => {
  const badge = hasStock() ? Stock.label(p) : null;
  const soldOut = hasStock() && Stock.soldOut(p);
  return `
  <article class="product-card${soldOut ? ' is-sold-out' : ''}">
    <div class="product-image">
      <button class="image-viewer-trigger" type="button" data-product="${p.id}" aria-label="View details and photos of ${p.name}" aria-haspopup="dialog">
        <img src="${p.image}" alt="${p.name}" loading="lazy">
        <span class="quick-view" aria-hidden="true"><i class="fa-solid fa-expand"></i> View details</span>
      </button>
      ${badge ? `<span class="stock-badge tone-${badge.tone}">${badge.text}</span>` : ''}
    </div>
    <div class="product-body">
      <div class="product-title-row">
        <h3>${p.name}</h3>
        <span class="price">${money.format(p.price)}</span>
      </div>
      <p>${p.desc}</p>
      ${soldOut
        ? `<span class="btn btn-light order-btn is-disabled" aria-disabled="true"><i class="fa-solid fa-ban" aria-hidden="true"></i> Sold out</span>`
        : `<a class="btn btn-primary order-btn" href="order.html?product=${encodeURIComponent(p.id)}">
        Order this pack <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>`}
    </div>
  </article>
`;
};

/* ---------- RENDER PRODUCTS ---------- */
function renderProducts() {
  const a = document.getElementById('sachetGrid');
  const b = document.getElementById('jarGrid');
  if (a) a.innerHTML = products.filter(p => p.group === 'sachet').map(card).join('');
  if (b) b.innerHTML = products.filter(p => p.group === 'jar').map(card).join('');
}
// redraw the cards if the stock changes in another tab (e.g. the admin)
if (typeof Stock !== 'undefined') Stock.onChange(() => renderProducts());

/* ---------- ORDER PAGE ---------- */
function setupOrderPage() {
  const form = document.getElementById('orderForm');
  const itemsEl = document.getElementById('orderItems');
  if (!form || !itemsEl) return;

  const $ = id => document.getElementById(id);
  const summary = $('orderSummary');
  const empty = $('orderEmpty');
  const picker = $('productPicker');
  const options = $('productOptions');
  const chooseBtn = $('chooseProductBtn');
  const addBtn = $('addProductBtn');
  const closePickerBtn = $('closePickerBtn');
  const totalRow = $('totalRow');
  const totalEl = $('total');
  const countEl = $('itemCount');
  const message = $('formMessage');
  const submit = $('submitBtn');
  const MAX_QTY = 50;

  /* The order: one line per product → { id, qty, type } */
  let cart = [];
  const find = id => products.find(p => p.id === id);
  const hasType = product => !/potato/i.test(product.name);   // plantain products come ripe or unripe
  // stock rules (stock.js): which types can be ordered and how many are left
  const typesOk = p => (hasStock() ? Stock.orderableTypes(p) : (hasType(p) ? ['Ripe', 'Unripe'] : ['']));
  const maxFor = line => Math.min(MAX_QTY, hasStock() ? Stock.left(find(line.id), line.type) : MAX_QTY);
  const lineTotal = line => find(line.id).price * line.qty;
  const orderTotal = () => cart.reduce((sum, line) => sum + lineTotal(line), 0);

  // A product chosen on the products page (order.html?product=big-jar) starts the order
  const start = find(new URLSearchParams(location.search).get('product'));
  const emptyText = empty.querySelector('span:not(.order-empty-icon)');
  if (start && typesOk(start).length) cart.push({ id: start.id, qty: 1, type: typesOk(start)[0] });
  else if (start && emptyText) emptyText.textContent = `Sorry, ${start.name} is sold out right now. Please choose another product.`;

  /* product picker */
  const drawOptions = () => {
    options.innerHTML = products.map(p => {
      const out = !typesOk(p).length;
      const badge = hasStock() ? Stock.label(p) : null;
      return `
      <button type="button" class="product-option${out ? ' is-sold-out' : ''}" data-id="${p.id}"${out ? ' disabled aria-disabled="true"' : ''}>
        <img src="${p.image}" alt="">
        <span>${p.name}<small>${out ? 'Sold out' : money.format(p.price) + (badge ? ` · ${badge.text}` : '')}</small></span>
        <i class="fa-solid fa-circle-check product-option-check" aria-hidden="true"></i>
      </button>`;
    }).join('');
  };
  drawOptions();

  /* Each order line is a product + its type, so the same pack can be
     ordered ripe AND unripe as two separate lines. */
  const addProduct = id => {
    const product = find(id);
    const types = typesOk(product);                           // only types in stock
    if (!types.length) return;
    const lines = cart.filter(l => l.id === id);
    const missing = types.find(t => !lines.some(l => l.type === t));
    if (missing !== undefined) { cart.push({ id, qty: 1, type: missing }); return; }   // add a type not in the order yet
    const room = lines.find(l => l.qty < maxFor(l));          // otherwise one more where stock allows
    if (room) room.qty += 1;
    else stockNote = `That’s all the ${product.name} we have left right now.`;
  };
  let stockNote = '';

  // two lines with the same product and type become one
  const mergeDuplicates = () => {
    const merged = [];
    cart.forEach(line => {
      const same = merged.find(l => l.id === line.id && l.type === line.type);
      if (same) same.qty = Math.min(maxFor(same), same.qty + line.qty);
      else merged.push(line);
    });
    cart = merged;
  };

  const setPicker = open => {
    picker.hidden = !open;
    [chooseBtn, addBtn].forEach(b => b.setAttribute('aria-expanded', String(open)));
    render();
    if (open) picker.querySelector('.product-option').focus({ preventScroll: true });
  };

  options.addEventListener('click', e => {
    const btn = e.target.closest('.product-option');
    if (!btn) return;
    addProduct(btn.dataset.id);
    clearMessage();
    setPicker(false);
  });

  chooseBtn.addEventListener('click', () => setPicker(true));
  addBtn.addEventListener('click', () => setPicker(picker.hidden));
  closePickerBtn.addEventListener('click', () => setPicker(false));

  /* order lines */
  itemsEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const i = Number(btn.closest('[data-index]').dataset.index);
    const line = cart[i];
    if (!line) return;
    if (btn.dataset.action === 'remove') cart.splice(i, 1);
    if (btn.dataset.action === 'minus') line.qty = Math.max(1, line.qty - 1);
    if (btn.dataset.action === 'plus') line.qty = Math.min(maxFor(line), line.qty + 1);
    render();
  });

  itemsEl.addEventListener('change', e => {
    if (!e.target.matches('select[data-action="type"]')) return;
    const line = cart[Number(e.target.closest('[data-index]').dataset.index)];
    line.type = e.target.value;
    line.qty = Math.max(1, Math.min(line.qty, maxFor(line)));
    mergeDuplicates();
    render();
  });

  function render() {
    const hasItems = cart.length > 0;
    const pickerOpen = !picker.hidden;

    empty.hidden = hasItems || pickerOpen;
    addBtn.hidden = !hasItems || pickerOpen;
    totalRow.hidden = !hasItems;
    summary.classList.toggle('has-items', hasItems);

    itemsEl.innerHTML = cart.map((line, i) => {
      const p = find(line.id);
      const max = maxFor(line);
      const types = typesOk(p);
      if (line.type && !types.includes(line.type)) types.push(line.type);   // keep the chosen type listed
      return `
        <li class="order-item" data-index="${i}">
          <img class="order-item-img" src="${p.image}" alt="">
          <div class="order-item-info">
            <strong>${p.name}${line.type && cart.filter(l => l.id === line.id).length > 1 ? ` <em class="order-item-tag">${line.type}</em>` : ''}</strong>
            <span>${money.format(p.price)} each${max < MAX_QTY ? ` · <b class="order-item-left">${max} left</b>` : ''}</span>
          </div>
          <button type="button" class="order-item-remove" data-action="remove" aria-label="Remove ${p.name}">
            <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
          </button>
          <div class="order-item-controls">
            <div class="quantity-control" role="group" aria-label="Quantity of ${p.name}">
              <button type="button" data-action="minus" aria-label="Decrease quantity"${line.qty <= 1 ? ' disabled' : ''}>−</button>
              <strong>${line.qty}</strong>
              <button type="button" data-action="plus" aria-label="Increase quantity"${line.qty >= max ? ' disabled' : ''}>+</button>
            </div>
            ${hasType(p) ? (types.length > 1 ? `
            <select class="order-item-type" data-action="type" aria-label="Plantain type for ${p.name}">
              ${types.map(t => `<option value="${t}"${line.type === t ? ' selected' : ''}>${t}</option>`).join('')}
            </select>` : `<span class="order-item-only">${line.type} only</span>`) : '<span></span>'}
            <span class="order-item-total">${money.format(lineTotal(line))}</span>
          </div>
        </li>`;
    }).join('');

    // mark products already in the order inside the picker
    options.querySelectorAll('.product-option').forEach(b => {
      b.classList.toggle('is-in-order', cart.some(l => l.id === b.dataset.id));
    });

    if (stockNote) { showError(stockNote); stockNote = ''; }

    const count = cart.reduce((n, l) => n + l.qty, 0);
    totalEl.textContent = money.format(orderTotal());
    countEl.textContent = hasItems ? `· ${count} item${count === 1 ? '' : 's'}` : '';
  }

  /* hidden fields sent with the form */
  const fillHiddenFields = () => {
    $('orderField').value = cart.map(line => {
      const p = find(line.id);
      return `${line.qty} × ${p.name}${hasType(p) ? ` (${line.type})` : ''} = ${money.format(lineTotal(line))}`;
    }).join('\n');
    $('itemsField').value = String(cart.reduce((n, l) => n + l.qty, 0));
    $('totalField').value = money.format(orderTotal());
  };

  /* ---- form fields ---- */
  const phone = $('phone');
  const phoneField = $('phoneField');
  const phoneHint = $('phoneHint');
  const PHONE_HINT = phoneHint.textContent;
  const locationSelect = $('location');
  const addressField = $('addressField');
  const address = $('address');
  const orderTypeField = form.querySelector('.choice-field');

  // Nigerian mobile: 0 + 10 digits (070/080/081/090/091…) or +234 / 234 + 10 digits
  const normalisePhone = value => {
    const digits = value.replace(/[\s\-().]/g, '');
    const m = digits.match(/^(?:\+?234|0)([789][01]\d{8})$/);
    return m ? '0' + m[1] : null;
  };

  const checkPhone = (showEmpty = false) => {
    const value = phone.value.trim();
    let error = '';
    if (!value) error = showEmpty ? 'Please enter your phone number.' : '';
    else if (/[^\d\s\-+().]/.test(value)) error = 'Use numbers only, e.g. 08012345678.';
    else if (!normalisePhone(value)) error = 'Enter a valid mobile number, e.g. 08012345678 or +2348012345678.';
    phoneField.classList.toggle('has-error', !!error);
    phone.setAttribute('aria-invalid', error ? 'true' : 'false');
    phoneHint.textContent = error || PHONE_HINT;
    return !error;
  };

  phone.addEventListener('blur', () => checkPhone(false));
  phone.addEventListener('input', () => { if (phoneField.classList.contains('has-error')) checkPhone(false); });

  // Home Delivery needs an address
  const syncLocation = () => {
    const home = locationSelect.value === 'Home Delivery';
    addressField.hidden = !home;
    address.required = home;
    if (!home) address.value = '';
  };
  locationSelect.addEventListener('change', syncLocation);
  syncLocation();

  form.addEventListener('change', e => {
    if (e.target.name === 'order_type') orderTypeField.classList.remove('has-error');
  });

  const clearMessage = () => { message.className = 'form-message'; message.textContent = ''; };
  const showError = text => { message.className = 'form-message error'; message.textContent = text; };

  /* ---- delivery batch announcement (set by the admin) ---- */
  const hasBatch = () => typeof Batch !== 'undefined';
  const batchPopup = $('batchPopup');
  let batchFocus = null;

  const fillBatch = () => {
    const b = hasBatch() ? Batch.current() : null;
    $('batchStrip').hidden = !b;
    $('deliveryField').value = hasBatch() && Batch.all().length ? Batch.assign().text : '';
    if (!b) return null;
    $('batchStripText').innerHTML = b.closed
      ? 'Orders for the current batch have closed. <strong>New orders join the next batch.</strong>'
      : `Next delivery: <strong>${b.dateText}</strong>${b.closesText ? ` · Order by ${Batch.format(b.closes, false)}` : ''}`;
    $('batchKicker').textContent = b.closed ? 'Delivery update' : 'Next delivery';
    $('batchTitle').textContent = b.closed ? 'This batch is now closed' : b.dateText;
    $('batchText').textContent = b.closed
      ? (b.hasOpen && b.closesText
          ? `Orders for the ${b.dateText} delivery closed on ${b.closesText}. You can still order: your order joins the next delivery batch and we will message you the delivery date on WhatsApp.`
          : 'Orders for our last delivery batch have closed. You can still order: your order joins the next batch and we will message you the delivery date on WhatsApp.')
      : 'We deliver in batches: every order placed now is delivered together on this date.';
    const facts = [];
    if (!b.closed && b.note) facts.push(['fa-regular fa-clock', b.note]);
    if (!b.closed && b.closesText) facts.push(['fa-regular fa-calendar-xmark', `Orders close ${b.closesText}`]);
    facts.push(['fa-solid fa-location-dot', 'Pick up at UNILAG or Charity Pavilion, or choose home delivery']);
    $('batchFacts').innerHTML = facts.map(([icon, text]) => `<li><i class="${icon}" aria-hidden="true"></i><span></span></li>`).join('');
    [...$('batchFacts').children].forEach((li, i) => { li.querySelector('span').textContent = facts[i][1]; });
    return b;
  };

  const openBatch = () => {
    if (!fillBatch()) return;
    batchFocus = document.activeElement;
    batchPopup.hidden = false;
    requestAnimationFrame(() => batchPopup.classList.add('is-open'));
    document.body.classList.add('viewer-open');
    $('batchOk').focus({ preventScroll: true });
  };
  const closeBatch = () => {
    if (batchPopup.hidden) return;
    batchPopup.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
    setTimeout(() => { batchPopup.hidden = true; }, 250);
    if (batchFocus && batchFocus !== document.body) batchFocus.focus({ preventScroll: true });
  };
  ['batchOk', 'batchClose'].forEach(id => $(id).addEventListener('click', closeBatch));
  batchPopup.addEventListener('click', e => { if (e.target === batchPopup) closeBatch(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeBatch(); });
  $('batchStrip').addEventListener('click', openBatch);
  if (hasBatch()) Batch.onChange(fillBatch);
  setTimeout(openBatch, 350);   // pops up every time the order page opens

  /* ---- payment (bank transfer) ---- */
  const pay = {
    overlay: $('payment'), step: $('payStep'), done: $('payDone'), confirm: $('payConfirm'),
    message: $('payMessage'), close: $('payClose'), back: $('payBack'), finish: $('payFinish')
  };
  let reference = '';
  let lastFocus = null;

  /* Order reference: DG-MMDD-NNNN, e.g. DG-1120-4821
     MMDD = today's month and day, NNNN = random 4-digit number (1000–9999). */
  const newReference = () => {
    const now = new Date();
    const mmdd = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    let n;
    if (window.crypto && crypto.getRandomValues) n = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
    else n = 1000 + Math.floor(Math.random() * 9000);
    return `DG-${mmdd}-${n}`;
  };

  const openPayment = () => {
    reference = reference || newReference();
    $('payAmount').textContent = money.format(orderTotal());
    $('payAmountRaw').textContent = String(orderTotal());
    $('payBank').textContent = PAYMENT_ACCOUNT.bank;
    $('payAccName').textContent = PAYMENT_ACCOUNT.accountName;
    $('payAccNo').textContent = PAYMENT_ACCOUNT.accountNumber;
    $('payRef').textContent = reference;
    pay.step.hidden = false; pay.done.hidden = true;
    pay.message.className = 'form-message'; pay.message.textContent = '';
    lastFocus = document.activeElement;
    pay.overlay.hidden = false;
    requestAnimationFrame(() => pay.overlay.classList.add('is-open'));
    document.body.classList.add('viewer-open');
    pay.confirm.focus({ preventScroll: true });
  };

  const closePayment = () => {
    pay.overlay.classList.remove('is-open');
    document.body.classList.remove('viewer-open');
    setTimeout(() => { pay.overlay.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };

  [pay.close, pay.back, pay.finish].forEach(btn => btn.addEventListener('click', closePayment));
  pay.overlay.addEventListener('click', e => { if (e.target === pay.overlay && !pay.confirm.disabled) closePayment(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !pay.overlay.hidden && !pay.confirm.disabled) closePayment();
  });

  // copy buttons
  pay.overlay.addEventListener('click', async e => {
    const btn = e.target.closest('.pay-copy');
    if (!btn) return;
    const text = $(btn.dataset.copyFrom).textContent.trim();
    try { await navigator.clipboard.writeText(text); }
    catch (err) {                                   // older browsers
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t);
      t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove();
    }
    const html = btn.innerHTML;
    btn.classList.add('is-copied'); btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Copied';
    setTimeout(() => { btn.classList.remove('is-copied'); btn.innerHTML = html; }, 1600);
  });

  /* Step 1 — "Proceed to Payment": check everything, then show the transfer details */
  form.addEventListener('submit', e => {
    e.preventDefault();
    clearMessage();

    if (!cart.length) {
      showError('Please choose at least one product at the top of the page before continuing.');
      summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
      summary.classList.remove('needs-product'); void summary.offsetWidth; summary.classList.add('needs-product');
      return;
    }

    // phone: our own check; then the browser checks the other required fields
    // stock may have changed since the page opened
    if (hasStock()) {
      const short = cart.filter(l => l.qty > Stock.left(find(l.id), l.type));
      if (short.length) {
        cart = cart.filter(l => Stock.left(find(l.id), l.type) > 0).map(l => ({ ...l, qty: Math.min(l.qty, maxFor(l)) }));
        render(); drawOptions();
        showError(`Sorry, stock changed: ${short.map(l => find(l.id).name).join(', ')} ${short.length > 1 ? 'were' : 'was'} updated. Please check your order.`);
        summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    if (!checkPhone(true)) {
      showError('Please check your phone number.');
      phone.focus();
      return;
    }
    if (!form.querySelector('[name="order_type"]:checked')) orderTypeField.classList.add('has-error');
    if (!form.reportValidity()) return;
    phone.value = normalisePhone(phone.value);   // send it in one clean format, e.g. 08012345678

    openPayment();
  });

  /* Step 2 — "I have made payment": this is what actually sends the order */
  pay.confirm.addEventListener('click', async () => {
    pay.message.className = 'form-message'; pay.message.textContent = '';

    const key = form.querySelector('[name="access_key"]').value.trim();
    if (!key || key === 'YOUR_WEB3FORMS_ACCESS_KEY') {
      pay.message.className = 'form-message error';
      pay.message.textContent = 'Orders can’t be sent yet: add your Web3Forms access key in order.html.';
      return;
    }

    fillHiddenFields();
    $('paymentMethodField').value = `Bank transfer to ${PAYMENT_ACCOUNT.bank} ${PAYMENT_ACCOUNT.accountNumber} (customer says paid — please confirm)`;
    $('paymentRefField').value = reference;

    const idle = pay.confirm.innerHTML;
    pay.confirm.disabled = true;
    pay.confirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Sending your order…';

    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      const result = await response.json();
      if (!(response.ok && result.success)) throw new Error(result.message || 'Unable to submit order.');

      // WhatsApp message with the order, for the "Send my order on WhatsApp" button
      const waText = [
        'Hello Divine Grace Chips 👋, I just placed an order on your website.',
        '',
        `*Order ref:* ${reference}`,
        ...cart.map(line => {
          const p = find(line.id);
          return `• ${line.qty} × ${p.name}${hasType(p) ? ` (${line.type})` : ''} = ${money.format(lineTotal(line))}`;
        }),
        `*Total:* ${money.format(orderTotal())}`,
        '',
        `*Name:* ${$('name').value.trim()}`,
        `*Phone:* ${phone.value}`,
        `*Order type:* ${(form.querySelector('[name="order_type"]:checked') || {}).value || ''}`,
        ...($('deliveryField').value ? [`*Expected delivery:* ${$('deliveryField').value}`] : []),
        `*${locationSelect.value === 'Home Delivery' ? 'Delivery' : 'Pickup'}:* ${locationSelect.value}${locationSelect.value === 'Home Delivery' ? ` — ${address.value.trim()}` : ''}`,
        '',
        `I have paid by bank transfer to ${PAYMENT_ACCOUNT.bank} (${PAYMENT_ACCOUNT.accountNumber}) using the reference above.`
      ].join('\n');
      $('payWhatsApp').href = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(waText)}`;

      // success: show the confirmation, then clear the order and form
      const where = locationSelect.value === 'Home Delivery' ? 'your home address' : locationSelect.value;
      const batchNow = $('deliveryField').value;
      $('batchDone').hidden = !batchNow;
      $('batchDone').innerHTML = batchNow ? `<i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Expected delivery: <strong></strong>` : '';
      if (batchNow) $('batchDone').querySelector('strong').textContent = batchNow;
      $('payDoneText').textContent = `Thank you, ${$('name').value.trim().split(/\s+/)[0]}! We will confirm your payment and call you on ${phone.value} to arrange delivery to ${where}.`;
      $('payDoneRef').textContent = reference;
      pay.step.hidden = true; pay.done.hidden = false;
      pay.finish.focus({ preventScroll: true });

      // demo: hand the order to the admin in this browser (BACKEND: insert into orders)
      if (typeof ShopOrders !== 'undefined') {
        const slot = hasBatch() ? Batch.assign() : { batchId: null, awaiting: false };
        const now = new Date().toISOString();
        ShopOrders.add({
          id: 'w' + Date.now().toString(36), ref: reference, createdAt: now,
          customer: { name: $('name').value.trim(), phone: phone.value, email: ($('email').value || '').trim() },
          orderType: (form.querySelector('[name="order_type"]:checked') || {}).value || '',
          location: locationSelect.value, address: address.value.trim(), review: ($('review').value || '').trim(),
          items: cart.map(line => { const p = find(line.id); return { productId: p.id, name: p.name, type: line.type, qty: line.qty, price: p.price }; }),
          total: orderTotal(), status: 'pending', paymentRef: reference,
          batchId: slot.batchId, awaitingBatch: !!slot.awaiting,
          history: [{ status: 'pending', at: now }]
        });
      }
      if (hasStock()) Stock.take(cart, products);   // packs leave limited stock
      form.reset();
      syncLocation();
      cart = [];
      drawOptions();
      reference = '';
      history.replaceState(null, '', location.pathname);   // drop ?product= from the address
      render();
      message.className = 'form-message success';
      message.textContent = 'Order received — thank you! We will contact you shortly.';
    } catch (err) {
      pay.message.className = 'form-message error';
      pay.message.textContent = 'We could not send your order. Please check your connection and tap the button again.';
    } finally {
      pay.confirm.disabled = false;
      pay.confirm.innerHTML = idle;
    }
  });

  // stock changed in another tab (e.g. the admin): refresh the lists
  if (hasStock()) Stock.onChange(() => {
    cart = cart.filter(l => Stock.left(find(l.id), l.type) > 0).map(l => ({ ...l, qty: Math.min(l.qty, maxFor(l)) }));
    drawOptions(); render();
  });

  render();
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
      <div class="pv-slide${/\.(png|webp)$/i.test(src) ? ' is-cutout' : ''}" role="group" aria-label="Photo ${i + 1} of ${photos.length}">
        <img src="${src}" alt="${product.name}${i ? ` — photo ${i + 1}` : ''}" draggable="false">
      </div>`).join('');
    thumbs.innerHTML = single ? '' : photos.map((src, i) => `
      <button type="button" class="pv-thumb${/\.(png|webp)$/i.test(src) ? ' is-cutout' : ''}" aria-label="Show photo ${i + 1}">
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
    if (!/potato/i.test(product.name)) {
      specs.push(['Ingredients', 'Plantain, vegetable oil, chilli pepper, salt']);   // from the pack label
      const types = hasStock() ? Stock.orderableTypes(product) : ['Ripe', 'Unripe'];
      specs.push(['Plantain', types.length === 2 ? 'Ripe or unripe — choose when ordering' : types.length ? `${types[0]} only right now` : '—']);
    }
    if (hasStock()) {
      const badge = Stock.label(product);
      specs.unshift(['Availability', Stock.soldOut(product) ? 'Sold out' : badge && /left/.test(badge.text) ? badge.text.split(' · ')[0] : 'In stock']);
    }
    const soldOut = hasStock() && Stock.soldOut(product);
    const orderBtn = $('.pv-order');
    orderBtn.classList.toggle('is-disabled', soldOut);
    orderBtn.classList.toggle('btn-primary', !soldOut);
    orderBtn.classList.toggle('btn-light', soldOut);
    if (soldOut) { orderBtn.removeAttribute('href'); orderBtn.setAttribute('aria-disabled', 'true'); orderBtn.innerHTML = '<i class="fa-solid fa-ban" aria-hidden="true"></i> Sold out'; }
    else { orderBtn.removeAttribute('aria-disabled'); orderBtn.innerHTML = 'Order this pack <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>'; }
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

  // listen on the page, so cards redrawn after a stock change still open
  document.addEventListener('click', e => {
    const trigger = e.target.closest('.image-viewer-trigger');
    if (!trigger) return;
    const product = products.find(p => p.id === trigger.dataset.product);
    if (product) open(product, trigger);
  });

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
  setupCollage();
  setupReviewsCarousel()
  setupBottomNav();
  setupDelivery();
  setupBadgeRotation();
  setupCounters();
  setupProductImageViewer();
  setupNavActiveOnClick();
  document.querySelectorAll('#year').forEach(el => el.textContent = new Date().getFullYear());
});
