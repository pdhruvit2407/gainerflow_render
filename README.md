# GainerFlow - Top Stock Screener & Real-Time Watchlist

GainerFlow is a premium, real-time stock screener and watchlist dashboard. It scrapes market screener lists directly from Finviz and integrates Gemini-powered AI Flash News Analysis and hover-preview stock charts.

---

## Key Features

1. **Finviz Market Screeners**:
   - **Top Gainers**: Lists top daily gainers on Finviz.
   - **Bullish Scan**: Shows bullish setup parameters (micro-cap+, price > $10, relative volume > 1.5, ATR > 1, etc.).
   - **Most Active**: Displays high-volume, highly active daily tickers.
   - **Unusual Volume**: Screens stocks with anomalous volume spikes.
   - **Most Volatile**: Highlights stocks with the highest price fluctuations.
2. **Hover stock chart preview**: Hovering over any ticker symbol in the dashboard displays a floating glassmorphic preview card containing the daily candlestick chart and company sector/market details, following the cursor dynamically.
3. **Gemini AI news analysis**: A click on the brain icon next to any ticker (or within the stock detail modal) triggers real-time news scraping from Finviz and feeds headlines into Gemini 2.5 Flash to summarize exactly **5 one-sentence flash news bullet points** on key events and momentum catalysts.
4. **Persistent Watchlist**: Add tickers to a local watchlist database with custom notes and background-refreshed quote caching.

---

## Tech Stack

- **Backend**: Python, Flask, BeautifulSoup4, Requests
- **AI Engine**: Gemini 2.5 Flash API (via direct REST API calls)
- **Frontend**: HTML5, Vanilla JavaScript, CSS3 (glassmorphic styling, animations, responsive design)
- **Data Source**: Finviz quotes & charts

---

## Getting Started

### 1. Prerequisites
Ensure you have Python 3.9+ installed.

### 2. Set Up Environment Variables
Set your Gemini API Key in your shell environment:
```bash
export GEMINI_API_KEY="your_api_key_here"
```

### 3. Run the Server
Use the pre-configured virtual environment in the project directory to launch the server:
```bash
./venv/bin/python app.py
```

The server will start on port `5001`. Access the dashboard at:
[http://127.0.0.1:5001](http://127.0.0.1:5001)

---

## Project Structure

```
├── app.py              # Flask server, scrapers & Gemini integration
├── watchlist.json      # Local JSON database for watchlist data
├── templates/
│   └── index.html      # Main dashboard HTML template
└── static/
    ├── css/
    │   └── style.css   # Custom CSS styling (glassmorphism & layout)
    └── js/
        └── app.js      # App state management, loaders & click handlers
```
