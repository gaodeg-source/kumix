const https = require('https');

module.exports = (req, res) => {
  const itemId = req.query && req.query.itemId;
  if (!itemId) {
    res.status(400).json({ status: { code: -1, message: 'itemId required' } });
    return;
  }
  const token = process.env.WDTOKEN || 'cdbf6c5e';
  const ts = Date.now();
  const param = encodeURIComponent(JSON.stringify({ itemId }));
  const apiUrl = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=${param}&wdtoken=${token}&_=${ts}`;

  https.get(apiUrl, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    });
  }).on('error', err => {
    res.status(500).json({ status: { code: -1, message: err.message } });
  });
};
