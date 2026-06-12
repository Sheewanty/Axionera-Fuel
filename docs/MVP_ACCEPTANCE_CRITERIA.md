# MVP Acceptance Criteria

## General

- Users can sign in.
- A tenant owner can create at least one station.
- All operational records are scoped to tenant and station.
- Users cannot see data from another tenant.
- Users only see sidebar menu groups/items allowed by their role.
- Backend routes reject access to unauthorized modules even if the user guesses the URL.
- All forms validate required fields server-side.
- All money and litre calculations are recomputed server-side.
- Every create/update/delete writes an audit log.

## Setup

- Admin can create products.
- Admin can create price history entries.
- Admin can create pumps.
- Admin can create nozzles and assign product to each nozzle.
- Admin can create tanks and assign product to each tank.

## Daily Pump Readings

- Supervisor can open a daily session.
- User can enter previous/current meter readings per nozzle.
- App calculates litres sold.
- App calculates expected amount.
- User can enter cash received.
- App calculates variance.
- Formula/calculated columns are visually distinct.

## Tank Dipping

- User can enter opening stock, receipts, closing dip, and closing stock.
- App pulls meter sold litres by date and product.
- App calculates tank variance/loss.
- Variance is flagged with status color.

## Product Discharge

- User can record product receipt details.
- User can record invoice and station measurements.
- App calculates difference/shortage.
- Record can be linked to tank/product/date.

## Cash Collection

- User can enter amount to bank and bank collection details.
- App pulls expected cash from pump readings.
- App calculates banking variance.

## Expenditure

- User can enter expenditure with category, amount, approval, receipt status, and description.
- Daily Summary includes expenditure total.

## Mart Sales

- User can enter POS, cash, mobile money, returns, and cash count.
- App calculates net mart sales.
- App calculates mart variance.

## Daily Close

- Daily close dashboard shows:
  - Total litres sold
  - Expected forecourt cash
  - Cash banked
  - Banking variance
  - Expenditure
  - Mart net sales
  - Tank variance by product
  - Open exceptions
- Supervisor can mark day ready for review.
- Manager can approve or reopen.

## Owner Dashboard

- Owner can view all stations under the tenant.
- Owner can filter by station and date range.
- Owner can see cross-station litres, expected revenue, cash banked, banking variance, expenditure, mart sales, tank variance, and net cash position.
- Owner can see a ranked exception list by amount/risk.
- Owner can drill down from an insight/exception to the station daily close record.
- Non-owner roles cannot access owner dashboard unless explicitly authorized.

## UI

- Shell mimics Strategy OS:
  - Collapsible/hover-expanding navy sidebar
  - Grouped sidebar menu
  - Role-based menu visibility
  - Navy header
  - Center search
  - User avatar/account area
  - Gold active accents
  - Modal overlays
  - Dense operational cards/tables

## Reports

- User can export daily close report to Excel.
- User can export daily close report to PDF.
- Exports match the operational data shown on screen.
