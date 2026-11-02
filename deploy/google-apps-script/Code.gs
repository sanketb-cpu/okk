const TIME_ZONE = 'Asia/Kolkata';
// NSE blocks many Google Apps Script IPs. TradingView's public scanner is used
// here because it is reachable from Apps Script and returns current NSE quotes.
const SCANNER_URL = 'https://scanner.tradingview.com/india/scan';
const DEFAULT_THRESHOLD_PERCENT = 6;
const DEFAULT_MIN_SIGNAL_SCORE = 70;
const MIN_RELATIVE_VOLUME = 1.5;
// Official NSE individual-security F&O underlyings snapshot, 26-Oct-2026.
const FNO_SYMBOLS = '360ONE,ABB,APLAPOLLO,AUBANK,ADANIENSOL,ADANIENT,ADANIGREEN,ADANIPORTS,ADANIPOWER,ABCAPITAL,ALKEM,AMBER,AMBUJACEM,ANANDRATHI,ANGELONE,APOLLOHOSP,ASHOKLEY,ASIANPAINT,ASTRAL,ATHERENERG,AUROPHARMA,DMART,AXISBANK,BSE,BAJAJ-AUTO,BAJFINANCE,BAJAJFINSV,BANDHANBNK,BANKBARODA,BANKINDIA,MAHABANK,BDL,BEL,BHARATFORG,BHEL,BPCL,BHARTIARTL,BIOCON,BLUESTARCO,BOSCHLTD,BRITANNIA,CGPOWER,CANBK,CDSL,CHOLAFIN,CIPLA,CUB,COALINDIA,COCHINSHIP,COFORGE,COLPAL,CAMS,CONCOR,COROMANDEL,CROMPTON,CUMMINSIND,DLF,DABUR,DATAPATTNS,DELHIVERY,DIVISLAB,DIXON,DRREDDY,ETERNAL,EICHERMOT,FORCEMOT,NYKAA,FORTIS,GAIL,GVT&D,GMRAIRPORT,GLENMARK,GODFRYPHLP,GODREJCP,GODREJPROP,GRASIM,HCLTECH,HDFCAMC,HDFCBANK,HDFCLIFE,HAVELLS,HEROMOTOCO,HINDALCO,HAL,HINDPETRO,HINDUNILVR,HINDZINC,POWERINDIA,HYUNDAI,ICICIBANK,ICICILIFE,ICICIGI,IDFCFIRSTB,ITC,INDIANB,IEX,IOC,IRFC,IREDA,INDUSTOWER,INDUSINDBK,NAUKRI,INFY,INOXWIND,INDIGO,JINDALSTEL,JSWENERGY,JSWSTEEL,JIOFIN,JUBLFOOD,KEI,KPITTECH,KALYANKJIL,KARURVYSYA,KAYNES,KFINTECH,KOTAKBANK,LTF,LICHSGFIN,LTM,LT,LAURUSLABS,LICI,LODHA,LUPIN,M&M,MANAPPURAM,MANKIND,MARICO,MARUTI,MFSL,MAXHEALTH,MAZDOCK,MOTILALOFS,MPHASIS,MCX,MUTHOOTFIN,NBCC,NHPC,NMDC,NTPC,NATIONALUM,NAVINFLUOR,NESTLEIND,NAM-INDIA,OBEROIRLTY,ONGC,OIL,PAYTM,OFSS,POLICYBZR,PGEL,PIIND,PNBHOUSING,PAGEIND,PATANJALI,PERSISTENT,PETRONET,PIDILITIND,POLYCAB,PFC,POWERGRID,PREMIERENE,PRESTIGE,PNB,RBLBANK,RECLTD,RADICO,RVNL,RELIANCE,SAGILITY,SBICARD,SBILIFE,SHREECEM,SRF,MOTHERSON,SHRIRAMFIN,ENRIN,SIEMENS,SOLARINDS,SONACOMS,SBIN,SAIL,SUNPHARMA,SUPREMEIND,SUZLON,SWIGGY,SYRMA,TATACONSUM,TVSMOTOR,TCS,TATAELXSI,TMPV,TATAPOWER,TATASTEEL,TECHM,FEDERALBNK,INDHOTEL,PHOENIXLTD,TITAN,TORNTPHARM,TRENT,TIINDIA,UNOMINDA,UPL,UJJIVANSFB,ULTRACEMCO,UNIONBANK,UNITDSPR,VBL,VEDL,VMM,IDEA,VOLTAS,WAAREEENER,WIPRO,YESBANK,ZYDUSLIFE'.split(',').reduce(function (map, symbol) {
  map[symbol] = true;
  return map;
}, {});
// Official NIFTY 500 constituent snapshot retrieved from NSE Indices, 28-Oct-2026.
const NIFTY500_SYMBOLS = '360ONE,ABB,ACC,ACMESOLAR,AIAENG,APLAPOLLO,AUBANK,AWL,AADHARHFC,AARTIIND,AAVAS,ABBOTINDIA,ACE,ACUTAAS,ADANIENSOL,ADANIENT,ADANIGREEN,ADANIPORTS,ADANIPOWER,ATGL,ABCAPITAL,ABREL,ABSLAMC,CPPLUS,AEGISLOG,AEGISVOPAK,AETHER,AFCONS,AFFLE,AJANTPHARM,ALKEM,ABDL,ARE&M,AMBER,AMBUJACEM,ANANDRATHI,ANANTRAJ,ANGELONE,ANTHEM,ANURAS,APARINDS,APOLLOHOSP,APOLLOTYRE,APTUS,ASAHIINDIA,ASHOKLEY,ASIANPAINT,ASTERDM,ASTRAL,ATHERENERG,ATUL,AUROPHARMA,AIIL,AVANTIFEED,DMART,AXISBANK,AZAD,BEML,BLS,BSE,BAGMANE,BAJAJ-AUTO,BAJFINANCE,BAJAJFINSV,BAJAJHLDNG,BAJAJHFL,BALKRISIND,BALRAMCHIN,BANDHANBNK,BANKBARODA,BANKINDIA,MAHABANK,BATAINDIA,BELRISE,BERGEPAINT,BHARATCOAL,BDL,BEL,BHARATFORG,BHEL,BPCL,BHARTIARTL,BHARTIHEXA,GROWW,BIOCON,BSOFT,BBOX,BLUESTARCO,BOSCHLTD,FIRSTCRY,BRIGADE,BRITANNIA,BIRET,CCL,CESC,CGPOWER,CIEINDIA,CRISIL,CANFINHOME,CANBK,CANHLIFE,CAPLIPOINT,CGCL,CARBORUNIV,CARTRADE,CASTROLIND,CEATLTD,CEMPRO,CENTRALBK,CDSL,CMPDI,CHAMBLFERT,CHENNPETRO,CHOICEIN,CHOLAHLDNG,CHOLAFIN,CIPLA,CUB,CLEANMAX,CLEAN,COALINDIA,COCHINSHIP,COFORGE,COHANCE,COLPAL,CAMS,CONCORDBIO,CONCOR,COROMANDEL,CRAFTSMAN,CREDITACC,CROMPTON,CUMMINSIND,CUPID,CYIENT,DLF,DOMS,DABUR,DALBHARAT,DATAPATTNS,DEEPAKFERT,DEEPAKNTR,DELHIVERY,DEVYANI,DIVISLAB,DIXON,LALPATHLAB,DRREDDY,DUMMYHEG,EIDPARRY,EIHOTEL,EMBASSY,EICHERMOT,ELECON,ELGIEQUIP,EMAMILTD,EMCURE,EMMVEE,ENDURANCE,ENGINERSIN,ESCORTS,ETERNAL,EXIDEIND,NYKAA,FEDERALBNK,FACT,FINCABLES,FSL,FIVESTAR,FORCEMOT,FORTIS,FRACTAL,GAIL,GVT&D,GMRAIRPORT,GABRIEL,GALLANTT,GRSE,GICRE,GILLETTE,GLAND,GLAXO,GLENMARK,MEDANTA,GPIL,GODFRYPHLP,GODREJCP,GODREJIND,GODREJPROP,GRANULES,GRAPHITE,GRASIM,GRAVITA,GESHIP,FLUOROCHEM,GMDCLTD,HBLENGINE,HCLTECH,HDBFS,HDFCAMC,HDFCBANK,HDFCLIFE,HEGAM,HFCL,HAVELLS,HEROMOTOCO,HEXT,HSCL,HINDALCO,HAL,HINDCOPPER,HINDPETRO,HINDUNILVR,HINDZINC,POWERINDIA,HOMEFIRST,HONASA,HONAUT,HUDCO,HYUNDAI,ICICIBANK,ICICILIFE,ICICIGI,ICICIAMC,IDBI,IDFCFIRSTB,IFCI,IIFL,INOXINDIA,IRB,IRCON,ITCHOTELS,ITC,ITI,INDIACEM,INDIAMART,INDIANB,IEX,IOC,IOB,IRCTC,IRFC,IREDA,IGL,INDHOTEL,INDUSTOWER,INDUSINDBK,NAUKRI,INFY,INOXWIND,INTELLECT,INDIGO,IGIL,IKS,IPCALAB,JKCEMENT,JBMA,JKTYRE,JMFINANCIL,JSWCEMENT,JSWENERGY,JSWINFRA,JSWSTEEL,JAINREC,JPPOWER,J&KBANK,JINDALSAW,JSL,JINDALSTEL,JIOFIN,JUBLFOOD,JUBLINGREA,JWL,JYOTICNC,KPRMILL,KEI,KPITTECH,KSB,KAJARIACER,KPIL,KALYANKJIL,KARURVYSYA,KAYNES,KEC,KFINTECH,KIRLOSBROS,KIRLOSENG,KOTAKBANK,KIMS,LTF,LTTS,LGEINDIA,LICHSGFIN,LTFOODS,LTM,LT,LAURUSLABS,LEMONTREE,LENSKART,LICI,LINDEINDIA,LLOYDSME,LODHA,LUPIN,MMTC,MRF,MTARTECH,MGL,M&MFIN,M&M,MANAPPURAM,MRPL,MANKIND,MARICO,MARUTI,MFSL,MAXHEALTH,MAZDOCK,MEESHO,MINDACORP,MSUMI,MOTILALOFS,MPHASIS,MCX,MUTHOOTFIN,NATCOPHARM,NBCC,NCC,NHPC,NLCINDIA,NMDC,NSLNISP,NTPCGREEN,NTPC,NH,NATIONALUM,NAVA,NAVINFLUOR,NESTLEIND,NETWEB,NEULANDLAB,NAM-INDIA,NUVAMA,NUVOCO,OBEROIRLTY,ONGC,OIL,OLAELEC,OLECTRA,PAYTM,ONESOURCE,OFSS,POLICYBZR,PCBL,PGEL,PIIND,PNBHOUSING,PTCIL,PVRINOX,PAGEIND,PARADEEP,PATANJALI,PERSISTENT,PETRONET,PHOENIXLTD,PWL,PIDILITIND,PINELABS,PIRAMALFIN,PPLPHARMA,POLYMED,POLYCAB,POONAWALLA,PFC,POWERGRID,PREMIERENE,PRESTIGE,PFOCUS,PRIVISCL,PNB,RRKABEL,RBLBANK,RECLTD,RHIM,RITES,RADICO,RVNL,RAILTEL,RAINBOW,RKFORGE,REDINGTON,RELIANCE,RPOWER,RUBICON,SBICARD,SBILIFE,SJVN,SHRIPISTON,SRF,SAGILITY,SAILIFE,SAMMAANCAP,MOTHERSON,SANSERA,SARDAEN,SCHAEFFLER,SCHNEIDER,SCI,SHREECEM,SHRIRAMFIN,SHYAMMETL,ENRIN,SIEMENS,SIGNATURE,SOBHA,SOLARINDS,SONACOMS,STARHEALTH,SBIN,SAIL,STLTECH,SUMICHEM,SUNPHARMA,SUNTV,SUNDARMFIN,SUPREMEIND,SUZLON,SWANCORP,SWIGGY,SYNGENE,SYRMA,TBOTEK,TDPOWERSYS,TVSMOTOR,TATACAP,TATACHEM,TATACOMM,TCS,TATACONSUM,TATAELXSI,TATAINVEST,TMCV,TMPV,TATAPOWER,TATASTEEL,TATATECH,TTML,TECHM,TECHNOE,TEGA,TEJASNET,TENNIND,THANGAMAYL,NIACL,RAMCOCEM,THERMAX,TIMKEN,TITAGARH,TITAN,TORNTPHARM,TORNTPOWER,TARIL,TRENT,TRIDENT,TRITURBINE,TIINDIA,UNOMINDA,UPL,UCOBANK,UTIAMC,ULTRACEMCO,UNIONBANK,UBL,UNITDSPR,URBANCO,USHAMART,VTL,VBL,VAML,VISL,VEDL,VOGL,VEDPOWER,VIJAYA,VMM,IDEA,VOLTAS,WAAREEENER,WELCORP,WELSPUNLIV,WHIRLPOOL,WIPRO,WOCKPHARMA,YESBANK,ZFCVINDIA,ZEEL,ZENTEC,ZENSARTECH,ZYDUSLIFE,ZYDUSWELL,ECLERX'.split(',').reduce(function (map, symbol) {
  map[symbol] = true;
  return map;
}, {});
const UNIVERSE_SYMBOLS = Object.assign({}, FNO_SYMBOLS, NIFTY500_SYMBOLS);
const DEFAULT_BACKTEST_SYMBOLS = ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'INFY', 'TCS', 'LT', 'AXISBANK', 'BAJFINANCE', 'TATASTEEL'];

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

/** Apply the recommended intraday profile to Script Properties. */
function setRecommendedSettings() {
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('THRESHOLD_PERCENT', '6');
  properties.setProperty('MIN_SIGNAL_SCORE', '70');
  properties.setProperty('ALLOW_REPEAT_ALERTS', 'true');
  properties.setProperty('BACKTEST_SYMBOLS', 'ALL_UNIVERSE');
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
    if (item.change < threshold || signal.score < minScore || !signal.candleConfirmed || (!allowRepeats && state[key])) return;

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
    columns: ['name', 'close', 'change', 'volume', 'relative_volume_10d_calc', 'VWAP', 'EMA20', 'EMA50', 'RSI', 'ATR', 'high', 'low', 'close|15', 'open|15', 'high|15', 'low|15', 'change|15', 'volume|15', 'VWAP|15', 'EMA20|15', 'RSI|15'],
    filter: [
      { left: 'exchange', operation: 'equal', right: 'NSE' },
      { left: 'change', operation: 'greater', right: 0 }
    ],
    options: { lang: 'en' },
    range: [0, 1000],
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
      low: Number(values[11]),
      close15: Number(values[12]),
      open15: Number(values[13]),
      high15: Number(values[14]),
      low15: Number(values[15]),
      change15: Number(values[16]),
      volume15: Number(values[17]),
      vwap15: Number(values[18]),
      ema20_15: Number(values[19]),
      rsi15: Number(values[20])
    };
  }).filter(function (item) {
    return item.ticker && UNIVERSE_SYMBOLS[item.ticker] && isFinite(item.change);
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
    score += 15;
    reasons.push('strong 1D momentum');
  }
  if (item.relativeVolume >= 2) {
    score += 15;
    reasons.push('volume >= 2x 10D average');
  } else if (item.relativeVolume >= MIN_RELATIVE_VOLUME) {
    score += 8;
    reasons.push('above-average volume');
  }
  if (item.ltp > item.vwap) {
    score += 10;
    reasons.push('above VWAP');
  }
  if (item.ltp > item.ema20) {
    score += 10;
    reasons.push('above 20 EMA');
  }
  if (item.ema20 > item.ema50) {
    score += 10;
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
  const candleConfirmed = isCandleConfirmed_(item);
  if (candleConfirmed) {
    score += 20;
    reasons.push('latest 15m candle confirmed');
  }
  return {
    score: score,
    label: score >= 80 ? 'A-GRADE SETUP' : (score >= 60 ? 'B-GRADE SETUP' : 'WATCHLIST'),
    reasons: reasons,
    candleConfirmed: candleConfirmed
  };
}

function isCandleConfirmed_(item) {
  return isFinite(item.close15) && isFinite(item.open15) && isFinite(item.change15) &&
    isFinite(item.vwap15) && isFinite(item.ema20_15) &&
    item.change15 > 0 && item.close15 > item.open15 &&
    item.close15 > item.vwap15 && item.close15 > item.ema20_15;
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
    '15m candle: ' + (signal.candleConfirmed ? 'CONFIRMED bullish close above 15m VWAP/EMA20' : 'WAIT - 15m confirmation not complete'),
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

function getBacktestSymbols_() {
  const configured = PropertiesService.getScriptProperties().getProperty('BACKTEST_SYMBOLS');
  if (configured && ['ALL_FNO', 'ALL_UNIVERSE'].indexOf(configured.trim().toUpperCase()) !== -1) return Object.keys(UNIVERSE_SYMBOLS);
  const symbols = configured ? configured.split(',').map(function (symbol) { return symbol.trim(); }) : DEFAULT_BACKTEST_SYMBOLS;
  return symbols.filter(function (symbol) { return symbol && UNIVERSE_SYMBOLS[symbol]; });
}

function fetchHistoricalBars_(symbol, days) {
  // Yahoo limits 15-minute history to roughly the most recent 60 days.
  const usableDays = Math.min(Number(days) || 30, 60);
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol + '.NS') +
    '?range=' + usableDays + 'd&interval=15m&events=history&includePrePost=false';
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
      'Accept': 'application/json,text/plain,*/*',
      'Accept-Language': 'en-IN,en;q=0.9'
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Yahoo 15m data failed for ' + symbol + ': HTTP ' + response.getResponseCode() + ' (maximum supported lookback is 60 days)');
  }
  const payload = JSON.parse(response.getContentText());
  if (payload.chart && payload.chart.error) throw new Error('Yahoo 15m data failed for ' + symbol + ': ' + payload.chart.error.description);
  const result = (payload.chart || {}).result;
  if (!result || !result.length) throw new Error('No Yahoo 15m data for ' + symbol);
  const data = result[0];
  const quote = data.indicators.quote[0];
  const bars = [];
  (data.timestamp || []).forEach(function (timestamp, index) {
    const open = Number(quote.open[index]);
    const high = Number(quote.high[index]);
    const low = Number(quote.low[index]);
    const close = Number(quote.close[index]);
    const volume = Number(quote.volume[index]);
    if ([open, high, low, close, volume].every(isFinite)) {
      bars.push({ timestamp: timestamp, open: open, high: high, low: low, close: close, volume: volume });
    }
  });
  return bars;
}

function average_(values) {
  if (!values.length) return null;
  return values.reduce(function (sum, value) { return sum + value; }, 0) / values.length;
}

function emaNext_(previous, value, period) {
  return previous == null ? value : previous + (2 / (period + 1)) * (value - previous);
}

function backtestSymbol_(symbol, bars, threshold, minScore, holdBars) {
  const enriched = [];
  let session = '';
  let previousSessionClose = null;
  let lastClose = null;
  let sessionValue = 0;
  let sessionVolume = 0;
  let ema20 = null;
  let ema50 = null;
  const trueRanges = [];
  const gains = [];
  const losses = [];
  const previousVolumes = [];

  bars.forEach(function (bar) {
    const day = Utilities.formatDate(new Date(bar.timestamp * 1000), TIME_ZONE, 'yyyy-MM-dd');
    if (day !== session) {
      if (lastClose != null) previousSessionClose = lastClose;
      session = day;
      sessionValue = 0;
      sessionVolume = 0;
    }

    const typical = (bar.high + bar.low + bar.close) / 3;
    sessionValue += typical * bar.volume;
    sessionVolume += bar.volume;
    const vwap = sessionVolume ? sessionValue / sessionVolume : null;
    ema20 = emaNext_(ema20, bar.close, 20);
    ema50 = emaNext_(ema50, bar.close, 50);

    const trueRange = lastClose == null ? bar.high - bar.low : Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - lastClose),
      Math.abs(bar.low - lastClose)
    );
    trueRanges.push(trueRange);
    if (trueRanges.length > 14) trueRanges.shift();
    const atr = trueRanges.length >= 14 ? average_(trueRanges) : null;

    if (lastClose != null) {
      const difference = bar.close - lastClose;
      gains.push(Math.max(0, difference));
      losses.push(Math.max(0, -difference));
      if (gains.length > 14) gains.shift();
      if (losses.length > 14) losses.shift();
    }
    const averageGain = gains.length >= 14 ? average_(gains) : null;
    const averageLoss = losses.length >= 14 ? average_(losses) : null;
    const rsi = averageGain != null && averageLoss != null
      ? (averageLoss === 0 ? 100 : 100 - (100 / (1 + averageGain / averageLoss)))
      : null;
    const averageVolume = previousVolumes.length >= 10 ? average_(previousVolumes) : null;
    const relativeVolume = averageVolume ? bar.volume / averageVolume : null;
    const dailyChange = previousSessionClose ? ((bar.close / previousSessionClose) - 1) * 100 : null;
    const candleConfirmed = bar.close > bar.open && bar.close > vwap && bar.close > ema20;

    enriched.push({
      open: bar.open, high: bar.high, low: bar.low, close: bar.close,
      vwap: vwap, ema20: ema20, ema50: ema50, rsi: rsi,
      atr: atr, relativeVolume: relativeVolume, dailyChange: dailyChange,
      candleConfirmed: candleConfirmed,
      score: 15 + (relativeVolume >= 2 ? 15 : (relativeVolume >= MIN_RELATIVE_VOLUME ? 8 : 0)) +
        (bar.close > vwap ? 10 : 0) + (bar.close > ema20 ? 10 : 0) +
        (ema20 > ema50 ? 10 : 0) + (rsi >= 50 && rsi <= 75 ? 10 : 0) +
        (candleConfirmed ? 20 : 0)
    });
    previousVolumes.push(bar.volume);
    if (previousVolumes.length > 40) previousVolumes.shift();
    lastClose = bar.close;
  });

  let trades = 0;
  let wins = 0;
  let totalR = 0;
  let nextAllowed = 0;
  for (let index = 0; index < enriched.length - 1; index++) {
    if (index < nextAllowed) continue;
    const bar = enriched[index];
    if (!bar.candleConfirmed || bar.dailyChange == null || bar.dailyChange < threshold ||
      bar.relativeVolume == null || bar.relativeVolume < MIN_RELATIVE_VOLUME ||
      bar.ema20 <= bar.ema50 || bar.rsi == null || bar.rsi < 50 || bar.rsi > 75 ||
      bar.atr == null || bar.atr <= 0 || bar.score < minScore) continue;

    const entryBar = enriched[index + 1];
    const entry = entryBar.open;
    const stop = entry - bar.atr * 1.5;
    const risk = entry - stop;
    const target = entry + risk * 2;
    let exitR = null;
    let exitIndex = Math.min(enriched.length - 1, index + holdBars);
    for (let future = index + 1; future <= exitIndex; future++) {
      const futureBar = enriched[future];
      if (futureBar.low <= stop) {
        exitR = -1;
        exitIndex = future;
        break;
      }
      if (futureBar.high >= target) {
        exitR = 2;
        exitIndex = future;
        break;
      }
    }
    if (exitR == null) {
      exitR = (enriched[exitIndex].close - entry) / risk;
    }
    trades++;
    if (exitR > 0) wins++;
    totalR += exitR;
    nextAllowed = exitIndex + 1;
  }
  return { symbol: symbol, trades: trades, wins: wins, totalR: totalR };
}

/** Run manually to evaluate the rules on recent 15-minute history. */
function runBacktest() {
  const properties = PropertiesService.getScriptProperties();
  const threshold = Number(properties.getProperty('THRESHOLD_PERCENT') || DEFAULT_THRESHOLD_PERCENT);
  const minScore = Number(properties.getProperty('MIN_SIGNAL_SCORE') || DEFAULT_MIN_SIGNAL_SCORE);
  const requestedDays = Number(properties.getProperty('BACKTEST_DAYS') || '30');
  const days = Math.min(requestedDays, 60);
  const holdBars = Number(properties.getProperty('BACKTEST_HOLD_BARS') || '12');
  const symbols = getBacktestSymbols_();
  const results = [];
  symbols.forEach(function (symbol) {
    try {
      results.push(backtestSymbol_(symbol, fetchHistoricalBars_(symbol, days), threshold, minScore, holdBars));
    } catch (error) {
      results.push({ symbol: symbol, error: error.message });
    }
  });

  const successful = results.filter(function (result) { return !result.error; });
  const totalTrades = successful.reduce(function (sum, result) { return sum + result.trades; }, 0);
  const wins = successful.reduce(function (sum, result) { return sum + result.wins; }, 0);
  const totalR = successful.reduce(function (sum, result) { return sum + result.totalR; }, 0);
  const lines = [
    'NSE INTRADAY BACKTEST',
    'Period: requested ' + requestedDays + ' days; using last ' + days + ' available 15m days | target: 2R | hold: ' + holdBars + ' bars',
    'Rules: F&O + NIFTY 500, +'+ threshold.toFixed(2) + '% daily move, latest 15m confirmation, volume and trend filters',
    '',
    'Total trades: ' + totalTrades,
    'Wins: ' + wins,
    'Win rate: ' + (totalTrades ? (wins / totalTrades * 100).toFixed(1) : '0.0') + '%',
    'Total R: ' + totalR.toFixed(2),
    'Average R/trade: ' + (totalTrades ? (totalR / totalTrades).toFixed(2) : '0.00'),
    '',
    successful.map(function (result) {
      return result.symbol + ': ' + result.trades + ' trades, ' + (result.trades ? (result.wins / result.trades * 100).toFixed(0) : '0') + '% wins, ' + result.totalR.toFixed(2) + 'R';
    }).join('\n'),
    '',
    'This is a research backtest using Yahoo Finance 15m history; slippage, brokerage, taxes and gaps are not modeled.'
  ];
  if (results.some(function (result) { return result.error; })) {
    lines.push('Unavailable: ' + results.filter(function (result) { return result.error; }).map(function (result) { return result.symbol + ' (' + result.error + ')'; }).join(', '));
  }
  const report = lines.join('\n');
  Logger.log(report);
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
