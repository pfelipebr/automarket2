// Servidor placeholder para validar a infra K8s
// Substitua por src/server.ts quando o código real estiver pronto.
const http = require('http');

let dbReady = false;

// Simula a checagem de DB após 5s de startup
setTimeout(() => { dbReady = true; }, 5000);

const routes = {
  '/health': (res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'automarket-backend' }));
  },
  '/ready': (res) => {
    if (dbReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not ready', reason: 'waiting for db' }));
    }
  },
};

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const handler = routes[req.url];
  if (handler) {
    handler(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', path: req.url }));
  }
}).listen(3000, () => {
  console.log('[AutoMarket backend placeholder] rodando na porta 3000');
});
