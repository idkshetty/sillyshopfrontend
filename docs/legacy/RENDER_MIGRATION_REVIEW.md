# Render/local backend review — 21 October 2026

Project watermark: Vishnu Shetty | Silly Sensei

The backend is now a standalone Node HTTP service. `node index.js` and `npm start` keep the service running. Firebase Auth/Firestore remain; the Cloud Functions runtime dependency, trigger wrappers, frontend callable SDK, and function deployment configuration were removed.

## Delivered

- HTTP endpoints under `/api/`, raw-body Razorpay webhook at `/webhooks/razorpay`, health endpoint at `/health`.
- Local default port 3000; Render PORT and 0.0.0.0 binding, startup scripts, optional Blueprint and standalone setup guide.
- Exact production CORS origins, local loopback origins on development ports, configurable additional frontend origins.
- Verified Firebase ID tokens (including revoked-token checks), existing owner/admin authorization and per-user throttling, optional local App Check with production default enforcement.
- Public frontend API configuration: localhost automatically uses port 3000; production URL remains blank as requested.
- Bounded JSON requests, protected error responses, no authentication bypass for browser API calls.
- Order transitions and email outbox events commit atomically. The API worker processes durable queued email with leases, retries and provider idempotency.
- Customer cancellations moved into the API; Firestore rules prevent clients from changing status directly.
- Separate backend package has its own tests, lockfile, environment example and ignore rules.

## Validation

- 30 application/unit tests passed.
- 4 standalone backend tests passed: HTTP/CORS/auth/App Check/raw webhook behavior, atomic queue generation, retry/duplicate suppression, and starting the real `node index.js` entry point.
- 2 emulator integration tests passed against `demo-silly-render`: quote, payment, cancellation, refund, private invoices and persisted email queue.
- 19 Firestore security-rule tests passed against `demo-silly-rules`, including rejected direct status changes and private financial/outbox data.
- JavaScript syntax checks passed.
- Provider calls were mocked; no real payments or emails were sent.

## Deployment requirements and limits

- Configure private Firebase Admin credentials in local `.env` or Render Environment/Secret Files.
- Supply the actual Render URL in the frontend before production use.
- Deploy the updated Firestore rules from the main shop repository.
- Configure App Check, Razorpay webhook/credentials and Resend credentials before enabling those features.
- Resend is still the email transport; Gmail SMTP has not been implemented.
- Initial checkout creation does not send a receipt. Subsequent API status/payment/refund/ownership changes queue emails while enabled. Direct Firebase Console edits bypass the queue.
- A sleeping/stopped service delays queued email. Use an always-running service for prompt processing.
- Existing outbox records without the new scheduling field require manual reconciliation; old deployed email triggers, if any, must be disabled to prevent duplicate sends.
- No production deployment or cloud configuration was performed.
