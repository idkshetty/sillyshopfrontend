# Silly Sensei shop

Static storefront and admin UI, with a separate Node 22 backend for Render or local development. No Firebase Cloud Functions or subscriptions. The frontend API URL is configured for https://sillyshop.onrender.com in frontend/backend-config.js.

## Run

```powershell
npm ci
npm start
```

Open http://localhost:4173/shop.html. In a second terminal configure backend/.env from backend/.env.example, then run `npm --prefix backend ci` and `npm --prefix backend start`. The separate C:\vscodee\shopbackend deployment runs `node payment.js` after installing dependencies. See [backend setup](docs/BACKEND_SETUP.md) for the complete configuration and migration steps.

## Organization

| Path | Purpose |
| --- | --- |
| frontend/ | Only publicly hosted files: storefront/admin modules, CSS and assets |
| backend/ | Editable server modules and bundled payment.js; private Firebase, Razorpay and email logic |
| docs/ | Setup, review, architecture and operational notes |
| source/styles/ | Original editable SCSS |
| scripts/ | Static development server, syntax checks, smoke checks and asset utilities |
| tests/ | Unit, database emulator and UI component fixtures |
| firestore.rules / database.rules.json | Current browser access rules |
| firestore.indexes.json | Order-history index and image index exemptions |

Watermark comments identify Vishnu Shetty | Silly Sensei in backend/tooling source only. They are not added to the rendered frontend or invoice. Original artwork, third-party licenses and old-link redirect pages are retained.

## Data and security

Firebase Authentication signs users in. Realtime Database serves public content, settings and product projections, and stores customer profiles, private reference images and label settings. Firestore retains canonical stock, orders, verified sales, payment mappings, audit/rate records, transient reference transfers and the email outbox so related state changes are atomic. Browser Firestore access is denied; private reads and all writes go through authenticated API handlers.

Admins manage Products, Collections, Orders & requests, Sales & revenue, Storefront editor, Banners & reviews, Label template, Contact and policy tabs. Existing verified admin emails are retained; ADMIN_UIDS can add this project's users. The backend remains the authority on permissions, prices, stock and payment state. Updating a product requires its original version, preventing a stale editor from overwriting stock changes.

Customers sign in before checkout, submit at most five distinct products with a confirmed delivery map pin, and pay the verified artwork total after discounts through Razorpay at checkout. Checkout reserves the purchased stock atomically; shipping is confirmed by the studio and collected as a separate payment later. `PAYMENT_PREVIEW_ENABLED=true` shows a clearly labeled animation preview without creating an order or payment; set it to `false` for Razorpay Test Mode on localhost. Customers can optionally save an address, view paginated order history and request cancellation. The owner or admin alone can access private order references and invoices. Captures are verified server-side; duplicate notifications cannot create duplicate sales. Paid cancellations flag required refunds; refund execution remains in Razorpay Dashboard. See [Razorpay setup](docs/RAZORPAY_SETUP.md).

## Downloads and maps

Paid/refunded orders offer downloadable PDF payment invoices with responsive layout and current verified refund totals. They do not include a GST tax breakdown. Admin sales CSV exports the current date/environment selection and escapes spreadsheet formula prefixes. It does not export customer addresses or emails. Sales load is capped at 10,000 records; larger stores need a server-side paginated export.

Delivery maps support mouse-wheel/trackpad zoom, two-finger touch pinch, keyboard navigation, zoom buttons and draggable pins. Address changes require reconfirmation. Search uses Photon and map tiles use OpenStreetMap; deployment at higher traffic needs suitable provider capacity. Printed map links/QR codes open Google Maps without a paid Maps API key.

## Images and loading

Page loading uses layout-matched skeletons from `frontend/skeletons.js` and `frontend/skeletons.css`. The first load and each route change show the skeleton for at least one second, configured by `MIN_PAGE_LOADING_MS` in `frontend/page-loading.js`. Data loads during that interval; background updates do not restart it. Replace placeholders with content, an empty state, or an error when loading settles; never show empty results while data is still loading. Skeleton shapes are hidden from assistive technology, with a single loading status, and shimmer respects reduced-motion preferences.

Uploads are resized/re-encoded to bounded raster images, at most 100,000 data-URL characters each. Categories load eagerly with dimensions and asynchronous decoding. Public content is cached locally for up to one day and refreshed from RTDB; private data is never stored in that cache. Eight product images, seven review images and up to three private references per product are supported. Base64 increases transfer size; a first network load under one second cannot be guaranteed. Existing remote Storage reference images require re-upload/conversion during migration.

## Email

Gmail uses GMAIL_USER and GMAIL_APP_PASSWORD with EMAIL_ENABLED=true. False disables new events and pauses queued sends after a restart. Emails go to verified Firebase account addresses when order/payment/refund status changes. Ambiguous SMTP sends enter manual review to avoid blind duplicate sends. Render free blocks Gmail SMTP ports; use a capable paid service or the optional Resend HTTPS provider. See the [new environment template](backend/.env.example).

## Validation

```powershell
npm run check
npm test
npm --prefix backend test
npm run test:smoke
npx firebase emulators:exec --only firestore,database --config firebase.test.json --project demo-silly-rtdb "node --test tests/firestore.test.mjs tests/backend-emulator.test.mjs tests/database.test.mjs tests/catalog-emulator.test.mjs"
```

Emulator tests use isolated demo projects and mocked payment/email providers. No production data is cleared and no real money or email is sent. Java is required for Firebase emulators. After changing server source run `npm --prefix backend run build` to refresh deployable bundles. See [final review](docs/FINAL_REVIEW.md), [production readiness](docs/PRODUCTION_READINESS.md) and [project guide](docs/PROJECT_GUIDE.md).
