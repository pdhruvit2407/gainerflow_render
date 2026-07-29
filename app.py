import os
import json
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from bs4 import BeautifulSoup
from datetime import datetime
from zoneinfo import ZoneInfo
from flask import Flask, jsonify, render_template, request, Response

app = Flask(__name__)

WATCHLIST_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'watchlist.json')
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

# Initialize Firestore with dynamic detection
db = None
WATCHLIST_DOC_REF = None

def is_market_open():
    try:
        ny_tz = ZoneInfo("America/New_York")
    except Exception:
        from datetime import timezone, timedelta
        ny_tz = timezone(timedelta(hours=-5))
        
    now = datetime.now(ny_tz)
    if now.weekday() >= 5: # Saturday or Sunday
        return False
        
    start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)
    end_time = now.replace(hour=16, minute=0, second=0, microsecond=0)
    
    return start_time <= now <= end_time

def get_market_health():
    try:
        # Fetch QQQ data for the last 3 months
        ticker = yf.Ticker("QQQ")
        hist = ticker.history(period="3mo")
        if hist.empty or len(hist) < 50:
            # Fallback to SPY
            ticker = yf.Ticker("SPY")
            hist = ticker.history(period="3mo")
            
        if not hist.empty and len(hist) >= 50:
            # Calculate 50-day SMA on close prices
            close_prices = hist['Close']
            current_price = close_prices.iloc[-1]
            sma_50 = close_prices.iloc[-50:].mean()
            
            is_healthy = bool(current_price > sma_50)
            return {
                'success': True,
                'is_healthy': is_healthy,
                'index': str(ticker.ticker),
                'current_price': float(round(current_price, 2)),
                'sma_50': float(round(sma_50, 2)),
                'percent_above': float(round(((current_price - sma_50) / sma_50) * 100, 2))
            }
    except Exception as e:
        print(f"Error calculating market health: {e}")
        
    return {'success': False, 'is_healthy': True, 'reason': 'Error/Fallback'}

# If running on Google Cloud Run (K_SERVICE is set) or USE_FIRESTORE environment variable is true
if os.environ.get('K_SERVICE') or os.environ.get('USE_FIRESTORE', 'false').lower() == 'true':
    try:
        from google.cloud import firestore
        db = firestore.Client()
        WATCHLIST_DOC_REF = db.collection('settings').document('watchlist')
        print("Successfully initialized Firestore Client for watchlist database.")
    except Exception as e:
        print(f"Failed to initialize Firestore: {e}. Falling back to local watchlist.json.")
        db = None

# Load watchlist from Firestore (or fallback to local file)
def load_watchlist():
    if db is not None and WATCHLIST_DOC_REF is not None:
        try:
            doc = WATCHLIST_DOC_REF.get()
            if doc.exists:
                return doc.to_dict()
        except Exception as e:
            print(f"Error reading from Firestore: {e}. Checking local database.")
            
    # Fallback to local file
    if not os.path.exists(WATCHLIST_FILE):
        return {"tickers": [], "notes": {}, "cached_data": {}}
    try:
        with open(WATCHLIST_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {"tickers": [], "notes": {}, "cached_data": {}}

# Save watchlist to Firestore (or fallback to local file)
def save_watchlist(data):
    if db is not None and WATCHLIST_DOC_REF is not None:
        try:
            WATCHLIST_DOC_REF.set(data)
            return
        except Exception as e:
            print(f"Error writing to Firestore: {e}. Writing locally.")
            
    # Fallback to local file
    try:
        with open(WATCHLIST_FILE, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving local watchlist: {e}")

# Generic parser for Finviz screener table
def scrape_finviz_screener(url):
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            return None, f"Failed to fetch Finviz screener (Status {response.status_code})"
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', class_='screener_table')
        if not table:
            return None, "Screener table not found in HTML"
        
        rows = table.find_all('tr')
        if not rows or len(rows) < 2:
            return None, "No data rows found in screener table"
            
        headers_list = [cell.text.strip() for cell in rows[0].find_all(['td', 'th'])]
        stocks = []
        
        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < len(headers_list):
                continue
                
            data = {}
            for i in range(len(cells)):
                header_name = headers_list[i].lower().replace('.', '').replace('/', '').replace(' ', '_')
                
                # Prevent duplicate first character from logo initial graphic in ticker column
                if header_name == 'ticker':
                    tab_link = cells[i].find('a', class_='tab-link')
                    if tab_link:
                        cell_val = tab_link.text.strip()
                    else:
                        cell_val = cells[i].get('data-boxover-ticker', '').strip()
                        if not cell_val:
                            cell_val = cells[i].text.strip()
                else:
                    cell_val = cells[i].text.strip()
                    
                data[header_name] = cell_val
            
            stocks.append({
                'no': data.get('no', ''),
                'ticker': data.get('ticker', ''),
                'company': data.get('company', ''),
                'sector': data.get('sector', ''),
                'industry': data.get('industry', ''),
                'country': data.get('country', ''),
                'market_cap': data.get('market_cap', ''),
                'pe': data.get('pe', ''),
                'price': data.get('price', ''),
                'change': data.get('change', ''),
                'volume': data.get('volume', '')
            })
            
        return stocks, None
    except Exception as e:
        return None, str(e)

# Scrape Finviz top gainers screener
def scrape_top_gainers():
    return scrape_finviz_screener("https://finviz.com/screener?v=110&s=ta_topgainers")

# Scrape Finviz bullish scan screener
def scrape_bullish_scan():
    url = "https://finviz.com/screener?v=110&f=cap_microover,sh_avgvol_o1000,sh_curvol_o2000,sh_price_o10,sh_relvol_o1.5,ta_averagetruerange_o1,ta_change_u3&ft=4&o=-volume"
    return scrape_finviz_screener(url)

# Scrape Finviz most active screener
def scrape_most_active():
    return scrape_finviz_screener("https://finviz.com/screener?v=110&s=ta_mostactive")

# Scrape Finviz unusual volume screener
def scrape_unusual_volume():
    return scrape_finviz_screener("https://finviz.com/screener?v=110&s=ta_unusualvolume&o=-volume")

# Scrape Finviz most volatile screener
def scrape_most_volatile():
    return scrape_finviz_screener("https://finviz.com/screener?v=110&s=ta_mostvolatile&o=-volume")

# Scrape Finviz institutional breakouts screener
def scrape_institutional_breakouts():
    url = "https://finviz.com/screener?v=110&f=geo_usa,ind_stocksonly,sh_avgvol_o750,sh_price_o10,sh_relvol_o2,ta_change_u&ft=4&o=-volume"
    return scrape_finviz_screener(url)

# Scrape single ticker quote details
def scrape_ticker_details(ticker):
    ticker = ticker.upper().strip()
    url = f"https://finviz.com/quote.ashx?t={ticker}"
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 404:
            return None, "Stock ticker not found"
        if response.status_code != 200:
            return None, f"Failed to fetch stock details (Status {response.status_code})"
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check if the page redirected or is invalid (e.g. search page instead of quote)
        title = soup.find('title')
        title_text = title.text.strip() if title else ""
        if "Stock Screener" in title_text or not title_text:
            return None, "Invalid ticker or stock not found"
            
        # Parse Company Name from Title (Format: TICKER - Company Name Stock Price and Quote)
        company_name = ""
        if " - " in title_text:
            parts = title_text.split(" - ")
            company_name = parts[1].split(" Stock Price")[0].strip()
            
        # Parse Sector, Industry, Country from links
        sector = "N/A"
        industry = "N/A"
        country = "N/A"
        for link in soup.find_all('a'):
            href = link.get('href', '')
            if 'f=sec_' in href:
                sector = link.text.strip()
            elif 'f=ind_' in href:
                industry = link.text.strip()
            elif 'f=geo_' in href:
                country = link.text.strip()
                
        # Parse Snapshot Tables
        snapshot_tables = soup.find_all('table', class_=lambda c: c and ('snapshot-table2' in c or 'snapshot-table' in c))
        snapshot_data = {}
        for table in snapshot_tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all('td')
                for i in range(0, len(cells), 2):
                    if i + 1 < len(cells):
                        k = cells[i].text.strip()
                        v = cells[i+1].text.strip()
                        if k:
                            snapshot_data[k] = v
                            
        # Extracted basic stats
        price = snapshot_data.get('Price', 'N/A')
        change = snapshot_data.get('Change', 'N/A')
        market_cap = snapshot_data.get('Market Cap', 'N/A')
        pe = snapshot_data.get('P/E', 'N/A')
        volume = snapshot_data.get('Volume', 'N/A')
        
        # Parse Profile Description
        profile = soup.find('td', class_='fullview-profile') or soup.find(id='profile-text') or soup.find('p', class_='profile-text')
        profile_text = ""
        if profile:
            profile_text = profile.text.strip()
        else:
            for td in soup.find_all('td'):
                if 'is a' in td.text and len(td.text) > 100 and ('company' in td.text or 'corporation' in td.text):
                    profile_text = td.text.strip()
                    break
                    
        # Fetch next earnings date from yfinance
        earnings_date_str = "N/A"
        earnings_soon = False
        try:
            yt = yf.Ticker(ticker)
            cal = yt.calendar
            if cal and 'Earnings Date' in cal and cal['Earnings Date']:
                next_earnings = cal['Earnings Date'][0]
                from datetime import date, timedelta
                # Convert next_earnings to date if it is datetime
                if hasattr(next_earnings, 'date'):
                    next_earnings_date = next_earnings.date()
                else:
                    next_earnings_date = next_earnings
                
                # Check if it is within the next 3 days
                today = date.today()
                three_days_later = today + timedelta(days=3)
                
                earnings_date_str = next_earnings_date.strftime('%Y-%m-%d')
                if today <= next_earnings_date <= three_days_later:
                    earnings_soon = True
        except Exception as ex:
            print(f"Error fetching calendar for {ticker}: {ex}")

        details = {
            'ticker': ticker,
            'company': company_name or snapshot_data.get('Company', 'N/A'),
            'sector': sector,
            'industry': industry,
            'country': country,
            'market_cap': market_cap,
            'pe': pe,
            'price': price,
            'change': change,
            'volume': volume,
            'profile': profile_text or "No company profile description available.",
            'snapshot': snapshot_data,
            'updated_at': datetime.now().isoformat(),
            'earnings_date': earnings_date_str,
            'earnings_soon': earnings_soon
        }
        
        return details, None
    except Exception as e:
        return None, str(e)


# Flask Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/stocks')
def get_stocks():
    stocks, error = scrape_top_gainers()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stocks/bullish')
def get_bullish_stocks():
    stocks, error = scrape_bullish_scan()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stocks/mostactive')
def get_most_active_stocks():
    stocks, error = scrape_most_active()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stocks/unusualvolume')
def get_unusual_volume_stocks():
    stocks, error = scrape_unusual_volume()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stocks/mostvolatile')
def get_most_volatile_stocks():
    stocks, error = scrape_most_volatile()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stocks/breakouts')
def get_breakout_stocks():
    stocks, error = scrape_institutional_breakouts()
    if error:
        return jsonify({'success': False, 'error': error}), 500
    return jsonify({'success': True, 'stocks': stocks})

@app.route('/api/stock/<ticker>')
def get_stock_details(ticker):
    details, error = scrape_ticker_details(ticker)
    if error:
        return jsonify({'success': False, 'error': error}), 404
    return jsonify({'success': True, 'details': details})

def update_cached_stock_history_and_trend(cached_data, details):
    history = cached_data.get('price_history', []) if isinstance(cached_data, dict) else []
    try:
        new_price = float(details['price'].replace('$', '').replace(',', '').strip())
    except Exception:
        new_price = None
        
    if new_price is not None:
        if not history or history[-1] != new_price:
            history.append(new_price)
            if len(history) > 5:
                history.pop(0)
                
    trend = 'neutral'
    if len(history) >= 3:
        is_up = True
        for i in range(1, len(history)):
            if history[i] <= history[i-1]:
                is_up = False
                break
        if is_up:
            trend = 'up'
            
    return {
        'ticker': details['ticker'],
        'company': details['company'],
        'sector': details['sector'],
        'industry': details['industry'],
        'country': details['country'],
        'market_cap': details['market_cap'],
        'pe': details['pe'],
        'price': details['price'],
        'change': details['change'],
        'volume': details['volume'],
        'price_history': history,
        'trend': trend,
        'earnings_date': details.get('earnings_date', cached_data.get('earnings_date', 'N/A') if isinstance(cached_data, dict) else 'N/A'),
        'earnings_soon': details.get('earnings_soon', cached_data.get('earnings_soon', False) if isinstance(cached_data, dict) else False)
    }

@app.route('/api/stock/<ticker>/update', methods=['POST'])
def update_stock_quote(ticker):
    ticker = ticker.upper().strip()
    details, error = scrape_ticker_details(ticker)
    if error:
        return jsonify({'success': False, 'error': error}), 404
        
    # If the ticker is in watchlist, update its cached data
    watchlist = load_watchlist()
    if ticker in watchlist['tickers']:
        cached_data = watchlist['cached_data'].get(ticker, {})
        watchlist['cached_data'][ticker] = update_cached_stock_history_and_trend(cached_data, details)
        save_watchlist(watchlist)
        
    return jsonify({'success': True, 'details': details})

@app.route('/api/market-status')
def get_market_status():
    try:
        ny_tz = ZoneInfo("America/New_York")
    except Exception:
        from datetime import timezone, timedelta
        ny_tz = timezone(timedelta(hours=-5))
        
    now = datetime.now(ny_tz)
    open_status = is_market_open()
    
    return jsonify({
        'success': True,
        'is_open': open_status,
        'current_time_est': now.strftime('%I:%M:%S %p'),
        'timezone': 'EST/EDT (New York)'
    })

@app.route('/api/market-health')
def get_market_health_route():
    health = get_market_health()
    return jsonify(health)

@app.route('/api/sector-rotation')
def get_sector_rotation():
    try:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=3) as executor:
            future_gainers = executor.submit(scrape_top_gainers)
            future_unusual = executor.submit(scrape_unusual_volume)
            future_breakouts = executor.submit(scrape_institutional_breakouts)
            
            gainers, _ = future_gainers.result()
            unusual, _ = future_unusual.result()
            breakouts, _ = future_breakouts.result()
            
        gainers = gainers or []
        unusual = unusual or []
        breakouts = breakouts or []
        
        industry_data = {}
        
        def process_list(stocks, weight):
            for s in stocks:
                ind = s.get('industry', 'N/A')
                sec = s.get('sector', 'N/A')
                if ind == 'N/A' or not ind:
                    continue
                if ind not in industry_data:
                    industry_data[ind] = {
                        'industry': ind,
                        'sector': sec,
                        'score': 0.0,
                        'stocks': []
                    }
                industry_data[ind]['score'] += weight
                # Add stock if not already present
                if s['ticker'] not in [x['ticker'] for x in industry_data[ind]['stocks']]:
                    ticker_clean = s['ticker'].upper().strip()
                    industry_data[ind]['stocks'].append({
                        'ticker': ticker_clean,
                        'company': s['company'],
                        'price': s['price'],
                        'change': s['change'],
                        'volume': s['volume']
                    })
                    
        process_list(gainers, 1.0)
        process_list(unusual, 1.5)
        process_list(breakouts, 2.0)
        
        # Sort industries by score descending
        sorted_industries = sorted(industry_data.values(), key=lambda x: x['score'], reverse=True)
        
        # Format the top 4 industries
        result = []
        for ind in sorted_industries[:4]:
            def parse_change(c_str):
                try:
                    return float(c_str.replace('%', '').replace('+', '').strip())
                except Exception:
                    return 0.0
            sorted_stocks = sorted(ind['stocks'], key=lambda s: parse_change(s['change']), reverse=True)
            result.append({
                'industry': ind['industry'],
                'sector': ind['sector'],
                'score': round(ind['score'], 1),
                'leaders': sorted_stocks[:3]
            })
            
        return jsonify({'success': True, 'industries': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/watchlist')
def get_watchlist():
    refresh = request.args.get('refresh', 'false').lower() == 'true'
    watchlist = load_watchlist()
    
    # Bypass refresh if market is closed to conserve resources
    if refresh and is_market_open() and watchlist.get('tickers'):
        from concurrent.futures import ThreadPoolExecutor
        tickers = watchlist['tickers']
        with ThreadPoolExecutor(max_workers=min(len(tickers), 10)) as executor:
            results = executor.map(scrape_ticker_details, tickers)
            
        for ticker, (details, error) in zip(tickers, results):
            if details and not error:
                cached_data = watchlist['cached_data'].get(ticker, {})
                watchlist['cached_data'][ticker] = update_cached_stock_history_and_trend(cached_data, details)
        save_watchlist(watchlist)
        
    return jsonify({'success': True, 'watchlist': watchlist})

@app.route('/api/watchlist/add', methods=['POST'])
def add_to_watchlist():
    req_data = request.get_json() or {}
    ticker = req_data.get('ticker', '').upper().strip()
    if not ticker:
        return jsonify({'success': False, 'error': 'Ticker is required'}), 400
        
    watchlist = load_watchlist()
    if ticker in watchlist['tickers']:
        return jsonify({'success': True, 'message': 'Already in watchlist', 'watchlist': watchlist})
        
    # Scrape to verify and cache basic data
    details, error = scrape_ticker_details(ticker)
    if error:
        return jsonify({'success': False, 'error': f"Failed to add '{ticker}': {error}"}), 404
        
    watchlist['tickers'].append(ticker)
    watchlist['cached_data'][ticker] = update_cached_stock_history_and_trend({}, details)
    save_watchlist(watchlist)
    return jsonify({'success': True, 'watchlist': watchlist})

@app.route('/api/watchlist/remove', methods=['POST'])
def remove_from_watchlist():
    req_data = request.get_json() or {}
    ticker = req_data.get('ticker', '').upper().strip()
    if not ticker:
        return jsonify({'success': False, 'error': 'Ticker is required'}), 400
        
    watchlist = load_watchlist()
    if ticker in watchlist['tickers']:
        watchlist['tickers'].remove(ticker)
        watchlist['cached_data'].pop(ticker, None)
        watchlist['notes'].pop(ticker, None)
        save_watchlist(watchlist)
        
    return jsonify({'success': True, 'watchlist': watchlist})

@app.route('/api/stock/<ticker>/notes', methods=['POST'])
def save_stock_notes(ticker):
    ticker = ticker.upper().strip()
    req_data = request.get_json() or {}
    notes = req_data.get('notes', '')
    
    watchlist = load_watchlist()
    watchlist['notes'][ticker] = notes
    save_watchlist(watchlist)
    
    return jsonify({'success': True, 'notes': watchlist['notes']})

@app.route('/api/chart/<ticker>')
def get_chart_image(ticker):
    ticker = ticker.upper().strip()
    # Support type (c=candle, l=line), period (d=daily, w=weekly, m=monthly), size (m=medium, l=large)
    ty = request.args.get('ty', 'c')
    ta = request.args.get('ta', '1')
    p = request.args.get('p', 'd')
    s = request.args.get('s', 'l')
    
    url = f"https://finviz.com/chart.ashx?t={ticker}&ty={ty}&ta={ta}&p={p}&s={s}"
    headers = {"User-Agent": USER_AGENT}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            return Response(response.content, mimetype="image/png")
        else:
            return jsonify({'success': False, 'error': 'Chart could not be retrieved'}), response.status_code
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stock/<ticker>/ainews')
def get_stock_ai_news(ticker):
    ticker = ticker.upper().strip()
    
    # 1. Fetch news headlines from Yahoo Finance using yfinance
    try:
        ticker_obj = yf.Ticker(ticker)
        yf_news = ticker_obj.news
        
        # Resolve company name
        company_name = ticker
        try:
            company_name = ticker_obj.info.get('longName', ticker)
        except Exception:
            pass
            
        headlines = []
        if yf_news:
            for story in yf_news[:15]:  # Take top 15 news articles
                content = story.get('content', {})
                if not content:
                    continue
                title = content.get('title', '')
                pub_date_str = content.get('pubDate', '')
                provider = content.get('provider', {}).get('displayName', '')
                
                # Format ISO 8601 date string to YYYY-MM-DD
                formatted_date = ""
                if pub_date_str:
                    try:
                        clean_date = pub_date_str.replace('Z', '')
                        dt = datetime.fromisoformat(clean_date)
                        formatted_date = dt.strftime('%Y-%m-%d')
                    except Exception:
                        formatted_date = pub_date_str
                
                date_prefix = f"[{formatted_date}] " if formatted_date else ""
                provider_suffix = f" (via {provider})" if provider else ""
                headlines.append(f"- {date_prefix}{title}{provider_suffix}")
                
        if not headlines:
            return jsonify({'success': False, 'error': "No recent news headlines found for this stock on Yahoo Finance."}), 404
            
        news_str = "\n".join(headlines)
        
        # 2. Call Gemini API for news analysis
        gemini_key = os.environ.get('GEMINI_API_KEY')
        if not gemini_key:
            return jsonify({'success': False, 'error': "Gemini API key is not configured on the server."}), 500
            
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={gemini_key}"
        
        prompt = (
            f"You are an elite financial AI assistant. Below are recent news headlines for the stock {ticker} ({company_name}) with their publication dates:\n\n"
            f"{news_str}\n\n"
            f"Provide exactly 5 bullet points of flash news for this company. "
            f"Each bullet point must be a single, short, and highly explainable statement summarizing a key recent event (e.g. what happened, why it matters, and the date it occurred).\n"
            f"Explicitly mention the date of the event in each bullet point.\n"
            f"Do not write introductory or concluding text. Output exactly 5 bullet points starting with '-'."
        )
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        
        gemini_res = requests.post(gemini_url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
        if gemini_res.status_code != 200:
            return jsonify({'success': False, 'error': f"Gemini API request failed (Status {gemini_res.status_code}): {gemini_res.text}"}), 500
            
        res_data = gemini_res.json()
        if 'candidates' in res_data and res_data['candidates']:
            analysis = res_data['candidates'][0]['content']['parts'][0]['text']
            return jsonify({'success': True, 'analysis': analysis})
        else:
            return jsonify({'success': False, 'error': "Gemini API did not return any content candidates."}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

def calculate_indicators(df, supertrend_period=10, supertrend_multiplier=3.0):
    if df.empty or len(df) < 10:
        return df
    
    # Calculate EMAs for Ripster Clouds
    df['ema8'] = df['Close'].ewm(span=8, adjust=False).mean()
    df['ema9'] = df['Close'].ewm(span=9, adjust=False).mean()
    df['ema12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['ema34'] = df['Close'].ewm(span=34, adjust=False).mean()
    df['ema50'] = df['Close'].ewm(span=50, adjust=False).mean()
    df['ema89'] = df['Close'].ewm(span=89, adjust=False).mean()
    df['ema200'] = df['Close'].ewm(span=200, adjust=False).mean() if len(df) >= 200 else df['Close']
    
    # Calculate Supertrend
    high = df['High']
    low = df['Low']
    close = df['Close']
    
    tr1 = high - low
    tr2 = (high - close.shift(1)).abs()
    tr3 = (low - close.shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    
    # ATR Wilder's Moving Average
    atr = tr.ewm(alpha=1/supertrend_period, adjust=False).mean()
    
    hl2 = (high + low) / 2
    basic_ub = hl2 + supertrend_multiplier * atr
    basic_lb = hl2 - supertrend_multiplier * atr
    
    final_ub = basic_ub.copy()
    final_lb = basic_lb.copy()
    
    supertrend = pd.Series(0.0, index=df.index)
    trend = pd.Series(1, index=df.index)
    
    for i in range(1, len(df)):
        # Final Upper Band
        if basic_ub.iloc[i] < final_ub.iloc[i-1] or close.iloc[i-1] > final_ub.iloc[i-1]:
            final_ub.iloc[i] = basic_ub.iloc[i]
        else:
            final_ub.iloc[i] = final_ub.iloc[i-1]
            
        # Final Lower Band
        if basic_lb.iloc[i] > final_lb.iloc[i-1] or close.iloc[i-1] < final_lb.iloc[i-1]:
            final_lb.iloc[i] = basic_lb.iloc[i]
        else:
            final_lb.iloc[i] = final_lb.iloc[i-1]
            
        # Trend
        if close.iloc[i] > final_ub.iloc[i]:
            trend.iloc[i] = 1
        elif close.iloc[i] < final_lb.iloc[i]:
            trend.iloc[i] = -1
        else:
            trend.iloc[i] = trend.iloc[i-1]
            
        # Supertrend
        if trend.iloc[i] == 1:
            supertrend.iloc[i] = final_lb.iloc[i]
        else:
            supertrend.iloc[i] = final_ub.iloc[i]
            
    df['supertrend'] = supertrend
    df['supertrend_direction'] = trend
    
    # Calculate Signals
    signals = []
    for i in range(1, len(df)):
        prev_st_dir = trend.iloc[i-1]
        curr_st_dir = trend.iloc[i]
        
        prev_close = close.iloc[i-1]
        curr_close = close.iloc[i]
        
        prev_cloud_max = max(df['ema12'].iloc[i-1], df['ema34'].iloc[i-1])
        curr_cloud_max = max(df['ema12'].iloc[i], df['ema34'].iloc[i])
        
        prev_cloud_min = min(df['ema12'].iloc[i-1], df['ema34'].iloc[i-1])
        curr_cloud_min = min(df['ema12'].iloc[i], df['ema34'].iloc[i])
        
        signal = 'neutral'
        
        # BUY
        if prev_st_dir == -1 and curr_st_dir == 1:
            signal = 'buy_supertrend_flip'
        elif curr_st_dir == 1 and prev_close <= prev_cloud_max and curr_close > curr_cloud_max:
            signal = 'buy_cloud_breakout'
        # SELL
        elif prev_st_dir == 1 and curr_st_dir == -1:
            signal = 'sell_supertrend_flip'
        elif curr_st_dir == -1 and prev_close >= prev_cloud_min and curr_close < curr_cloud_min:
            signal = 'sell_cloud_breakdown'
            
        signals.append(signal)
        
    df['signal'] = ['neutral'] + signals
    return df

@app.route('/api/stock/<ticker>/indicators')
def get_stock_indicators(ticker):
    ticker = ticker.upper().strip()
    interval = request.args.get('interval', '5m')
    
    try:
        t = yf.Ticker(ticker)
        df = t.history(interval=interval, period='5d')
        if df.empty or len(df) < 15:
            return jsonify({'success': False, 'error': f'No historical intraday data found for {ticker}'}), 404
            
        df = calculate_indicators(df)
        
        candles = []
        ema8 = []
        ema9 = []
        ema12 = []
        ema34 = []
        ema50 = []
        supertrend = []
        signals = []
        
        for idx, row in df.iterrows():
            t_val = int(idx.timestamp())
            
            candles.append({
                'time': t_val,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': float(row['Volume'])
            })
            
            ema8.append({'time': t_val, 'value': float(row['ema8'])})
            ema9.append({'time': t_val, 'value': float(row['ema9'])})
            ema12.append({'time': t_val, 'value': float(row['ema12'])})
            ema34.append({'time': t_val, 'value': float(row['ema34'])})
            ema50.append({'time': t_val, 'value': float(row['ema50'])})
            
            supertrend.append({
                'time': t_val,
                'value': float(row['supertrend']),
                'direction': int(row['supertrend_direction'])
            })
            
            if row['signal'] != 'neutral':
                signals.append({
                    'time': t_val,
                    'type': row['signal'],
                    'price': float(row['Close'])
                })
        
        latest = df.iloc[-1]
        status = {
            'price': float(latest['Close']),
            'ema12': float(latest['ema12']),
            'ema34': float(latest['ema34']),
            'ema50': float(latest['ema50']),
            'supertrend': float(latest['supertrend']),
            'supertrend_direction': int(latest['supertrend_direction']),
            'signal': latest['signal'],
            'updated_at': df.index[-1].strftime('%Y-%m-%d %I:%M:%S %p')
        }
        
        return jsonify({
            'success': True,
            'candles': candles,
            'ema8': ema8,
            'ema9': ema9,
            'ema12': ema12,
            'ema34': ema34,
            'ema50': ema50,
            'supertrend': supertrend,
            'signals': signals,
            'status': status
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/watchlist/signals')
def get_watchlist_signals():
    watchlist = load_watchlist()
    tickers = watchlist.get('tickers', [])
    if not tickers:
        return jsonify({'success': True, 'signals': {}})
        
    signals_data = {}
    
    def get_ticker_signal(ticker):
        try:
            t = yf.Ticker(ticker)
            df = t.history(interval='5m', period='2d')
            if df.empty or len(df) < 15:
                return None
            df = calculate_indicators(df)
            latest = df.iloc[-1]
            
            recent_signal = 'neutral'
            recent_signal_candle_idx = -1
            
            # Look back up to 3 candles
            for offset in [1, 2, 3]:
                if len(df) >= offset:
                    sig = df['signal'].iloc[-offset]
                    if sig != 'neutral':
                        recent_signal = sig
                        recent_signal_candle_idx = len(df) - offset
                        break
                        
            return {
                'ticker': ticker,
                'price': float(latest['Close']),
                'change_pct': float(round(((latest['Close'] - df['Close'].iloc[-2]) / df['Close'].iloc[-2]) * 100, 2)) if len(df) > 1 else 0.0,
                'supertrend_direction': int(latest['supertrend_direction']),
                'supertrend': float(latest['supertrend']),
                'ema12': float(latest['ema12']),
                'ema34': float(latest['ema34']),
                'ema50': float(latest['ema50']),
                'latest_signal': latest['signal'],
                'recent_signal': recent_signal,
                'recent_signal_age': (len(df) - 1 - recent_signal_candle_idx) if recent_signal != 'neutral' else -1,
                'updated_at': df.index[-1].strftime('%I:%M %p')
            }
        except Exception as ex:
            print(f"Error calculating watchlist signal for {ticker}: {ex}")
            return None

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(len(tickers), 10)) as executor:
        results = executor.map(get_ticker_signal, tickers)
        
    for res in results:
        if res:
            signals_data[res['ticker']] = res
            
    return jsonify({
        'success': True,
        'signals': signals_data
    })

@app.route('/favicon.ico')
def favicon():
    return app.send_static_file('favicon.svg')

@app.route('/api/chat', methods=['POST'])
def chat():
    # Retrieve data from request
    data = request.get_json() or {}
    message = data.get('message', '').strip()
    history = data.get('history', [])
    
    if not message:
        return jsonify({'success': False, 'error': 'Message is required.'}), 400
        
    # Check if Gemini key is available
    gemini_key = os.environ.get('GEMINI_API_KEY')
    if not gemini_key:
        return jsonify({'success': False, 'error': 'Gemini API key is not configured on the server.'}), 500
        
    # Regex parse for ticker symbols in message to retrieve Yahoo Finance news
    import re
    words = re.findall(r'\b([A-Za-z]{1,5})\b', message)
    potential_tickers = [w.upper() for w in words]
    
    # Key words indicating they want news/updates
    is_news_query = any(k in message.lower() for k in ['news', 'headline', 'update', 'latest', 'happen', 'report', 'earnings', 'about', 'on'])
    
    news_context = ""
    found_ticker = None
    if is_news_query:
        for ticker in potential_tickers:
            # Skip common short English words
            if ticker in ['I', 'A', 'ON', 'FOR', 'IN', 'IS', 'TO', 'BY', 'AT', 'IT', 'US', 'AM', 'HE', 'WE', 'UP', 'GO', 'DO', 'ME', 'MY', 'SO', 'OR', 'AN', 'IF', 'NO', 'OK', 'NEW', 'NOW', 'OUT', 'GET', 'HAS', 'CAN', 'WHO', 'THE', 'AND', 'BUT', 'YOU', 'ALL', 'ANY', 'HOW', 'WHY', 'DAY']:
                continue
            try:
                t_obj = yf.Ticker(ticker)
                yf_news = t_obj.news
                if yf_news:
                    found_ticker = ticker
                    headlines = []
                    for story in yf_news[:10]:
                        content = story.get('content', {})
                        if content:
                            title = content.get('title', '')
                            provider = content.get('provider', {}).get('displayName', '')
                            headlines.append(f"- {title} (via {provider})")
                    if headlines:
                        news_context = f"\n[Real-time News Headlines for {ticker} from Yahoo Finance]:\n" + "\n".join(headlines)
                        break
            except Exception as e:
                print(f"Error fetching news context for {ticker} in chat: {e}")
                continue
                
    # Build System Instruction
    system_instruction_text = (
        "You are GainerFlow AI Assistant, an elite financial chatbot integrated directly into the GainerFlow Stock Screener. "
        "Your role is to help users analyze stocks, explain technical indicators (like EMAs and Supertrend), and summarize recent news. "
        "Be highly professional, polite, concise, and helpful. Use clear markdown formatting for bold text, headers, and bullet lists to make your responses readable. "
    )
    if news_context:
        system_instruction_text += (
            f"\n\nHere is real-time news context for the user's query:\n{news_context}\n\n"
            "Use this news context to answer the user's question, summarize the headlines, and explain what is currently happening with this stock."
        )
        
    # Format contents for Gemini API: map history and add the latest message
    contents = []
    for item in history:
        role = item.get('role')
        if role == 'assistant':
            role = 'model'
        elif role == 'user':
            role = 'user'
        else:
            continue
            
        parts = item.get('parts', [])
        if not parts and 'content' in item:
            parts = [{"text": item['content']}]
            
        contents.append({
            "role": role,
            "parts": parts
        })
        
    # Append latest user message
    contents.append({
        "role": "user",
        "parts": [{"text": message}]
    })
    
    # API Request Body
    request_body = {
        "contents": contents,
        "systemInstruction": {
            "parts": [
                {"text": system_instruction_text}
            ]
        }
    }
    
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={gemini_key}"
    
    try:
        response = requests.post(gemini_url, json=request_body, headers={'Content-Type': 'application/json'}, timeout=15)
        response_data = response.json()
        
        if response.status_code != 200:
            return jsonify({
                'success': False, 
                'error': response_data.get('error', {}).get('message', f"Gemini API returned status {response.status_code}")
            }), 500
            
        candidates = response_data.get('candidates', [])
        if not candidates:
            return jsonify({'success': False, 'error': "No response candidates returned from Gemini API."}), 500
            
        reply_text = candidates[0].get('content', {}).get('parts', [{}])[0].get('text', '')
        
        return jsonify({
            'success': True,
            'reply': reply_text,
            'news_retrieved': found_ticker is not None,
            'ticker': found_ticker
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': f"Failed to communicate with Gemini API: {str(e)}"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)
