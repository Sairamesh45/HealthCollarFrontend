// Vercel Serverless Function — proxies all ThingsBoard API calls
// Credentials are kept server-side via environment variables and never exposed to the browser.

export default async function handler(req, res) {
  // Allow CORS for same-origin Vercel deployment
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const TB_HOST = process.env.TB_HOST;
  const TB_USER = process.env.TB_USER;
  const TB_PASS = process.env.TB_PASS;

  if (!TB_HOST || !TB_USER || !TB_PASS) {
    return res.status(500).json({ error: 'Server configuration missing. Set TB_HOST, TB_USER, TB_PASS in environment variables.' });
  }

  const tbPath = req.query.path;
  if (!tbPath) {
    return res.status(400).json({ error: 'Missing required query parameter: path' });
  }

  try {
    // Authenticate with ThingsBoard
    const authRes = await fetch(`${TB_HOST}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TB_USER, password: TB_PASS }),
    });

    if (!authRes.ok) {
      const errText = await authRes.text();
      return res.status(401).json({ error: `ThingsBoard auth failed (${authRes.status}): ${errText}` });
    }

    const { token } = await authRes.json();

    // Forward the original request to ThingsBoard
    const fetchOpts = {
      method: req.method,
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const tbRes = await fetch(`${TB_HOST}${tbPath}`, fetchOpts);
    const text = await tbRes.text();

    // Pass through ThingsBoard's status code
    if (!text) {
      return res.status(tbRes.status).end();
    }

    try {
      const data = JSON.parse(text);
      return res.status(tbRes.status).json(data);
    } catch {
      return res.status(tbRes.status).send(text);
    }
  } catch (err) {
    return res.status(500).json({ error: `Proxy error: ${err.message}` });
  }
}
