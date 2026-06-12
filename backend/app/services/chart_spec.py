from typing import Any

from app.models.schemas import ChartSpec

NUMERIC_HINTS = {"int", "integer", "real", "float", "double", "numeric", "decimal", "number"}
DATE_HINTS = {"date", "datetime", "timestamp", "time"}


def _is_numeric(val: Any) -> bool:
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def _looks_like_date(val: Any) -> bool:
    if not isinstance(val, str):
        return False
    return any(ch in val for ch in "-/") and any(c.isdigit() for c in val)


def _column_types(columns: list[str], rows: list[dict[str, Any]]) -> dict[str, str]:
    types: dict[str, str] = {}
    for col in columns:
        sample = next((r.get(col) for r in rows if r.get(col) is not None), None)
        if _is_numeric(sample):
            types[col] = "numeric"
        elif _looks_like_date(sample):
            types[col] = "date"
        else:
            types[col] = "categorical"
    return types


def build_chart_spec(columns: list[str], rows: list[dict[str, Any]]) -> ChartSpec | None:
    if not columns or not rows or len(columns) < 2:
        return None

    types = _column_types(columns, rows)
    numeric_cols = [c for c in columns if types[c] == "numeric"]
    date_cols = [c for c in columns if types[c] == "date"]
    cat_cols = [c for c in columns if types[c] == "categorical"]

    if date_cols and numeric_cols and len(rows) >= 2:
        return ChartSpec(
            type="line",
            x_column=date_cols[0],
            y_column=numeric_cols[0],
            title=f"{numeric_cols[0]} over time",
        )

    if len(cat_cols) == 1 and len(numeric_cols) == 1 and len(rows) <= 20:
        return ChartSpec(
            type="bar",
            x_column=cat_cols[0],
            y_column=numeric_cols[0],
            title=f"{numeric_cols[0]} by {cat_cols[0]}",
        )

    if len(cat_cols) == 1 and len(numeric_cols) == 0 and len(rows) <= 10:
        return ChartSpec(
            type="pie",
            x_column=cat_cols[0],
            y_column=cat_cols[0],
            title=f"Distribution of {cat_cols[0]}",
        )

    if cat_cols and numeric_cols:
        return ChartSpec(
            type="bar",
            x_column=cat_cols[0],
            y_column=numeric_cols[0],
            title=f"{numeric_cols[0]} by {cat_cols[0]}",
        )

    return None
