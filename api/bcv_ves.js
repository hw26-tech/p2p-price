const fetch = require('node-fetch');

function parseNumber(str) {
  if (!str) return null;
  const clean = String(str).replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch('https://exchangemonitor.net/dolar-venezuela', {
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

    // intenta buscar una mención de BCV con su valor en Bs
    let usd = null;

    const patterns = [
      /BCV[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2,8})?)/i,
      /Dólar BCV[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2,8})?)/i,
      /Tasa Oficial[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2,8})?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        usd = parseNumber(match[1]);
        if (usd && usd > 0) break;
      }
    }

    if (!usd || usd <= 0) {
      throw new Error('No se pudo extraer BCV desde ExchangeMonitor');
    }

    // euro: lo sacamos del BCV oficial para mantenerlo real
    const bcvResponse = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!bcvResponse.ok) {
      throw new Error('No se pudo consultar BCV para el euro');
    }

    const bcvHtml = await bcvResponse.text();
    const bcvText = bcvHtml
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const eurMatch = bcvText.match(/EUR\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2,8})?)/i);
    const eur = eurMatch ? parseNumber(eurMatch[1]) : null;

    return res.status(200).json({
      success: true,
      source: 'exchangemonitor.net + bcv.org.ve',
      rate: usd,
      euro: eur || 0
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};