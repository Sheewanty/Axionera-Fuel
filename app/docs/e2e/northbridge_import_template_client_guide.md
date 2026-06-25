# FuelStation OS Import Template Guide

This guide explains how to fill the Excel import workbook for onboarding a filling station tenant and loading historical operating data.

Use this order:

1. Setup sheets
2. Daily session sheets
3. Operational transaction sheets
4. Cash and control sheets
5. Validate in FuelStation OS
6. Import only after validation passes

Do not rename sheets or column headers. Leave unused optional cells blank. Use one row per record.

## Before You Start

- Use dates in `13-Jun-2026` or Excel date format.
- Use the same `CompanyCode` everywhere for the same tenant.
- Use the same `StationCode`, `ProductCode`, `TankCode`, `PumpCode`, and `NozzleCode` exactly as entered in setup sheets.
- Enter only actual expenditure used. Do not enter imprest advances or unused cash as expenditure.
- MoMo receipts are recorded for sales control, but MoMo is not bankable cash.
- Cash collection should bank only physical cash: pump cash, debtor cash payments, and lube bay cash sales, less actual expenditure and previous banked cash.

## 1. Companies

Enter one row for the company/tenant.

Required fields:

- `CompanyCode`: Short unique code, for example `NBF`.
- `TenantName`: Registered or trading company name.
- `Slug`: Lowercase URL-safe name, for example `northbridge-fuels`.
- `SubscriptionPackage`: Package name, for example `STARTER`, `PRO`, or `ENTERPRISE`.
- `SubscriptionStatus`: Usually `ACTIVE`.
- `MaxStations`, `MaxTanks`, `MaxPumps`: Subscription limits.
- `BillingEmail`: Billing contact email.
- `BillingAddress`: Company billing address.
- `OwnerName`, `OwnerEmail`: Main tenant owner contact.

## 2. Stations

Enter one row per station.

Required fields:

- `CompanyCode`: Must match the Companies sheet.
- `StationCode`: Short station code, for example `NBF-TN`.
- `StationName`: Station display name.
- `Location`: Town or area.
- `Status`: Usually `ACTIVE`.

## 3. Users

Enter users who should access the tenant.

Required fields:

- `CompanyCode`
- `StationCode`: Leave blank for tenant-wide users such as OWNER or ADMIN. Enter a station code for station-specific roles.
- `Email`: Login email.
- `Name`
- `Role`: `OWNER`, `ADMIN`, `STATION_MANAGER`, `SUPERVISOR`, `ATTENDANT`, `ACCOUNTANT`, or `AUDITOR`.
- `Status`: Usually `ACTIVE`.
- `ForcePasswordChange`: Use `YES` for imported users.

Imported users receive a temporary password from the system and must change it after login.

## 4. Products

Enter all fuel, lubricant, and lube bay products.

Required fields:

- `CompanyCode`
- `ProductCode`: Short code, for example `S95`, `AGO`, `ENG15W40`.
- `ProductName`: Product display name.
- `Category`: Use `FUEL`, `LUBRICANT`, or `PARTS`.
- `IsActive`: `YES` or `NO`.

## 5. Product Prices

Enter selling prices by station and product.

Required fields:

- `CompanyCode`
- `StationCode`
- `ProductCode`
- `PricePerLitre`: For fuel this is the pump price. For lube bay products this is the unit price.
- `EffectiveFrom`
- `EffectiveTo`: Leave blank if current.

## 6. Tanks

Enter one row per physical tank.

Required fields:

- `CompanyCode`
- `StationCode`
- `TankCode`
- `TankName`
- `ProductCode`: Product held in the tank.
- `CapacityLitres`
- `Status`: Usually `ACTIVE`.

## 7. Pumps

Enter one row per pump.

Required fields:

- `CompanyCode`
- `StationCode`
- `PumpCode`
- `PumpName`
- `Status`: Usually `ACTIVE`.

## 8. Nozzles

Enter one row per nozzle/meter.

Required fields:

- `CompanyCode`
- `StationCode`
- `PumpCode`
- `NozzleCode`
- `NozzleName`
- `ProductCode`
- `MeterCode`
- `Status`: Usually `ACTIVE`.

## 9. Debtors

Use this for approved customers allowed to buy on credit.

Required fields:

- `CompanyCode`
- `StationCode`
- `DebtorName`
- `Phone`
- `Email`: Optional.
- `CreditLimit`
- `OpeningBalance`: Existing debt before the system goes live.
- `Status`: Usually `ACTIVE`.

Debtors must exist here before credit sales or debtor payments are imported.

## 10. Lube Service Types

Enter service categories offered at the lube bay.

Required fields:

- `CompanyCode`
- `StationCode`: Leave blank for tenant-wide service types, or enter a station code for station-specific services.
- `ServiceName`: For example `Oil Change`, `Wheel Rotation`, `Filter Replacement`.
- `VehicleCategory`: For example `Motorcycles & Tricycles`, `Heavy Duty & Commercial Trucks`, `Light Commercial Vehicles`, `SUV and Crossovers`, or `Salon and Sedans`.
- `DefaultLabourCharge`
- `IsActive`: `YES` or `NO`.

## 11. MoMo Operators

Enter mobile money operators used across sales/payment screens.

Required fields:

- `CompanyCode`
- `StationCode`: Leave blank for tenant-wide operators.
- `OperatorName`: For example `MTN`, `Telecel`, or `AT`.
- `IsActive`: `YES` or `NO`.

## 12. Daily Sessions

Create the business day before entering transactions for that day.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`: Usually `DAY`.
- `OpenedByEmail`
- `Status`: Usually `OPEN` for imported working data, or the correct historical status.

Every pump reading, tank dipping, product discharge, stock adjustment, expenditure, mart sale, lube sale, debtor payment, payment detail, and cash collection must point to an existing daily session.

## 13. Pump Readings

Enter one row per nozzle per business day.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `NozzleCode`
- `ProductCode`
- `OpeningMeter`
- `ClosingMeter`
- `UnitPrice`
- `CashReceived`
- `GoCardVisa`
- `Coupon`
- `GHQRMomo`
- `CreditSales`
- `AttendantEmail`

Calculated fields:

- `LitresSoldFormula`: Closing meter minus opening meter.
- `ExpectedAmountFormula`: Litres sold multiplied by unit price.
- `VarianceFormula`: Cash + GO Card/Visa + Coupon + GHQR/MoMo + Credit Sales minus expected amount.

If there is a credit sale, the customer must already exist in Debtors and the related debtor ledger entry should also be entered.

## 14. Product Discharge

Enter physical deliveries into tanks.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `TankCode`
- `ProductCode`
- `SupplierName`
- `InvoiceNumber`
- `ProductDischargedLitres`
- `VehicleRegistrationNumber`
- `DriverName`
- `StationSupervisorName`
- `BeforeTankLitres`
- `AfterTankLitres`

Useful control fields:

- `CouplingHeightCm`
- `CalibrationCertificate`
- `TBar`
- `TankerWaterTestStatus`
- `ReceivingTankWaterTestStatus`
- `AdjustmentTopUpLitres`: Use this for later adjustment/top-up litres, especially where a transporter short-delivered and makes up the difference later.

Calculated fields:

- `ExpectedTankAfterDischarge`: Before tank litres + product discharged litres + adjustment/top-up litres.
- `DischargeVarianceLitres`: After tank litres minus expected tank after discharge.

## 15. Tank Dipping

Enter one row per tank per business day.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `TankCode`
- `ProductCode`
- `OpeningStockLitres`
- `ReceiptsLitres`
- `ClosingDipCm`
- `ClosingStockLitres`
- `WaterTestStatus`
- `SupervisorEmail`

Calculated fields:

- `MeterSoldLitres`: Sum of pump litres sold for that product/session.
- `ExpectedClosingFormula`: Opening stock + receipts + approved adjustment in - meter sold - approved adjustment out.
- `VarianceLitresFormula`: Actual closing stock minus expected closing stock.

## 16. Stock Adjustments

Use this sheet for approved non-sales stock movements that affect tank stock but must not create revenue, cash, HQ settlement, debtor sales, or banking expectation.

Examples:

- NPA inspection draw-off of a few litres during a regulatory inspection.
- Approved stock correction that is not a product discharge and not a pump sale.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`: Usually `DAY`.
- `TankName`
- `ProductName`
- `AdjustmentType`: Use `REGULATORY_INSPECTION`, `STOCK_CORRECTION`, `EVAPORATION`, or `OTHER`.
- `Direction`: Use `OUT` for NPA draw-offs; use `IN` only for approved stock added back.
- `Litres`: Must be greater than zero.

Recommended control fields:

- `AuthorityReason`: For example `NPA inspection draw-off`.
- `Reference`: Inspection/reference number where available.
- `RecordedBy`
- `ApprovedBy`
- `ApprovalStatus`: Use `APPROVED`, `PENDING`, or `REJECTED`. Only `APPROVED` rows affect tank variance.
- `Remarks`

Effect on calculations:

- `OUT` reduces expected closing stock.
- `IN` increases expected closing stock.
- Stock adjustments do not affect pump expected revenue, cash collection, payment details, debtor ledger, or bankable cash.

Example:

| CompanyCode | StationCode | BusinessDate | Shift | TankName | ProductName | AdjustmentType | Direction | Litres | AuthorityReason | Reference | RecordedBy | ApprovedBy | ApprovalStatus | Remarks |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| NBF | ACC | 21-Jun-2026 | DAY | Diesel Tank | Diesel | REGULATORY_INSPECTION | OUT | 5.00 | NPA inspection draw-off | NPA/ACC/2026/014 | Kofi Mensah | Ama Boateng | APPROVED | Routine inspection sample |

Opening stock for a tank should normally be the previous day closing stock. For the first imported day, enter the actual opening stock from the station records.

## 17. Expenditure

Enter actual expenditure only.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `VoucherReference`
- `Category`
- `Amount`
- `PaidBy`
- `ApprovedBy`
- `ReceiptAttached`
- `Description`

Do not record cash advances as expenditure. If GHS100 was given and only GHS70 was spent, record GHS70 as expenditure. The remaining GHS30 is accountable imprest or returned cash, not expenditure.

## 18. Mart Sales

Enter one daily mart sales summary per station/session.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `OpeningCash`
- `CardSales`
- `CashSales`
- `MobileMoney`
- `Returns`
- `PhysicalCashCount`

Calculated fields:

- `NetMartSales`: Card sales + cash sales + mobile money - returns.
- `Variance`: Physical cash count compared with expected cash position.

Card sales are electronic card/POS settlements. Cash sales are physical cash kept in the till.

## 19. Lube Sale Lines

Enter product line items for lube bay sales.

Required fields:

- `SaleRef`: Must match a row in Lube Sales.
- `ProductName`: Must exist in Products.
- `Quantity`
- `UnitPrice`
- `Amount`: Quantity multiplied by unit price.

For service-only work such as wheel rotation, do not enter a product line.

## 20. Lube Sales

Enter one row per lube bay job.

Required fields:

- `SaleRef`: Unique reference.
- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `VehicleReg`
- `CustomerName`
- `ServiceType`
- `VehicleCategory`
- `LabourCharge`
- `Discount`
- `PaymentMode`: `CASH`, `MOMO`, `CARD`, or `CREDIT`.
- `CashAmount`
- `CardAmount`
- `MomoAmount`
- `CreditAmount`
- `SupervisorName`

Conditional fields:

- If `PaymentMode` is `CREDIT`, enter `DebtorName`.
- If `PaymentMode` is `MOMO`, enter `MomoOperator` and `MomoNumber`.

Calculated field:

- `TotalExpected`: Product line total + labour charge - discount.

## 21. Debtor Ledger

Enter credit sales and debtor payments.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `DebtorName`
- `Type`: `SALE` or `PAYMENT`.
- `Amount`
- `PaymentMethod`: For sales use `CREDIT`. For payments use `CASH`, `CHEQUE`, `CARD`, or `MOMO`.
- `Reference`

Conditional fields:

- For fuel credit sales, enter `ProductName`.
- For cash payments, the cash amount is bankable and should be included in cash collection.
- For MoMo payments, record the payment for debtor balance control, but do not include it in bankable physical cash.

## 22. Payment Details

Enter non-cash payment details for audit and reconciliation.

Typical channels:

- `GO_CARD`
- `COUPON`
- `GHQR`
- `CARD`
- `MOMO`
- `CREDIT`

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `Channel`
- `Amount`
- `ReferenceNumber`
- `Status`

Optional fields:

- `ProductCode`
- `CustomerName`
- `AttendantName`
- `SerialNumber`
- `PhoneNumber`
- `Remarks`

## 23. Cash Collections

Enter bank deposits or cash collection records.

Required fields:

- `CompanyCode`
- `StationCode`
- `BusinessDate`
- `Shift`
- `PumpCash`
- `DebtorCashPayments`
- `LubeCashSales`
- `ActualExpenditure`
- `AlreadyBanked`
- `AmountToBank`
- `BankCollectionDate`
- `BankReference`
- `BankSignatureName`
- `SupervisorSignatureName`

Calculated fields:

- `ExpectedCash`: Pump cash + debtor cash payments + lube bay cash sales - actual expenditure - already banked.
- `Variance`: Amount to bank minus expected cash.

Bank collection date is the date the bank physically collected or received the cash. Business date is the operational day that generated the cash.

## Final Checks Before Upload

- Every code used in transaction sheets exists in setup sheets.
- Every business date/shift in transaction sheets exists in Daily Sessions.
- Every debtor used in credit sales or payments exists in Debtors.
- Every lube sale line has a matching `SaleRef` in Lube Sales.
- Every product discharge links to the correct tank/product.
- Tank variance, product discharge variance, pump variance, lube variance, and cash collection variance should be zero unless there is a real exception to investigate.
- Validate the workbook in FuelStation OS before importing.
- Import only after validation passes.
