# Developer Tools in This App

This document lists the main developer tools used in this repository, what they do, and why they matter for a data warehouse-driven application.

## Why Dev Tools Matter for a Data Warehouse App

This app is built around warehouse tables (for example `fact_retailorder` and related `dim_*` tables), so developer tools are not just for coding speed. They protect data quality, make ETL behavior reproducible, and help validate analytics and forecast outputs against the same warehouse source of truth.

## Core Application Tooling

### Next.js (App Router)

- **What it does**
  - Hosts UI pages and API routes in one codebase.
  - Implements endpoints such as bulk order ETL (`/api/orders/bulk`), analytics routes (`/api/analytics/*`), and dev SQL endpoint (`/api/dev/sql`).
- **Why it is related to data warehouse**
  - The ETL transform/load logic and analytics query layer both run in these API routes.
  - It keeps ingestion and reporting close to the warehouse schema used by the app.

### TypeScript

- **What it does**
  - Adds type safety for API payloads, UI state, and route handlers.
- **Why it is related to data warehouse**
  - Reduces schema-shape mistakes between ETL payloads and warehouse columns.
  - Helps keep dimension/fact field handling consistent in data APIs.

### mysql2 (Promise Pool)

- **What it does**
  - Provides DB connectivity through `src/lib/db.ts` with pooled MySQL connections.
  - Used by ETL routes, analytics routes, and SQL workspaces.
- **Why it is related to data warehouse**
  - This is the direct execution path to warehouse tables.
  - Pooling and shared config keep query behavior stable across ingestion and analytics operations.

### xlsx

- **What it does**
  - Parses uploaded Excel files in the Orders bulk upload UI.
- **Why it is related to data warehouse**
  - It is the Extract entry point for the app ETL pipeline.
  - Structured Excel rows become warehouse-bound records after server-side transform/load.

## Built-in Developer Utilities (In-App)

### Dev SQL Workspace (`/dev`)

- **What it does**
  - UI component `DevSqlWorkspace` sends SQL to `POST /api/dev/sql`.
  - Endpoint requires authenticated user and returns row sets or write results.
- **Why it is related to data warehouse**
  - Enables fast inspection and debugging of fact/dimension data during development.
  - Useful to verify ETL outcomes and analytics assumptions directly on warehouse tables.

### Orders SQL Insert Workspace

- **What it does**
  - `SqlQueryView` sends SQL to `POST /api/orders/query`.
  - Endpoint only accepts `INSERT` statements.
- **Why it is related to data warehouse**
  - Supports controlled manual inserts for order facts when testing ingestion behavior.
  - Helps validate insert-side business logic against warehouse constraints.

### Dev Guard Script (`scripts/dev-guard.mjs`)

- **What it does**
  - Runs before `next dev` (`npm run dev`).
  - Blocks startup if another local dev server is already running or if the port is busy.
- **Why it is related to data warehouse**
  - Prevents duplicate local servers from issuing conflicting writes/queries against the same DB.
  - Improves reproducibility when validating ETL and analytics behavior.

## Data Science / Forecasting Developer Tools

### Jupyter Notebooks

- **What it does**
  - `notebooks/delay_forecast_training.ipynb`: model training/evaluation pipeline.
  - `notebooks/master_dataset_eda.ipynb`: exploratory analysis.
- **Why it is related to data warehouse**
  - Notebook features and labels are derived from warehouse-style business data.
  - They provide evidence for feature quality and metric quality before deploying model artifacts.

### Python Inference and Evaluation Scripts

- **What it does**
  - `scripts/forecast_predict.py`: loads trained artifacts and returns delay-risk predictions.
  - `scripts/eta_rolling_cv.py`: time-aware regression validation workflow (rolling CV + chronological split).
- **Why it is related to data warehouse**
  - Forecast inputs are sourced from warehouse-aligned dimensions and facts.
  - Scripts enforce feature alignment with training metadata, reducing train/serve drift.

## Quality and Styling Tooling

### ESLint (`npm run lint`)

- **What it does**
  - Static checks for JavaScript/TypeScript code quality.
- **Why it is related to data warehouse**
  - Catches implementation errors early in ETL/analytics route code before they become data issues.

### Tailwind CSS + PostCSS

- **What it does**
  - Styles the admin and developer interfaces.
- **Why it is related to data warehouse**
  - Indirect support: clearer internal tooling UI improves speed when validating warehouse data and ETL results.

## Practical Dev Workflow (Warehouse Context)

1. Run app with `npm run dev` (guarded by `dev-guard`).
2. Load test data through bulk upload ETL (`/api/orders/bulk`) or controlled insert tools.
3. Verify loaded rows and dimensions with dev SQL workspace.
4. Validate analytics endpoints against the same warehouse tables.
5. For forecast flows, train/evaluate in notebooks/scripts and serve predictions through API routes.

This keeps ETL, analytics, and forecasting aligned to one warehouse-backed data model.
