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

## Pickleball tournaments

The **Tournaments** header button beside Pickleball opens `/tournaments`. Anyone
can follow teams, brackets and results. Signed-in players can register one doubles
team per event and withdraw before the draw starts. Team and player names are
public; contact phone numbers are visible only to the team captain and admins.

Admins manage events on the same page:

1. Choose **Create tournament**, enter the venue, future start time, capacity
   (2–32 teams) and points target (11, 15 or 21).
2. Edit the event or remove entries while registration is open. Registration
   closes at the start time, or when the admin starts the draw.
3. Choose **Generate draw & start** to randomly seed a single elimination bracket.
   Byes advance automatically. The draw and teams are then locked.
4. Assign courts/times and enter match scores. One game decides each match; the
   winner must reach the selected target and lead by at least two points.
   Saved results are final. Winners advance automatically, and the final result
   displays the champions.

Match schedules are informational and do not reserve courts in the separate
court booking system. Dates are entered and displayed in the viewer's local time.
Admins can cancel unfinished events; existing teams and results remain visible.
The page subscribes to live changes and refreshes every 15 seconds.

### Database installation

Apply the complete `drizzle/migrations/0008_pickleball_tournaments.sql` file **once**
after migrations `0000` through `0007`, before publishing the tournament frontend.
For this Lovable Cloud app, open the same project database where you successfully
ran the order-type migration: **More → Database → Manage → SQL editor**. Run the
file there. A separate Supabase project with only `cafe_orders` is not this app's
database.

The migration creates tournament tables, access policies, registration and admin
functions, and realtime subscriptions in one transaction. The browser cannot
write tournament tables directly; SQL functions enforce roles, capacity, draw
locking and scoring. Existing food orders and court bookings are preserved.

Check the installation with this read-only query:

```sql
SELECT to_regclass('public.pickleball_tournaments'),
       to_regclass('public.pickleball_teams'),
       to_regclass('public.pickleball_matches');
```

All three results should contain table names. Then publish the updated frontend,
sign in as an admin and create your first event.

### Local tournament checks

Use an **empty, disposable local PostgreSQL database** as a local superuser. The
script installs the earlier migrations and synthetic auth/storage fixtures, then
checks every field size from 2 to 32 teams, bracket completion, score validation,
registration limits, permissions, private contacts and cancellation:

```sh
createdb flavorfleet_tournament_test
psql -X -v ON_ERROR_STOP=1 -d flavorfleet_tournament_test -f scripts/test-tournaments.sql
dropdb flavorfleet_tournament_test
```

Run `npm test`, `npx tsc --noEmit` and `npm run build` for frontend checks.

## Delete a conversation from your inbox

Admins, riders and customers can use the trash button beside a conversation, or
in the open chat toolbar, then confirm **Delete for me**. This hides the entry
only for the signed-in account, including its unread badge. Other participants
keep their conversation and all messages remain stored. A new message restores
the conversation to the inbox; explicitly opening a chat with its contact/order
button restores it only for that account. Resolving a thread alone does not
restore it. Other sessions refresh their inbox within the existing 10-second poll.

Apply the complete `drizzle/migrations/0009_personal_inbox_deletion.sql` file
after earlier migrations, in the same **Lovable Cloud → Database →
Manage → SQL editor** used for the order and tournament updates. Apply SQL before
publishing the updated frontend. Existing conversation access, sender identity
checks and rider assignment rules remain enforced.

If the SQL editor reports `delete_support_conversation already exists`, clear
the editor and run the complete current version of that file. It can be rerun
after an earlier installation or failed attempt. It replaces the inbox RPC,
policy and restore trigger without deleting conversation, message, read or
personal inbox state. It does not remove dependent database objects; if a
dependency blocks replacement, the transaction rolls back without data changes.

Local checks use an empty disposable PostgreSQL database as a local superuser:

```sh
createdb flavorfleet_inbox_test
psql -X -v ON_ERROR_STOP=1 -d flavorfleet_inbox_test -f scripts/test-inbox-deletion.sql
dropdb flavorfleet_inbox_test
```
