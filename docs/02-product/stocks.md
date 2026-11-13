# Stocks

A lean stock ledger: what materials are on hand, what came in, what went out, and what is running low. Admin and Office only; every route is gated in `stocks.route.ts`.

## Items
Name, optional category, a unit (`pcs`, `sheet`, `kg`, `m`, `ft`, `box`, `set`, `litre`), a **low-stock level**, and the current quantity. Adding an item can record the amount in stock now as an opening `IN` line. Items are archived, never deleted, so history stays readable; an archived item takes no new movements until restored.

**Level:** `OUT` at zero, `LOW` at or below the low-stock level, otherwise `OK`.

## Movements (append-only)
| Type | Quantity means | Effect |
|---|---|---|
| `IN` | amount received | adds |
| `OUT` | amount used or issued | subtracts; refused with `409` if more than is in stock |
| `ADJUST` | the counted total | sets the balance; the line stores the signed difference |

Every line keeps the balance after it, who recorded it, and an optional note (for example the project it went to). The balance change is one atomic update, so two people acting at once can never push stock below zero.

## API
`GET /stocks/summary`, `GET|POST /stocks/items`, `PATCH /stocks/items/:itemId`, `GET|POST /stocks/items/:itemId/movements`.

## Not in v1
Vendors, purchase orders, costs and values, tagging stock-out to a project, low-stock notifications.
