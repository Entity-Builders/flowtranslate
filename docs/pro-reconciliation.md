# FlowTranslate Pro Reconciliation Runbook

This runbook is for operator-only paid-but-not-Pro cases. It is not user-facing
support copy and it must not be wired into the FlowTranslate browser app.

## First Rule

Never grant Pro from a checkout return URL, screenshot, or browser query param.
Checkout returns are UX hints only. Pro can be reconciled manually only after
Mercado Pago evidence confirms the paid state and the local FlowTranslate rows
can be matched safely.

## Inputs To Collect

Collect these outside git, analytics, screenshots, and issue text:

- FlowTranslate `user_id` from Supabase Auth.
- Local `external_reference` when available.
- Local or provider `provider_subscription_id` / `provider_preapproval_id`.
- Mercado Pago state from the provider dashboard/API.
- Mercado Pago event/update timestamp when available. If the provider does not
  expose one for the case, use the support decision time deliberately and record
  it in private notes.
- Amount and currency shown by Mercado Pago.
- The operator case id, such as `ftpro-2026-06-13-001`.

Do not paste payer email, card data, access tokens, webhook secrets, raw Mercado
Pago payloads, source text, generated text, or full database rows into this repo.

## Decision Path

1. Confirm the account is permanent, not an anonymous guest session.
2. Run the read-only diagnosis queries from
   `eb-infra/supabase/support/flowtranslate-pro-reconciliation.sql`.
3. Check local subscription, entitlement, provider events, `safe_error_code`,
   `external_reference`, and provider ids.
4. Check Mercado Pago externally with server-side credentials outside the repo.
5. Prefer waiting for webhook retry or resending the provider notification when
   the local event is `received`, `failed`, or the provider lookup error is
   retryable.
6. Use manual grant only when provider evidence is paid/active and local state is
   missing, stale, or safely recoverable.
7. Use revoke/cancel only when provider evidence says the payment was refunded,
   charged back, disputed, cancelled, expired, or the manual grant was wrong.

## Provider Evidence Required For Manual Grant

Manual grant requires all of this:

- Provider is Mercado Pago.
- Provider status is active/authorized/approved/accredited/processed.
- Amount/currency match the FlowTranslate Pro v1 offer: ARS 4.999/mes.
- The provider record is tied to the expected `external_reference`,
  `provider_subscription_id`, or `provider_preapproval_id`.
- The target account is a permanent FlowTranslate user.

If any item is unclear, keep the user non-active and continue support
investigation. Do not invent provider ids or write active Pro as a courtesy.

## Support SQL

Use:

```txt
eb-infra/supabase/support/flowtranslate-pro-reconciliation.sql
```

The SQL file contains three templates:

1. Read-only diagnosis.
2. Manual grant from an existing local subscription.
3. Manual subscription recovery plus grant when Mercado Pago succeeded but the
   local subscription row is missing.
4. Revoke/cancel for mistaken grants, refunds, chargebacks, disputes,
   cancellations, or expired access.

Every mutable template uses explicit placeholders and should fail if copied
unchanged. Review the read-back rows before changing the final `rollback` to
`commit`.

Mutable templates also check that the target account is not anonymous and that
manual evidence is not older than local `last_provider_event_at`.

## Expected Local Shapes

Active provider-confirmed Pro should end with:

- `flowtranslate.billing_subscriptions.normalized_status = 'active'`
- `flowtranslate.billing_subscriptions.last_verified_at is not null`
- `flowtranslate.entitlements.account_kind = 'pro'`
- `flowtranslate.entitlements.source = 'mercado_pago'`
- `flowtranslate.entitlements.plan = 'pro'`
- `flowtranslate.entitlements.status = 'active'`
- `flowtranslate.entitlements.last_verified_at is not null`

The support SQL also writes a safe audit row into
`flowtranslate.billing_provider_events` with topic `manual_reconciliation`.

## After Reconciliation

After a grant or revoke:

1. Re-run the diagnosis section.
2. Confirm the entitlement shape matches the expected state.
3. Ask the user to refresh FlowTranslate after the next account/quota UI reads
   current entitlement state.
4. Keep the operator case id in private support notes, not in public analytics or
   browser-visible payloads.
