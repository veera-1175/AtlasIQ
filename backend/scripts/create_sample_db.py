"""Create sample sales SQLite database for AtlasIQ demos."""
import sqlite3
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.paths import sample_data_dir  # noqa: E402

SAMPLE_PATH = sample_data_dir() / "sales.db"


def main() -> None:
    SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SAMPLE_PATH.exists():
        SAMPLE_PATH.unlink()

    conn = sqlite3.connect(SAMPLE_PATH)
    try:
        conn.executescript(
            """
            CREATE TABLE customers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                region TEXT NOT NULL
            );

            CREATE TABLE sales (
                id INTEGER PRIMARY KEY,
                region TEXT NOT NULL,
                revenue REAL NOT NULL,
                quarter TEXT NOT NULL,
                sale_date TEXT NOT NULL
            );

            INSERT INTO customers (id, name, region) VALUES
                (1, 'Acme Corp', 'North America'),
                (2, 'Globex', 'Europe'),
                (3, 'Initech', 'Asia'),
                (4, 'Umbrella Co', 'North America'),
                (5, 'Stark Industries', 'Europe');

            INSERT INTO sales (id, region, revenue, quarter, sale_date) VALUES
                (1, 'North America', 1200000, 'Q1', '2024-01-15'),
                (2, 'Europe', 980000, 'Q1', '2024-02-10'),
                (3, 'Asia', 750000, 'Q1', '2024-03-05'),
                (4, 'North America', 3000000, 'Q2', '2024-04-20'),
                (5, 'Europe', 2100000, 'Q2', '2024-05-12'),
                (6, 'Asia', 1100000, 'Q2', '2024-06-08'),
                (7, 'North America', 2800000, 'Q3', '2024-07-22'),
                (8, 'Europe', 3100000, 'Q3', '2024-08-14'),
                (9, 'Asia', 1400000, 'Q3', '2024-09-30'),
                (10, 'North America', 4200000, 'Q4', '2024-10-18'),
                (11, 'Europe', 2900000, 'Q4', '2024-11-25'),
                (12, 'Asia', 1600000, 'Q4', '2024-12-12');
            """
        )
        conn.commit()
        print(f"Created {SAMPLE_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
