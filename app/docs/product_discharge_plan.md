# M4 Phase 3 — Product Discharge Implementation Plan

## Overview
This document outlines the implementation approach for the **Product Discharge** module. It incorporates strict fuel receiving logs perfectly linked to daily shifts and individual tanks.

## Database Schema Migrations

1. **`ProductDischarge` Model Updates:**
   - **[NEW FIELD] `dailySessionId String`**: Enforce strict mapping to the operational shift that physically received the fuel.
   - **[NEW FIELD] `tankId String`**: Shift from pure `productId` tracking to explicit `tankId` tracking to reconcile individual underground tanks properly.
   - **[RELATIONS]**: Add `DailySession` and `Tank` relations in Prisma.
   - **[INDEXES]**: Add `@@index([tenantId, dailySessionId])` and `@@index([tenantId, dailySessionId, tankId])` to support fast lookups. No unique constraint on `dailySessionId` + `tankId` since a tank can receive multiple discharges in a single day.
   - **Data Migration**: Since there is no critical production data, these fields will be added as required.

## Backend Services (`src/lib/db/product-discharge.service.ts`)

Create the domain service handling the business logic for fuel receiving:
- **Rule**: `product-discharge.service.ts` purely performs domain writes utilizing the required `db: Db` parameter. It **does not** create `AuditLog` records directly. Audit logging is strictly handled by the `withMutation()` wrapper.
- `createDischarge(tenantId, stationId, dailySessionId, ...data, tx: Db)`: 
  - Validates `DailySession` is not `APPROVED`.
  - Validates `tenantId`, `stationId`, `dailySessionId`, `tankId`, and `productId` all match.
  - Computes math strictly using existing helpers: `calcExpectedTankAfterDischarge` and `calcDischargeVariance` from `src/lib/calculations.ts` (which properly accounts for `topUpLitres`).
- `updateDischarge(...)`: Validates state/locks, recalculates using helpers.
- `deleteDischarge(...)`: Validates state/locks, removes the record.

## Server Actions (`src/lib/actions/product-discharge.actions.ts`)

Create Server Actions wrapping the service calls. 
- **Roles allowed:** `SUPERVISOR`, `STATION_MANAGER`, `ADMIN`, `OWNER`.
- `withMutation()` will provide the transactional `tx` and automatically log the `CREATE`, `UPDATE`, or `DELETE` audit logs in the same atomic transaction.

## Frontend UI

### `src/app/(dashboard)/forecourt/product-discharge/page.tsx`
- Server component utilizing `resolveOrRedirectStation()` to enforce a valid station context.
- Fetches the active `DailySession`.
- Fetches all `ProductDischarge` records matching the session.
- Fetches `Tank` list to populate the dropdowns (so user selects Tank, which auto-derives the Product).

### `src/app/(dashboard)/forecourt/product-discharge/ProductDischargeClient.tsx`
- **Data Table:** Displays existing discharges for the day, highlighting `dischargeVarianceLitres` with a `VarianceBadge`.
- **Form Modal:** A comprehensive data entry form capturing all owner-requested fields:
  - Vehicle Registration, Driver Name, Station Supervisor
  - Coupling Height (cm), Calibration Certificate, T-Bar
  - Supplier Name, Invoice Number, Invoice Measurement
  - Top-up (L), Product Discharged (L), Before/After Tank Litres.

## Daily Close Integration (`src/app/(dashboard)/daily-close/page.tsx`)

- **Calculation:** Aggregate the `dischargeVarianceLitres` from `ProductDischarge` across all records tied to the `dailySessionId`.
- **Validation Blocks:** 
  - Discharges are **NOT** globally required if a day had no deliveries.
  - **[BLOCKER]**: Closure will be blocked if a tank dipping declares `receiptsLitres > 0` but no corresponding `ProductDischarge` exists for that `dailySessionId + tankId`.
  - **[BLOCKER]**: Closure will be blocked if the aggregate `productDischargedLitres + topUpLitres` for a tank significantly mismatches the tank dipping `receiptsLitres`.

## Verification Plan
### Automated Tests (`src/lib/db/__tests__/product-discharge.service.test.ts`)
- Top-up math correctly affects variance.
- Approved-session lock perfectly rejects writes.
- Tenant/station/session/tank/product mismatch strictly rejects.
- Audit wrapper atomicity functions correctly with `ProductDischarge` operations.
- `daily-session.service.test.ts` updated: Daily Close is blocked when receipts exist without a matching discharge.

### Manual Verification
- Render UI, ensure all fields flow correctly to DB.
- Test missing stationId redirects.
- Test Daily Close validation blocker visually.
