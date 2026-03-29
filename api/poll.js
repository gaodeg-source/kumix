const https = require('https');

const ITEM_CONFIG = {
  '7565709739': {
    stocks: { 'KUNHO': 699699, 'YOUMIN': 985477, 'XAYDEN': 987130, 'MINJE': 875395, 'MASAMI': 987500, 'HYUNBIN': 998533, 'ON:N': 987423 }
  },
  '7565710019': {
    stocks: { 'KUNHO': 984766, 'YOUMIN': 980640, 'XAYDEN': 966266, 'MINJE': 669733, 'MASAMI': 669772, 'HYUNBIN': 965555, 'ON:N': 666566 }
  },
  '7526988904': {
    stocks: { 'KUNHO': 999688, 'YOUMIN': 999833, 'XAYDEN': 999510, 'MINJE': 999805, 'MASAMI': 999910, 'HYUNBIN': 999694, 'ON:N': 999877 }
  },
  '7719424307': {
    stocks: { 'RAP LINE': 488444, 'VOCAL LINE': 548985 }
  },
  '7527002904': {
    stocks: { 'KUNHO': 999590, 'YOUMIN': 999805, 'XAYDEN': 999696, 'MINJE': 999780, 'MASAMI': 999866, 'HYUNBIN': 999755, 'ON:N': 999866 }
  },
  '7525118051': {
    type: 'single',
    maxStock: 94685877
  }
};

function canonicalTitle(t) { return t.replace(/：/g, ':'); }

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function redis(token, url, command) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  return res.json();
}

function tsNow() {
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

async function saveIfChanged(redisUrl, redisToken, key, sales) {
  const redisKey = 'log:' + key;
  const last = await redis(redisToken, redisUrl, ['LINDEX', redisKey, 0]);
  const lastSold = last.result ? JSON.parse(last.result).sold : null;
  if (lastSold === sales) return false;
  const delta = lastSold !== null ? sales - lastSold : null;
  const entry = JSON.stringify({ ts: tsNow(), sold: sales, delta });
  await redis(redisToken, redisUrl, ['LPUSH', redisKey, entry]);
  await redis(redisToken, redisUrl, ['LTRIM', redisKey, 0, 1999]);
  return true;
}

module.exports = async (req, res) => {
  const redisUrl   = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;
  const wdtoken    = process.env.WDTOKEN || 'cdbf6c5e';

  if (!redisUrl || !redisToken) {
    res.status(500).json({ error: 'Redis not configured' });
    return;
  }

  const changes = [];
  const ts = Date.now();

  try {
    for (const [itemId, cfg] of Object.entries(ITEM_CONFIG)) {
      const param = encodeURIComponent(JSON.stringify({ itemId }));
      const url = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=${param}&wdtoken=${wdtoken}&_=${ts}`;
      const data = await fetchJson(url);
      if (data.status.code !== 0) continue;

      if (cfg.type === 'single') {
        const sales = cfg.maxStock - data.result.itemStock;
        const changed = await saveIfChanged(redisUrl, redisToken, itemId, sales);
        if (changed) changes.push(itemId + '=' + sales);
      } else {
        for (const sku of data.result.skuInfos) {
          const info = sku.skuInfo;
          const title = canonicalTitle(info.title);
          const max = cfg.stocks[title];
          if (max === undefined) continue;
          const sales = max - info.stock;
          const key = itemId + ':' + title;
          const changed = await saveIfChanged(redisUrl, redisToken, key, sales);
          if (changed) changes.push(key + '=' + sales);
        }
      }
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
    return;
  }

  res.status(200).json({ ok: true, changes, ts: tsNow() });
};
