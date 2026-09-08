"""Source reconciliation safeguards; no network needed."""
import unittest
from datetime import date
from unittest.mock import patch
from scripts import fetch_spy_valuation as valuation

class Page:
    def __init__(self, text): self.text = text
    def extract_text(self): return self.text

class Reader:
    def __init__(self, text): self.pages = [Page(text)]

class SpyValuationTests(unittest.TestCase):
    def test_explicit_report_close_instead_of_guessed_weekday(self):
        sample = 'The bottom-up target price for the S&P 500 is 9240.59, which is 19.3% above the closing price of 7747.71.'
        with patch.object(valuation, 'PdfReader', return_value=Reader(sample)):
            self.assertEqual(valuation.extract_reference_close(b''), 7747.71)
    def test_missing_report_close_fails_closed(self):
        with patch.object(valuation, 'PdfReader', return_value=Reader('No reference close.')):
            with self.assertRaises(RuntimeError): valuation.extract_reference_close(b'')
    def test_approximate_eps_and_unknown_reference_date_are_explicit(self):
        record = valuation.build_record(date(2026,9,4),'report',19.5,31.5,15.0,None,7747.71)
        self.assertEqual(record['forward_12m_eps'],397.32)
        self.assertIsNone(record['reference_close_date'])
        self.assertIn('Approximate',record['forward_eps_basis'])
        self.assertIn('Illustrative',record['calendar_eps_basis'])
    def test_new_year_requires_reviewed_anchor(self):
        with self.assertRaises(RuntimeError):
            valuation.build_record(date(2027,1,8),'report',19.5,10,10,None,7747.71)

if __name__ == '__main__': unittest.main()
