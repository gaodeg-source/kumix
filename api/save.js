const MAX_ENTRIES = 2000;

async function redis(token, url, command) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.json();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) { res.status(500).json({ error: 'Redis not configured' }); return; }

  const { key, ts, sold, delta } = req.body;
  if (!key || ts === undefined || sold === undefined) { res.status(400).json({ error: 'Missing fields' }); return; }

  const entry = JSON.stringify({ ts, sold, delta: delta ?? null });
  await redis(token, url, ['LPUSH', 'log:' + key, entry]);
  await redis(token, url, ['LTRIM', 'log:' + key, 0, MAX_ENTRIES - 1]);

  res.status(200).json({ ok: true });
};
