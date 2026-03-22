const https = require('https');

module.exports = (req, res) => {
  const token = process.env.WDTOKEN || '7880e40b';
  const ts = Date.now();
  const apiUrl = `https://thor.weidian.com/detail/getItemSkuInfo/1.0?param=%7B%22itemId%22%3A%227553485595%22%7D&wdtoken=${token}&_=${ts}`;

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
