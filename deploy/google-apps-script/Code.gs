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

  fetchRows_().forEach(function (item) {
    const key = today + ':' + item.ticker;
    if (item.change < threshold || (!allowRepeats && state[key])) return;

    sendTelegram_(formatAlert_(item, threshold));
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

function formatAlert_(item, threshold) {
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
    'Source: NSE public market-data endpoint.',
    'Market-movement alert only—not a buy/sell recommendation.'
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
