#!/usr/bin/env python3
"""Rebuild SPY as one consistent raw-close and dividend-reinvested return series.
Always refresh the full adjusted history: dividend adjustment factors change.
Only completed exchange sessions are accepted; no intraday quotes.
"""
import csv
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import exchange_calendars as xcals

ROOT = Path(__file__).resolve().parents[1]

def latest_completed_session(now):
    """Use the exchange close, including holidays, early closes and DST."""
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError('now must be timezone-aware')
    today = now.astimezone(ZoneInfo('America/New_York')).date()
    calendar = xcals.get_calendar('XNYS', start=f'{today.year - 1}-01-01',
                                  end=f'{today.year + 1}-12-31')
    session = calendar.date_to_session(today.isoformat(), direction='previous')
    if calendar.session_close(session) > now:
        session = calendar.previous_session(session)
    return session.date()


def write_history(frame, now=None):
    cutoff = latest_completed_session(now or datetime.now(ZoneInfo('America/New_York')))
    close, adjusted = frame['Close'], frame['Adj Close']
    if hasattr(close, 'columns'):
        close, adjusted = close.iloc[:, 0], adjusted.iloc[:, 0]
    rows = [(d.date().isoformat(), float(close.loc[d]), float(adjusted.loc[d]))
            for d in frame.index if d.date() <= cutoff]
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
        'completion_policy': 'Include sessions through the latest completed NYSE close, including early closes; live quotes never enter history',
        'risk_policy': 'Prior calendar week only; first 200 weeks warm up, trailing percentile uses up to 20 years',
        'legacy_proxy': 'spy_legacy_proxy.csv: archived scaled SPX before SPY inception, inherited adjustment basis unverified; excluded from all models and simulations',
        'sha256': hashlib.sha256(content.encode()).hexdigest(),
    }
    (ROOT / 'data/spy_history_metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    return metadata

if __name__ == '__main__':
    import yfinance as yf

    # Capture the cutoff before downloading so a request crossing the close
    # cannot admit a bar that was fetched while the session was still open.
    now = datetime.now(ZoneInfo('America/New_York'))
    result = write_history(yf.download('SPY', period='max', interval='1d', auto_adjust=False, progress=False), now=now)
    print(json.dumps(result, indent=2))
