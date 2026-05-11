const fetch = require('node-fetch');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Esta fuente es la más confiable para el BCV real sin bloqueos
    const response = await fetch('https://pydolarve.org/api/v1/dollar?page=bcv');

    if (!response.ok) throw new Error('BCV Shield Error');

    const data = await response.json();

    // Extraemos Dollar y Euro exactos del BCV
    const rateUsd = data?.monedas?.usd?.promedio;
    const rateEur = data?.monedas?.eur?.promedio;

    if (!rateUsd) throw new Error('Data no disponible');

    return res.status(200).json({
      success: true,
      source: 'BCV Oficial (pydolarve)',
      rate: parseFloat(rateUsd),
      euro: parseFloat(rateEur)
    });

  } catch (err) {
    // Si la anterior falla por bloqueo, usamos esta de respaldo
    try {
      const resp2 = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      const data2 = await resp2.json();
      const resp3 = await fetch('https://ve.dolarapi.com/v1/euro/oficial');
      const data3 = await resp3.json();

      if (data2.promedio) {
        return res.status(200).json({
          success: true,
          source: 'BCV Backup (dolarapi)',
          rate: parseFloat(data2.promedio),
          euro: parseFloat(data3.promedio)
        });
      }
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: 'BCV no responde'
    });
  }
};