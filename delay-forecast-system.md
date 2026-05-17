# Delay Forecast System: Full Pipeline

This document explains how the delay-risk forecast works end-to-end in this repository, from model training to UI display.

## 1) What the system predicts

The current system predicts **delay risk**, not ETA:

- `delayRiskScore`: calibrated probability in `[0, 1]`
- `delayRiskLabel`: derived from score thresholds:
  - `Low` if score `< 0.3`
  - `Medium` if score `>= 0.3` and `< 0.6`
  - `High` if score `>= 0.6`

The response also includes:

- `modelVersion`
- `generatedAt`
- `predictions[]` (one item per input shipment)

## 2) Training pipeline (notebook)

Training is implemented in `notebooks/delay_forecast_training.ipynb`. The repository ships **delay risk only** as a trained forecast product (no separate demand or sales time-series forecast in the app or deployment artifacts).

### 2.1 Data preparation and features

The notebook builds delay-training features and includes calendar-derived fields from `orderDate`, including:

- `month`
- `dayOfWeek`
- `dayOfMonth`
- `isWeekend`

It also keeps business/logistics fields (for example ship mode, sales, quantity, product/customer/location attributes) and builds a delay target (`is_delayed`).

### 2.2 Train / test design

- **Primary split**: 80% train / 20% test, **stratified on `ShipStatus`**, with rows **shuffled** first (`random_state=111`). This matches a static tabular risk-scoring setup (not a rolling origin time-series CV).
- **Why stratify**: `ShipStatus` (on-time vs late) drives the label distribution; stratification keeps similar class balance in train and test so metrics are comparable.
- **Why shuffle**: the workflow treats each order line as an exchangeable draw for risk scoring rather than forecasting the next calendar week from past weeks alone.

### 2.3 Candidate models (Stage 1 — model choice)

Each candidate is wrapped in the same sklearn `Pipeline`: `ColumnTransformer` (scaled numerics, passthrough IDs / month / day-of-month / weekend flag, one-hot categoricals) plus the classifier.

**Always included (sklearn):**

| Model | Role |
| --- | --- |
| `LogisticRegression` | Fast, interpretable linear baseline for calibrated probabilities. |
| `HistGradientBoostingClassifier` | Strong default for heterogeneous tabular data; native in sklearn. |
| `RandomForestClassifier` | Ensemble tree baseline; robust to noise. |
| `DecisionTreeClassifier` | Deliberately weak nonlinear baseline to sanity-check that complex models earn their keep. |
| `MLPClassifier` | Small neural baseline; sample weights are applied only when the installed sklearn version supports `sample_weight` for that estimator. |

**Included when optional packages are installed** (the notebook `try`/`except` imports and skips missing libraries):

| Model | Role |
| --- | --- |
| `LGBMClassifier` (`lightgbm`) | High-performance GBDT common in industry benchmarks. |
| `XGBClassifier` (`xgboost`) | Widely used GBDT variant. |
| `CatBoostClassifier` (`catboost`) | Handles categoricals well; useful cross-check on the same feature matrix. |

**Stage 1 procedure**: a random **30% stratified subset** of the training rows is taken for speed. On that subset, a **70/30 stratified holdout** is used: each pipeline is fit on the inner 70% and scored on the inner 30%.

**Stage 1 metrics** (computed on the inner holdout):

| Metric | Meaning | Why it is used |
| --- | --- | --- |
| **ROC-AUC** | Discrimination across all probability thresholds. | Standard ranking quality for binary risk; threshold-independent. |
| **PR-AUC** (`average_precision_score`) | Area under precision–recall curve. | Often more informative than ROC when the positive (late) class is **rare**; rewards catching delayed shipments without flooding false alarms. |
| **F1 macro** | Harmonic mean of precision/recall **averaged across both classes** with equal weight per class. | Avoids a model that only predicts the majority class; aligns with caring about **both** on-time and late errors when a default 0.5 threshold is applied. |
| **Accuracy** | Fraction of correct hard labels at 0.5 threshold. | Easy to communicate; interpreted alongside F1 when classes are mildly imbalanced. |

**Winner selection**: models are sorted by **F1 macro (desc)**, then **PR-AUC (desc)**, then **ROC-AUC (desc)**. That order prefers balanced hard-class performance first, then positive-class retrieval quality, then overall ranking. The winning name is stored (e.g. recent runs often pick `HistGradientBoostingClassifier`, but the notebook is authoritative for your data).

### 2.4 Hyperparameter tuning (Stage 2)

- **Tool**: `RandomizedSearchCV` with **`n_iter=15`**, **`StratifiedKFold(n_splits=5, shuffle=True)`** on another **30% stratified random subset** of the full training rows (for runtime).
- **Scoring dict**: `roc_auc`, `average_precision`, `f1_macro` (see `DELAY_SCORING` in the notebook).
- **`refit` metric**: `f1_macro` (`DELAY_REFIT_METRIC`) so the chosen hyperparameters are the ones that maximize macro-F1 under cross-validation, not a single metric in isolation.
- **Rationale**: full grid search over tree ensembles is expensive; randomized search explores the space efficiently. Stratified folds preserve class ratios. Refitting on macro-F1 keeps the tuned model aligned with the same priority used to sort Stage 1 results.

### 2.5 Probability calibration

After fitting the **tuned** base delay pipeline on **all** training rows, probabilities are calibrated so UI scores behave like **well-calibrated** risks (not just ranking scores):

- `CalibratedClassifierCV`
- `method="sigmoid"` (Platt-style)
- `FrozenEstimator` around the fitted pipeline so the inner model is not re-fit during calibration
- `cv=None` with a **random 15%** stratified slice of the training rows reserved as the calibration fit set

**Rationale**: tree ensembles and related classifiers can be **miscalibrated** (predicted 0.7 not meaning 70% empirical late rate). Sigmoid calibration on a held slice adjusts the probability scale while keeping the same ranking for thresholding in many cases; it is what backs `delayRiskScore` in production.

### 2.6 Final evaluation and export

On the **locked 20% test split** from §2.2, the **calibrated** estimator is evaluated using **probability** `predict_proba[:, 1]` and **hard** predictions at **0.5** on calibrated probabilities:

| Metric | Role |
| --- | --- |
| ROC-AUC / PR-AUC | Same interpretation as Stage 1, but on the **final** held-out test set after tuning and calibration. |
| F1 macro / Accuracy | Hard-label quality at 0.5 on calibrated scores. |
| **Brier score** (`brier_score_loss`) | Mean squared error between predicted probability and the 0/1 outcome — a **proper scoring rule** for probabilities (lower is better; penalizes confident wrong predictions more than accuracy alone), supporting the choice to calibrate. |

**Artifacts written** (paths may be `notebooks/artifacts/...` locally or `/content/artifacts/...` in Colab; copy into `models/forecast/` for the app):

- `delay_classifier.pkl` — calibrated classifier used by `scripts/forecast_predict.py`
- `forecast_metadata.pkl` — feature list, label maps, thresholds, serialized test metrics / version metadata

Intermediate checkpoints: `stage1_model_selection.pkl`, `stage2_tuning.pkl`, `stage3_final_models.pkl` under `notebooks/artifacts/checkpoints/` when that directory is used.

### 2.7 Latest holdout evaluation snapshot

Latest reported run (shuffled 20% test split):

- Delay model: `HistGradientBoostingClassifier`
- CV refit metric: `f1_macro`
- Calibration: `sigmoid` (`FrozenEstimator`, random 15% of train)
- Delay ROC-AUC: `0.917`
- Delay PR-AUC: `0.922`
- Delay F1 (macro): `0.825`
- Delay accuracy: `0.828`
- Delay Brier score: `0.114`
- Holdout class report:

```text
              precision    recall  f1-score   support

        Late       0.86      0.75      0.80       916
     On-Time       0.81      0.89      0.85      1083

    accuracy                           0.83      1999
   macro avg       0.83      0.82      0.82      1999
weighted avg       0.83      0.83      0.83      1999
```

Artifacts saved to `notebooks/artifacts`.

Sample delay label distribution from this holdout output:

- `Low`: 935
- `High`: 725
- `Medium`: 339

Interpretation:

- **Strong ranking quality**: ROC-AUC `0.917` and PR-AUC `0.922` indicate the model separates late vs on-time shipments well.
- **Balanced overall classification**: macro-F1 `0.825` with accuracy `0.828` is consistent with good two-class performance, not only majority-class fit.
- **Meaningful calibration quality**: Brier `0.114` is reasonably low for this tabular setting, supporting use of `delayRiskScore` as a probability-like risk signal.
- **Main error pattern**: `Late` recall (`0.75`) is lower than `On-Time` recall (`0.89`), so the model still misses a share of truly delayed shipments. If business cost of missed delays is high, threshold tuning (below `0.5`) or cost-sensitive retraining should be considered.

## 3) Runtime artifacts used by the app

At runtime, the app expects:

- `models/forecast/delay_classifier.pkl`
- `models/forecast/forecast_metadata.pkl`

These defaults can be overridden with environment variables:

- `FORECAST_CLASSIFIER_PATH`
- `FORECAST_METADATA_PATH`

## 4) Frontend input pipeline

The forecast UI is in `src/app/(app)/forecast/_components/ForecastView.tsx`.

### 4.1 Lookup loading

On load, the form fetches:

- `/api/orders/lookup` for ship modes and sales people
- `/api/customers?limit=500` for customer + segment fields
- `/api/products?limit=500` for product/category/subcategory and unit price/cost

Location search calls:

- `/api/locations?q=<postal-or-city-prefix>`

### 4.2 Field derivation in UI

Before submit, the UI derives:

- `sales` from selected product `UnitSP * quantity`
- `profit` from `(UnitSP - UnitCP) * quantity`

The UI also computes a preview of calendar fields from `orderDate`, but those calendar features are ultimately derived in Python inference logic as part of feature construction.

### 4.3 Request payload

The submit payload follows `ForecastShipmentInput` (`src/lib/forecast/types.ts`), and sends:

```json
{
  "shipments": [
    {
      "orderDate": "YYYY-MM-DD",
      "shipMode": "...",
      "shipModeID": 0,
      "postalCode": "...",
      "retailSalesPeopleID": 0,
      "productID": "...",
      "sales": 0,
      "quantity": 0,
      "profit": 0,
      "cusSegmentID": 0,
      "segment": "...",
      "subCategoryID": 0,
      "categoryID": 0,
      "region": "...",
      "longitude": 0,
      "latitude": 0
    }
  ]
}
```

## 5) API layer: validation and inference routing

`POST /api/forecast/predict` is implemented at `src/app/api/forecast/predict/route.ts`.

### 5.1 Input validation

The route:

1. Validates body shape (`shipments` array with at least one item).
2. Validates each required field and type.
3. Returns `400` with exact missing/invalid fields if any shipment is invalid.

### 5.2 Mock vs Python inference

Behavior is controlled by environment flags:

- If `FORECAST_USE_MOCK === "true"`, returns mock predictions from `src/lib/forecast/mock.ts`.
- Otherwise it calls Python inference (`runDelayForecastPython`).
- If Python fails and `FORECAST_FALLBACK_MOCK === "true"`, route falls back to mock.
- If Python fails and fallback is disabled, route returns `503`.

## 6) Node-to-Python bridge

Bridge logic is in `src/lib/forecast/predict.ts`.

It:

1. Spawns `python3` (or `FORECAST_PYTHON`) with script `scripts/forecast_predict.py`.
2. Passes JSON request body through `stdin`.
3. Parses `stdout` as JSON.
4. Rejects on non-JSON output, non-zero exits, explicit script error object, or invalid response shape.

## 7) Python inference script internals

Script: `scripts/forecast_predict.py`

### 7.1 Artifact loading

Loads:

- classifier (`delay_classifier.pkl`)
- metadata (`forecast_metadata.pkl`)

If either file is missing, it returns a structured error and exits non-zero.

### 7.2 Feature alignment

The script reads the feature list from metadata (`features.delay`), inspects the fitted sklearn preprocessor, and reconstructs rows in the exact expected training-column order.

It:

- normalizes camelCase aliases (for compatibility)
- derives calendar fields from `orderDate`
- fills missing categorical/numeric values with neutral defaults
- coerces values by expected type group (categorical, passthrough int, scaled numeric)

### 7.3 Scoring and labeling

For each shipment:

1. Runs `predict_proba(... )[:, 1]` on the calibrated classifier.
2. Rounds score to 2 decimals.
3. Converts score to `Low/Medium/High` using `0.3` and `0.6` thresholds.

The script returns:

- `modelVersion` (from metadata, with fallback)
- `generatedAt` (UTC ISO timestamp)
- `predictions[]` with `delayRiskScore`, `delayRiskLabel`, `explanation`

## 8) Lookup data sources in DB-backed APIs

These APIs populate required model fields:

- `/api/orders/lookup` -> `dim_shipmode`, `dim_retailsalespeople`
- `/api/customers` -> `dim_customer` + `dim_customersegment`
- `/api/products` -> `dim_product` + `dim_subcategory` + `dim_category`
- `/api/locations` -> `dim_location` (postal/city/region/coords)

DB access uses `src/lib/db.ts` (MySQL pool over SSL, configured by env vars).

## 9) Operational flow summary

1. User fills forecast form in `ForecastView`.
2. Form fetches reference entities (ship mode, customer, product, location).
3. Frontend builds one `ForecastShipmentInput`.
4. Frontend posts to `/api/forecast/predict`.
5. API validates request.
6. API uses mock or Python bridge depending on env flags.
7. Python loads model + metadata, builds aligned features, runs calibrated probability scoring.
8. API returns standardized response.
9. Frontend renders score, label, explanation, model version, and generation timestamp.
