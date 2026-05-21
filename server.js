const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('sd-proxy ok');
    return;
  }

  if (req.method !== 'POST' || req.url !== '/analizza') {
    res.writeHead(404); res.end('Not found'); return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(body); } catch {
      res.writeHead(400); res.end('Bad JSON'); return;
    }

    const data = JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1200,
      messages: payload.messages
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    };

    const apiReq = https.request(options, apiRes => {
      let result = '';
      apiRes.on('data', chunk => result += chunk);
      apiRes.on('end', () => {
        res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(result);
      });
    });

    apiReq.on('error', err => {
      console.error('API error:', err.message);
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    });

    apiReq.on('timeout', () => {
      apiReq.destroy();
      res.writeHead(504); res.end(JSON.stringify({ error: 'timeout' }));
    });

    apiReq.write(data);
    apiReq.end();
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`Proxy attivo su porta ${PORT}`));
