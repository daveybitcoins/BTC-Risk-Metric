#!/usr/bin/env python3
"""Rebuild SPY as one consistent raw-close and dividend-reinvested return series.
Always refresh the full adjusted history: dividend adjustment factors change.
Only dates before today's New York date are accepted; no intraday quotes.
"""
import csv
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]

def write_history(frame, today=None):
    today = today or datetime.now(ZoneInfo('America/New_York')).date()
    close, adjusted = frame['Close'], frame['Adj Close']
    if hasattr(close, 'columns'):
        close, adjusted = close.iloc[:, 0], adjusted.iloc[:, 0]
    rows = [(d.date().isoformat(), float(close.loc[d]), float(adjusted.loc[d]))
            for d in frame.index if d.date() < today]
    if len(rows) < 8000 or rows[0][0] != '1993-01-29':
        raise RuntimeError('Incomplete SPY download; existing data preserved')
    if any(not (math.isfinite(p) and math.isfinite(a) and p > 0 and a > 0) for _, p, a in rows):
        raise RuntimeError('Invalid SPY price; existing data preserved')
    path = ROOT / 'data_spy.csv'
    proxy = ROOT / 'data/spy_legacy_proxy.csv'
    if not proxy.exists() and path.exists():
        legacy = list(csv.DictReader(path.open()))
        with proxy.open('w') as f:
            f.write('date,legacy_scaled_price\n')
            for r in legacy:
                if r['date'] < '1993-01-22':
                    f.write(f"{r['date']},{r['price']}\n")
    anchor = rows[0][2]
    content = 'date,price,total_return_index\n' + ''.join(
        f'{d},{p:.6f},{a / anchor * 100:.8f}\n' for d, p, a in rows)
    path.write_text(content)
    metadata = {
        'source': 'Yahoo Finance via yfinance, auto_adjust=False',
        'source_url': 'https://finance.yahoo.com/quote/SPY/history/',
        'first_date': rows[0][0], 'last_date': rows[-1][0], 'rows': len(rows),
        'price_basis': 'Close: split-adjusted, not dividend-adjusted',
        'total_return_index': 'Adj Close / first Adj Close * 100; distributions reinvested, before taxes and trading costs',
        'completion_policy': 'Exclude the current New York calendar date; live quotes never enter history',
        'risk_policy': 'Prior calendar week only; first 200 weeks warm up, trailing percentile uses up to 20 years',
        'legacy_proxy': 'spy_legacy_proxy.csv: archived scaled SPX before SPY inception, inherited adjustment basis unverified; excluded from all models and simulations',
        'sha256': hashlib.sha256(content.encode()).hexdigest(),
    }
    (ROOT / 'data/spy_history_metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata

if __name__ == '__main__':
    result = write_history(yf.download('SPY', period='max', interval='1d', auto_adjust=False, progress=False))
    print(json.dumps(result, indent=2))
