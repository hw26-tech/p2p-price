const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // API tipo "Exchange Rate API" (ejemplo público)
    const url = 'https://open.er-api.com/v6/latest/USD';
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!r.ok) {
      throw new Error('HTTP ' + r.status);
    }

    const data = await r.json();

    if (!data || !data.rates || typeof data.rates.VES !== 'number') {
      throw new Error('La respuesta no trae rate VES');
    }

    const rate = data.rates.VES;

    return res.status(200).json({
      success: true,
      source: 'Exchange Rate API (USD→VES)',
      rate
    });
  } catch (err) {
    console.error('bcv_ves error:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
