const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configurar CORS para que el frontend pueda llamar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const binanceApiUrl = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

    // Petición para COMPRA (BUY)
    const buyPayload = {
      page: 1,
      rows: 1,
      payTypes: [],
      countries: [],
      publisherType: null,
      asset: 'USDT',
      fiat: 'VES',
      tradeType: 'BUY'
    };

    const buyResp = await fetch(binanceApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buyPayload)
    });

    const buyData = await buyResp.json();
    let buyPrice = null;

    if (buyData && buyData.data && buyData.data.length > 0) {
      buyPrice = parseFloat(buyData.data[0].adv.price);
    }

    // Petición para VENTA (SELL)
    const sellPayload = {
      page: 1,
      rows: 1,
      payTypes: [],
      countries: [],
      publisherType: null,
      asset: 'USDT',
      fiat: 'VES',
      tradeType: 'SELL'
    };

    const sellResp = await fetch(binanceApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sellPayload)
    });

    const sellData = await sellResp.json();
    let sellPrice = null;

    if (sellData && sellData.data && sellData.data.length > 0) {
      sellPrice = parseFloat(sellData.data[0].adv.price);
    }

    if (!buyPrice || !sellPrice) {
      return res.status(500).json({
        success: false,
        error: 'No se pudieron obtener precios de Binance P2P'
      });
    }

    return res.status(200).json({
      success: true,
      source: 'Binance P2P',
      buy: buyPrice,
      sell: sellPrice
    });

  } catch (error) {
    console.error('Error en binance_ves:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
