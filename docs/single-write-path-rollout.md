# Single write path rollout

Live store-build OTA channel: `production` (runtime version `1.0.0`).

## SQL

- Run now: none.
- Phase 4 hold: `supabase/sql/052_single_write_path_phase4_HOLD_DO_NOT_RUN.sql`.
  Every statement is commented out. Do not execute the forward statement until
  the observation window and update-adoption gate are both satisfied.

## Phase 3 observation window (48-72 hours)

Monitor Render and Supabase for:

- `POST /api/claims` request volume, `201` rate, latency, and claim ids from the
  `[claims/create] created` log event.
- Availability failures: `5xx`, client network timeouts, and malformed/non-JSON
  responses. Do not count expected policy responses (`400` safety blocks, `403`
  suspensions, `422` validation, or `429` limits) as endpoint availability
  failures.
- Safety: every endpoint-created row starts `safety_status='APPROVED'` only
  after the synchronous safety verdict. The migration 048/049 trigger and
  webhook remain enabled for legacy direct inserts.
- Enrichment completion: embedding storage, topic attachment, AI precheck, and
  creation SEO warnings. These are non-blocking but should converge after the
  claim is created.
- Legacy direct inserts: compare Supabase claim ids created during the window
  with `[claims/create] created` ids in Render logs. Rows without a matching
  endpoint log are expected old-bundle/direct-path writes and must continue to
  be guarded by the database safety trigger/webhook.
- Images and mentions: image upload remains the existing post-create storage
  flow; watch the client `Claim posted without image` warning rate separately
  from endpoint create success.

Flip `USE_API_CREATE` to `false` and issue a rollback OTA if any of these occur:

- any author-id mismatch or verified safety bypass through `POST /api/claims`;
- more than 2% endpoint availability failures over 15 minutes with at least 50
  attempts, or five consecutive valid-user create failures;
- sustained p95 create latency above 15 seconds for 30 minutes;
- a schema/response regression that prevents a returned row from mapping into
  the mobile `Claim` model.

## Phase 4 adoption gate

Do not remove direct INSERT until the Phase 2 update is the active production
update and adoption among active users meets the chosen cutoff (recommended:
at least 99% of 7-day active users, with no direct inserts for 72 hours).
Confirm the production branch/update group in EAS, then compare update adoption
against the app's active-user telemetry. If current telemetry cannot identify
the running Expo update id for active sessions, add that measurement first;
download/publish success alone is not proof that old bundles are gone.
