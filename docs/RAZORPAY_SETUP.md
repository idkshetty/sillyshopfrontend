# Razorpay checkout setup

The shop charges the artwork total at checkout. The studio confirms shipping later, and the customer pays that charge from My account. A free shipping code makes the later shipping charge zero. Razorpay orders are created by the backend, and only captured payments with a matching amount, order ID and verified signature become sales.

## Test Mode

1. In the Razorpay Dashboard, switch to **Test Mode** and open **Account & Settings → API Keys**. Generate a test Key ID and Key Secret. Store the secret privately; never add it to `frontend/` or commit it.
2. In `backend/.env` (or your private Render environment), set:

   ```dotenv
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=your-test-key-secret
   WEBHOOK_SECRET=your-separate-test-webhook-secret
   PAYMENTS_ENABLED=true
   PAYMENT_PREVIEW_ENABLED=false
   ```

   Keep the existing Firebase credentials, `FIREBASE_DB_URL`, and `STORE_URL`. The webhook secret is a value you choose when creating the webhook; it is separate from the API Key Secret. Do not use `RAZORPAY_WEBHOOK_SECRET` as well as `WEBHOOK_SECRET` unless they are the same value.
3. Set automatic payment capture in the Razorpay Dashboard. The shop confirms an order only after Razorpay reports the payment as **captured**.
4. Restart the backend after changing its environment. Run the frontend with `npm start`; `http://localhost:4173/shop.html` proxies `/api/` and `/config` to the backend on port 3000. Test Mode works on localhost when preview mode is off.
5. In the Test Mode Dashboard, create a webhook at `https://YOUR-PUBLIC-BACKEND/webhooks/razorpay` with the same `WEBHOOK_SECRET`. Subscribe to `payment.captured`, `order.paid`, and `refund.processed`. Localhost is not a public webhook URL; use a public staging backend or a supported tunnel for webhook testing. The checkout handler also verifies the payment immediately, so a local test can work before webhook delivery is configured.
6. Sign in with a verified Google account, add an in-stock product, confirm a delivery map pin, and make a test payment. Check **My account** for captured status and the invoice. Test both a successful and failed payment; retrying must use the same order without creating a second sale. Then confirm a shipping charge as an admin and test its separate payment.

`GET /config` reports `paymentsEnabled`, `paymentPreviewEnabled`, and `paymentMode` without exposing secrets. `paymentMode` should be `test` during testing. Do not mark a Razorpay test payment as an offline payment.

## Live Mode

After the complete Test Mode checkout, webhook, shipping and refund flow passes, switch the Razorpay Dashboard to **Live Mode**. Generate a separate live Key ID and Key Secret, create a **live** webhook with its own secret and the same events, and put the live credentials in the production backend environment. Keep `PAYMENTS_ENABLED=true` and `PAYMENT_PREVIEW_ENABLED=false`; restart or redeploy the backend. `GET /config` should show `paymentMode: "live"`.

Live Mode key generation may require verified website details and account activation. Verify the production site URL, Firebase authorized domain, App Check, exact CORS origin, automatic capture, and a real low-value transaction with refund before inviting customers. Test and live transactions are recorded separately in sales. Never expose Key Secrets or service-account JSON in the browser or chat.

Official references: [API keys](https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/), [web checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhooks](https://razorpay.com/docs/webhooks/setup-edit-payments/), [capture settings](https://razorpay.com/docs/payments/payments/capture-settings/).
