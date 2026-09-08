"use client";

import { useEffect, useState } from "react";
import { bitcoinSnapshot, spySnapshot } from "@/lib/market-models";

type Reading = { date: string; value: number; price?: number };
type Snapshot = { btc?: Reading; spy?: Reading; breadth?: Reading };
const definitions = [
  { key: "btc", title: "Bitcoin risk", detail: "Structural + momentum", href: "/risk-metric/" },
  { key: "spy", title: "SPY cycle risk", detail: "200-week trend percentile", href: "/spy-risk-metric/" },
  { key: "breadth", title: "Market breadth", detail: "Stocks above their 200-day average", href: "/ema-scanner/" },
] as const;
function zone(value: number) {
  return value < 0.2 ? "Accumulate" : value < 0.5 ? "Neutral" : value < 0.8 ? "Caution" : "Euphoria";
}
function parsePrices(text: string): [string, number][] {
  const rows = text.trim().split(/\r?\n/).slice(1).map(row => {
    const [date, price] = row.split(",");
    return [date, Number(price)] as [string, number];
  }).filter(([date, price]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(price) && price > 0);
  return rows.sort((a, b) => a[0].localeCompare(b[0]));
}
export function MarketSnapshot() {
  const [snapshot, setSnapshot] = useState<Snapshot>({});
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let active = true;
    async function fetchData(path: string) {
      const response = await fetch(path, { cache: "no-cache", signal: controller.signal });
      if (!response.ok) throw new Error("Data unavailable");
      return response;
    }
    const tasks = [
      fetchData("/data.csv").then(r => r.text()).then(text => {
        const point = bitcoinSnapshot(parsePrices(text));
        if (active && Number.isFinite(point.risk)) setSnapshot(s => ({ ...s, btc: { date: point.date, value: point.risk, price: point.price } }));
      }),
      fetchData("/data_spy.csv").then(r => r.text()).then(text => {
        const point = spySnapshot(parsePrices(text));
        if (active && Number.isFinite(point.risk)) setSnapshot(s => ({ ...s, spy: { date: point.date, value: point.risk, price: point.price } }));
      }),
      fetchData("/data/scanner_data.json").then(r => r.json()).then(data => {
        const value = data.breadth_context?.above_200d;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(data.meta?.date)) throw new Error("Invalid breadth data");
        if (active) setSnapshot(s => ({ ...s, breadth: { date: data.meta.date, value } }));
      }),
    ];
    Promise.allSettled(tasks).then(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  const incomplete = definitions.some(({ key }) => !snapshot[key]);
  return (
    <section className="market-snapshot" aria-labelledby="snapshot-heading">
      <div className="snapshot-heading">
        <div><p className="eyebrow">The latest saved readings</p><h2 id="snapshot-heading">Market snapshot</h2></div>
        <p>Daily data · Dates shown below<br />Dashboards may include newer quotes.</p>
      </div>
      <div className="snapshot-grid" aria-busy={loading}>
        {definitions.map(({ key, title, detail, href }) => {
          const reading = snapshot[key];
          return <a className="snapshot-card" href={href} key={key}
            data-tone={reading ? (key === "breadth" ? "Breadth" : zone(reading.value)) : undefined}>
            <span className="snapshot-card__title">{title}<span aria-hidden="true">↗</span></span>
            <div className="snapshot-card__reading"><strong>{reading ? (key === "breadth" ? `${reading.value.toFixed(1)}%` : reading.value.toFixed(3)) : "—"}</strong>
              {reading && key !== "breadth" && <span className="snapshot-zone">{zone(reading.value)}</span>}
            </div>
            <span className="snapshot-card__detail">{detail}</span>
            {reading ? <span className="snapshot-card__date">As of <time dateTime={reading.date}>{reading.date}</time></span> : <span className="snapshot-card__date">{loading ? "Loading reading…" : "Reading unavailable"}</span>}
          </a>;
        })}
      </div>
      {!loading && incomplete && <p className="snapshot-status" role="status">Some readings could not be loaded. <button type="button" onClick={() => { setLoading(true); setAttempt(a => a + 1); }}>Retry</button></p>}
    </section>
  );
}
