import csv
import json
import tempfile
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from scripts import validate_data


class ValidateDataTests(unittest.TestCase):
    def test_spy_valuation_reconciles_forward_eps(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            payload = {
                "as_of": "2026-09-04",
                "source": "FactSet Earnings Insight",
                "source_url": "https://advantage.factset.com/report.pdf",
                "reported_forward_pe": 19.5,
                "reference_close_date": "2026-09-02",
                "reference_spx_close": 7666.6,
                "forward_12m_eps": 393.16,
                "actual_year": 2025,
                "actual_eps": 271.23,
                "current_year": 2026,
                "current_year_growth_pct": 31.5,
                "current_year_eps": 356.68,
                "next_year": 2027,
                "next_year_growth_pct": 15.0,
                "next_year_eps": 410.18,
            }
            (root / "data" / "spy_valuation.json").write_text(
                json.dumps(payload), encoding="utf-8"
            )
            with mock.patch.object(validate_data, "ROOT_DIR", str(root)):
                validate_data.validate_valuation(today=date(2026, 9, 7))
                payload["forward_12m_eps"] = 373.08
                (root / "data" / "spy_valuation.json").write_text(
                    json.dumps(payload), encoding="utf-8"
                )
                with self.assertRaisesRegex(ValueError, "does not reconcile"):
                    validate_data.validate_valuation(today=date(2026, 9, 7))

    def test_freshness_rejects_stale_and_future_dates(self):
        today = date(2026, 7, 31)

        validate_data.require_fresh_date("2026-07-27", "market data", 4, today)

        with self.assertRaisesRegex(ValueError, "is stale"):
            validate_data.require_fresh_date(
                "2026-07-26", "market data", 4, today
            )
        with self.assertRaisesRegex(ValueError, "in the future"):
            validate_data.require_fresh_date(
                "2026-08-01", "market data", 4, today
            )
        with self.assertRaisesRegex(ValueError, "invalid date"):
            validate_data.parse_date("2026-02-30", "market data")

    def test_scanner_checks_every_row(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            today = datetime.now(timezone.utc).date()
            rows = [self.scanner_row(index) for index in range(100)]
            rows[-1]["price"] = "not-a-number"
            scanner = {
                "meta": {"date": today.isoformat(), "total_stocks": len(rows)},
                "dashboard": self.scanner_dashboard(rows),
                "full_scanner": rows,
                "sector_heatmap": [],
            }
            (root / "data" / "scanner_data.json").write_text(
                json.dumps(scanner), encoding="utf-8"
            )
            self.write_breadth_history(root, today)

            with mock.patch.object(validate_data, "ROOT_DIR", str(root)):
                with self.assertRaisesRegex(ValueError, "row 100 invalid price"):
                    validate_data.validate_scanner()

    def test_scanner_requires_matching_breadth_date(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            today = datetime.now(timezone.utc).date()
            rows = [self.scanner_row(index) for index in range(100)]
            scanner = {
                "meta": {"date": today.isoformat(), "total_stocks": len(rows)},
                "dashboard": self.scanner_dashboard(rows),
                "full_scanner": rows,
                "sector_heatmap": [],
            }
            (root / "data" / "scanner_data.json").write_text(
                json.dumps(scanner), encoding="utf-8"
            )
            self.write_breadth_history(root, today - timedelta(days=1))

            with mock.patch.object(validate_data, "ROOT_DIR", str(root)):
                with self.assertRaisesRegex(ValueError, "scanner meta.date"):
                    validate_data.validate_scanner()

    def test_dividends_check_every_payment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "data").mkdir()
            today = datetime.now(timezone.utc).date()
            required_symbols = ["AAPL", "T", "O", "SCHD", "JEPI", "TDAQ", "IAUI"]
            symbols = required_symbols + [f"S{index}" for index in range(93)]
            tickers = {
                symbol: {
                    "name": f"Company {symbol}",
                    "dividend_yield": 2.5,
                    "dividend_rate": 1.0,
                    "frequency": "quarterly",
                    "last_payments": [
                        {"ex_date": today.isoformat(), "amount": 0.25}
                    ],
                }
                for symbol in symbols
            }
            tickers[symbols[-1]]["last_payments"][0]["amount"] = -1
            dividends = {
                "meta": {
                    "date": today.isoformat(),
                    "total_tickers": len(tickers),
                },
                "tickers": tickers,
            }
            (root / "data" / "dividend_data.json").write_text(
                json.dumps(dividends), encoding="utf-8"
            )

            with mock.patch.object(validate_data, "ROOT_DIR", str(root)):
                with self.assertRaisesRegex(ValueError, "invalid amount"):
                    validate_data.validate_dividends()

    @staticmethod
    def scanner_row(index):
        return {
            "symbol": f"S{index}",
            "name": f"Stock {index}",
            "price": 100,
            "sector": "Technology",
            "signal": "Full Bull",
            "ema8": 99,
            "ema13": 98,
            "ema21": 97,
            "rank": index + 1,
            "price_vs_8w": 1.01,
            "price_vs_13w": 2.04,
            "price_vs_21w": 3.09,
            "ema8_vs_13": 1.02,
            "ema13_vs_21": 1.03,
            "spread_score": 2.05,
        }

    @staticmethod
    def scanner_dashboard(rows):
        return {
            "total": len(rows),
            "signals": [{"signal": "Full Bull", "count": len(rows), "pct": 1.0}],
        }

    @staticmethod
    def write_breadth_history(root, end_date):
        path = root / "data" / "breadth_history.csv"
        fieldnames = [
            "date",
            "above_5d",
            "above_20d",
            "above_50d",
            "above_200d",
        ]
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for offset in range(99, -1, -1):
                writer.writerow(
                    {
                        "date": (end_date - timedelta(days=offset)).isoformat(),
                        "above_5d": 50,
                        "above_20d": 50,
                        "above_50d": 50,
                        "above_200d": 50,
                    }
                )


if __name__ == "__main__":
    unittest.main()
