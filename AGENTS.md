<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- Orders, rider acceptance, status changes and rider approval go through security-definer SQL functions (place_order, rider_accept_order, rider_update_status, review_rider_application) so prices and permissions are enforced in the database, not the browser.
- Roles live in public.user_roles (admin/rider/customer); the first user to sign up becomes admin via the signup trigger.
- Pages read data with the browser client under RLS; signed-in pages live under src/routes/_authenticated/.
- Customer order tracking resolves assigned rider names through the authorized order_rider function, keyed by order and rider ID, rather than broadening profile visibility.
- Rider identification fields live in owner/admin-readable rider_verifications, separate from broadly rider-readable profiles, to keep documents private; owner writes only submit pending verification and never grant roles.
- Verification uploads use unique owner-prefixed storage paths and file validation; profile URLs are persisted while signed owner URLs support workspace-blocked public buckets.
- Rider photo eligibility is validated against stored objects by database triggers/RPCs; delivery completion uses rider_complete_delivery with an order-scoped private storage path and a trigger that also guards admin updates, so UI bypasses cannot skip mandatory photos.
- Reusable rider photo and delivery proof controls share owner-prefixed storage helpers; order card components remain outside page renders so refetches do not reset in-progress uploads.
