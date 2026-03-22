async function redis(token, url, command) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.json();
}

module.exports = async (req, res) => {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) { res.status(500).json({ error: 'Redis not configured' }); return; }

  const key = req.query.key;
  if (!key) { res.status(400).json({ error: 'Missing key' }); return; }

  const result = await redis(token, url, ['LRANGE', 'log:' + key, 0, 1999]);
  const entries = (result.result || []).map(e => JSON.parse(e));

  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(entries));
};
