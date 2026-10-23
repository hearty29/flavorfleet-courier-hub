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
