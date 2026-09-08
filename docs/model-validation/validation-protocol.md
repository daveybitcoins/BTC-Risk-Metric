# Model validation protocol — frozen September 8, 2026

The September remediation corrects data and outputs without optimizing BTC risk weights, the SPY percentile window, or EMA screening thresholds against past returns. Calculation tests are regression controls, not proof of profitable investing.

## Prospective benchmark

`frozen-models-2026-09-08.json` records the BTC and SPY calculation hashes, hashes through each model’s last available frozen date and an explicit research protocol. Run `node scripts/evaluate-model-holdout.cjs` to evaluate only observations after the freeze. The runner rejects changed formulas or revised pre-freeze inputs until their provenance is reviewed and a separately versioned evaluation is established. Do not overwrite the baseline to make a historical result look out-of-sample.

The research rule contributes $1,000 on the first available observation of each full post-freeze month (beginning October 2026). It uses the previous observation's score; below 0.50, the four equal risk bands request 4×, 3×, 2× or 1× the contribution. Actual purchases are capped by contributed cash. Above the threshold, funds stay in cash. The comparator invests the same contributions immediately. Both pay an illustrative 5 basis points on purchases. Cash earns zero; no leverage, sales or taxes are modeled. These are explicitly chosen research assumptions, not recommended investor allocations.

BTC uses its price series; SPY uses the dividend-reinvested return index, with its prior-calendar-week signal. The runner reports contributions, cash, expenses and terminal wealth for both. It makes no annualized-return, probability-of-loss, or Sharpe claim. Three years, all contribution months, minimum daily-observation counts and bounded data gaps form a minimum coverage gate, not proof of statistical significance; outcomes still require assessment across independent episodes and market regimes. Review sensitivities to costs, cash yield and chosen start date separately, without replacing the primary frozen rule after seeing results.

On September 8 there is no post-freeze performance to measure: status is **pending**, not passed. Existing historical diagnostics remain retrospective. This runner is manual and does not schedule monitoring or deploy anything.

## EMA and breadth

EMA remains a descriptive screen. A return backtest requires point-in-time constituents, delisted instruments, adjusted returns, a defined portfolio/rebalance rule and benchmark. The retained top-300 snapshots do not establish that full dataset, so no performance result is inferred. The repaired breadth series has 124 retained NYSE-session snapshots, only 111 complete across all indicators; missing sessions stay missing. Its historical percentile is a short-window descriptive reading and can differ materially from the old mixed-universe score.

## Dividend planning

Dividend forecasts are recurring distribution estimates, not security return or dividend-safety forecasts. Liquidation events and sourced closed instruments are excluded; unknown future closures still need provider classification or sourced status maintenance. Estimates must stay visibly separate from published payment dates and historical entitlement. Portfolio coverage must remain visible.

## Release gates

- BTC score regression fixtures remain unchanged; true running-peak drawdown counterexample passes.
- SPY causal-prefix checks, raw/total-return provenance, matched funding, retained cash and distribution-once tests pass.
- Breadth session horizon, missing/zero and conditional higher/lower tests pass.
- Dividend liquidation, supplemental/duplicate, payment-date, coverage and unknown-basis counterexamples pass.
- Data validators, production build, browser smoke and responsive checks pass before release.

The public DCA calculator remains a configurable, zero-cost educational illustration with a clear disclosure. The frozen research runner separately applies its declared 5bp cost assumption, so their outputs are not presented as identical performance estimates.
