const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // evita cache en Vercel/CDN
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = 'https://open.er-api.com/v6/latest/USD';
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    if (!r.ok) throw new Error('HTTP ' + r.status);

    const data = await r.json();

    const usdToVes = data?.rates?.VES;
    const usdToEur = data?.rates?.EUR;

    if (typeof usdToVes !== 'number') throw new Error('La respuesta no trae rate VES');
    if (typeof usdToEur !== 'number' || usdToEur === 0) throw new Error('La respuesta no trae rate EUR');

    const eurToVes = usdToVes / usdToEur;

    return res.status(200).json({
      success: true,
      source: 'open.er-api.com (USD base)',
      rate: usdToVes,     // USD->VES
      euro: eurToVes      // EUR->VES calculado
    });
  } catch (err) {
    console.error('bcv_ves error:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
