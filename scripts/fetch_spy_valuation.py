#!/usr/bin/env python3
"""Refresh the SPY dashboard's forward-earnings anchor from FactSet."""

import io
import json
import re
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yfinance as yf
from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "data" / "spy_valuation.json"
ACTUAL_YEAR = 2025
ACTUAL_EPS = 271.23
REPORT_BASE = (
    "https://advantage.factset.com/hubfs/Website/Resources%20Section/"
    "Research%20Desk/Earnings%20Insight/EarningsInsight_"
)


def report_candidates(today):
    """Return recent Thursday/Friday report dates, newest first."""
    for days_ago in range(0, 22):
        candidate = today - timedelta(days=days_ago)
        if candidate.weekday() in (3, 4):
            yield candidate


def download_latest_report(today=None):
    today = today or datetime.now(timezone.utc).date()
    headers = {"User-Agent": "DaveyBitcoins valuation updater/1.0"}
    for report_date in report_candidates(today):
        url = REPORT_BASE + report_date.strftime("%m%d%y") + ".pdf"
        try:
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=headers), timeout=30
            ) as response:
                payload = response.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            continue
        if payload.startswith(b"%PDF"):
            return report_date, url, payload
    raise RuntimeError("No FactSet Earnings Insight PDF found in the last 22 days")


def extract_factset_metrics(pdf_bytes, report_year):
    text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf_bytes)).pages)
    pe_match = re.search(
        r"forward\s+12-month\s+P/E\s+ratio\s+for\s+the\s+S&P\s+500\s+is\s+([0-9]+(?:\.[0-9]+)?)",
        text,
        flags=re.IGNORECASE,
    )
    if not pe_match:
        raise RuntimeError("Could not find the S&P 500 forward P/E in the FactSet report")
    reported_pe = float(pe_match.group(1))
    if not 10 <= reported_pe <= 40:
        raise RuntimeError(f"Implausible forward P/E parsed from FactSet: {reported_pe}")
    growth_matches = {
        int(year): float(growth)
        for year, growth in re.findall(
            r"For\s+CY\s+(\d{4}),\s+analysts\s+are\s+projecting\s+earnings\s+growth\s+of\s+(-?[0-9]+(?:\.[0-9]+)?)%",
            text,
            flags=re.IGNORECASE,
        )
    }
    if report_year not in growth_matches or report_year + 1 not in growth_matches:
        raise RuntimeError("Could not find current- and next-year earnings growth in FactSet")
    return reported_pe, growth_matches[report_year], growth_matches[report_year + 1]


def fetch_reference_close(report_date):
    # Earnings Insight is published Friday and uses Wednesday's closing price.
    target = report_date - timedelta(days=2)
    prices = yf.download(
        "^GSPC",
        start=(target - timedelta(days=7)).isoformat(),
        end=(target + timedelta(days=1)).isoformat(),
        auto_adjust=False,
        progress=False,
    )
    if prices.empty:
        raise RuntimeError("No S&P 500 history returned for the FactSet reference date")
    close = prices["Close"]
    if hasattr(close, "columns"):
        close = close.iloc[:, 0]
    close = close.dropna()
    if close.empty:
        raise RuntimeError("S&P 500 reference close is missing")
    return close.index[-1].date(), float(close.iloc[-1])


def build_record(report_date, source_url, reported_pe, current_growth, next_growth, close_date, spx_close):
    if report_date.year != ACTUAL_YEAR + 1:
        raise RuntimeError("Update ACTUAL_YEAR and ACTUAL_EPS before processing a new calendar year")
    current_eps = ACTUAL_EPS * (1 + current_growth / 100)
    next_eps = current_eps * (1 + next_growth / 100)
    return {
        "as_of": report_date.isoformat(),
        "source": "FactSet Earnings Insight",
        "source_url": source_url,
        "reported_forward_pe": round(reported_pe, 2),
        "reference_close_date": close_date.isoformat(),
        "reference_spx_close": round(spx_close, 2),
        "forward_12m_eps": round(spx_close / reported_pe, 2),
        "actual_year": ACTUAL_YEAR,
        "actual_eps": ACTUAL_EPS,
        "current_year": report_date.year,
        "current_year_growth_pct": current_growth,
        "current_year_eps": round(current_eps, 2),
        "next_year": report_date.year + 1,
        "next_year_growth_pct": next_growth,
        "next_year_eps": round(next_eps, 2),
    }


def main():
    report_date, source_url, pdf_bytes = download_latest_report()
    reported_pe, current_growth, next_growth = extract_factset_metrics(pdf_bytes, report_date.year)
    close_date, spx_close = fetch_reference_close(report_date)
    record = build_record(report_date, source_url, reported_pe, current_growth, next_growth, close_date, spx_close)

    if OUTPUT_PATH.exists() and json.loads(OUTPUT_PATH.read_text()) == record:
        print(f"SPY valuation already current through {record['as_of']}")
        return 0
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(
        f"Updated SPY valuation through {record['as_of']}: "
        f"{record['reported_forward_pe']}x, forward EPS ${record['forward_12m_eps']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
