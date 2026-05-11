const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Consultamos Dolar y Euro en paralelo para que sea ultra rápido
    const [resUsd, resEur] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
      fetch('https://ve.dolarapi.com/v1/euro/oficial')
    ]);

    const dataUsd = await resUsd.json();
    const dataEur = await resEur.json();

    const rateUsd = parseFloat(dataUsd.promedio);
    const rateEur = parseFloat(dataEur.promedio);

    if (!rateUsd) throw new Error('No hay USD');

    return res.status(200).json({
      success: true,
      source: 'DolarApi (BCV Oficial)',
      rate: rateUsd,
      euro: rateEur || (rateUsd * 1.10) // Fallback por si el API de euro falla
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};