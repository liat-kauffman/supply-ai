# Supplai Production Readiness Roadmap

Supplai has the main foundation of a B2B application: authentication, organizations, inventory, receipts, orders, AI features, PostgreSQL/RDS, ECS, HTTPS, and CI/CD.

## Current progress

Completed during the production-readiness work:

- Single-product AI photo counting now requires active company membership and owner/manager permission.
- Area-photo counting is available to all company members, scopes products to the selected company/storage area, saves a pending scan for the company, and requires owner/manager approval before updates.
- Managers can approve high-confidence scan results in bulk; lower-confidence results remain for separate review.
- Order quantities are recalculated on the server from package count and package size instead of trusting browser-provided totals.
- Receipt and area-photo inventory updates create audit records.

Next focus: add a detailed manager review screen for low-confidence results, then add automated tenant-isolation tests, a staging environment, backup/restore verification, monitoring, and safe deployment rollback.

Before real businesses rely on the application, complete the following work.

## Priority 0: Launch blockers

These items should be completed before inviting real customers.

### Data isolation and security

- Verify that every database query filters by the active organization.
- Add automated tests proving that one company cannot access another company's data.
- Complete permissions for owner, manager, and employee roles.
- Confirm that employees cannot perform manager-only actions.
- Add rate limiting to login, password reset, invitations, file uploads, and AI endpoints.
- Validate all uploaded files by type and size.
- Keep all secrets in AWS Secrets Manager or another server-side secret store.
- Confirm that no API keys, database URLs, or passwords are exposed to the browser.
- Add account deletion and company deletion rules.
- Review all error messages so they do not reveal passwords, tokens, database details, or internal infrastructure.

### Database protection

- Enable automated RDS backups.
- Enable point-in-time recovery where appropriate.
- Define the retention period for backups.
- Test restoring a backup into a separate database.
- Document the recovery process.
- Add indexes for the most common organization, inventory, receipt, and order queries.
- Add validation for duplicate products, duplicate suppliers, and duplicate orders.

### Authentication and email

- Verify registration, login, logout, and session expiration.
- Verify email confirmation links in production.
- Verify password reset links in production.
- Verify team invitation emails in production.
- Use the verified production email domain as the sender.
- Confirm SPF, DKIM, and DMARC are configured for the email domain.
- Add a clear message when an email is sent to spam or is delayed.
- Add a way to revoke sessions from the profile page.

## Priority 1: Complete the business workflows

### Order lifecycle

Implement and display a complete order lifecycle:

```text
Draft -> Submitted -> Approved/Rejected -> Ordered -> Received -> Closed
```

Each order should have:

- A visible status.
- Supplier details.
- The person who created it.
- The person who approved it.
- Created, approved, ordered, and received dates.
- Editable quantities before approval.
- A reason when an order is rejected or cancelled.
- Protection against duplicate submissions caused by retries or double-clicks.
- An export or supplier-ready order document.

### Inventory

- Keep manual counts and AI counts approval-gated.
- Record every quantity change in the audit history.
- Show who changed a quantity and why.
- Support multiple locations and storage areas clearly.
- Add product search and pagination for large inventories.
- Allow CSV import and export.
- Prevent negative stock unless the business explicitly allows it.

### Receipt imports

- Keep imported receipt data in a review state before updating stock.
- Show which fields came from OCR and which were manually corrected.
- Allow users to correct supplier, product, quantity, price, and tax values.
- Prevent importing the same receipt twice.
- Keep the original file reference and import history.
- Show clear warnings when OCR confidence is low.

### AI area counting

- Never update inventory automatically from an image.
- Show confidence, evidence, and warnings for every proposed count.
- Do not treat products outside the camera view as zero.
- Do not guess when similar products cannot be distinguished.
- Support multiple photos for a large storage area.
- Allow users to edit or exclude every proposed count.
- Add usage limits and cost monitoring for Gemini requests.
- Add a fallback message when Gemini is unavailable.
- Persist the scan result and approval history for later review.
- Do not store sensitive images permanently unless there is a clear retention policy.

## Priority 2: Reliability and operations

### Monitoring

Add CloudWatch alarms for:

- ECS task failures.
- ECS CPU and memory usage.
- RDS storage usage.
- RDS database connections.
- ALB 5xx responses.
- Slow requests.
- Failed deployments.
- Unhealthy target groups.
- Repeated AI failures.

### Application observability

- Add structured server logs.
- Include a request ID in logs and error responses.
- Add error tracking, such as Sentry.
- Capture API failures without logging secrets or sensitive data.
- Add a health endpoint for application readiness.
- Add a separate liveness endpoint for container health checks.
- Document where to find application, ECS, ALB, and database logs.

### Deployment safety

- Keep staging separate from production.
- Deploy to staging before production.
- Run formatting, linting, type checking, tests, and builds in CI.
- Use immutable image tags for deployments.
- Confirm ECS health checks before marking a deployment successful.
- Automatically roll back when a new deployment becomes unhealthy.
- Keep the previous ECS task definition available for manual rollback.
- Test the rollback procedure at least once.
- Keep deployment secrets in GitHub Actions environment secrets or OIDC-based AWS access.

## Priority 3: Automated testing

Add tests for:

- Registration and login.
- Logout and session expiration.
- Password reset.
- Company creation.
- Team invitations.
- Invitation acceptance.
- Organization isolation.
- Owner, manager, and employee permissions.
- Inventory quantity updates.
- AI count approval and rejection.
- Receipt import and correction.
- Duplicate receipt prevention.
- Order creation.
- Order approval and rejection.
- Order status transitions.
- Production health checks.

The most important end-to-end test should cover:

```text
Register -> Create company -> Add inventory -> Import receipt -> Create order
```

Also test the main screens at desktop, tablet, and mobile widths.

## Priority 4: Customer readiness

Add or verify:

- A company onboarding checklist.
- Helpful empty states.
- Demo data and a demo reset option.
- User profile and sign-out.
- Team management.
- Notification preferences.
- CSV export and import.
- Search and pagination for large lists.
- A support/contact method.
- Terms of service.
- Privacy policy.
- Clear explanation of how receipt and image data is handled.
- A visible last-updated time for inventory and order data.

## SaaS requirements

If Supplai will charge companies, add:

- Subscription plans.
- Trial periods.
- Plan limits.
- Billing and payment processing.
- Invoice history.
- Usage tracking.
- Upgrade and downgrade handling.
- Subscription cancellation.
- Company suspension rules for failed payments.
- A billing administration page.

## Recommended implementation order

1. Fix remaining routing and server-side error issues.
2. Prove organization isolation with automated tests.
3. Finish owner, manager, and employee permissions.
4. Complete order statuses and the approval workflow.
5. Add database backups and test a restore.
6. Add monitoring, error tracking, and deployment rollback.
7. Add end-to-end tests for the main business flow.
8. Add audit history and exports.
9. Improve onboarding, help text, empty states, and support features.
10. Add billing after the core workflow is reliable.

## Kubernetes decision

Kubernetes is not required for the first production version. ECS is simpler and sufficient for an early B2B application.

Consider Kubernetes later if Supplai has:

- Multiple independently deployed services.
- High or unpredictable traffic.
- Advanced autoscaling requirements.
- A dedicated engineering or operations team.
- A strong reason to standardize on Kubernetes.

Until then, invest in reliable ECS deployments, backups, monitoring, security, and tests instead.

## Definition of production-ready

Supplai is ready for real B2B customers when:

- Customer data is isolated and access-controlled.
- Backups and restore procedures have been tested.
- Authentication and email workflows work reliably.
- Orders and inventory have complete, auditable workflows.
- AI results are reviewable and never make unsafe automatic changes.
- CI/CD can deploy and roll back safely.
- Monitoring can detect failures before customers report them.
- Critical workflows have automated tests.
- Users understand what to do when a process fails.
