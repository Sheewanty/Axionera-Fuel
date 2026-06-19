# Future Release Notes

## Mart Operations: POS Integration Readiness

Current decision:
- Keep `Returns` and `Cash Count` routes/pages available in the codebase.
- Hide or defer these as active sidebar workflows until they become independent operational screens.
- For the current release, returns and closing cash count are captured inside the daily `Mart Sales` summary.

Future implementation:
- `Returns` should become a proper POS-imported or manually reviewed returns/refunds workflow with receipt number, cashier, item, reason, amount, and approval status.
- `Cash Count` should become a per-till or per-cashier closing workflow with opening float, cash drops, denomination count, supervisor verification, and variance review.
- When POS integration is introduced, imported card sales, cash sales, MoMo sales, returns, and cashier/till cash counts should feed the daily mart summary automatically.

## Expenditure and Accountable Imprest

Current decision:
- Normal expenditure should record the actual expense only.
- Do not use an expenditure field such as `paymentToBank` to represent unused cash returned from an advance.
- If GHS100 was taken for a purpose but only GHS70 was actually spent, the expenditure record should be GHS70.
- The unused GHS30 is not expenditure. It is either cash still held by the staff member or cash returned to the station/bankable cash pool.

Reasoning:
- Expenditures are often entered after the fact, so recording the actual spent amount keeps daily cash reconciliation simple.
- Mixing cash advances, actual expenses, and returned cash inside one expenditure record creates ambiguity.
- Vendor/customer bank payments should not be treated as "cash returned to bank"; they are payment methods and should be tracked separately when payment-method support is added.

Future implementation: Accountable Imprest workflow

1. Imprest Issued
   - Date issued
   - Amount issued
   - Issued to staff/member
   - Purpose
   - Approved by
   - Cash source: drawer, bank, or other controlled source
   - Status: open/pending retirement

2. Imprest Retirement
   - Date retired
   - Original imprest reference
   - Actual expenditure amount
   - Cash returned
   - Receipts attached
   - Retirement notes
   - Variance/shortage if actual expenditure plus returned cash does not equal amount issued

3. Daily cash impact
   - On the issue day, the full imprest issued reduces cash available as `Imprest Issued`, not as expenditure.
   - On the retirement day, the actual spent amount becomes expenditure.
   - On the retirement day, any returned cash increases bankable cash or reduces outstanding imprest.
   - Every retirement must reference the original imprest issue.

Recommended future screens:
- `Cash & Banking > Accountable Imprest`
- `Imprest Register`
- `Issue Imprest`
- `Retire Imprest`
- `Outstanding Imprest Report`

## Debtor Naming and Database Cleanup

Current decision:
- The user-facing application should use `Debtor`, because these customers owe the filling station.
- Keep existing database/model names such as `Creditor` and `CreditorLedgerEntry` unchanged until after e2e testing.
- Debtor creation belongs under `Setup > Debtors`.
- Credit sale and debtor payment posting belongs under `Cash & Banking > Credit Sales / Payments`.

Reasoning:
- Renaming database tables and Prisma models during active testing creates unnecessary migration risk.
- The control separation is more urgent than internal naming: setup registers approved debtors, while daily cash operations only select from that approved list.

Future implementation:
- Rename domain models and tables from `Creditor` to `Debtor` after the live workflow stabilizes.
- Add migration scripts with explicit data preservation and compatibility checks.
- Update audit entity names, reports, and exported column labels during the same release.
