# Dashboard Choices: Operations Insights and Sales Insights

This document explains why the project uses two main dashboards and how each one is connected to the data warehouse model.

## Why these two dashboards were chosen

The two dashboards are separated by decision focus:

- **Sales Insights (`/dashboard`)** focuses on revenue outcomes and commercial performance.
- **Operations Insights (`/analytics`)** focuses on delivery quality and operational risks.

This split helps users answer two different business questions quickly:

1. Are we growing sales and profit in the right regions/categories?
2. Are operations (delivery speed, late orders, returns) healthy enough to sustain that growth?

## Sales Insights dashboard (`/dashboard`)

### Main purpose for Sales

Sales Insights gives a high-level commercial view with trend and mix analysis, such as:

- Total Sales, Total Profit, Total Orders
- Return Rate and On-Time Delivery as supporting health KPIs
- Sales trends over time
- Regional performance (sales, profit, late rate)
- Delivery performance by category
- Ship mode distribution

### Why Sales Insights is useful

- Helps business users monitor growth and profitability in one place.
- Shows where performance is strong/weak by region and category.
- Keeps delivery-related context visible so sales decisions are not made in isolation.

## Operations Insights dashboard (`/analytics`)

### Main purpose for Operations

Operations Insights is designed for execution quality and service reliability, such as:

- Avg Delivery, Return Rate, On-Time/Late delivery metrics
- Top categories by profit (to prioritize operational effort on high-value areas)
- Sales and profit by segment
- Return rate by segment
- Late delivery by ship mode
- Top return-rate products/categories (with minimum order threshold)

### Why Operations Insights is useful

- Surfaces operational bottlenecks that affect customer experience and margin.
- Makes it easier to investigate where delays and returns come from.
- Supports targeted actions by city/segment/ship mode instead of broad assumptions.

## Relationship to the data warehouse

Both dashboards are powered by the same warehouse-style star-schema data model, centered around:

- **Fact table**: `fact_retailorder`
- **Dimension tables**:
  - `dim_location`
  - `dim_customer`
  - `dim_customersegment`
  - `dim_product`
  - `dim_subcategory`
  - `dim_category`
  - `dim_shipmode`
  - `dim_retailsalespeople`

### How warehouse data is used

- Dashboard APIs in `src/app/api/analytics/*` query `fact_retailorder` and join dimensions for slicing/filtering.
- Shared filters (region, city, segment, category, ship mode, year/month/date range) come from dimension attributes and order dates.
- KPI calculations (sales, profit, return rate, on-time rate, average ship days) are computed from fact-level metrics with dimensional context.

### Why this matters

- **Single source of truth**: both dashboards read from the same warehouse model.
- **Consistency**: Sales and Operations metrics stay aligned because they share definitions and filter logic.
- **Traceability**: business charts can be traced back to warehouse fact and dimension joins.
- **Scalability**: new KPIs/charts can be added by extending analytics queries on the same schema.

## Practical interpretation

- Use **Sales Insights** to track performance outcomes.
- Use **Operations Insights** to diagnose causes behind those outcomes.
- Together, they form a closed loop: commercial results + operational drivers, both grounded in warehouse data.
