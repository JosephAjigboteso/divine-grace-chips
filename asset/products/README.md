# Product photos

Each product has its own folder here, named after the product's `id` in `script.js`:

| Folder | Product |
|---|---|
| `ziploc/` | Ziploc (₦1,000) |
| `refill-2000/` | Refill Pack (₦2,000) |
| `plantain-dozen/` | Plantain Chips — Dozen (₦3,000) |
| `potato-dozen/` | Potato Chips — Dozen (₦3,000) |
| `small-jar/` | Small Jar (₦3,500) |
| `refill-4000/` | Refill Pack (₦4,000) |
| `big-jar/` | Big Jar (₦5,500) |
| `refill-6000/` | Refill Pack (₦6,000) |
| `_placeholder/` | Shared stand-in photos (see below) |

## Adding photos to a product

1. Put the photos in the product's folder and number them in the order you want them in the slider:
   `1.png`, `2.jpg`, `3.jpg` …
2. Open `script.js`, find the product in `const products = [ … ]` and list the files:

   ```js
   { id: 'big-jar', … photos: ['1.png', '2.jpg', '3.jpg'], … }
   ```

That's it. The product card, the product details slider and the order page all update automatically.

- **Photo 1 is the main photo.** It is shown on the product card, on the order page and first in the slider.
- **Transparent PNGs** (pack cut out, no background) are shown whole on a white background. Use this for the main photo.
- **JPGs** fill the whole slider frame, so they suit close-ups, lifestyle shots or photos with a real background.

## Placeholders

While a product has fewer than 3 photos, the slider is topped up with the shared photos in `_placeholder/`
(studio range shot, outdoor range shot, picnic photo). They disappear automatically as you add real photos.
To switch them off for one product, add `placeholders: false` to it in `script.js`.

## Photo tips

- About **1200–1600 px** on the longest side is plenty. Bigger files only make the page slower.
- Keep JPGs under about **400 KB** (export at roughly 80% quality).
- Shoot on a plain light background in good daylight, and keep the label readable.
- Use lowercase file names without spaces, e.g. `3.jpg`, not `Big Jar Photo 3.JPG`.
