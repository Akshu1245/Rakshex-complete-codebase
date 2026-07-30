# Team Subscription Operations

Owner: Product and Billing
Last reviewed: 2026-07-30

## Product model

Rakshex team subscriptions are workspace-scoped. A Pro workspace supports up to five reserved
seats; a Business workspace supports up to twenty-five. Active members and unexpired invitations
both consume capacity. Third-party AI-tool seat inventory is a separate feature and does not grant
Rakshex access.

Workspace roles are owner, admin, security lead, developer, analyst, viewer, and billing admin.
Only a workspace owner may cancel its subscription. Owners and billing administrators may view and
change billing; admins manage membership.

## Support procedures

### Invite is not received

1. Confirm the invite is pending and not expired.
2. Confirm the recipient address and verified SMTP delivery event.
3. Resend from the workspace Team page.
4. Never send or log the raw invitation token outside the transactional email path.
5. If expired, cancel it and issue a new invite.

### Workspace is at capacity

1. Count active members and unexpired invitations.
2. Cancel stale invitations or remove access only with customer authorization.
3. The owner or billing administrator may raise allocation within the plan limit.
4. For capacity above the plan limit, use a reviewed enterprise order form; do not bypass
   enforcement manually.

### Payment failure

Keep access status driven by signed provider webhooks. Do not activate a plan from a browser
callback. Reconcile provider payment ID, workspace subscription ID, integer minor-unit amount,
currency, and event ID before changing status.

### Ownership and cancellation

The last workspace owner cannot be removed. Transfer ownership before removing an owner. Record
cancellation mode, effective date, data-export request, retention timeline, refund decision, and
operator in the support ticket.
