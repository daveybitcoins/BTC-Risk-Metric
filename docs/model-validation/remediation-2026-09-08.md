# Investment model corrections — September 8, 2026

Implemented the agreed corrections across all four tools. Source engines and the production static export are synchronized. No push or production deployment was performed.

| Area | Change |
|---|---|
| Dividends | Sourced status for seven closed funds prevents liquidation cash being annualized; payment dates drive the calendar; estimates are visible; distinct supplemental events survive provider normalization; portfolio yield uses matching covered positions; unknown added cost basis stays unknown. |
| BTC | Historical backtest now uses true running-peak drawdown and requires a full forward horizon. Wording describes relative positioning and the revising fitted curve. Gold damping uses the stated end-2025 anchor. Risk weights, windows and thresholds are unchanged. |
| SPY | Actual ETF history rebuilt with raw-close and reinvested-distribution return columns. Pre-inception proxy archived outside calculations. Prior-calendar-week signals are stable when future observations arrive. DCA uses prior-observation decisions, equal funding, retained cash and a matched fixed-DCA benchmark. |
| SPY valuation | Report closing price replaces a guessed Wednesday anchor. Forward EPS is marked approximate because the reported multiple is rounded; calendar EPS values are explicitly growth-derived from an assumed base. |
| EMA/breadth | Historical breadth changes use percentage points, direction-specific frequencies and exact exchange-session horizons. A separate top-300 snapshot history replaces the mixed S&P500/top300 calibration. Live quotes no longer overwrite saved analytical prices. Valuation Screen replaces Best Opportunities and shows actual trailing EPS growth. |
| Validation | Versioned BTC/SPY calculation and data fingerprints plus an explicit prospective benchmark prevent hindsight from being labeled unseen performance. The runner currently reports pending; no post-freeze outcomes exist. |

## Verification

- Production build, TypeScript and Next lint pass.
- Eight BTC tests, nineteen investment-model tests, eight Worker tests and twenty-seven Python tests pass (62 calculation/control checks).
- Data validation passes for all price files, all 300 scanner rows, the consistent breadth history, all 6,164 dividend records and valuation inputs.
- Legacy and Next-export browser smoke checks pass.
- Responsive layout, light/dark themes, homepage/model parity, chart access, dividend retry and preserved holdings checks pass.
- Browser scenarios confirm fixed DCA equals its benchmark, skipped purchases remain cash, theme changes preserve the simulation, and closed ABNY holdings contribute no recurring income.
- Exported route files, engines and model data match the release files in the repository root.

## Limits that remain explicit

The top-300 history contains 124 retained session snapshots and 111 complete observations; its shorter calibration changes the displayed breadth score. Vendor timestamps are not independently established point-in-time data. New unclassified liquidation events still need provider classification or a sourced status update. Projected payment dates use historical payment patterns when a published date is unavailable; exchange holidays may differ. Historical dividend entitlement is not inferred from current holdings.

Corrected calculations do not prove a predictive edge. The prospective protocol is documented in `validation-protocol.md`; its performance evaluation must await later observations. No future monitoring automation was created. Current DCA is a zero-cost educational illustration; the separate frozen research comparison applies its stated 5bp purchase-cost assumption.
