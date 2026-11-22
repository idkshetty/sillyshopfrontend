# Historical invoice/file-organization review — 21 October 2026

**Superseded deployment notes:** The backend has since been converted to a standalone Node service for Render/local development. See RENDER_MIGRATION_REVIEW.md and BACKEND_SETUP.md for current instructions.

Project watermark: Vishnu Shetty | Silly Sensei

## Delivered

- Owner/admin invoice callable reads verified server-side sales in a transaction.
- Paid/refunded orders expose invoice download in customer history and admin orders.
- Self-contained HTML invoices include items, delivery, paid amount, verified refunds, stable reference, test designation and print-to-PDF instructions.
- Admin sales CSV follows the current India-date and live/test filters, preserves INR precision, escapes quotes/newlines and neutralizes spreadsheet formula prefixes.
- Static hosting and local development serve only `frontend/`.
- Backend has its own deployment configuration and README; existing Razorpay/Resend secret handling remains server-side.
- Source/tooling watermark comments stay outside the public frontend.
- Documentation and original SCSS have dedicated folders. Original artwork, vendor licenses and old-link redirects remain.
- Generated historical screenshots and unlocked logs were removed.

## Validation

- `npm test`: 29 tests passed.
- `npm run check`: application, backend and tooling syntax passed.
- `node scripts/smoke.mjs`: public assets served successfully and private backend/docs/test/package paths were inaccessible. The loopback smoke check required execution outside the restricted sandbox.
- Frontend and test relative module imports resolve after the move.
- Emulator integration coverage now includes unpaid invoice rejection, anonymous/non-owner rejection, owner/admin success, and refunded invoices.
- Emulator execution could not be completed in this session: the Firebase CLI reported that Firestore emulator port 8080 was already occupied. Run the documented emulator suites on a configured development machine before deployment.

## Remaining operational steps and limits

- Deploy `getInvoice`, configure App Check, and set real provider secrets before using the production integrations. No cloud resources were deployed and no real emails/payments were sent.
- Invoice files are HTML, with browser Print → Save as PDF. Direct PDF generation and a GST tax-invoice workflow are not included.
- CSV exports use the currently loaded sales snapshot. Refresh for recent changes. Sales loading remains unpaginated, as in the existing dashboard.
- This backend independently hosts on Firebase Cloud Functions; arbitrary server hosting requires adapting its callable/event runtime.
- A pre-existing local server occupies port 4173. Restart it to pick up the new public directory, or set `PORT` to another free port.
- Two historical logs, `test-results/server.log` and `test-results/server-error.log`, were locked by an existing process and retained.
- Visual browser QA and live-provider end-to-end verification were not completed.
- Suggested future features are documented separately and were not implemented.
