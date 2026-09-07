import unittest
from datetime import datetime

from scripts.fetch_dividends import (
    annualized_rate_from_payments,
    frequency_from_payment_dates,
)


class CalculationTests(unittest.TestCase):
    def test_dividend_frequency_uses_observed_cadence(self):
        monthly = [datetime(2026, month, 15) for month in range(1, 7)]
        quarterly = [
            datetime(2025, 12, 15),
            datetime(2026, 3, 15),
            datetime(2026, 6, 15),
        ]

        self.assertEqual(frequency_from_payment_dates(monthly), "monthly")
        self.assertEqual(frequency_from_payment_dates(quarterly), "quarterly")

    def test_dividend_frequency_does_not_guess_from_one_payment(self):
        self.assertIsNone(frequency_from_payment_dates([datetime(2026, 8, 15)]))

    def test_forward_dividend_rate_uses_latest_recurring_payment(self):
        payments = [
            {"ex_date": "2026-01-15", "amount": 0.20},
            {"ex_date": "2026-02-15", "amount": 0.21},
            {"ex_date": "2026-03-15", "amount": 0.25},
        ]

        self.assertEqual(annualized_rate_from_payments(payments, "monthly"), 3.0)


if __name__ == "__main__":
    unittest.main()
