const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Evitar cache para tener siempre el precio al minuto
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Usamos una fuente que reporta el BCV oficial de Venezuela
    // Esta es confiable y rápida
    const url = 'https://pydolarve.org/api/v1/dollar?page=bcv';
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) throw new Error('Error conectando con la fuente del BCV');

    const data = await response.json();

    // Extraemos Dollar y Euro directamente de la respuesta
    const bcvUsd = data?.monedas?.usd?.promedio;
    const bcvEur = data?.monedas?.eur?.promedio;

    // Validación de seguridad para no mandar basura
    if (!bcvUsd || bcvUsd <= 0) {
      throw new Error('No se pudo obtener la tasa oficial del Dólar');
    }

    return res.status(200).json({
      success: true,
      source: 'BCV Oficial (via pyDolar)',
      rate: parseFloat(bcvUsd),
      euro: bcvEur ? parseFloat(bcvEur) : 0
    });

  } catch (err) {
    console.error('Error en API BCV:', err.message);
    
    // Si falla la principal, intentamos una de respaldo (ExchangeRate-API corregida)
    try {
        const backupUrl = 'https://open.er-api.com/v6/latest/USD';
        const r = await fetch(backupUrl);
        const d = await r.json();
        const rate = d?.rates?.VES;
        
        if (rate && rate > 0) {
            return res.status(200).json({
                success: true,
                source: 'Backup API (International)',
                rate: parseFloat(rate),
                euro: rate / d.rates.EUR
            });
        }
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: 'Error obteniendo tasas: ' + err.message
    });
  }
};