const TIME_ZONE = 'Asia/Kolkata';
// NSE blocks many Google Apps Script IPs. TradingView's public scanner is used
// here because it is reachable from Apps Script and returns current NSE quotes.
const SCANNER_URL = 'https://scanner.tradingview.com/india/scan';
const DEFAULT_THRESHOLD_PERCENT = 10;
const DEFAULT_MIN_SIGNAL_SCORE = 60;
const MIN_RELATIVE_VOLUME = 1.5;

/** Run once after adding the Script Properties listed in README.md. */
function setup() {
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('TELEGRAM_BOT_TOKEN') || !properties.getProperty('TELEGRAM_CHAT_ID')) {
    throw new Error('Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Project Settings first.');
  }

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'checkMarket') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('checkMarket').timeBased().everyMinutes(5).create();
}

/** Called automatically every five minutes by the installed trigger. */
function checkMarket() {
  if (!isMarketTime_()) return;

  const properties = PropertiesService.getScriptProperties();
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || DEFAULT_THRESHOLD_PERCENT);
  const minScore = Number(properties.getProperty('MIN_SIGNAL_SCORE') || DEFAULT_MIN_SIGNAL_SCORE);
  const allowRepeats = (properties.getProperty('ALLOW_REPEAT_ALERTS') || 'true').toLowerCase() === 'true';
  const state = JSON.parse(properties.getProperty('ALERT_STATE') || '{}');
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const regime = fetchMarketRegime_();

  Object.keys(state).forEach(function (key) {
    if (key.indexOf(today + ':') !== 0) delete state[key];
  });

  let newsLookups = 0;
  fetchRows_().forEach(function (item) {
    const signal = scoreSetup_(item, threshold, regime);
    const key = today + ':' + item.ticker;
    if (item.change < threshold || signal.score < minScore || (!allowRepeats && state[key])) return;

    const reason = newsLookups < 5 ? findPossibleReason_(item.ticker) : {
      summary: 'News lookup skipped for this pass; review volume and price data below.',
      headlines: []
    };
    newsLookups++;
    sendTelegram_(formatAlert_(item, threshold, reason, signal, regime));
    state[key] = new Date().toISOString();
  });

  properties.setProperty('ALERT_STATE', JSON.stringify(state));
}

function isMarketTime_() {
  const now = new Date();
  const weekday = Number(Utilities.formatDate(now, TIME_ZONE, 'u'));
  const hour = Number(Utilities.formatDate(now, TIME_ZONE, 'H'));
  const minute = Number(Utilities.formatDate(now, TIME_ZONE, 'm'));
  const currentMinutes = hour * 60 + minute;
  return weekday >= 1 && weekday <= 5 && currentMinutes >= 9 * 60 + 15 && currentMinutes <= 15 * 60 + 30;
}

function fetchRows_() {
  const request = {
    symbols: { query: { types: [] }, tickers: [] },
    columns: ['name', 'close', 'change', 'volume', 'relative_volume_10d_calc', 'VWAP', 'EMA20', 'EMA50', 'RSI', 'ATR', 'high', 'low'],
    filter: [
      { left: 'exchange', operation: 'equal', right: 'NSE' },
      { left: 'change', operation: 'greater', right: 0 }
    ],
    options: { lang: 'en' },
    range: [0, 100],
    sort: { sortBy: 'change', sortOrder: 'desc' }
  };
  const response = UrlFetchApp.fetch(SCANNER_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(request),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Market-data request failed: HTTP ' + response.getResponseCode());
  }

  const payload = JSON.parse(response.getContentText());
  const records = payload.data || [];
  return records.map(function (record) {
    const values = record.d || [];
    const ltp = Number(values[1]);
    const change = Number(values[2]);
    const previous = ltp && isFinite(change) ? ltp / (1 + change / 100) : null;
    return {
      ticker: String(values[0] || String(record.s || '').replace(/^NSE:/, '')).trim(),
      change: change,
      ltp: ltp,
      previous: previous,
      quantity: Number(values[3]),
      relativeVolume: Number(values[4]),
      vwap: Number(values[5]),
      ema20: Number(values[6]),
      ema50: Number(values[7]),
      rsi: Number(values[8]),
      atr: Number(values[9]),
      high: Number(values[10]),
      low: Number(values[11])
    };
  }).filter(function (item) {
    return item.ticker && isFinite(item.change);
  }).sort(function (a, b) {
    return b.change - a.change;
  });
}

function findPossibleReason_(ticker) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(ticker + ' NSE India stock') + '&hl=en-IN&gl=IN&ceid=IN:en';
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return { summary: 'No recent public headline found; movement may be volume-driven or technical.', headlines: [] };
    }

    const document = XmlService.parse(response.getContentText());
    const channel = document.getRootElement().getChild('channel');
    const items = channel ? channel.getChildren('item') : [];
    const headlines = [];
    let combined = '';
    items.slice(0, 3).forEach(function (item) {
      const title = item.getChildText('title') || '';
      const pubDate = item.getChildText('pubDate') || '';
      if (!title) return;
      combined += ' ' + title.toLowerCase();
      headlines.push(title + (pubDate ? ' (' + pubDate + ')' : ''));
    });

    if (!headlines.length) {
      return { summary: 'No recent public headline found; movement may be volume-driven or technical.', headlines: [] };
    }

    const clues = [
      { pattern: /quarter|result|earnings|profit|revenue|ebitda/, label: 'Possible quarterly results or earnings news' },
      { pattern: /order|contract|deal|award|project|wins?/, label: 'Possible order, contract, or project news' },
      { pattern: /dividend|bonus|split|buyback|record date/, label: 'Possible corporate action' },
      { pattern: /merger|acquisition|stake|fundrais|investment|promoter/, label: 'Possible ownership, investment, or deal news' },
      { pattern: /approval|regulator| sebi|fda|license|clearance/, label: 'Possible regulatory or approval news' },
      { pattern: /upgrade|downgrade|target price|rating/, label: 'Possible analyst rating or target-price news' }
    ];
    const clue = clues.find(function (candidate) { return candidate.pattern.test(combined); });
    return {
      summary: clue ? clue.label : 'Recent headlines found; verify whether they relate to today\'s move.',
      headlines: headlines
    };
  } catch (error) {
    return { summary: 'News lookup unavailable; movement may be volume-driven or technical.', headlines: [] };
  }
}

function formatAlertLegacy_(item, threshold, reason) {
  return [
    'NSE MARKET ALERT',
    '',
    'Stock: ' + item.ticker,
    '1D RETURN: ' + signed_(item.change) + '%',
    'LTP: ₹' + item.ltp,
    'Previous close: ₹' + item.previous,
    'Day range: ₹' + item.low + ' - ₹' + item.high,
    'Traded quantity: ' + Number(item.quantity || 0).toLocaleString('en-IN'),
    'Turnover: ₹' + Number(item.turnover || 0).toLocaleString('en-IN') + ' lakh',
    'Alert threshold: +' + threshold.toFixed(2) + '%',
    '',
    'Possible reason: ' + reason.summary,
    reason.headlines.length ? 'Recent headlines:\n- ' + reason.headlines.join('\n- ') : '',
    '',
    'Source: NSE public market-data endpoint.',
    'Possible reason only—not a confirmed cause or buy/sell recommendation.'
  ].join('\n');
}

function fetchMarketRegime_() {
  const request = {
    symbols: { query: { types: [] }, tickers: ['NSE:NIFTY'] },
    columns: ['name', 'close', 'change', 'VWAP', 'EMA20', 'EMA50', 'RSI'],
    options: { lang: 'en' },
    range: [0, 1]
  };
  try {
    const response = UrlFetchApp.fetch(SCANNER_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(request),
      muteHttpExceptions: true
    });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('NIFTY request failed');
    const records = JSON.parse(response.getContentText()).data || [];
    const values = records.length ? records[0].d || [] : [];
    const regime = {
      ticker: 'NIFTY',
      close: Number(values[1]),
      change: Number(values[2]),
      vwap: Number(values[3]),
      ema20: Number(values[4]),
      ema50: Number(values[5]),
      rsi: Number(values[6])
    };
    regime.bullish = regime.close > regime.vwap && regime.close > regime.ema20 && regime.ema20 >= regime.ema50;
    regime.label = regime.bullish ? 'Bullish' : 'Neutral/Risk-off';
    return regime;
  } catch (error) {
    return { ticker: 'NIFTY', label: 'Unavailable', bullish: false };
  }
}

function scoreSetup_(item, threshold, regime) {
  let score = 0;
  const reasons = [];
  if (item.change >= threshold) {
    score += 20;
    reasons.push('strong 1D momentum');
  }
  if (item.relativeVolume >= 2) {
    score += 20;
    reasons.push('volume >= 2x 10D average');
  } else if (item.relativeVolume >= MIN_RELATIVE_VOLUME) {
    score += 10;
    reasons.push('above-average volume');
  }
  if (item.ltp > item.vwap) {
    score += 15;
    reasons.push('above VWAP');
  }
  if (item.ltp > item.ema20) {
    score += 10;
    reasons.push('above 20 EMA');
  }
  if (item.ema20 > item.ema50) {
    score += 15;
    reasons.push('20 EMA above 50 EMA');
  }
  if (item.rsi >= 50 && item.rsi <= 75) {
    score += 10;
    reasons.push('RSI in momentum range');
  }
  if (regime.bullish) {
    score += 10;
    reasons.push('NIFTY regime bullish');
  }
  return {
    score: score,
    label: score >= 80 ? 'A-GRADE SETUP' : (score >= 60 ? 'B-GRADE SETUP' : 'WATCHLIST'),
    reasons: reasons
  };
}

function tradePlan_(item) {
  if (!isFinite(item.atr) || item.atr <= 0 || !isFinite(item.ltp)) {
    return { available: false };
  }
  const entry = item.ltp;
  const stop = Math.max(0.01, entry - item.atr * 1.5);
  const risk = entry - stop;
  return {
    available: true,
    entry: entry,
    stop: stop,
    target1: entry + risk * 1.5,
    target2: entry + risk * 2,
    riskPerShare: risk
  };
}

function formatAlert_(item, threshold, reason, signal, regime) {
  const plan = tradePlan_(item);
  const lines = [
    'NSE MARKET ALERT - ' + signal.label,
    'Signal score: ' + signal.score + '/100',
    '',
    'Stock: ' + item.ticker,
    '1D RETURN: ' + signed_(item.change) + '%',
    'LTP: Rs ' + Number(item.ltp || 0).toFixed(2),
    'Previous close: Rs ' + Number(item.previous || 0).toFixed(2),
    'Volume: ' + Number(item.quantity || 0).toLocaleString('en-IN') + ' shares',
    'Relative volume (10D): ' + (isFinite(item.relativeVolume) ? item.relativeVolume.toFixed(2) + 'x' : 'unavailable'),
    'VWAP / EMA20 / EMA50: Rs ' + Number(item.vwap || 0).toFixed(2) + ' / Rs ' + Number(item.ema20 || 0).toFixed(2) + ' / Rs ' + Number(item.ema50 || 0).toFixed(2),
    'RSI: ' + (isFinite(item.rsi) ? item.rsi.toFixed(1) : 'unavailable'),
    'NIFTY regime: ' + regime.label,
    'Alert threshold: +' + threshold.toFixed(2) + '%',
    '',
    'Trade checklist: ' + (signal.reasons.length ? signal.reasons.join(', ') : 'insufficient confirmation'),
    plan.available ? 'Entry trigger: 15m candle close/hold above Rs ' + plan.entry.toFixed(2) : 'Entry/stop/targets unavailable: ATR missing',
    plan.available ? 'Stop-loss reference: Rs ' + plan.stop.toFixed(2) + ' (1.5 ATR)' : '',
    plan.available ? 'Targets: Rs ' + plan.target1.toFixed(2) + ' / Rs ' + plan.target2.toFixed(2) + ' (1:1.5 / 1:2)' : '',
    plan.available ? 'Position size: risk amount / Rs ' + plan.riskPerShare.toFixed(2) + ' per share' : '',
    'Risk rule: use only 0.5-1% of capital; do not chase or average down.',
    '',
    'Possible reason: ' + reason.summary,
    reason.headlines.length ? 'Recent headlines:\n- ' + reason.headlines.join('\n- ') : '',
    '',
    'Source: TradingView India public market scanner.',
    'Possible reason only - not a confirmed cause or buy/sell recommendation.'
  ];
  return lines.join('\n');
}

function signed_(value) {
  return (value >= 0 ? '+' : '') + Number(value).toFixed(2);
}

function sendTelegram_(message) {
  const properties = PropertiesService.getScriptProperties();
  const token = properties.getProperty('TELEGRAM_BOT_TOKEN');
  const chatId = properties.getProperty('TELEGRAM_CHAT_ID');
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Telegram request failed: HTTP ' + response.getResponseCode());
  }
}

function testAlert() {
  sendTelegram_(
    '✅ NSE Market Lens test alert\n\n' +
    'Telegram connection is working.\n' +
    'Live NSE checks run Monday–Friday, 09:15–15:30 IST.'
  );
}

/** Sends the top three current scanner rows immediately, regardless of market hours. */
function testCurrentAlerts() {
  const properties = PropertiesService.getScriptProperties();
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || DEFAULT_THRESHOLD_PERCENT);
  const regime = fetchMarketRegime_();
  const rows = fetchRows_().slice(0, 3);
  if (!rows.length) {
    sendTelegram_('NSE live preview test\n\nNo rows were returned by the market-data scanner.');
    return;
  }
  rows.forEach(function (item) {
    const signal = scoreSetup_(item, threshold, regime);
    sendTelegram_(
      'NSE LIVE PREVIEW TEST\n' +
      'This is an immediate test; normal alerts remain limited to market hours.\n\n' +
      formatAlert_(item, threshold, findPossibleReason_(item.ticker), signal, regime)
    );
  });
}

/**
 * Sunday/manual preview: sends up to three alerts from the latest NSE snapshot.
 * On a Sunday this is normally the latest available Friday data, not live data.
 */
function testLatestAvailableAlerts() {
  const properties = PropertiesService.getScriptProperties();
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || DEFAULT_THRESHOLD_PERCENT);
  const regime = fetchMarketRegime_();
  const rows = fetchRows_().filter(function (item) { return item.change >= threshold; }).slice(0, 3);

  if (!rows.length) {
    sendTelegram_(
      '🧪 NSE preview test\n\n' +
      'No latest available NSE stock is at or above +' + threshold.toFixed(2) + '%.'
    );
    return;
  }

  rows.forEach(function (item) {
    const reason = findPossibleReason_(item.ticker);
    const signal = scoreSetup_(item, threshold, regime);
    sendTelegram_(
      '🧪 LATEST AVAILABLE NSE PREVIEW\n' +
      'This is a Sunday test using the latest NSE snapshot, normally Friday data.\n\n' +
      formatAlert_(item, threshold, reason, signal, regime)
    );
  });
}
