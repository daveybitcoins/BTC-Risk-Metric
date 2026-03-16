/**
 * DaveyBitcoins Cloudflare Worker
 *
 * 1. Proxies Finnhub API calls (hides API key from browser)
 * 2. Triggers GitHub Actions workflows on a reliable cron schedule
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ====== FINNHUB PROXY ======
async function handleFinnhubProxy(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');

  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const finnhubUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${env.FINNHUB_KEY}`;
  const resp = await fetch(finnhubUrl);
  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
      ...CORS_HEADERS,
    },
  });
}

// ====== GITHUB WORKFLOW TRIGGER ======
async function triggerGitHubWorkflow(env, workflowFile) {
  const resp = await fetch(
    `https://api.github.com/repos/daveybitcoins/DaveyBitcoins-Website/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DaveyBitcoins-Worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );
  return resp.status;
}

// ====== REQUEST HANDLER ======
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Finnhub quote proxy: /api/quote?symbol=SPY
    if (url.pathname === '/api/quote') {
      return handleFinnhubProxy(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', time: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    return new Response('Not found', { status: 404 });
  },

  // ====== CRON HANDLER ======
  async scheduled(event, env, ctx) {
    // Trigger the "Update price data" workflow
    // The EMA scanner auto-chains via workflow_run trigger
    const status = await triggerGitHubWorkflow(env, 'update-csv.yml');
    console.log(`Triggered update-csv.yml — GitHub responded ${status}`);
  },
};
