/** Entrée Vercel du backend Node.js (pas un dossier /api). */
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

module.exports = async function handler(req, res) {
  restaurerUrl(req);
  const mod = require('./dist/vercel.js');
  return (mod.default || mod)(req, res);
};
