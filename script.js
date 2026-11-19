/* ---------- THEME MANAGEMENT ---------- */
function setupThemeToggle() {
  const toggle = document.querySelector('.theme-toggle');
  if (!toggle) return;

  const icon = toggle.querySelector('i');
  const STORAGE_KEY = 'dg-theme';

  const updateIcon = () => {
    const current = document.documentElement.getAttribute('data-theme');
    if (icon) {
      icon.className = current === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    toggle.setAttribute('aria-label', current === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  };

  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    sessionStorage.setItem(STORAGE_KEY, next);
    updateIcon();
  });

  updateIcon();
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
  { id: 'ziploc', name: 'Ziploc', price: 1000, group: 'sachet', image: 'asset/Ziploc.png', desc: 'A convenient, crunchy pack for a quick snack or little treat.' },
  { id: 'refill-2000', name: 'Refill Pack', price: 2000, group: 'sachet', image: 'asset/refill-white.png', desc: 'Light, crispy and satisfying — perfect to keep stocked.' },
  { id: 'plantain-dozen', name: 'Plantain Chips — Dozen', price: 3000, group: 'sachet', image: 'asset/refill-white.png', desc: 'A generous plantain option for sharing, events and resellers.' },
  { id: 'potato-dozen', name: 'Potato Chips — Dozen', price: 3000, group: 'sachet', image: 'asset/potato-white.png', desc: 'Crunchy potato chips for something a little different.' },
  { id: 'small-jar', name: 'Small Jar', price: 3500, group: 'jar', image: 'asset/small-jar-white.png', desc: 'A handy jar filled with crispy plantain goodness.' },
  { id: 'refill-4000', name: 'Refill Pack', price: 4000, group: 'jar', image: 'asset/refill-2white.png', desc: 'A larger refill for your jar or for sharing.' },
  { id: 'big-jar', name: 'Big Jar', price: 5500, group: 'jar', image: 'asset/Big-Jarwhite.png', desc: 'A generous jar for homes, offices, parties and serious snackers.' },
  { id: 'refill-6000', name: 'Refill Pack', price: 6000, group: 'jar', image: 'asset/Big-refill-white.png', desc: 'A large refill option for bigger orders and regular customers.' }
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
  if (!section || !stage) return;

  const items = Array.from(stage.querySelectorAll('.collage-item'));
  if (!items.length) return;

  /*
   * The old version intercepted wheel/touch events and temporarily locked
   * the document. That caused the vibration/stuck feeling, especially on
   * trackpads and mobile browsers.
   *
   * This version uses the browser's normal scroll position as the animation
   * driver. The section remains sticky visually, but scrolling is never
   * blocked.
   */
  let scatterOffsets = {};

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const recalcSpread = () => {
    const rect = stage.getBoundingClientRect();
    const isMobile = window.matchMedia('(max-width: 700px)').matches;

    /*
     * Keep the cards comfortably inside the viewport. Mobile uses a tighter
     * fan so all six products remain visible without colliding with the title.
     */
    const xReach = isMobile
      ? Math.min(rect.width * 0.36, 150)
      : Math.min(rect.width * 0.37, 360);

    const yReach = isMobile
      ? Math.min(rect.height * 0.27, 145)
      : Math.min(rect.height * 0.34, 250);

    const diagonalX = xReach * 0.92;
    const diagonalY = yReach * 0.86;

    scatterOffsets = {
      top:        { x: 0,              y: -yReach },
      topright:   { x: diagonalX,      y: -diagonalY },
      bottomright:{ x: diagonalX,      y: diagonalY },
      bottom:     { x: 0,              y: yReach },
      bottomleft: { x: -diagonalX,     y: diagonalY },
      topleft:    { x: -diagonalX,     y: -diagonalY }
    };
  };

  const applyProgress = (progress) => {
    const eased = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    if (title) {
      title.classList.toggle('is-visible', progress >= 0.42);
    }

    items.forEach((el) => {
      const dest = scatterOffsets[el.dataset.pos] || { x: 0, y: 0 };
      const tx = dest.x * eased;
      const ty = dest.y * eased;
      el.style.transform = `translate3d(calc(-50% + ${tx}px), calc(-50% + ${ty}px), 0)`;
    });
  };

  let ticking = false;

  const updateFromScroll = () => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      ticking = false;

      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp(-rect.top / travel, 0, 1);

      applyProgress(progress);
    });
  };

  const refresh = () => {
    recalcSpread();
    updateFromScroll();
  };

  requestAnimationFrame(refresh);
  window.addEventListener('scroll', updateFromScroll, { passive: true });
  window.addEventListener('resize', refresh);
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