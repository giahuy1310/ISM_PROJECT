"""
Time-series-safe ETA regression with chronological 80/10/10 split.

- Sort by OrderDate; split into train (80%), validation (10%), and test (10%).
- Model family: compare candidates on the 10% temporal validation holdout (not random).
- Tuning: RandomizedSearchCV + custom rolling splits (12m train / 3m val / 3m step) on train only; search uses at most 3 folds.
- Pipeline fits preprocessing only inside each training fold (no leakage).

Usage:
  python scripts/eta_rolling_cv.py
  python scripts/eta_rolling_cv.py --csv /path/to/master_dataset.csv
  python scripts/eta_rolling_cv.py --demo   # synthetic data, no CSV required
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterator, List, Tuple

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import BaseCrossValidator, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TARGET = "Days"
DATE_COL = "OrderDate"
# Fewer folds during hyperparameter search than the full rolling schedule (much faster).
MAX_SEARCH_CV_FOLDS = 3

# Default features for master retail schema (exclude target, dates, and direct leakage).
# ShipDate is omitted because Days is typically derived from ShipDate - OrderDate.
feature_cols: List[str] = [
    "Quantity",
    "Sales",
    "Profit",
    "Cost",
    "UnitCP",
    "UnitSP",
    "longitude",
    "latitude",
    "year",
    "month",
    "dayOfWeek",
    "ShipMode",
    "Country",
    "Region",
    "Segment",
    "Category",
    "SubCategory",
]
numeric_features: List[str] = [
    "Quantity",
    "Sales",
    "Profit",
    "Cost",
    "UnitCP",
    "UnitSP",
    "longitude",
    "latitude",
    "year",
    "month",
]
categorical_features: List[str] = [
    "dayOfWeek",
    "ShipMode",
    "Country",
    "Region",
    "Segment",
    "Category",
    "SubCategory",
]


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_csv_path(explicit: Path | None) -> Path:
    if explicit is not None:
        return explicit
    root = _repo_root()
    for candidate in (
        root / "master_dataset.csv",
        root / "data" / "master_dataset.csv",
        root / "data" / "processed" / "master_dataset.csv",
    ):
        if candidate.is_file():
            return candidate
    return root / "master_dataset.csv"


def make_synthetic_master(n_rows: int = 8000, seed: int = 0) -> pd.DataFrame:
    """Dense calendar-ish orders 2014–2017 for smoke-testing folds and CV."""
    rng = np.random.default_rng(seed)
    start = pd.Timestamp("2014-01-02")
    end = pd.Timestamp("2017-12-30")
    span_days = int((end.normalize() - start.normalize()).days) + 1
    day_offsets = rng.integers(0, span_days, size=n_rows)
    order_dates = start.normalize() + pd.to_timedelta(day_offsets, unit="D")
    order_dates = order_dates + pd.to_timedelta(rng.integers(0, 86400, size=n_rows), unit="s")
    df = pd.DataFrame({DATE_COL: order_dates})
    df["Quantity"] = rng.integers(1, 20, size=n_rows)
    df["Sales"] = rng.uniform(5, 500, size=n_rows)
    df["Profit"] = rng.uniform(-50, 80, size=n_rows)
    df["Cost"] = rng.uniform(5, 400, size=n_rows)
    df["UnitCP"] = rng.uniform(1, 50, size=n_rows)
    df["UnitSP"] = rng.uniform(2, 60, size=n_rows)
    df["longitude"] = rng.uniform(-120, -70, size=n_rows)
    df["latitude"] = rng.uniform(25, 48, size=n_rows)
    df["year"] = df[DATE_COL].dt.year
    df["month"] = df[DATE_COL].dt.month
    for col, cats in (
        ("ShipMode", ["A", "B", "C"]),
        ("Country", ["US", "CA", "MX"]),
        ("Region", ["East", "West", "Central"]),
        ("Segment", ["Consumer", "Corporate"]),
        ("Category", ["Office", "Furniture", "Tech"]),
        ("SubCategory", ["Chairs", "Phones", "Paper"]),
    ):
        df[col] = rng.choice(cats, size=n_rows)
    # Target loosely related to features (not meant to be realistic)
    df[TARGET] = (
        3
        + 0.01 * df["Quantity"]
        + 0.002 * df["Sales"]
        + rng.normal(0, 2, size=n_rows)
    ).clip(1, 60)
    return df.sort_values(DATE_COL).reset_index(drop=True)


def _one_hot_encoder() -> OneHotEncoder:
    try:
        return OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    except TypeError:
        return OneHotEncoder(handle_unknown="ignore", sparse=False)


def make_preprocessor(
    numeric_features: List[str], categorical_features: List[str]
) -> ColumnTransformer:
    transformers: List[Tuple[str, Pipeline, List[str]]] = []
    if numeric_features:
        month_passthrough = [c for c in numeric_features if c.lower() == "month"]
        scaled_numeric_features = [c for c in numeric_features if c not in month_passthrough]
        numeric_transformer = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ]
        )
        if scaled_numeric_features:
            transformers.append(("num", numeric_transformer, scaled_numeric_features))
        if month_passthrough:
            transformers.append(("num_month_passthrough", "passthrough", month_passthrough))
    if categorical_features:
        categorical_transformer = Pipeline(
            steps=[
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("onehot", _one_hot_encoder()),
            ]
        )
        transformers.append(("cat", categorical_transformer, categorical_features))
    if not transformers:
        raise ValueError("At least one of numeric_features or categorical_features must be non-empty.")
    return ColumnTransformer(transformers=transformers)


def intersect_feature_lists(df: pd.DataFrame) -> Tuple[List[str], List[str], List[str]]:
    present = set(df.columns)
    feats = [c for c in feature_cols if c in present]
    num = [c for c in numeric_features if c in present]
    cat = [c for c in categorical_features if c in present]
    ordered = [c for c in feats if c in num or c in cat]
    if not ordered:
        num = df.select_dtypes(include=[np.number]).columns.tolist()
        for c in (TARGET,):
            if c in num:
                num.remove(c)
        cat = df.select_dtypes(include=["object", "category"]).columns.tolist()
        if DATE_COL in cat:
            cat.remove(DATE_COL)
        ordered = num + cat
        num = [c for c in ordered if c in num]
        cat = [c for c in ordered if c in cat]
    return ordered, num, cat


def make_model_candidates() -> dict:
    return {
        "ridge": Ridge(),
        "rf": RandomForestRegressor(random_state=0, n_jobs=-1),
    }


class RollingYearMonthSplit(BaseCrossValidator):
    """
    Rolling splits on time-ordered dev rows: 12-month train, next 3-month val, step 3 months.
    self.dates must align row-for-row with X passed to split().
    """

    def __init__(
        self,
        dates: pd.Series,
        train_months: int = 12,
        val_months: int = 3,
        step_months: int = 3,
        dev_end: pd.Timestamp | str = "2016-12-31",
    ):
        self.dates = pd.to_datetime(dates).reset_index(drop=True)
        self.train_months = train_months
        self.val_months = val_months
        self.step_months = step_months
        self.dev_end = pd.Timestamp(dev_end)

    def get_n_splits(self, X=None, y=None, groups=None) -> int:
        return sum(1 for _ in self.split(X, y, groups))

    def split(self, X, y=None, groups=None) -> Iterator[Tuple[np.ndarray, np.ndarray]]:
        if len(self.dates) != len(X):
            raise ValueError("dates length must match X length")

        first = self.dates.min()
        train_starts = pd.date_range(
            start=pd.Timestamp(year=first.year, month=first.month, day=1),
            end=self.dev_end,
            freq=pd.DateOffset(months=self.step_months),
        )

        for train_start in train_starts:
            train_end = train_start + pd.DateOffset(months=self.train_months) - pd.Timedelta(days=1)
            val_start = train_end + pd.Timedelta(days=1)
            val_end = val_start + pd.DateOffset(months=self.val_months) - pd.Timedelta(days=1)
            if val_end > self.dev_end:
                break

            tr_mask = (self.dates >= train_start) & (self.dates <= train_end)
            va_mask = (self.dates >= val_start) & (self.dates <= val_end)
            if int(tr_mask.sum()) == 0 or int(va_mask.sum()) == 0:
                continue

            train_idx = np.flatnonzero(tr_mask.to_numpy())
            val_idx = np.flatnonzero(va_mask.to_numpy())
            yield train_idx, val_idx


def param_grid_for(name: str) -> dict:
    if name == "ridge":
        return {"model__alpha": np.logspace(-3, 3, 20)}
    if name == "rf":
        return {
            "model__n_estimators": [50, 100, 200],
            "model__max_depth": [None, 4, 8, 16],
            "model__min_samples_leaf": [1, 2, 5],
        }
    return {}


def main() -> None:
    parser = argparse.ArgumentParser(description="Rolling-window CV for ETA (Days).")
    parser.add_argument("--csv", type=Path, default=None, help="Path to master_dataset.csv")
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Use synthetic data instead of CSV (for smoke tests without a file).",
    )
    args = parser.parse_args()

    if args.demo:
        df = make_synthetic_master()
    else:
        csv_path = resolve_csv_path(args.csv)
        if not csv_path.is_file():
            raise FileNotFoundError(
                f"Dataset not found: {csv_path}. Place master_dataset.csv there, pass --csv, or use --demo."
            )
        df = pd.read_csv(csv_path, parse_dates=[DATE_COL])

    df[DATE_COL] = pd.to_datetime(df[DATE_COL])
    df["dayOfWeek"] = df[DATE_COL].dt.day_name()
    # Time-series safe: strict chronological order; no future rows before past.
    df = df.sort_values(DATE_COL).reset_index(drop=True)

    n_rows = len(df)
    train_end = int(np.floor(n_rows * 0.80))
    val_end = int(np.floor(n_rows * 0.90))
    if train_end < 1 or val_end <= train_end or val_end >= n_rows:
        raise ValueError("Not enough rows for chronological 80/10/10 train/validation/test split.")

    train_df = df.iloc[:train_end].copy()
    val_df = df.iloc[train_end:val_end].copy()
    test_df = df.iloc[val_end:].copy()

    feat, num_feats, cat_feats = intersect_feature_lists(train_df)
    X_train = train_df[feat]
    y_train = train_df[TARGET]
    X_val = val_df[feat]
    y_val = val_df[TARGET]
    X_test = test_df[feat] if len(test_df) else pd.DataFrame(columns=feat)
    y_test = test_df[TARGET] if len(test_df) else pd.Series(dtype=float)

    print(
        f"Chronological split sizes: train={len(train_df)} ({len(train_df) / n_rows:.1%}), "
        f"validation={len(val_df)} ({len(val_df) / n_rows:.1%}), test={len(test_df)} ({len(test_df) / n_rows:.1%})"
    )

    splitter = RollingYearMonthSplit(train_df[DATE_COL], dev_end=train_df[DATE_COL].max())
    print("Rolling CV folds (train only, 12m train / 3m val / 3m step):")
    n_folds = 0
    for k, (tr, va) in enumerate(splitter.split(X_train, y_train)):
        n_folds += 1
        tr_dates = train_df.loc[tr, DATE_COL]
        va_dates = train_df.loc[va, DATE_COL]
        print(
            f"Fold {k}: train {tr_dates.min().date()}..{tr_dates.max().date()} "
            f"(n={len(tr)}); val {va_dates.min().date()}..{va_dates.max().date()} (n={len(va)})"
        )
    if n_folds == 0:
        raise RuntimeError(
            "No rolling folds generated — check train_df date span vs 12m+3m windows."
        )

    best_name = None
    best_mae = np.inf
    for name, est in make_model_candidates().items():
        pre = make_preprocessor(num_feats, cat_feats)
        pipe = Pipeline([("prep", pre), ("model", est)])
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_val)
        mae = mean_absolute_error(y_val, pred)
        rmse = mean_squared_error(y_val, pred) ** 0.5
        print(f"[10% validation] {name}: MAE={mae:.4f} RMSE={rmse:.4f}")
        if mae < best_mae:
            best_mae, best_name = mae, name

    assert best_name is not None
    print(f"Selected model family: {best_name} (MAE={best_mae:.4f} on 10% temporal validation)")

    base_pre = make_preprocessor(num_feats, cat_feats)
    chosen_est = make_model_candidates()[best_name]
    pipe_search = Pipeline([("prep", base_pre), ("model", chosen_est)])

    rolling_cv = RollingYearMonthSplit(train_df[DATE_COL], dev_end=train_df[DATE_COL].max())
    search_cv_folds: list[tuple[np.ndarray, np.ndarray]] = []
    for fold_idx, (tr_idx, va_idx) in enumerate(rolling_cv.split(X_train, y_train)):
        if fold_idx >= MAX_SEARCH_CV_FOLDS:
            break
        search_cv_folds.append((tr_idx, va_idx))
    if len(search_cv_folds) == 0:
        raise RuntimeError(
            "No rolling folds for RandomizedSearchCV — check train_df date span vs 12m+3m windows."
        )
    print(
        f"Hyperparameter search: RandomizedSearchCV with {len(search_cv_folds)} fold(s) "
        f"(max {MAX_SEARCH_CV_FOLDS}; full splitter has more windows)."
    )
    search = RandomizedSearchCV(
        estimator=pipe_search,
        param_distributions=param_grid_for(best_name),
        n_iter=15,
        scoring="neg_mean_absolute_error",
        cv=search_cv_folds,
        random_state=0,
        n_jobs=-1,
        refit=True,
    )
    # CV fits the pipeline on train indices only each fold — imputers/scalers never see validation rows during fit.
    search.fit(X_train, y_train)
    print("Best rolling-CV params:", search.best_params_)
    print("Best rolling-CV score (neg_MAE):", search.best_score_)

    final = search.best_estimator_
    if len(test_df) == 0:
        print("No rows in 10% test holdout — skip final test metrics.")
    else:
        y_hat = final.predict(X_test)
        mae_test = mean_absolute_error(y_test, y_hat)
        rmse_test = mean_squared_error(y_test, y_hat) ** 0.5
        print(f"Final test (10% holdout): MAE={mae_test:.4f} RMSE={rmse_test:.4f}")

    # Leakage rules (feature engineering outside this script):
    # - Do not use future-dated rows when building features for a given OrderDate.
    # - Rolling aggregates: groupby + shift(1) before rolling so the current row uses only past data.
    # - Never fit preprocessing on full data before CV; use Pipeline + RandomizedSearchCV as here.


if __name__ == "__main__":
    main()
