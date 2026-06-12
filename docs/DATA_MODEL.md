# FuelStation OS Data Model

## Tenancy

Every operational record must be scoped by tenant and station.

Core fields on operational tables:

```text
id
tenant_id
station_id
created_by
updated_by
created_at
updated_at
deleted_at nullable
```

Use soft delete for business records where auditability matters.

## Main Tables

### tenants

```text
id
name
slug
subscription_status
billing_email
created_at
updated_at
```

### stations

```text
id
tenant_id
name
code
location
status
created_at
updated_at
```

### users

```text
id
email
name
password_hash or auth_provider_id
avatar_initials
status
created_at
updated_at
```

### memberships

```text
id
tenant_id
station_id nullable
user_id
role
created_at
updated_at
```

Roles:

- OWNER
- ADMIN
- STATION_MANAGER
- SUPERVISOR
- ATTENDANT
- ACCOUNTANT
- AUDITOR

### products

```text
id
tenant_id
name
category
is_active
created_at
updated_at
```

### price_history

```text
id
tenant_id
station_id
product_id
price_per_litre
effective_from
effective_to nullable
created_by
created_at
```

### pumps

```text
id
tenant_id
station_id
name
status
created_at
updated_at
```

### nozzles

```text
id
tenant_id
station_id
pump_id
product_id
name
meter_code
status
created_at
updated_at
```

### tanks

```text
id
tenant_id
station_id
product_id
name
capacity_litres
status
created_at
updated_at
```

### daily_sessions

```text
id
tenant_id
station_id
business_date
shift
status
opened_by
closed_by nullable
opened_at
closed_at nullable
supervisor_notes
```

Status:

- OPEN
- READY_FOR_REVIEW
- APPROVED
- REOPENED

### pump_readings

```text
id
tenant_id
station_id
daily_session_id
business_date
shift
pump_id
nozzle_id
product_id
attendant_id nullable
previous_litre
current_litre
litres_sold computed/application
price_per_litre
amount_expected computed/application
cash_received
gocard_amount          default 0
coupon_amount          default 0
ghqr_amount            default 0
creditors_amount       default 0
variance computed/application
remarks
created_by
updated_by
created_at
updated_at
```

Variance formula:

```text
amount_expected  = litres_sold × price_per_litre
total_collected  = cash_received + gocard_amount + coupon_amount + ghqr_amount + creditors_amount
variance         = total_collected - amount_expected
```

### tank_dippings

```text
id
tenant_id
station_id
daily_session_id
business_date
tank_id
product_id
opening_stock_litres
receipts_litres
closing_dip_cm
closing_stock_litres
meter_sold_litres computed/application
variance_litres computed/application
water_test_status
supervisor_id nullable
remarks
created_by
updated_by
created_at
updated_at
```

### product_discharges

```text
id
tenant_id
station_id
business_date
product_id
supplier_name
invoice_number
seal_numbers
seal_numbers_continued
compartment_number
invoice_measurement
station_measurement
product_discharged_litres
vehicle_registration_number nullable
station_supervisor_name nullable
coupling_height_cm nullable
calibration_certificate nullable
tbar nullable
top_up_litres              default 0
before_tank_litres
expected_tank_after_discharge computed/application
after_tank_litres
discharge_variance_litres computed/application
driver_name nullable
dealer_name nullable
remarks nullable
created_by
updated_by
created_at
updated_at
```

Formulas:

```text
expected_tank_after_discharge = before_tank_litres + product_discharged_litres + top_up_litres
discharge_variance_litres     = after_tank_litres - expected_tank_after_discharge
```

### cash_collections

```text
id
tenant_id
station_id
daily_session_id
business_date
amount_to_bank
bank_collection_date
bank_collection_reference
expected_cash computed/application
variance computed/application
bank_signature_name
supervisor_signature_name
remarks
created_by
updated_by
created_at
updated_at
```

### expenditures

```text
id
tenant_id
station_id
daily_session_id nullable
business_date
voucher_reference
category
amount
payment_to_bank    default 0
paid_by
approved_by
receipt_attached
description
created_by
updated_by
created_at
updated_at
```

Formula:

```text
net_expenditure = amount - payment_to_bank
```

### mart_sales

```text
id
tenant_id
station_id
daily_session_id
business_date
opening_cash
pos_sales
cash_sales
mobile_money
returns
net_mart_sales computed/application
cash_count
variance computed/application
remarks
created_by
updated_by
created_at
updated_at
```

### audit_logs

```text
id
tenant_id
station_id nullable
actor_user_id
entity_type
entity_id
action
before_json
after_json
created_at
```

## Calculation Policy

Store entered values. Calculate derived values in application services and query views. For audit-heavy records, also store calculated snapshot fields so historical reports do not change if prices/configuration change later.

Do not trust client-side calculations. Client can preview calculations, but server must recompute before save.

---

## Reconciliation Formulas

All formulas use **Net Expenditure**, not gross, to avoid double-counting payments that return to the bank.

### Per-Nozzle (Pump Reading)

```text
litres_sold      = current_litre - previous_litre
amount_expected  = litres_sold × price_per_litre
total_collected  = cash_received + gocard_amount + coupon_amount + ghqr_amount + creditors_amount
variance         = total_collected - amount_expected
```

### Per-Session (Daily Close)

```text
net_expenditure          = Σ amount - Σ payment_to_bank
physical_cash_to_bank    = Σ cash_received - net_expenditure
hq_direct_settlement     = Σ (gocard_amount + coupon_amount + ghqr_amount + creditors_amount)
total_accounted_sales    = physical_cash_to_bank + hq_direct_settlement + net_expenditure
```

### Product Discharge

```text
expected_tank_after_discharge = before_tank_litres + product_discharged_litres + top_up_litres
discharge_variance_litres     = after_tank_litres - expected_tank_after_discharge
```

### Tank Dipping

```text
meter_sold_litres = Σ litres_sold for nozzles on this product/session
variance_litres   = opening_stock_litres + receipts_litres - meter_sold_litres - closing_stock_litres
```

### Naming Conventions

- **physical_cash_to_bank**: Physical notes/coins deposited at bank. Never includes GOCARD/COUPON/GHQR/CREDITORS.
- **hq_direct_settlement**: Sales settled directly with HQ — do not appear in bank deposit.
- **net_expenditure**: Gross station expenditure minus any cash returned to bank via payment_to_bank.
- **variance** (pump): Positive = over-collection. Negative = shortage.
