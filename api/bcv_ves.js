const fetch = require('node-fetch');

function parseNumber(str) {
  if (!str) return null;
  const clean = String(str).replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : null;
}

/**
 * Strategy 1: ve.dolarapi.com — free, no auth, reliable JSON API
 * Returns BCV official USD and EUR rates
 */
async function fetchFromDolarApi() {
  const [usdRes, eurRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }),
    fetch('https://ve.dolarapi.com/v1/euros/oficial', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
  ]);

  if (!usdRes.ok || !eurRes.ok) {
    throw new Error('ve.dolarapi.com HTTP error');
  }

  const usdData = await usdRes.json();
  const eurData = await eurRes.json();

  const usd = usdData.promedio;
  const eur = eurData.promedio;

  if (!usd || usd <= 0) {
    throw new Error('ve.dolarapi.com returned invalid USD rate');
  }

  return {
    source: 've.dolarapi.com (BCV oficial)',
    rate: usd,
    euro: eur || 0
  };
}

/**
 * Strategy 2: Scrape BCV official website directly
 * May be blocked from some server IPs but works as fallback
 */
async function fetchFromBCV() {
  const response = await fetch('https://www.bcv.org.ve/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-VE,es;q=0.9,en;q=0.5'
    }
  });

  if (!response.ok) {
    throw new Error('BCV HTTP ' + response.status);
  }

  const html = await response.text();

  if (!html || html.length < 500) {
    throw new Error('BCV returned empty/blocked page');
  }

  // BCV page has div#dpilar for USD and div#euro for EUR with values
  const usdMatch = html.match(/id\s*=\s*["']dpilar["'][^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
  const eurMatch = html.match(/id\s*=\s*["']euro["'][^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);

  const usd = usdMatch ? parseNumber(usdMatch[1]) : null;
  const eur = eurMatch ? parseNumber(eurMatch[1]) : null;

  if (!usd || usd <= 0) {
    throw new Error('Could not parse BCV USD rate from HTML');
  }

  return {
    source: 'bcv.org.ve (directo)',
    rate: usd,
    euro: eur || 0
  };
}

/**
 * Strategy 3: Scrape monitorvenezuela.com for BCV data
 */
async function fetchFromMonitorVenezuela() {
  const response = await fetch('https://monitorvenezuela.com/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error('monitorvenezuela.com HTTP ' + response.status);
  }

  const html = await response.text();

  // Look for BCV rate in WhatsApp share links or page content
  // Pattern: "Dólar BCV ... 500,46 Bs" in share URLs or content
  const shareMatch = html.match(/D%C3%B3lar%20BCV[^"]*?([0-9]+)%2C([0-9]+)/i);
  if (shareMatch) {
    const usd = parseFloat(shareMatch[1] + '.' + shareMatch[2]);
    if (usd && usd > 0) {
      return {
        source: 'monitorvenezuela.com (BCV)',
        rate: usd,
        euro: 0  // harder to get euro from this source
      };
    }
  }

  // Fallback: search in plain text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');

  const bcvMatch = text.match(/BCV[^0-9]{0,40}([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2,8})?)/i);
  const usd = bcvMatch ? parseNumber(bcvMatch[1]) : null;

  if (!usd || usd <= 0) {
    throw new Error('Could not parse BCV rate from monitorvenezuela.com');
  }

  return {
    source: 'monitorvenezuela.com (BCV)',
    rate: usd,
    euro: 0
  };
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

  // Try strategies in order: dolarapi (most reliable) → BCV direct → monitorvenezuela
  const strategies = [
    { name: 'dolarapi', fn: fetchFromDolarApi },
    { name: 'bcv', fn: fetchFromBCV },
    { name: 'monitor', fn: fetchFromMonitorVenezuela }
  ];

  const errors = [];

  for (const strategy of strategies) {
    try {
      const result = await strategy.fn();
      if (result && result.rate > 0) {
        return res.status(200).json({
          success: true,
          source: result.source,
          rate: result.rate,
          euro: result.euro
        });
      }
    } catch (err) {
      errors.push(`${strategy.name}: ${err.message}`);
    }
  }

  return res.status(500).json({
    success: false,
    error: 'All BCV sources failed: ' + errors.join(' | ')
  });
};
