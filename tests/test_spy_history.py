"""Completed-session boundaries and history output; no network required."""
import csv
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pandas as pd
from scripts import rebuild_spy_history as history


class SpyHistoryTests(unittest.TestCase):
    def test_session_boundaries(self):
        cases = [
            ('2026-09-09T11:00:00-04:00', '2026-09-08'),
            ('2026-09-09T15:59:59-04:00', '2026-09-08'),
            ('2026-09-09T16:00:00-04:00', '2026-09-09'),
            ('2026-09-09T17:00:00-04:00', '2026-09-09'),
            ('2026-09-12T17:00:00-04:00', '2026-09-11'),
            ('2026-09-07T17:00:00-04:00', '2026-09-04'),
            ('2026-11-27T12:59:59-05:00', '2026-11-25'),
            ('2026-11-27T13:00:00-05:00', '2026-11-27'),
            ('2026-12-09T20:59:59+00:00', '2026-12-08'),
            ('2026-12-09T21:00:00+00:00', '2026-12-09'),
        ]
        for timestamp, expected in cases:
            with self.subTest(timestamp=timestamp):
                self.assertEqual(str(history.latest_completed_session(
                    datetime.fromisoformat(timestamp))), expected)

    def test_history_includes_today_only_after_close(self):
        dates = pd.bdate_range('1993-01-29', '2026-09-10')
        frame = pd.DataFrame({'Close': 100.0, 'Adj Close': 50.0}, index=dates)
        for timestamp, expected in [
            ('2026-09-09T11:00:00-04:00', '2026-09-08'),
            ('2026-09-09T17:00:00-04:00', '2026-09-09'),
        ]:
            with self.subTest(timestamp=timestamp), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'data').mkdir()
                with patch.object(history, 'ROOT', root):
                    metadata = history.write_history(frame, now=datetime.fromisoformat(timestamp))
                with (root / 'data_spy.csv').open() as stream:
                    rows = list(csv.DictReader(stream))
                self.assertEqual(rows[-1]['date'], expected)
                self.assertEqual(metadata['last_date'], expected)
                self.assertEqual(float(rows[-1]['total_return_index']), 100.0)


if __name__ == '__main__':
    unittest.main()
