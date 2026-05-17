#!/usr/bin/env python3
# Requires: pandas numpy joblib scikit-learn
#
# Inference script for notebooks/artifacts delay_classifier.pkl.
# Reads JSON from stdin: {"shipments":[{"orderDate","shipMode","quantity","sales",...}]}
# Prints JSON predictions to stdout (single line).

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import joblib
import pandas as pd


def _fitted_column_groups(estimator):
    """Infer num_scaled / num_passthrough / cat columns from pickled sklearn Pipeline."""
    prep = estimator.named_steps["preprocessor"]
    scaled, passthrough_int, categorical = [], [], []
    for name, _trans, cols in prep.transformers_:
        if name == "num_scaled":
            scaled = list(cols)
        elif name == "num_passthrough":
            passthrough_int = list(cols)
        elif name == "cat":
            categorical = list(cols)
    return scaled, passthrough_int, categorical


def _delay_risk_label(score: float) -> str:
    if score >= 0.6:
        return "High"
    if score >= 0.3:
        return "Medium"
    return "Low"


def _normalize_shipment_aliases(shipment: dict) -> dict:
    """TS client sends camelCase; sklearn training may use productID."""
    s = dict(shipment)
    if s.get("productID") is None and s.get("productId") is not None:
        s["productID"] = s["productId"]
    if s.get("shipModeID") is None and s.get("shipModeId") is not None:
        s["shipModeID"] = s["shipModeId"]
    if s.get("retailSalesPeopleID") is None and s.get("retailSalesPeopleId") is not None:
        s["retailSalesPeopleID"] = s["retailSalesPeopleId"]
    if s.get("cusSegmentID") is None and s.get("cusSegmentId") is not None:
        s["cusSegmentID"] = s["cusSegmentId"]
    if s.get("subCategoryID") is None and s.get("subCategoryId") is not None:
        s["subCategoryID"] = s["subCategoryId"]
    if s.get("categoryID") is None and s.get("categoryId") is not None:
        s["categoryID"] = s["categoryId"]
    return s


def _build_row(features: list[str], scaled, passthrough_int, categorical, shipment: dict) -> dict:
    """Map API shipment + defaults into one row aligned with training columns."""
    shipment = _normalize_shipment_aliases(shipment)
    order_raw = shipment.get("orderDate")
    order = pd.to_datetime(order_raw, errors="coerce")
    if pd.isna(order):
        order = pd.Timestamp.now().normalize()

    row: dict = {}
    for c in features:
        if c in categorical:
            row[c] = ""
        elif c in passthrough_int:
            row[c] = 0
        elif c in scaled:
            row[c] = 0.0
        else:
            row[c] = 0

    row["month"] = int(order.month)
    row["dayOfMonth"] = int(order.day)
    row["isWeekend"] = int(order.dayofweek >= 5)
    row["dayOfWeek"] = str(order.day_name())

    if "shipMode" in features and shipment.get("shipMode") is not None:
        row["shipMode"] = str(shipment["shipMode"]).strip()

    if "sales" in features and shipment.get("sales") is not None:
        v = shipment["sales"]
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v)):
            row["sales"] = float(v)

    if "quantity" in features and shipment.get("quantity") is not None:
        v = shipment["quantity"]
        if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(float(v)):
            row["quantity"] = float(v)

    # Known optional passthrough IDs if client sends integers
    for key in (
        "shipModeID",
        "postalCode",
        "retailSalesPeopleID",
        "productID",
        "profit",
        "cusSegmentID",
        "segment",
        "subCategoryID",
        "categoryID",
        "region",
        "longitude",
        "latitude",
    ):
        if key not in features:
            continue
        if key == "segment" or key == "region":
            if shipment.get(key) is not None:
                row[key] = str(shipment[key]).strip()
            continue
        if shipment.get(key) is None:
            continue
        v = shipment[key]
        try:
            if key in categorical:
                row[key] = str(v).strip()
            elif key == "productID":
                row[key] = str(int(v)) if str(v).strip().isdigit() else str(v).strip()
            else:
                row[key] = float(v)
        except (TypeError, ValueError):
            pass

    for c in categorical:
        row[c] = "" if row[c] is None else str(row[c])

    for c in passthrough_int:
        try:
            row[c] = int(row[c])
        except (TypeError, ValueError):
            row[c] = 0

    for c in scaled:
        try:
            row[c] = float(row[c])
        except (TypeError, ValueError):
            row[c] = 0.0

    return row


def main() -> None:
    parser = argparse.ArgumentParser(description="Forecast delay-risk from trained joblib artifacts.")
    root = Path(__file__).resolve().parents[1]
    parser.add_argument(
        "--classifier",
        type=Path,
        default=root / "models" / "forecast" / "delay_classifier.pkl",
        help="Path to delay_classifier.pkl",
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=root / "models" / "forecast" / "forecast_metadata.pkl",
        help="Path to forecast_metadata.pkl",
    )
    args = parser.parse_args()

    if not args.classifier.exists():
        print(json.dumps({"error": f"Classifier not found: {args.classifier}"}), file=sys.stdout)
        sys.exit(2)
    if not args.metadata.exists():
        print(json.dumps({"error": f"Metadata not found: {args.metadata}"}), file=sys.stdout)
        sys.exit(2)

    payload = json.load(sys.stdin)
    shipments = payload.get("shipments")
    if not isinstance(shipments, list) or len(shipments) == 0:
        print(json.dumps({"error": "Expected { shipments: [...] } with at least one item"}))
        sys.exit(1)

    metadata = joblib.load(args.metadata)
    clf = joblib.load(args.classifier)

    calibrated = clf.calibrated_classifiers_[0]
    base_pipeline = calibrated.estimator
    features = list(metadata["features"]["delay"])
    scaled_list, passthrough_list, categorical_list = _fitted_column_groups(base_pipeline)

    rows = [
        _build_row(features, scaled_list, passthrough_list, categorical_list, dict(s))
        for s in shipments
    ]

    df = pd.DataFrame(rows)[features]
    probs = clf.predict_proba(df)[:, 1]
    model_version = str(metadata.get("modelVersion") or "delay-calibrated-unknown")

    predictions = []
    for i, raw in enumerate(probs):
        score = round(float(raw), 2)
        label = _delay_risk_label(score)
        predictions.append(
            {
                "delayRiskScore": score,
                "delayRiskLabel": label,
                "explanation": "Calibrated late-shipment probability (trained delay classifier using order calendar, ship mode, and cargo fields; missing retail attributes default to neutral).",
            }
        )

    out = {
        "modelVersion": model_version,
        "generatedAt": pd.Timestamp.utcnow().isoformat() + "Z",
        "predictions": predictions,
    }
    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
