# SPY data and simulation correction — 2026-09-08

## Corrected inputs and signal policy

`data_spy.csv` now contains `date,price,total_return_index`. The entire history was downloaded from Yahoo Finance with `auto_adjust=False` on 2026-09-08, replacing the inherited mixed adjusted/unadjusted series. There are 8,458 observations from 1993-01-29 to 2026-09-04. `price` is Yahoo Close (split-adjusted, not dividend-adjusted). `total_return_index` is Yahoo Adj Close divided by its first value, times 100. This is a distribution-reinvestment return index, not an executable historical share price. Six decimal places preserve Close precision; eight preserve the index. Metadata and a SHA256 are in `data/spy_history_metadata.json`.

SPY's issuer inception date is January 22, 1993; the provider's first trading observation is January 29. The 8,352 pre-inception observations inherited from a scaled SPX proxy are archived in `data/spy_legacy_proxy.csv`, explicitly outside the model. Their historical adjustment basis has not been independently reconstructed. Pre-inception events no longer incorrectly map to the first available ETF price.

`scripts/rebuild_spy_history.py` refreshes the complete raw and adjusted series together, preserving coherent historical adjustment factors. As corrected on September 9, it admits today's bar after the NYSE session closes, using the exchange calendar for holidays, early closes, and daylight saving time. Before the close it admits only prior completed sessions. SPY Finnhub quotes no longer write into model history. A failed or incomplete download fails before replacing the dataset. The separate live-quote display can continue refreshing independently.

The frozen formula remains a 200-week simple moving average, logarithmic price deviation, and its trailing 20-year empirical weekly percentile. Only prior calendar weeks enter daily signals, including on Fridays. Prefix tests for Monday, Wednesday and Friday now reproduce identical historical scores. The first valid signal is 1996-11-25, with an expanding percentile window until late 2016. The chart marks warmup, and DCA excludes warmup plus the first day without an executable prior signal. Scenario percentile distributions use the same completed-week endpoint as the displayed score.

On the saved September 4 record the revised score is 0.9549808429 and the reference 200-week mean is 555.824400505. This difference from the prior release reflects corrected price history and signal timing, not weight or threshold optimization. It is not a probability of future loss.

## Matched-funded DCA

Each strategy receives the same base contribution on each scheduled date. Fixed DCA invests it immediately. Linear and exponential allocations request the existing 4/3/2/1 or 8/4/2/1 multiples, bounded by accumulated available cash; they cannot borrow. Skipped funds remain in portfolio cash at 0% interest. Purchases use the previous trading observation's already published risk reading and execute at the current saved close's return-index level. Both strategy and benchmark include reinvested distributions exactly once through that index. No dividend cash flow is added again.

The former hindsight-sized lump-sum comparator is replaced with matched fixed DCA. Contributions, cash and portfolio value are tracked throughout. All-skipped strategies remain valid cash portfolios and display their benchmark. The interface reports cash retained, invested dollars and cumulative invested dollars; return-index units remain internal to the calculation. Gain/contribution percentages are cumulative, not annualized or money-weighted. No taxes, commissions, slippage or interest are modeled. This is a transparent illustration, not evidence of strategy superiority or an executable trading recommendation.

## Valuation reconciliation

The September 4 FactSet report explicitly gives an S&P 500 closing index value of 7747.71 in its target-price discussion. Dividing by the report's rounded 19.5 forward P/E yields approximate forward EPS of 397.32. The old guessed Wednesday reference (7666.60) is removed. The updater now extracts the explicit price from the report and fails closed if it is absent. It does not invent a trading date; `reference_close_date` is null and the basis is documented. The ratio remains approximate because the report's P/E is rounded and the target-price reference is not a direct EPS feed.

The maintained 2025 EPS anchor of 271.23 is explicitly an assumption. Calendar EPS dollar amounts are growth roll-forwards from that assumption, not verified current FactSet bottom-up dollar estimates. The UI now labels those values as growth-derived. New calendar years continue to require a reviewed anchor rather than silent rollover.

## Validation and remaining limits

- `node --test tests/spy-model-validation.test.js`: six tests cover raw/return-series integrity, historical prefix invariance, warmup, equal funding/cash limits, prior-signal/all-cash behavior, and fixed-DCA/dividend-index parity.
- `python3 -m unittest discover -s tests -p test_spy_valuation.py`: four tests cover report anchor extraction, fail-closed behavior, approximate/unknown-date labels and calendar rollover. Requires the existing pypdf dependency.
- Python modules compile successfully. No production deployment was performed in this lane; integrated rendering and builds are handled by the parent task.

Provider prices and adjustment factors are still external inputs, not a point-in-time vendor archive. Correct mathematical causality does not eliminate parameter-selection hindsight or establish predictive efficacy. Previously inspected history is not a genuine unseen holdout. Preserve this specification and collect prospective observations before claiming out-of-sample performance.

Primary references: [Yahoo SPY history](https://finance.yahoo.com/quote/SPY/history/), [State Street SPY](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy), [FactSet September 4 report, page 12](https://advantage.factset.com/hubfs/Website/Resources%20Section/Research%20Desk/Earnings%20Insight/EarningsInsight_090426.pdf).
