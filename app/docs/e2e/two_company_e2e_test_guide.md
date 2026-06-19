# FuelStation OS Two-Company E2E Test Guide

Use this guide with the workbook:

`D:\DEV\FuelStation_OS\outputs\e2e_test_pack\fuelstation_os_two_company_e2e_import_template.xlsx`

The workbook is both:

- a populated e2e test data pack for manual testing; and
- a proposed future Excel import template for Super Admin tenant onboarding.

## Test Companies

### Company 1: Akwaaba Energy Ltd

- `companyCode`: `AKF`
- Package: `PRO`
- Stations:
  - `AKF-AC` - Akwaaba Accra Central
  - `AKF-KU` - Akwaaba Kumasi Ridge
- Products:
  - Super 95
  - Super 91
  - Diesel
  - Engine Oil 5W-30
  - Oil Filter
  - Brake Pads
- Debtors:
  - Mensah Logistics
  - Ridge Construction

### Company 2: Northbridge Fuels Ltd

- `companyCode`: `NBF`
- Package: `STARTER`
- Stations:
  - `NBF-TA` - Northbridge Tamale North
- Products:
  - Super 95
  - Super 91
  - Diesel
  - Engine Oil 15W-40
  - Air Filter
- Debtor:
  - Savannah Haulage

## Manual E2E Setup Order

Use the workbook tabs in this order.

1. `Companies`
   - Create each tenant.
   - Confirm package limits match the subscription values.

2. `Stations`
   - Create each station under the correct tenant.
   - Confirm station switching shows only stations belonging to that tenant.

3. `Users`
   - Create users by email, name, role, and station access.
   - Do not import passwords.
   - Generate temporary passwords and force reset later.

4. `Products`
   - Create fuel, lubricant, and other product records.

5. `Product Prices`
   - Enter station-specific prices.
   - Verify pump sales use the station price, not a global price.

6. `Tanks`
   - Create physical tank records.
   - Confirm each tank maps to the correct product.

7. `Pumps`
   - Create pumps at each station.

8. `Nozzles`
   - Create nozzles and assign them to pumps/products.
   - Confirm no nozzle points to a product outside its tenant.

9. `Debtors`
   - Create approved debtor accounts under `Setup > Debtors`.
   - Do not create debtors from the credit sale/payment posting page.

## One-Day Station Operations Flow

Run this sequence for each station using `19-Jun-2026` as the test business date.

### 1. Open Daily Session

Page: `Command Center` or `Daily Close`

Fields:

- Station
- Business date
- Shift: `DAY`
- Opened by supervisor/manager

Expected:

- Session status becomes `OPEN`.
- Forecourt, cash, mart, and lube entries are allowed.

### 2. Record Pump Sales

Page: `Forecourt Operations > Pump Readings`

Use workbook tab: `Pump Sales`

Fields to enter:

- Nozzle
- Closing meter
- Cash received
- GO Card / Visa
- Coupon
- GHQR / MoMo
- Credit sales
- Remarks

Calculated by app/workbook:

- Litres sold
- Expected amount
- Variance

Expected:

- Each row should have zero pump variance.
- Credit sale rows should be backed by debtor ledger entries.

### 3. Record Product Discharge

Page: `Forecourt Operations > Product Discharge`

Use workbook tab: `Product Discharge`

Fields to enter:

- Tank
- Product
- Supplier
- Invoice number
- Vehicle registration
- Driver name
- Before tank litres
- Invoice measurement
- Product discharged litres
- Adjustment / Top-up litres
- After tank litres
- Supervisor
- Coupling height
- Calibration certificate
- TBar

Calculated:

- Expected tank after discharge
- Discharge variance

Expected:

- `AKF-AC` Super 95 discharge variance: `0.00 L`
- `NBF-TA` Diesel discharge variance: `0.00 L`
- Northbridge includes a `100 L` adjustment/top-up to represent short delivery regularization.

### 4. Record Tank Dipping

Page: `Forecourt Operations > Tank Dipping`

Use workbook tab: `Tank Dipping`

Fields to enter:

- Tank
- Receipts litres
- Closing dip cm
- Closing stock litres
- Water test status

Calculated:

- Opening stock
- Meter sold litres
- Expected closing stock
- Tank variance litres

Expected:

- All station tank variance totals should be `0.00 L`.

### 5. Record Payment Details

Page: `Cash & Banking > Payment Details`

Use workbook tab: `Payment Details`

Fields to enter:

- Channel
- Amount
- Customer/attendant
- Reference/serial
- Status

Expected:

- Payment Details summary should show aggregated GO Card/Visa, Coupon, and GHQR/MoMo totals.
- Debtor payment totals should be visible by method where debtor payments exist.

### 6. Record Debtor Credit Sales and Payments

Page: `Cash & Banking > Credit Sales / Payments`

Use workbook tab: `Debtor Ledger`

Fields to enter:

- Debtor
- Entry type: `SALE` or `PAYMENT`
- Amount
- Payment method for payments
- Reference
- Payment date for cash payments

Expected:

- Credit sales increase debtor balance.
- Debtor payments reduce debtor balance.
- Cash debtor payments increase cash available for banking.
- Non-cash debtor payments reduce indebtedness but do not increase physical cash to bank.

### 7. Record Expenditure

Page: `Cash & Banking > Expenditure`

Use workbook tab: `Expenditure`

Fields to enter:

- Category
- Amount
- Paid by
- Voucher reference
- Receipt attached
- Description

Expected:

- Amount is actual expenditure only.
- There is no `paymentToBank` concept in the active workflow.
- Expected cash to bank reduces by actual expenditure only.

### 8. Record Mart Sales

Page: `Mart Operations > Mart Sales`

Use workbook tab: `Mart Sales`

Fields to enter:

- Opening cash
- Card sales
- Cash sales
- Mobile money
- Returns
- Physical cash count
- Remarks

Calculated:

- Net mart sales
- Mart cash variance

Expected:

- Mart cash variance should be `0.00` for all sample rows.

### 9. Record Lube Bay Sales

Page: `Lube Bay Operations > Lube Bay Sales`

Use workbook tabs:

- `Lube Bay Setup`
- `Lube Bay Sales`

Fields to enter:

- Vehicle registration
- Customer
- Service type
- Vehicle category
- Product line where applicable
- Quantity
- Labour charge
- Discount
- Payment mode
- Technician
- Supervisor

Expected:

- Product is optional.
- Wheel rotation example has no product and should still save.
- Total expected equals product amount plus labour less discount.
- Payment split should match total expected.

### 10. Record Cash Collection

Page: `Cash & Banking > Cash Collection`

Use workbook tab: `Cash Collection`

Fields to enter:

- Amount to bank
- Bank collection date
- Collection reference
- Bank signature name
- Supervisor signature name

Calculated:

- Pump cash
- Debtor cash payments
- Actual expenditure
- Expected cash to bank
- Banking variance

Expected:

- `AKF-AC` expected cash to bank: `GHS9,730.00`
- `AKF-KU` expected cash to bank: `GHS6,220.00`
- `NBF-TA` expected cash to bank: `GHS3,900.00`
- Banking variance should be `GHS0.00`.
- The system should reject a new cash entry if remaining expected cash is zero/negative.

### 11. Close Daily Session

Page: `Daily Close`

Expected:

- Missing workflow warnings should disappear after all required workflows are entered.
- Close Day should require confirmation.
- Session moves from `OPEN` to `READY_FOR_REVIEW`.
- Owner/Admin approval moves it to `APPROVED`.
- Approved session blocks new operational writes.

## Expected Reconciliation Targets

Use workbook tab: `Expected Reconciliation`.

All rows should show:

- Banking variance: `0.00`
- Mart cash variance: `0.00`
- Tank variance litres: `0.00`
- Discharge variance litres: `0.00`

Station expected cash to bank:

| Company | Station | Expected Cash To Bank |
| --- | --- | ---: |
| AKF | AKF-AC | GHS9,730.00 |
| AKF | AKF-KU | GHS6,220.00 |
| NBF | NBF-TA | GHS3,900.00 |

## Import Module Requirements Derived From This Pack

When the Backup / Restore module is implemented, it should support:

- Validate-only import.
- Create-new-tenant import.
- Restore-to-existing-tenant mode with explicit destructive confirmation.
- Business-code resolution instead of database IDs.
- All-or-nothing setup imports inside a transaction.
- Row-level validation report before writing.
- Audit log with file name, file hash, actor, tenant, row counts, and result.
- Password exclusion and temporary password generation for imported users.
- Tenant isolation checks on every imported row.

