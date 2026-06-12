# Implementation Plan: Daily Session Lifecycle

This plan outlines the state machine implementation for the `DailySession` record.

## 1. State Machine Transitions

- `OPEN -> READY_FOR_REVIEW`
- `READY_FOR_REVIEW -> APPROVED`
- `APPROVED -> REOPENED`
- `REOPENED -> READY_FOR_REVIEW`

## 2. Role-Based Access & Mutations

- **`closeSession` (`OPEN` / `REOPENED` -> `READY_FOR_REVIEW`)**:
  - Uses `withMutation`.
  - Allowed roles: `SUPERVISOR`, `STATION_MANAGER`, `ADMIN`, `OWNER`.
  - Action: Sets `closedAt`, `closedBy`.
- **`approveSession` (`READY_FOR_REVIEW` -> `APPROVED`)**:
  - Uses `withApproval`.
  - Allowed roles: `STATION_MANAGER`, `ADMIN`, `OWNER`.
  - Action: Locks the session, sets status to `APPROVED`.
- **`reopenSession` (`APPROVED` -> `REOPENED`)**:
  - Uses `withApproval`.
  - Allowed roles: `ADMIN`, `OWNER`.
  - Action: Requires a specific "reason" parameter, sets status to `REOPENED`.

## 3. Data Integrity & Validation

- **No writes after APPROVED**: Add a check in `withMutation`/`withApproval` or directly within the domain services for Pump Readings, Tank Dippings, Cash Entries, Discharges, and Expenditures to block writes if the parent `DailySession` is `APPROVED`.
- **Validation on Close**: Before allowing `READY_FOR_REVIEW`, the server will verify that there is at least one pump reading, tank dipping, and cash entry for the session. 
  - *Placeholder Note*: We will include placeholder comments to validate Product Discharge and Expenditure later, making it clear the day is not fully reconciled yet.
- **Auditing**: All state transitions will log to `AuditLog` within the same `prisma.$transaction`.
- **Scoping**: All service reads/writes will enforce `tenantId` and `stationId` scoping.
- **DB Injection**: Service functions will accept `db: Db` as a required parameter to avoid global Prisma usage.

## 4. UI / Page Conversion

- Convert `src/app/(dashboard)/daily-close/page.tsx` from static to dynamic (Server Component).
- Fetch the target `DailySession` and all domain data using `stationId`.
- Compute reconciliation totals server-side (total litres sold, expected cash, banked cash, banking variance) and pass to a Client Component.
- Display `DailyCloseClient.tsx` with action buttons ("Close Day", "Approve Day", "Reopen Day") that only appear based on the session's current status and the user's role.

## 5. Verification & Tests

- Add `src/lib/db/__tests__/daily-session.service.test.ts`.
- Tests will cover:
  - Valid transitions
  - Invalid transitions (e.g. `OPEN -> APPROVED` directly)
  - Role denial (e.g. `SUPERVISOR` trying to approve or reopen)
  - Cross-tenant access denial
  - Audit log creation inside the transaction
  - Reopen reason requirement
