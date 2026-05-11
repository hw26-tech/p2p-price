const fetch = require('node-fetch');

/**
 * Fetches Binance P2P ads for a given trade type.
 * Returns an array of price floats from the top listings.
 */
async function fetchP2PPrices(tradeType, rows = 20) {
  const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';
  const payload = {
    page: 1,
    rows,
    payTypes: [],
    countries: [],
    publisherType: null,
    asset: 'USDT',
    fiat: 'VES',
    tradeType
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    },
    body: JSON.stringify(payload)
  });

  const json = await resp.json();
  if (!json || !json.data || json.data.length === 0) {
    return [];
  }

  return json.data.map(d => ({
    price: parseFloat(d.adv.price),
    available: parseFloat(d.adv.tradableQuantity || '0'),
    minAmount: parseFloat(d.adv.minSingleTransAmount || '0'),
    maxAmount: parseFloat(d.adv.maxSingleTransAmount || '0'),
    methods: (d.adv.tradeMethods || []).map(m => m.identifier)
  }));
}

/**
 * Filters out outlier ads and computes a representative median price.
 * - Excludes unusual payment methods (RecargaPines, gift cards, etc.)
 * - Excludes listings with very low availability (< 50 USDT)
 * - Removes statistical outliers (prices beyond 1.5× IQR from median)
 */
function getRepresentativePrice(ads) {
  if (!ads || ads.length === 0) return null;

  // Exclude non-standard payment methods that typically have inflated/deflated prices
  const excludedMethods = ['RecargaPines', 'GiftCard', 'Zelle', 'Paypal'];

  let filtered = ads.filter(ad => {
    // Exclude if any payment method is in the excluded list
    const hasExcluded = ad.methods.some(m =>
      excludedMethods.some(ex => m.toLowerCase().includes(ex.toLowerCase()))
    );
    if (hasExcluded) return false;

    // Exclude very small listings (< 50 USDT available)
    if (ad.available < 50) return false;

    return true;
  });

  // If filtering removed everything, fall back to all ads minus excluded methods only
  if (filtered.length === 0) {
    filtered = ads.filter(ad =>
      !ad.methods.some(m =>
        excludedMethods.some(ex => m.toLowerCase().includes(ex.toLowerCase()))
      )
    );
  }

  // If still nothing, use all ads
  if (filtered.length === 0) {
    filtered = ads;
  }

  const prices = filtered.map(a => a.price).sort((a, b) => a - b);

  // Remove statistical outliers using IQR method
  if (prices.length >= 5) {
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q3 = prices[Math.floor(prices.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const cleaned = prices.filter(p => p >= lowerBound && p <= upperBound);
    if (cleaned.length > 0) {
      return median(cleaned);
    }
  }

  return median(prices);
}

function median(sortedArr) {
  if (sortedArr.length === 0) return null;
  const mid = Math.floor(sortedArr.length / 2);
  if (sortedArr.length % 2 === 0) {
    return Math.round(((sortedArr[mid - 1] + sortedArr[mid]) / 2) * 100) / 100;
  }
  return sortedArr[mid];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Fetch 20 listings for each side
    const [buyAds, sellAds] = await Promise.all([
      fetchP2PPrices('BUY', 20),
      fetchP2PPrices('SELL', 20)
    ]);

    // BUY = user wants to buy USDT (merchants are selling)
    const buyPrice = getRepresentativePrice(buyAds);
    // SELL = user wants to sell USDT (merchants are buying) — sorted descending on Binance
    const sellPrice = getRepresentativePrice(sellAds);

    if (!buyPrice && !sellPrice) {
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
