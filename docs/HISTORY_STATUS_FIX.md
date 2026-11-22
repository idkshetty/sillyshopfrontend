# Customer history and status fixes — 21 October 2026

Project watermark: Vishnu Shetty | Silly Sensei

## Confirmed causes

The live loadCustomerRequests query failed with Firestore code 9: missing composite index on checkoutRequests (uid ascending, createdAt descending, document ID descending). The emulator does not enforce composite indexes, so earlier emulator runs did not reveal the deployment gap.

The admin status dropdown offered every status regardless of current state, payment or reserved inventory. The backend correctly rejects invalid transitions with 409. Current sampled orders were unpaid, including a cancelled request, so fulfilment/reopening remains prohibited. No production order status was changed during diagnosis.

## Fixes

History tries the indexed query first. Only a missing/building-index error activates a bounded fallback that queries the signed-in customer's UID, sorts newest first and returns 20 records per page. It reads at most 501 owner records to enforce a 500-record fallback limit; larger histories receive an explicit temporary-unavailable message, never silently truncated results. Other Firestore errors are not swallowed. Cursors preserve timestamp seconds and nanoseconds to avoid duplicate/skipped records across equal or sub-millisecond timestamps. Existing millisecond cursors remain accepted.

Admin status options now share the server transition rules. Unpaid fulfilment and terminal-order reopening are unavailable. Cancellation uses its dedicated control for stock/refund handling; unquoted requests can also be cancelled by admins. Quote controls appear only in valid states. The UI reloads current server state after a status attempt, including conflicts. Server conflict messages explain missing payment, reserved stock or cancellation handling. Unexpected API errors log an operation path and error code without request bodies/tokens/customer details.

## Index deployment still recommended

The configured service account could read data but Firebase denied the attempt to create the index. No IAM permissions were changed. The fallback was verified against existing live customer histories using read-only checks. An owner/editor with index-management permission should deploy the existing index definition:

```powershell
# From C:\vscodee\sillyshop, using a Firebase login with index-management permission:
npx firebase deploy --only firestore:indexes --project shopatsillysensei
```

This does not deploy browser rules or mutate order records. Wait until the index is ready; the primary query will then be used automatically. Alternatively create a collection-scope checkoutRequests index in Firebase Console with uid Ascending and createdAt Descending (document ID follows Descending). Do this before any customer's history exceeds 500 orders.

## Apply locally

The rebuilt payment.js is copied to C:\vscodee\shopbackend. Existing .env and private credentials are untouched. Stop the running backend with Ctrl+C, then run `node payment.js` (index.js remains a launcher). Refresh the frontend so the new order-workflow module and controls load.

Checks: 31 frontend/domain tests and 10 backend tests, including explicit missing-index fallback/owner isolation/precision/bounds tests; isolated emulator lifecycle/rules checks; live read-only history verification. No customer email or real payment was triggered.
