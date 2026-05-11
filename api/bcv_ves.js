const fetch = require('node-fetch');

function parseBcvNumber(value) {
  if (!value) return null;
  const cleaned = String(value).trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractRate(text, code) {
  const regex = new RegExp(`${code}\\s*([0-9.,]+)`, 'i');
  const match = text.match(regex);
  if (!match) return null;
  return parseBcvNumber(match[1]);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    const html = await response.text();

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const usd = extractRate(text, 'USD');
    const eur = extractRate(text, 'EUR');

    if (!usd || usd <= 0) {
      throw new Error('No se pudo extraer USD desde BCV');
    }

    if (!eur || eur <= 0) {
      throw new Error('No se pudo extraer EUR desde BCV');
    }

    return res.status(200).json({
      success: true,
      source: 'bcv.org.ve',
      rate: usd,
      euro: eur
    });
  } catch (err) {
    console.error('bcv_ves error:', err.message);

    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};