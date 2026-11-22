# Backend connection troubleshooting

Current setup: Node 22 locally or Render, with Firebase Auth and Realtime Database plus transactional Firestore. No Cloud Functions endpoints.

- **401 Unauthorized:** the original configuration points at a missing Admin credential file; the example JSON also names a different Firebase project. Use a real account from shopatsillysensei, set FIREBASE_DB_URL, restart the backend and sign in again. The new server validates configuration at startup. Tokens refresh once on 401; authentication is never bypassed.
- **403:** token verified but the account is not permitted, the origin is not allowed, or App Check is missing/invalid. ADMIN_UIDS must contain this project's UID. ENFORCE_APP_CHECK=false is intended for local setup; production App Check needs a registered public site key.
- **CORS:** loopback origins on all ports are included. Add exact extra frontend origins to ALLOWED_ORIGINS. A stale cloudfunctions.net request means the browser still has old frontend modules. Serve frontend/ and refresh.
- **node exits immediately:** run Node 22 and `node payment.js`. Missing credentials/required email/payment settings intentionally stop startup with a useful error. A valid configuration prints the listening port. /health tests process liveness, not Firebase permissions or mail delivery.
- **ERR_BLOCKED_BY_CLIENT:** often a browser extension/privacy filter. Compare a clean browser profile. The current frontend no longer imports the Firestore client/listen channel. Old tabs can still show old requests until refreshed.
- **COOP popup warnings:** these originate in Google's sign-in popup and do not explain the order API's 401. This project does not set restrictive COOP headers. If your host adds Cross-Origin-Opener-Policy: same-origin, configure the host for the sign-in flow (same-origin-allow-popups). Do not disable token verification or suppress console errors to hide them.
- **Unused preload warnings:** unconditional logo/font preloads were removed. A generic <URL> message cannot identify another remaining resource; check the actual Network URL and any preload headers injected by your host.
- **No email:** EMAIL_ENABLED must be true, provider credentials and STORE_URL set, and backend continuously running. Gmail needs an App Password and verified customer account email. Render free blocks SMTP. Inspect mailOutbox for pending/manual_review; do not blindly resend an ambiguous Gmail send.
- **Public content empty:** configure the exact RTDB URL and migrate legacy Firestore data with migrate-data.js after a dry run. Deploy the new rules and frontend/API together.

Full steps: [BACKEND_SETUP.md](BACKEND_SETUP.md).

For loadCustomerRequests 500 and status-change 409, see [HISTORY_STATUS_FIX.md](HISTORY_STATUS_FIX.md). History has a bounded owner-only fallback while its composite index is missing; invalid status choices are now excluded from the admin dropdown.
