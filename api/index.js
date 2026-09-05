const fs = require('fs');
const path = require('path');

function restaurerUrl(req) {
  const raw = req.url || '/';
  const qIndex = raw.indexOf('?');
  const search = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
  const params = new URLSearchParams(search);
  const forwarded = params.get('p');
  params.delete('p');
  const rest = params.toString();
  if (forwarded) req.url = forwarded + (rest ? `?${rest}` : '');
}

function chargerHandler() {
  const candidats = [
    path.join(__dirname, '..', 'dist', 'vercel.js'),
    path.join(process.cwd(), 'dist', 'vercel.js'),
    path.join(__dirname, '..', 'server', 'vercel.js'),
  ];
  const manquants = [];
  for (const fichier of candidats) {
    if (fs.existsSync(fichier)) {
      return require(fichier);
    }
    manquants.push(fichier);
  }
  throw new Error(`Fichier compilé introuvable (${manquants.join(' | ')})`);
}

module.exports = async function handler(req, res) {
  try {
    restaurerUrl(req);
    if (String(req.url || '').split('?')[0] === '/v1/sante') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true, nom: 'ManuPro' }));
      return;
    }
    const mod = chargerHandler();
    return (mod.default || mod)(req, res);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: false,
          message: 'API indisponible. Vérifiez DATABASE_URL et les variables Vercel.',
          detail,
        }),
      );
    }
  }
};
