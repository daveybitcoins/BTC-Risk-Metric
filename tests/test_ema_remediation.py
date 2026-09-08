"""Behavior checks for comparable breadth history and valuation inputs."""
import csv
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import process_ema as model

FIELDS = ['above_5d', 'above_20d', 'above_50d', 'above_200d']

class BreadthCorrections(unittest.TestCase):
    def test_nyse_holidays_and_weekends_are_not_observations(self):
        self.assertEqual(model._exchange_sessions('2026-09-04', '2026-09-08'), ['2026-09-04', '2026-09-08'])
        self.assertEqual(model._exchange_sessions('2026-04-02', '2026-04-06'), ['2026-04-02', '2026-04-06'])
        self.assertEqual(model._exchange_sessions('2026-09-07', '2026-09-07'), [])

    def test_zero_is_valid_and_missing_is_excluded_on_common_window(self):
        dates = model._exchange_sessions('2026-01-02', '2026-04-01')
        history = [{'date': date, **dict.fromkeys(FIELDS, float(i))} for i, date in enumerate(dates)]
        history[1]['above_5d'] = None
        result = model._compute_breadth_stats(history, dict.fromkeys(FIELDS, 0))
        for indicator in result['indicators']:
            self.assertEqual(indicator['hist_min'], 0)
            self.assertEqual(indicator['data_points'], len(history) - 1)

    def test_missing_target_does_not_compress_horizon(self):
        dates = model._exchange_sessions('2026-01-02', '2026-08-31')
        history = [{'date': date, 'above_5d': 50.0} for date in dates]
        history[0]['above_5d'] = 0.0
        history.pop(5)  # fifth session target absent, sixth must not substitute
        result = model._compute_forward_returns(history, {'above_5d': 0}, ['above_5d'], {'above_5d': 'Oversold'})[0]
        self.assertNotIn(5, [h['days'] for h in result['horizons']])
        self.assertEqual(result['horizons'][0]['avg_change'], 50)

    def test_high_zone_reports_frequency_of_lower_breadth(self):
        dates = model._exchange_sessions('2026-01-02', '2026-08-31')
        history = [{'date': date, 'above_5d': 0.0} for date in dates]
        history[0]['above_5d'] = 100.0
        result = model._compute_forward_returns(history, {'above_5d': 100}, ['above_5d'], {'above_5d': 'Overbought'})[0]
        self.assertEqual(result['direction'], 'overbought')
        self.assertTrue(all(h['pct_revert'] == 100 and h['avg_change'] == -100 for h in result['horizons']))

    def test_closed_session_does_not_write_history(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(model, 'BREADTH_HISTORY', str(Path(directory) / 'history.csv')):
            model._append_breadth_history('2026-09-07', dict.fromkeys(FIELDS, 50))
            self.assertFalse(Path(model.BREADTH_HISTORY).exists())

    def test_append_updates_source_digest_without_duplicate_dates(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(model, 'BREADTH_HISTORY', str(Path(directory) / 'history.csv')), patch.object(model, 'CSV_DIR', directory):
            snapshot = Path(directory) / 'Weekly EMA Values_2026-09-08.csv'
            snapshot.write_text('original input')
            model._append_breadth_history('2026-09-08', dict.fromkeys(FIELDS, 50), str(snapshot))
            manifest_path = Path(directory) / 'history.provenance.json'
            original = json.loads(manifest_path.read_text())
            snapshot.write_text('updated input')
            model._append_breadth_history('2026-09-08', dict.fromkeys(FIELDS, 51), str(snapshot))
            updated = json.loads(manifest_path.read_text())
            self.assertEqual(len(updated['sources']), 1)
            self.assertEqual(updated['sources'][0]['sha256'], hashlib.sha256(snapshot.read_bytes()).hexdigest())
            self.assertNotEqual(original['sources'][0]['sha256'], updated['sources'][0]['sha256'])
            with open(model.BREADTH_HISTORY) as handle:
                self.assertEqual(len(list(csv.DictReader(handle))), 1)

    def test_screen_preserves_source_growth_without_reverse_rounded_peg(self):
        stock = dict(symbol='TEST', peg=.01, fwd_pe=8.5, mkt_cap_b=60, analyst='Buy', price=10, eps_growth_yoy_ttm=899.6351)
        row = model.build_best_opportunities([stock])[0]
        self.assertEqual(row['eps_growth_yoy_ttm'], 899.6351)
        self.assertNotIn('implied_growth', row)

if __name__ == '__main__':
    unittest.main()
