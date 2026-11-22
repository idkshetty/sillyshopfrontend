# Silly Sensei backend setup

Project watermark: Vishnu Shetty | Silly Sensei

The API runs on your computer or Render using Node 22. No Cloud Functions or subscriptions are used. `payment.js` is the self-contained application entry point; Firebase Admin and Nodemailer remain installed npm dependencies. In the main project, edit backend source modules and run `npm --prefix backend run build` to regenerate it.

## 1. Firebase and the 401 error

The frontend uses **shopatsillysensei**. The sample account for **sillysensei-b251b** is a different project and cannot verify this shop's users. The existing shopbackend .env also points GOOGLE_APPLICATION_CREDENTIALS at a missing file. The updated server fails at startup with a useful error instead of accepting requests with unusable configuration. Update: the owner has since supplied valid inline credentials and the RTDB URL; read-only access to both databases passed. Inline JSON takes precedence over the unused file path.

In Firebase Console, select shopatsillysensei, enable Authentication with Google, and download its original Admin service-account JSON from Project settings → Service accounts. Store it privately. Choose ONE:

- Local file: `GOOGLE_APPLICATION_CREDENTIALS=C:/private/shopatsillysensei-service-account.json`.
- Environment: `FIREBASE_SERVICE_ACCOUNT` containing the complete JSON. In a local .env wrap the single-line JSON in single quotes; preserve escaped `\n` in the private key. In Render paste the actual JSON value without surrounding shell quotes.

Set `FIREBASE_PROJECT_ID=shopatsillysensei`. Create Realtime Database if needed and copy its exact URL into `FIREBASE_DB_URL`; regional URLs vary, so do not invent it. Firestore remains required for atomic order/payment/stock operations. These Firebase settings are necessary in addition to Razorpay and email keys.

Optional `ADMIN_UIDS` is a comma-separated list of UIDs from this project. Existing verified admin emails and trusted admin custom claims also work. CORS permission alone never grants access; every private API call verifies the Firebase ID token including revocation. A customer cannot gain admin access by editing the browser.

## 2. Start locally

From C:\vscodee\shopbackend (or the main project's backend folder):

```powershell
npm ci --omit=dev
# Copy .env.example to .env only if you do not already have a .env.
node payment.js
```

The separate folder also has an index.js compatibility launcher, so `node index.js` works. The process prints its port and stays running. Open http://localhost:3000/health; this confirms HTTP liveness, not successful third-party delivery. GET /config exposes public Firebase project/database identifiers and the payment-preview on/off flag, never credentials.

Run `npm start` from C:\vscodee\sillyshop for the frontend at http://localhost:4173/shop.html. Loopback origins localhost, 127.0.0.1 and [::1] with any port are allowed. Additional origins belong in ALLOWED_ORIGINS as exact origins with no path/trailing slash. Firebase Authentication authorized domains are configured separately in Firebase Console.

After replacing credentials, restart the backend, refresh the frontend and sign in again. An expired token is refreshed and retried once automatically. Persistent 401 means authentication still failed; it is never bypassed. A valid non-admin receives 403 for administrative actions.

## 3. Existing data migration and rules

Back up your databases and stop old storefront/admin writes during the cutover. With real Firebase credentials and the RTDB URL configured, run these from the backend folder:

```powershell
node migrate-data.js
node migrate-data.js --apply
```

The first command reports candidate records only. The second copies missing RTDB paths, preserving existing target values and every Firestore source record. It copies public content/settings/products, customer profiles, label settings and private customization records. Legacy Storage object references are copied as references, not converted to image bytes; re-upload those images before retiring Storage. Existing orders, sales and stock remain in Firestore.

From the main project root, deploy rules and indexes to the intended project:

```powershell
npx firebase deploy --only "database,firestore:rules,firestore:indexes" --project shopatsillysensei
```

`database.rules.json`: publicStore is readable; customer profiles are readable only by the matching UID; private reference/settings nodes are not browser-readable. All browser writes are denied. `firestore.rules`: all browser reads and writes denied. The authenticated backend uses Admin SDK and explicitly validates every action. Deploy the new frontend/API together with these rules; old Firestore-based clients will no longer work. Keep legacy rule files only for reference, never deploy them as current rules.

## 4. Razorpay

Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and WEBHOOK_SECRET, then PAYMENTS_ENABLED=true. Start with test keys. Configure automatic capture in Razorpay. Register `https://YOUR-SERVICE.onrender.com/webhooks/razorpay` for payment.captured, order.paid and refund.processed with the same webhook signing secret. Local webhook tests require a secure reachable tunnel; localhost is not accessible to Razorpay.

Checkout charges the server-verified artwork total after discounts immediately and reserves the selected quantities in the same Firestore transaction that creates the request. Shipping is excluded from that first charge. The admin can later set a shipping charge from **Orders & requests**; the customer sees a separate shipping payment button in **My account**, and the server creates a distinct Razorpay order for that amount. A free shipping promo requires a zero shipping quote. Captured item and shipping payments are aggregated into one verified sale and invoice. The signed-in owner must complete Razorpay Checkout; the server verifies the HMAC and fetches each payment from Razorpay, checking captured state, exact amount, INR currency and the matching stored gateway order. Browser totals are not trusted. Duplicate callbacks/webhooks do not duplicate either charge. Refunds are performed through Razorpay Dashboard and reconciled by webhook; approving a cancellation flags the refund due but does not issue it automatically.

Set `PAYMENT_PREVIEW_ENABLED=true` to show a clearly labeled success/failure simulation on localhost or the live storefront. The preview does not contact Razorpay, create a request/order, or reserve stock; it only plays the matching result animation. Set it to `false` and enable payments to exercise Razorpay Test Mode on localhost. `PAYMENTS_ENABLED` is the separate switch for actual Razorpay orders and requires test/live credentials plus the webhook secret. See [RAZORPAY_SETUP.md](RAZORPAY_SETUP.md) for Test Mode and Live Mode steps.

For an offline payment already received (cash, UPI or bank transfer), an admin can open **Orders & requests → Record offline payment**, select the method and enter the receipt/transaction reference. This records the quoted amount as a manual sale, enables the customer's invoice, adds it to the offline/manual sales export, emails the customer if email is enabled, and writes an admin audit record. Do not use it as a payment test or before funds are received. A pending or recorded Razorpay payment cannot be replaced by a manual entry. **Mark unpaid** is available only for a manual entry before fulfilment advances; use it only if funds were never received or were returned. For a cancelled manually paid order, return funds through the original method, then record **Mark offline refund complete**. Manual records remain auditable and voided corrections are excluded from sales totals.

An ambiguous order-creation timeout is held for manual reconciliation in paymentSessions; do not delete it and blindly retry because a gateway order may already exist. Inspect Razorpay and the stored request/receipt before resolving it. Cancellation after capture is marked refund required. Test and live revenue stay separate.

## 5. Gmail and the switch

Enable Google Account 2-Step Verification, then create an App Password at https://myaccount.google.com/apppasswords. Set:

```dotenv
EMAIL_PROVIDER=gmail
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-generated-app-password
EMAIL_ENABLED=true
STORE_URL=https://your-frontend-domain/shop.html
```

Use an App Password, never the normal Gmail password. The backend sends from this Gmail account to the customer's **verified Firebase account email**, rather than an arbitrary checkout address. Request creation and changes to status/payment/refund state create queue events transactionally. Unchanged status does not generate another email.

Set EMAIL_ENABLED=false and restart to stop sending. While off, new changes create no events; existing pending events pause and resume after enabling. Already accepted mail cannot be recalled. There is no frontend switch exposing secrets. Gmail SMTP cannot guarantee exactly-once delivery: once sending may have started, ambiguous failures go to mailOutbox state manual_review rather than automatic resend. Inspect the Gmail Sent folder and provider result before deciding whether to send manually.

**Render free web services block outbound SMTP ports 465/587.** Use an SMTP-capable paid service for Gmail. Alternatively EMAIL_PROVIDER=resend uses HTTPS with RESEND_API_KEY and a verified EMAIL_FROM sender. The existing HTTPS provider supports idempotent retries. A continuously running service is required for timely email/projection workers; a sleeping free instance delays processing.

Google instructions: https://support.google.com/accounts/answer/185833
Render limits: https://render.com/docs/free

## 6. Render and production cutover

For a repository containing only the standalone backend folder: build `npm ci --omit=dev`, start `node payment.js`, health path `/health`, Node 22. For the full project, root directory is backend. Use **one API instance** for the projection worker. Render supplies PORT; bind is already 0.0.0.0. Supply private environment values in Render; never upload a filled .env to static hosting.

Set NODE_ENV=production, real STORE_URL and frontend origins. Register reCAPTCHA Enterprise App Check for the frontend domains and put its public site key in frontend/firebase-config.js before setting ENFORCE_APP_CHECK=true. Production defaults to enforcement unless explicitly configured; Auth is always required even if App Check is disabled locally.

The frontend API URL is configured as https://sillyshop.onrender.com in frontend/backend-config.js. If the Render service URL changes, update PRODUCTION_API_URL before publishing. Optionally set firebaseConfig.databaseURL to the same public RTDB URL so public content need not wait for backend /config. Publish ONLY frontend/. The default local server already enforces this boundary.

Before live payments: finish business/support/policy text, migrate and inspect existing data, deploy rules/indexes, authorize frontend domains in Firebase Auth, verify a real admin and customer login, run a test payment/refund/webhook flow, test Gmail once with an owned test account, and confirm customer-private data cannot be read by another account. Configure backups and monitor Render errors and mailOutbox/manual_review/paymentAlerts. No real charge, email, migration or deployment was performed by the automated checks.
