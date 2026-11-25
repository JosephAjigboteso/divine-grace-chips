# Divine Grace Chips — website

A static website (HTML, CSS, JavaScript; no build step) plus a front-end admin dashboard.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home page: hero, brand collage, why us, delivery tracker animation, reviews |
| `products.html` | Product catalogue; clicking a product opens its details and photo slider |
| `order.html` | Order page: order builder (ripe/unripe lines), customer form, bank-transfer payment step |
| `admin.html` | Admin dashboard: sign in, overview charts, orders, products (**sample data for now**) |

| File | What it does |
|---|---|
| `style.css` | All site styles (colours and fonts are set at the top) |
| `script.js` | Site behaviour, product list, payment account details |
| `admin.css`, `admin.js` | Admin dashboard styles and screens |
| `admin-data.js` | The admin **data layer**: the only place the dashboard reads or saves data |
| `stock.js` | Shared by shop and admin: product availability, **delivery batches** (open / close, the date and delivery locations customers see), and a demo inbox that passes shop orders to the admin |
| `asset/products/` | One folder of photos per product; see `asset/products/README.md` |
| `asset/icons/`, `asset/og-image.jpg` | Browser icon and the link-preview card shown on WhatsApp etc. |

## Before going live

- **Web3Forms key:** replace `YOUR_WEB3FORMS_ACCESS_KEY` in `order.html`.
- **Bank account:** replace the placeholder `PAYMENT_ACCOUNT` details in `script.js`.
- **Product weights:** the weights in `script.js` are placeholders.
- **WhatsApp number:** orders from "Send my order on WhatsApp" go to `BUSINESS_WHATSAPP` in `script.js`
  (currently 0815 725 5322 written as `2348157255322`).
- **Link preview image:** in the `<head>` of `index.html`, `products.html` and `order.html`, change
  `og:image` from `asset/og-image.jpg` to the full address once the site is live
  (e.g. `https://your-site.com/asset/og-image.jpg`). WhatsApp only shows the preview with a full address.
- **Admin:** `admin.html` uses a demo sign-in (`admin@divinegrace.ng` / `demo1234`) and sample orders saved
  in the browser only. Do not rely on it until it is connected to a backend (below).

## Admin dashboard → backend

The admin screens only talk to `AdminData` in `admin-data.js`. Each function there has a
`// BACKEND:` comment saying what it should become. To go live, replace each function body
with a real API call that returns the same data shape; the screens don't change.

Suggested backend: **Supabase** (hosted Postgres database + admin sign-in + photo storage),
usable straight from this static site.

| Table | Holds |
|---|---|
| `products` | name, category, price, weight, description, available |
| `product_images` | product photos, in order (Supabase Storage) |
| `orders` | customer, phone, order type, delivery location, address, review, total, payment reference, status |
| `order_items` | product, ripe/unripe, quantity, price at time of order |
| `order_status_history` | each status change with its time (feeds the delivery charts) |
| `stock` | per product: status (full / limited / out), ripe-unripe availability, packs left per type |
| `batches` | numbered delivery batches: expected date, order-closing date, note, show on/off, open/closed, pickup points (list) and home delivery on/off |

Each order stores its `batch_id`, or `awaiting_batch = true` when it was placed after a batch closed
(shown in the admin with a **New batch** tag). Sending that customer the date on WhatsApp moves the
order into the open batch and removes the tag. Opening a batch resets every product to Fully available.

`stock.js` works the same way: today it saves in the browser (so admin changes only reach the shop
in that same browser); with the backend, its load/save become calls to the `stock` table and every
customer sees the same availability.

Order status: `pending` (payment to confirm) → `confirmed` → `out` (out for delivery) → `delivered`, or `cancelled`.
Admin access should be enforced on the backend (Supabase Auth + row-level security), never in the browser.
