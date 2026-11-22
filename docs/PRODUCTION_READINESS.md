# Production readiness

Project watermark: Vishnu Shetty | Silly Sensei

The implementation and local automated checks are prepared; production deployment and provider checks still need verification. The newly supplied Firebase configuration passed read-only Firestore and RTDB connectivity checks. The frontend points to https://sillyshop.onrender.com; live payments, email and the deployment cutover still need verification.

## Configuration still required

- Keep the configured shopatsillysensei inline service account private. It now connects successfully; it takes priority over the old unused GOOGLE_APPLICATION_CREDENTIALS path.
- The supplied RTDB URL is configured in the public frontend and environment example. Confirm Google Auth authorized frontend domains and administrator assignments.
- Legacy data dry run/migration, coordinated current rules/indexes/API/frontend deployment.
- Production STORE_URL and extra frontend origins. The frontend API URL is already configured as https://sillyshop.onrender.com.
- PAYMENT_PREVIEW_ENABLED defaults to false. Set it to true only while you want visitors to see simulated payment outcomes; with false and Test Mode credentials, localhost can run actual Razorpay test checkout. It is separate from the real Razorpay PAYMENTS_ENABLED switch.
- Registered App Check public site key and enforcement for production.
- Razorpay keys, distinct webhook secret, capture configuration and webhook registration; test before live mode.
- Gmail App Password and SMTP-capable hosting if enabling Gmail. Render free blocks SMTP and sleeps on idle; email/projection processing needs a running process. Optional Resend HTTPS remains available.
- Final business/contact/policy wording and seller/tax information where applicable. Current downloads are payment records, not GST tax invoices.

## Safeguards implemented and reviewed

Revoked-token checks, owner/admin authorization, exact CORS origins, production App Check, secret-free public configuration, body limits, sensitive-write throttling, safe image/ID validation, optimistic product edits, server-priced quotes, transactional stock reservation/release, stable checkout IDs, verified gateway signatures and captured amounts, duplicate payment handling, private invoices, CSV formula neutralization and source-only watermark comments.

Status events commit with the order mutation. Gmail ambiguous sends require manual review rather than blind retries. A crash between Firestore and RTDB transfer is retried from durable reference-transfer records. Transfer images are excluded from Firestore indexing. Firestore browser access is denied and RTDB browser writes are denied.

## Practical limits and operations

- Read-only Admin access to both live databases was verified. Actual browser authorization after rule deployment, email delivery, webhooks and payment capture still require end-to-end testing; /health is process liveness only.
- Use one API instance for catalogue/reference projection. Keep dependencies updated and monitor logs, paymentAlerts and mailOutbox/manual_review. SMTP has no exactly-once guarantee.
- Refund approval flags required action; execute refunds in Razorpay Dashboard and let verified webhook data reconcile totals. Stock reservations do not yet expire automatically.
- Product projection and a cached public catalogue can briefly show stale stock. Checkout/quotes revalidate server-side. First-load category latency depends on connection, database location and image size; no universal sub-second claim is made.
- Admin requests show the most recent 100; catalogue listing caps at 1,000; sales exports support up to 10,000 loaded sales. Larger datasets need paginated admin tools.
- Old remote Storage image references need conversion/re-upload. Migration does not copy image bytes or delete source documents.
- Back up both databases, define retention for orders/audits/emails and review rate-limit TTL expiry in Firebase before scale. The backend never logs secrets intentionally.

Follow the cutover and test steps in [BACKEND_SETUP.md](BACKEND_SETUP.md).
