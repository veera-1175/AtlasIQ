from typing import Any


def detect_trends(columns: list[str], rows: list[dict[str, Any]]) -> list[str]:
    if len(rows) < 2:
        return []

    numeric_cols = [
        c
        for c in columns
        if all(isinstance(r.get(c), (int, float)) and not isinstance(r.get(c), bool) for r in rows if r.get(c) is not None)
    ]
    if not numeric_cols:
        return []

    trends: list[str] = []
    col = numeric_cols[0]
    values = [float(r[col]) for r in rows if r.get(col) is not None]
    if len(values) < 2:
        return trends

    first, last = values[0], values[-1]
    if first == 0:
        return trends

    pct = ((last - first) / abs(first)) * 100
    direction = "grew" if pct > 0 else "declined"
    trends.append(f"{col.replace('_', ' ')} {direction} {abs(pct):.1f}% from first to last row")

    if len(values) >= 3:
        mid = len(values) // 2
        first_half = sum(values[:mid]) / mid
        second_half = sum(values[mid:]) / (len(values) - mid)
        if first_half > 0:
            half_pct = ((second_half - first_half) / abs(first_half)) * 100
            if abs(half_pct) >= 5:
                half_dir = "increased" if half_pct > 0 else "decreased"
                trends.append(f"Average {col.replace('_', ' ')} {half_dir} {abs(half_pct):.1f}% in the second half")

    return trends
