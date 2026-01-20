const fetch = require('node-fetch');

function parseNumber(str) {
  if (!str) return null;
  let s = str.trim();
  s = s.replace(/\s+/g, '');

  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousand = decimal === '.' ? ',' : '.';
    s = s.split(thousand).join('');
    s = s.replace(decimal, '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = 'https://www.monitordedivisavenezuela.com/';
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!r.ok) {
      throw new Error('HTTP ' + r.status);
    }

    const html = await r.text();
    const regex = /Tasa\s*BCV[\s\S]*?(\d{1,3}(?:[\.,]\d{3})*[\.,]\d{1,2})(?=\s*Bs)/i;
    const match = html.match(regex);

    if (!match) {
      throw new Error('No pude extraer la tasa BCV');
    }

    const rate = parseNumber(match[1]);

    if (!rate) {
      throw new Error('El número no se pudo convertir');
    }

    return res.status(200).json({
      success: true,
      source: 'MonitorDeDivisaVenezuela.com',
      rate: rate
    });

  } catch (err) {
    console.error('bcv_ves error:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
