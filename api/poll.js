const https = require('https');

const MAX_STOCK_1V1 = 888686;
const MAX_STOCK_1V7 = 999999300;
const ITEM1_ID = '7553485595';
const ITEM2_ID = '7555500440';
const MEMBERS = ['KUNHO','YOUMIN','XAYDEN','MINJE','MASAMI','HYUNBIN','ON:N'];

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
  const d = new Date(), pad = n => String(n).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
}

async function saveIfChanged(redisUrl, redisToken, key, sales) {
  const redisKey = 'log:' + key;
  // get last saved entry
  const last = await redis(redisToken, redisUrl, ['LINDEX', redisKey, 0]);
  const lastSold = last.result ? JSON.parse(last.result).sold : null;

  if (lastSold === sales) return false; // no change

  const delta = lastSold !== null ? sales - lastSold : null;
  const entry = JSON.stringify({ ts: tsNow(), sold: sales, delta });
  await redis(redisToken, redisUrl, ['LPUSH', redisKey, entry]);
  await redis(redisToken, redisUrl, ['LTRIM', redisKey, 0, 1999]);
  return true;
}

module.exports = async (req, res) => {
  const redisUrl   = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;
  const wdtoken    = process.env.WDTOKEN || '7880e40b';

  if (!redisUrl || !redisToken) {
    res.status(500).json({ error: 'Redis not configured' });
    return;
  }

  const ts = Date.now();
  const changes = [];

  try {
    // poll item 1 (1v1 by member)
    const url1 = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=%7B%22itemId%22%3A%22${ITEM1_ID}%22%7D&wdtoken=${wdtoken}&_=${ts}`;
    const data1 = await fetchJson(url1);
    if (data1.status.code === 0) {
      for (const sku of data1.result.skuInfos) {
        const info = sku.skuInfo;
        if (!MEMBERS.includes(info.title)) continue;
        const sales = MAX_STOCK_1V1 - info.stock;
        const changed = await saveIfChanged(redisUrl, redisToken, info.title, sales);
        if (changed) changes.push(info.title + ':' + sales);
      }
    }

    // poll item 2 (1v7)
    const url2 = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=%7B%22itemId%22%3A%22${ITEM2_ID}%22%7D&wdtoken=${wdtoken}&_=${ts+1}`;
    const data2 = await fetchJson(url2);
    if (data2.status.code === 0) {
      const sales = MAX_STOCK_1V7 - data2.result.itemStock;
      const changed = await saveIfChanged(redisUrl, redisToken, '1v7', sales);
      if (changed) changes.push('1v7:' + sales);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
    return;
  }

  res.status(200).json({ ok: true, changes, ts: tsNow() });
};
