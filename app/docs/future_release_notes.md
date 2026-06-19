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
