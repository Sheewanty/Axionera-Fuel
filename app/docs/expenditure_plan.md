# M4 Phase 4a: Expenditures

Adds full CRUD for **Expenditures** — station operational expenses that affect the cash reconciliation pipeline. Mart Sales is deferred to Phase 4b pending variance formula clarification.

## Design Decisions (confirmed by user)

- **`dailySessionId` is intentionally nullable.** Session-linked expenditures block writes when session is `READY_FOR_REVIEW`/`APPROVED`. Non-session-linked expenditures stay out of Daily Close and cash reconciliation.
- **`paymentToBank`** reduces the net expenditure that affects cash: `netExpenditure = amount - paymentToBank`. Cash Collection already reads this correctly in [cash-collection.service.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/db/cash-collection.service.ts#L34-L43).

## Deferred: Mart Sales (Phase 4b)

> [!WARNING]
> **Mart variance formula needs clarification before implementation.**
> `calcMartVariance(cashCount, netMartSales)` compares physical cash counted against `posSales + cashSales + mobileMoney - returns`. If `cashCount` is physical mart cash only, this formula is wrong — POS and mobile money are not physical cash. Options:
> 1. `cashCount` means total mart revenue counted (all channels) → formula is correct
> 2. `cashCount` means physical cash only → variance should be `cashCount - cashSales` (or `cashCount - (netMartSales - posSales - mobileMoney)`)
>
> Additionally: add `@@unique([tenantId, dailySessionId])` to `MartSale` to enforce one-per-session.

## Proposed Changes

### Zod Schema

#### [NEW] [expenditure.schema.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/schemas/expenditure.schema.ts)

- `createExpenditureSchema`: `stationId`, `dailySessionId` (optional), `category` (required), `amount` (positive, finite), `paymentToBank` (non-negative, finite), `paidBy` (required), `voucherReference` (optional), `approvedBy` (optional), `receiptAttached` (boolean), `description` (optional)
- Refinement: `paymentToBank <= amount`
- `updateExpenditureSchema`: extends create with `id`
- `deleteExpenditureSchema`: `id`, `stationId`, `dailySessionId` (optional)

---

### Service Layer

#### [NEW] [expenditure.service.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/db/expenditure.service.ts)

**`createExpenditure(db, input)`**
- If `dailySessionId` is provided: validate session exists, tenant+station match, status is `OPEN` or `REOPENED`
- If `dailySessionId` is absent: skip session checks (standalone expense)
- Set `businessDate` from session (if linked) or current date (if standalone)
- Create record

**`updateExpenditure(db, input)`**
- Verify existing record matches tenant+station
- If session-linked: validate session status
- Update record

**`deleteExpenditure(db, id, tenantId, stationId, dailySessionId?)`**
- Same session-status guards as create
- Delete by id

**`listExpenditures(db, tenantId, dailySessionId)`**
- Read-only, ordered by `createdAt` desc

---

### Server Actions

#### [NEW] [expenditure.actions.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/actions/expenditure.actions.ts)

Following the hardened Product Discharge pattern:
- Zod validation before `withMutation()`
- `parsed.data` passed to service
- `roles: ["SUPERVISOR", "STATION_MANAGER", "ADMIN", "OWNER"]` in `withMutation()` opts
- Three actions: `createExpenditureAction`, `updateExpenditureAction`, `deleteExpenditureAction`
- `revalidatePath` on `/(dashboard)/cash/expenditure`

---

### UI Page

#### [NEW] [expenditure/page.tsx](file:///d:/DEV/FuelStation_OS/app/src/app/(dashboard)/cash/expenditure/page.tsx)

- Server component with `resolveOrRedirectStation()` for station fallback
- Queries latest daily session for the station
- Lists expenditures for that session via service
- Renders `ExpenditureClient`

#### [NEW] [ExpenditureClient.tsx](file:///d:/DEV/FuelStation_OS/app/src/app/(dashboard)/cash/expenditure/ExpenditureClient.tsx)

- Table: category, amount, paymentToBank, net (computed client-side for display), paidBy, receipt status
- Modal form for create/edit with all fields
- Delete button with confirmation
- Read-only when session is `READY_FOR_REVIEW` or `APPROVED`

---

### Seed Data

#### [MODIFY] [seed.ts](file:///d:/DEV/FuelStation_OS/app/prisma/seed.ts)

Add expenditure seed records before the cash collection block:
- "Generator Fuel" — GHS 350, paymentToBank: 0
- "Staff Meals" — GHS 120, paymentToBank: 0  
- "Contractor Payment" — GHS 800, paymentToBank: 400

All linked to `dailySessionId` and `stationId`, `paidBy: userSupervisor.id`.

---

### Tests

#### [NEW] [expenditure.service.test.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/db/__tests__/expenditure.service.test.ts)

Using the `MockDb` + `asDb()` pattern:
- Create with session: success, APPROVED block, READY_FOR_REVIEW block, tenant mismatch
- Create without session (standalone): success, no session guard
- Update: success, blocked states
- Delete: success, blocked states

#### [NEW] [expenditure.schema.test.ts](file:///d:/DEV/FuelStation_OS/app/src/lib/schemas/__tests__/expenditure.schema.test.ts)

- Valid payload, negative amount, paymentToBank > amount, missing required fields, Infinity rejection

---

### Migration

No schema changes needed — `Expenditure` model is already in the schema and covered by the `init` migration.

## Verification Plan

### Automated Tests
```bash
npm run lint
npm run typecheck
npm test -- --run
```

### Manual Verification
- Expenditure page loads at `/cash/expenditure?stationId=...`
- Daily Close still correctly computes `totalNetExpenditure`
- Cash Collection `expectedCash` still accounts for expenditures correctly
