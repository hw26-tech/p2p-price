const crypto = require('crypto');

/**
 * Autenticación segura para la sección privada de finanzas.
 *
 * Credenciales y secreto se configuran mediante variables de entorno en Vercel:
 *   - FINANCE_USER       -> nombre de usuario (por defecto "hw")
 *   - FINANCE_PASS_HASH  -> SHA-256 (hex) de la contraseña
 *   - FINANCE_SECRET     -> clave para firmar los tokens de sesión
 *
 * Si no se configuran, se usan valores por defecto (cámbialos en producción).
 * El cliente NUNCA recibe la contraseña: solo un token firmado (HMAC-SHA256)
 * con expiración, que luego se verifica en cada acceso a la página privada.
 */

// Valores por defecto (sobrescribir con variables de entorno en Vercel)
const DEFAULT_USER = 'hw';
// SHA-256 de "565851"
const DEFAULT_PASS_HASH =
  '2a8acfecb8f1896fb11b3ddbe7b32780d46c339b2b5e0a206e1c715311cce81d';
const DEFAULT_SECRET = 'p2p-finanzas-secret-cambiar-en-vercel-2026';

const USER = process.env.FINANCE_USER || DEFAULT_USER;
const PASS_HASH = process.env.FINANCE_PASS_HASH || DEFAULT_PASS_HASH;
const SECRET = process.env.FINANCE_SECRET || DEFAULT_SECRET;

// Duración del token de sesión: 7 días
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  while (input.length % 4) input += '=';
  return Buffer.from(input, 'base64').toString('utf8');
}

function sign(payloadStr) {
  return crypto.createHmac('sha256', SECRET).update(payloadStr).digest('hex');
}

/** Genera un token firmado con expiración. */
function createToken() {
  const payload = JSON.stringify({ u: USER, exp: Date.now() + TOKEN_TTL_MS });
  const encoded = base64url(payload);
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

/** Verifica un token: firma válida y no expirado. */
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return false;

  const expected = sign(encoded);
  // Comparación segura contra timing attacks
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(fromBase64url(encoded));
    if (!payload.exp || Date.now() > payload.exp) return false;
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // --- LOGIN: POST { username, password } ---
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { body = {}; }
      }
      const { username, password } = body || {};

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Faltan credenciales' });
      }

      const userOk = username === USER;
      const passOk = sha256(String(password)) === PASS_HASH;

      if (userOk && passOk) {
        const token = createToken();
        return res.status(200).json({ success: true, token });
      }

      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' });
    }

    // --- VERIFY: GET con header Authorization: Bearer <token> o ?token= ---
    if (req.method === 'GET') {
      const auth = req.headers['authorization'] || '';
      const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : null;
      const token = headerToken || (req.query && req.query.token) || null;

      const valid = verifyToken(token);
      return res.status(valid ? 200 : 401).json({ success: valid });
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('auth error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
