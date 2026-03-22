// One-time cleanup: removes duplicate consecutive entries from a Redis log key
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

  // ?delete=KUNHO → wipe that key entirely
  if (req.query.delete) {
    const redisKey = 'log:' + req.query.delete;
    await redis(token, url, ['DEL', redisKey]);
    res.status(200).json({ ok: true, deleted: req.query.delete });
    return;
  }

  const keys = ['KUNHO','YOUMIN','XAYDEN','MINJE','MASAMI','HYUNBIN','ON:N','1v7'];
  const report = {};

  for (const k of keys) {
    const redisKey = 'log:' + k;
    const result = await redis(token, url, ['LRANGE', redisKey, 0, 1999]);
    const entries = (result.result || []).map(e => JSON.parse(e));

    // entries are newest-first; deduplicate consecutive same sold values
    const deduped = entries.filter((e, i) => {
      if (i === 0) return true;
      return e.sold !== entries[i - 1].sold;
    });

    if (deduped.length < entries.length) {
      // rewrite the key with deduped entries
      await redis(token, url, ['DEL', redisKey]);
      // push oldest-first so newest ends up at index 0
      for (let i = deduped.length - 1; i >= 0; i--) {
        await redis(token, url, ['LPUSH', redisKey, JSON.stringify(deduped[i])]);
      }
      report[k] = { before: entries.length, after: deduped.length };
    } else {
      report[k] = { before: entries.length, after: deduped.length };
    }
  }

  res.status(200).json({ ok: true, report });
};
