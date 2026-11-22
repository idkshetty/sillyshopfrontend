# Project guide

Project watermark: Vishnu Shetty | Silly Sensei

The root README describes the folder layout and features. [BACKEND_SETUP.md](BACKEND_SETUP.md) is the current operational guide. Historical review material under legacy/ is not a deployment guide.

Publish only frontend/. The private backend is independently deployable on Render or locally. In the main project maintain modular backend sources, then generate payment.js with `npm --prefix backend run build`. The deploy folder contains the bundled payment.js, migration utility, package files, environment example and documentation; index.js simply launches payment.js. npm dependencies are still required. Existing .env values are preserved during updates.

Realtime Database stores public content/product projections and customer-facing nonfinancial data. Firestore provides transaction boundaries for orders, stock and verified sales and durable email/transfer queues. Public product changes use listeners rather than recurring catalogue polling; projections can briefly lag the canonical stock. Server checkout and quote validation always use canonical stock/prices. Run one API instance for the projection worker.

The migration utility copies missing RTDB nodes without deleting source data. Keep backups and coordinate the frontend/API/rule cutover. Old Firestore clients are intentionally blocked by the new rules. Legacy Storage files are not deleted or downloaded automatically.

## Suggested next features — not added

1. Shipment tracking with courier links and customer delivery updates.
2. Expiring stock reservations with gateway reconciliation before release.
3. Low-stock alerts and a complete inventory adjustment history.
4. A refund approval queue with settlement reconciliation.
5. Wishlist and opt-in back-in-stock notifications.

Shipment tracking and safe reservation expiry would be the most useful next additions for this quote-based workflow. None were implemented as part of this request.
