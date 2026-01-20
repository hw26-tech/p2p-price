const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Usamos el API de pydolarvenezuela para sacar la tasa BCV
    const apiUrl = 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar';
    const response = await fetch(apiUrl);
    const data = await response.json();

    let bcvRate = null;

    if (data && data.monitors && data.monitors.bcv && data.monitors.bcv.price) {
      bcvRate = parseFloat(data.monitors.bcv.price);
    }

    if (!bcvRate) {
      return res.status(500).json({
        success: false,
        error: 'No se pudo obtener la tasa BCV'
      });
    }

    // Simulamos Kontigo con un spread sobre BCV
    const SPREAD_BUY = 0.008;  // +0.8% para compra
    const SPREAD_SELL = 0.012; // +1.2% para venta

    const buyPrice = bcvRate * (1 + SPREAD_BUY);
    const sellPrice = bcvRate * (1 + SPREAD_SELL);

    return res.status(200).json({
      success: true,
      source: 'Kontigo (simulado desde BCV)',
      buy: buyPrice,
      sell: sellPrice,
      note: 'Kontigo no tiene API pública. Esto es una aproximación basada en BCV + spread.'
    });

  } catch (error) {
    console.error('Error en kontigo_ves:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
