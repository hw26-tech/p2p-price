const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  try {
    // usamos allorigins como proxy (esto evita el 403 del BCV)
    const proxyUrl = 'https://api.allorigins.win/raw?url=https://www.bcv.org.ve/';

    const response = await fetch(proxyUrl);
    const html = await response.text();

    // limpiar html
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // sacar USD
    const usdMatch = text.match(/USD\s*([0-9.,]+)/);
    const eurMatch = text.match(/EUR\s*([0-9.,]+)/);

    if (!usdMatch || !eurMatch) {
      throw new Error('No se pudo leer BCV');
    }

    const usd = parseFloat(usdMatch[1].replace(',', '.'));
    const eur = parseFloat(eurMatch[1].replace(',', '.'));

    return res.status(200).json({
      success: true,
      source: 'BCV REAL (proxy)',
      rate: usd,
      euro: eur
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};