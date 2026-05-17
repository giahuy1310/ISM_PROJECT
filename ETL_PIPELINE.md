# ETL Pipeline for Bulk Orders

This document describes the current bulk upload ETL used by the Orders module.

## Pipeline Summary

- **Extract (client)**: `src/app/(app)/orders/_components/ExcelUpload.tsx` reads `.xlsx` rows and sends them to one request.
- **Transform (server)**: `src/app/api/orders/bulk/route.ts` validates, normalizes, and derives fields per row.
- **Load (server)**: rows are inserted into `fact_retailorder` in a single DB transaction.

## End-to-End Flow

1. User uploads Excel in Orders bulk UI.
2. Client parses first sheet to JSON rows and calls `POST /api/orders/bulk` with `{ rows: [...] }`.
3. Server validates request shape and batch size (`1..1000` rows).
4. Server transforms each row:
   - Required: `OrderID`, `OrderDate`, `CustomerID`, `ProductID`
   - Date normalization: `OrderDate`, `ShipDate` -> `YYYY-MM-DD`
   - Integer checks: `ShipModeID`, `RetailSalesPeopleID`, `Quantity`, `Days`
   - Enum normalization:
     - `Returned`: `Yes | No`
     - `ShipStatus`: `On-Time | Late` (accepts `ontime` too)
   - Derived normalization:
     - `Profit = Sales - Cost` (if both provided)
     - `Days = ShipDate - OrderDate` (if both provided)
   - Rule check: `ShipDate` cannot be before `OrderDate`
5. Server rejects duplicate business keys in the same upload (`OrderID + ProductID`).
6. Server validates dimension references:
   - `CustomerID` -> `dim_customer`
   - `ProductID` -> `dim_product`
   - `ShipModeID` -> `dim_shipmode` (when provided)
   - `RetailSalesPeopleID` -> `dim_retailsalespeople` (when provided)
   - `PostalCode` -> `dim_location` (when provided)
7. If any issue exists, the batch is rejected (no partial insert).
8. If all rows pass, all rows are inserted in one transaction and committed.

## Detailed ETL Flow (Stage by Stage)

### 1) Extract Stage (UI -> API Payload)

- Source file: `.xlsx` template used by the Orders bulk upload UI.
- Extraction component: `ExcelUpload.tsx`.
- Parsing behavior:
  - Reads the first worksheet only.
  - Converts worksheet rows to JSON objects keyed by header names.
  - Preserves row order to keep deterministic row-level error reporting.
- Output contract:
  - Sends a single HTTP request to `POST /api/orders/bulk`.
  - Body shape is always `{ "rows": [...] }`.
- Extract-stage failures:
  - Invalid/unsupported file content is blocked in UI before request.
  - Missing required headers surface as row-level validation errors on server.

### 2) Transform Stage (API Validation + Normalization)

- Transformation entrypoint: `src/app/api/orders/bulk/route.ts`.
- Request-level checks:
  - `rows` must be an array.
  - batch size must be in `1..1000`.
- Row-level normalization:
  - Trims and standardizes text fields.
  - Normalizes dates to `YYYY-MM-DD`.
  - Validates integer-like fields (`ShipModeID`, `RetailSalesPeopleID`, `Quantity`, `Days`).
  - Normalizes enum variants (`Returned`, `ShipStatus`) to canonical values.
- Derived field resolution:
  - Computes `Profit` when `Sales` and `Cost` are present.
  - Computes `Days` from `ShipDate - OrderDate` when both dates exist.
- Business rule enforcement:
  - Rejects invalid date order (`ShipDate < OrderDate`).
  - Rejects duplicate business keys in one upload (`OrderID + ProductID`).
- Transform-stage failures:
  - Any failed row marks the full batch as failed.
  - Server returns all collected row errors in one response.

### 3) Load Stage (Dimension Integrity + Fact Insert)

- Pre-load integrity checks:
  - Confirms referenced dimension keys exist (`dim_customer`, `dim_product`, and optional dimensions).
  - Prevents orphan fact rows caused by unknown dimension IDs.
- Load operation:
  - Writes only transformed and validated records into `fact_retailorder`.
  - Uses one database transaction for the full batch.
- Commit strategy:
  - All-or-nothing commit: either all rows are inserted, or none are inserted.
- Load-stage failures:
  - Any DB or referential validation failure triggers rollback.
  - Response remains deterministic: `inserted=0`, `failed=total`.

### 4) Post-Load Outcome

- Success path (`201`): returns inserted count and empty error list.
- Failure path (`400`): returns batch failure counts and row-indexed error messages.
- Unexpected path (`500`): returns generic server error payload.

## ETL Control Characteristics

- **Atomicity**: no partial loads for a single upload.
- **Data quality gate**: validation and dimension checks happen before insert.
- **Deterministic feedback**: row-level errors map back to user input order.
- **Scalability boundary**: current endpoint caps at 1000 rows per request.

## Payload Schema

`POST /api/orders/bulk`

Top-level body:

```json
{
  "rows": [
    {
      "OrderID": "CA-2026-001",
      "OrderDate": "2026-05-01",
      "ShipDate": "2026-05-04",
      "ShipModeID": 1,
      "CustomerID": "CG-12520",
      "PostalCode": "10024",
      "RetailSalesPeopleID": 1,
      "ProductID": "FUR-BO-10001798",
      "Returned": "No",
      "ShipStatus": "On-Time",
      "Sales": 250,
      "Quantity": 2,
      "Profit": 80,
      "Cost": 170,
      "Days": 3
    }
  ]
}
```

Supported columns align with the template:

`OrderID`, `OrderDate`, `ShipDate`, `ShipModeID`, `CustomerID`, `PostalCode`, `RetailSalesPeopleID`, `ProductID`, `Returned`, `ShipStatus`, `Sales`, `Quantity`, `Profit`, `Cost`, `Days`.

## Responses

### Success (`201`)

```json
{
  "inserted": 120,
  "failed": 0,
  "total": 120,
  "errors": []
}
```

### Validation Failure (`400`)

```json
{
  "inserted": 0,
  "failed": 120,
  "total": 120,
  "errors": [
    { "row": 14, "message": "CustomerID does not exist: CUST-999" }
  ]
}
```

### Request Shape Failure (`400`)

```json
{ "error": "rows must be an array" }
```

Other request errors include:
- `rows cannot be empty`
- `rows cannot exceed 1000`

### Unexpected Server Error (`500`)

```json
{ "error": "Internal server error" }
```

## Notes

- Client-side checks in `ExcelUpload` are pre-validation only; server validation is authoritative.
- This bulk endpoint is separate from single-row creation (`POST /api/orders`), which remains available for manual entry.
