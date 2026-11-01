const TIME_ZONE = 'Asia/Kolkata';
const NSE_HOME = 'https://www.nseindia.com';
const NSE_API_URL = 'https://www.nseindia.com/api/live-analysis-variations?index=gainers&type=FOS';

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
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || '10');
  const allowRepeats = (properties.getProperty('ALLOW_REPEAT_ALERTS') || 'true').toLowerCase() === 'true';
  const state = JSON.parse(properties.getProperty('ALERT_STATE') || '{}');
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');

  Object.keys(state).forEach(function (key) {
    if (key.indexOf(today + ':') !== 0) delete state[key];
  });

  let newsLookups = 0;
  fetchRows_().forEach(function (item) {
    const key = today + ':' + item.ticker;
    if (item.change < threshold || (!allowRepeats && state[key])) return;

    const reason = newsLookups < 5 ? findPossibleReason_(item.ticker) : {
      summary: 'News lookup skipped for this pass; review volume and price data below.',
      headlines: []
    };
    newsLookups++;
    sendTelegram_(formatAlert_(item, threshold, reason));
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
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    'Accept': 'application/json,text/plain,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nseindia.com/market-data/top-gainers-losers'
  };
  const home = UrlFetchApp.fetch(NSE_HOME, { headers: headers, muteHttpExceptions: true });
  const cookieHeader = home.getAllHeaders()['Set-Cookie'];
  const cookies = Array.isArray(cookieHeader)
    ? cookieHeader.map(function (cookie) { return cookie.split(';')[0]; }).join('; ')
    : (cookieHeader ? String(cookieHeader).split(';')[0] : '');
  if (cookies) headers.Cookie = cookies;

  const response = UrlFetchApp.fetch(NSE_API_URL, { headers: headers, muteHttpExceptions: true });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('NSE request failed: HTTP ' + response.getResponseCode());
  }

  const payload = JSON.parse(response.getContentText());
  const records = payload.allSec && payload.allSec.data ? payload.allSec.data : [];
  return records.map(function (record) {
    return {
      ticker: String(record.symbol || '').trim(),
      change: Number(record.perChange != null ? record.perChange : record.net_price),
      ltp: record.ltp,
      previous: record.prev_price,
      high: record.high_price,
      low: record.low_price,
      quantity: record.trade_quantity,
      turnover: record.turnover
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

function formatAlert_(item, threshold, reason) {
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

/**
 * Sunday/manual preview: sends up to three alerts from the latest NSE snapshot.
 * On a Sunday this is normally the latest available Friday data, not live data.
 */
function testLatestAvailableAlerts() {
  const properties = PropertiesService.getScriptProperties();
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || '10');
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
    sendTelegram_(
      '🧪 LATEST AVAILABLE NSE PREVIEW\n' +
      'This is a Sunday test using the latest NSE snapshot, normally Friday data.\n\n' +
      formatAlert_(item, threshold, reason)
    );
  });
}
