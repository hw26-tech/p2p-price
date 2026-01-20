const fs = require('fs');
const path = require('path');

// Archivo temporal en /tmp (Vercel lo borra cada deploy, pero funciona para sesión)
const HISTORY_FILE = '/tmp/price_history.json';

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading history:', e);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error('Error saving history:', e);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Devuelve el histórico
      const history = loadHistory();
      return res.status(200).json({ success: true, history });
    }

    if (req.method === 'POST') {
      // Agrega un nuevo punto al histórico
      const { binance_buy, binance_sell, bcv, kontigo_buy, kontigo_sell, brecha } = req.body;

      if (!binance_buy || !bcv) {
        throw new Error('Faltan datos');
      }

      let history = loadHistory();

      // Mantener máximo 288 puntos (24h * 12 = cada 5 min, o 24h * 1 = cada hora)
      const newEntry = {
        timestamp: new Date().toISOString(),
        binance_buy,
        binance_sell,
        bcv,
        kontigo_buy,
        kontigo_sell,
        brecha
      };

      history.push(newEntry);

      // Limitar a últimas 288 horas (12 días)
      if (history.length > 288) {
        history = history.slice(-288);
      }

      saveHistory(history);

      return res.status(200).json({ success: true, message: 'Histórico actualizado' });
    }

    return res.status(405).json({ success: false, error: 'Método no permitido' });
  } catch (err) {
    console.error('history error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};