// State Management
let watchlist = [];
let watchlistNotes = {};
let watchlistCached = {};
let watchlistSignals = {};
let screenerStocks = [];
let bullishStocks = [];
let mostActiveStocks = [];
let unusualVolumeStocks = [];
let mostVolatileStocks = [];
let breakoutStocks = [];
let activeTab = 'gainers'; // 'gainers', 'bullish', 'mostactive', 'unusualvolume', 'mostvolatile', or 'breakouts'
let selectedTicker = null;
let selectedStockDetails = null;
let isMarketOpen = true; // default to true, checked dynamically
let lightweightChart = null;
let lightweightChartCandleSeries = null;
let lightweightChartEma12Series = null;
let lightweightChartEma34Series = null;
let lightweightChartEma50Series = null;
let lightweightChartSupertrendSeries = null;

// Watchlist Sorting State
let watchlistSortKey = null; // 'price' or 'volume'
let watchlistSortOrder = 'desc'; // 'asc' or 'desc'

// Chart state options (default: Candle, Daily, Indicators on)
let chartOptions = {
    ty: 'c',
    p: 'd',
    ta: '1'
};

// Auto Refresh state (5 minutes = 300 seconds)
const REFRESH_INTERVAL_SECONDS = 300;
let refreshCountdown = REFRESH_INTERVAL_SECONDS;
let countdownTimer = null;

// DOM Elements
const elScreenerList = document.getElementById('screener-list');
const elWatchlistList = document.getElementById('watchlist-list');
const elHeaderWatchlistPrice = document.getElementById('header-watchlist-price');
const elHeaderWatchlistVolume = document.getElementById('header-watchlist-volume');
const elHeaderWatchlistChange = document.getElementById('header-watchlist-change');
const elScreenerCount = document.getElementById('screener-count');
const elBullishCount = document.getElementById('bullish-count');
const elWatchlistCount = document.getElementById('watchlist-count');
const elAutoRefreshTimer = document.getElementById('auto-refresh-timer');
const elMarketStatusBar = document.getElementById('market-status-bar');
const elMarketStatusText = document.getElementById('market-status-text');
const elMarketHealthBar = document.getElementById('market-health-bar');
const elMarketHealthText = document.getElementById('market-health-text');
const elSectorRotationList = document.getElementById('sector-rotation-list');
const elBtnManualRefresh = document.getElementById('btn-manual-refresh');
const elRefreshIcon = document.getElementById('refresh-icon');

// Ticker hover card elements
const elHoverCard = document.getElementById('ticker-hover-card');
const elHoverCardImg = document.getElementById('hover-card-img');
const elHoverCardLoading = document.getElementById('hover-card-loading');
const elHoverCardTicker = document.getElementById('hover-card-ticker');
const elHoverCardCompany = document.getElementById('hover-card-company');
const elHoverCardMeta = document.getElementById('hover-card-meta');

// Tabs
const elTabGainers = document.getElementById('tab-gainers');
const elTabBullish = document.getElementById('tab-bullish');
const elTabMostActive = document.getElementById('tab-mostactive');
const elMostActiveCount = document.getElementById('mostactive-count');
const elTabUnusualVolume = document.getElementById('tab-unusualvolume');
const elUnusualVolumeCount = document.getElementById('unusualvolume-count');
const elTabMostVolatile = document.getElementById('tab-mostvolatile');
const elMostVolatileCount = document.getElementById('mostvolatile-count');
const elTabBreakouts = document.getElementById('tab-breakouts');
const elBreakoutsCount = document.getElementById('breakouts-count');
const elTabLiveAlerts = document.getElementById('tab-livealerts');
const elLiveAlertsCount = document.getElementById('livealerts-count');

// AI News Modal Elements
const elAiNewsModal = document.getElementById('ai-news-modal');
const elBtnCloseAiModal = document.getElementById('btn-close-ai-modal');
const elAiNewsTicker = document.getElementById('ai-news-ticker');
const elAiNewsLoading = document.getElementById('ai-news-loading');
const elAiNewsContent = document.getElementById('ai-news-content');
const elBtnModalAiNews = document.getElementById('btn-modal-ai-news');

// Search elements
const elInputSearch = document.getElementById('input-search-ticker');
const elBtnSearchSubmit = document.getElementById('btn-search-submit');
const elSearchErrorMsg = document.getElementById('search-error-msg');

// Modal Elements
const elModal = document.getElementById('stock-modal');
const elBtnCloseModal = document.getElementById('btn-close-modal');
const elModalTicker = document.getElementById('modal-ticker');
const elModalCompany = document.getElementById('modal-company');
const elModalSector = document.getElementById('modal-sector');
const elModalIndustry = document.getElementById('modal-industry');
const elModalCountry = document.getElementById('modal-country');
const elModalPrice = document.getElementById('modal-price');
const elModalChange = document.getElementById('modal-change');
const elModalMarketCap = document.getElementById('modal-market-cap');
const elModalVolume = document.getElementById('modal-volume');
const elModalPE = document.getElementById('modal-pe');
const elModalUpdateTime = document.getElementById('modal-update-time');
const elStockChart = document.getElementById('stock-chart');
const elChartLoading = document.getElementById('chart-loading');
const elModalSnapshotGrid = document.getElementById('modal-snapshot-grid');
const elModalProfileDesc = document.getElementById('modal-profile-desc');
const elModalNotesArea = document.getElementById('modal-notes-area');
const elBtnSaveNotes = document.getElementById('btn-save-notes');
const elNotesStatusMsg = document.getElementById('notes-status-msg');
const elBtnModalWatchlistToggle = document.getElementById('btn-modal-watchlist-toggle');
const elBtnModalRefreshQuote = document.getElementById('btn-modal-refresh-quote');
const elLiveIndicatorChart = document.getElementById('live-indicator-chart');
const elModalStrategyCard = document.getElementById('modal-strategy-card');
const elStrategySupertrend = document.getElementById('strategy-supertrend');
const elStrategyEmaCloud = document.getElementById('strategy-ema-cloud');
const elStrategySignal = document.getElementById('strategy-signal');
const elStrategyRecommendation = document.getElementById('strategy-recommendation');

// Initialize on page load with readyState check to avoid race conditions
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initApp();
        setupEventListeners();
    });
} else {
    initApp();
    setupEventListeners();
}

// App Initiation
async function initApp() {
    loadDashboardLayout();
    setupDragAndDrop();
    
    await checkMarketStatus();
    await checkMarketHealth();
    
    // Load initial data quickly from cache
    await Promise.all([
        loadWatchlistData(false),
        loadScreenerData(),
        loadBullishData(),
        loadMostActiveData(),
        loadUnusualVolumeData(),
        loadMostVolatileData(),
        loadBreakoutsData(),
        loadWatchlistSignals()
    ]);
    
    // Start timers
    startCountdown();
    
    // Load sector rotation in background
    loadSectorRotationData();
    
    // Refresh watchlist data in background for latest quotes
    loadWatchlistData(true);
}

// Setup all Event Listeners
function setupEventListeners() {
    // Helper to deactivate all tabs
    function deactivateAllTabs() {
        elTabGainers.classList.remove('active');
        elTabBullish.classList.remove('active');
        elTabMostActive.classList.remove('active');
        elTabUnusualVolume.classList.remove('active');
        elTabMostVolatile.classList.remove('active');
        elTabBreakouts.classList.remove('active');
        elTabLiveAlerts.classList.remove('active');
    }

    // Tab switching
    elTabGainers.addEventListener('click', () => {
        if (activeTab === 'gainers') return;
        activeTab = 'gainers';
        deactivateAllTabs();
        elTabGainers.classList.add('active');
        renderScreenerTable();
    });

    elTabBullish.addEventListener('click', () => {
        if (activeTab === 'bullish') return;
        activeTab = 'bullish';
        deactivateAllTabs();
        elTabBullish.classList.add('active');
        renderScreenerTable();
    });

    elTabMostActive.addEventListener('click', () => {
        if (activeTab === 'mostactive') return;
        activeTab = 'mostactive';
        deactivateAllTabs();
        elTabMostActive.classList.add('active');
        renderScreenerTable();
    });

    elTabUnusualVolume.addEventListener('click', () => {
        if (activeTab === 'unusualvolume') return;
        activeTab = 'unusualvolume';
        deactivateAllTabs();
        elTabUnusualVolume.classList.add('active');
        renderScreenerTable();
    });

    elTabMostVolatile.addEventListener('click', () => {
        if (activeTab === 'mostvolatile') return;
        activeTab = 'mostvolatile';
        deactivateAllTabs();
        elTabMostVolatile.classList.add('active');
        renderScreenerTable();
    });

    elTabBreakouts.addEventListener('click', () => {
        if (activeTab === 'breakouts') return;
        activeTab = 'breakouts';
        deactivateAllTabs();
        elTabBreakouts.classList.add('active');
        renderScreenerTable();
    });

    elTabLiveAlerts.addEventListener('click', () => {
        if (activeTab === 'livealerts') return;
        activeTab = 'livealerts';
        deactivateAllTabs();
        elTabLiveAlerts.classList.add('active');
        renderScreenerTable();
    });

    // AI News Modal Close
    elBtnCloseAiModal.addEventListener('click', closeAiModal);
    elAiNewsModal.addEventListener('click', (e) => {
        if (e.target === elAiNewsModal) closeAiModal();
    });

    // AI News Trigger from detail modal
    elBtnModalAiNews.addEventListener('click', () => {
        if (selectedTicker) {
            openAiNews(selectedTicker);
        }
    });

    // Manual Refresh
    elBtnManualRefresh.addEventListener('click', () => {
        if (!isMarketOpen) {
            alert('US Stock Market is currently closed. Trading hours are Mon-Fri, 9:00 AM - 4:00 PM EST.');
            return;
        }
        triggerRefresh();
    });

    // Search input handler (Enter key)
    elInputSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearchSubmit();
        }
    });

    // Search click handler
    elBtnSearchSubmit.addEventListener('click', () => {
        handleSearchSubmit();
    });

    // Modal Close
    elBtnCloseModal.addEventListener('click', closeModal);
    elModal.addEventListener('click', (e) => {
        if (e.target === elModal) closeModal();
    });
    elModalTicker.addEventListener('click', () => {
        if (selectedTicker) {
            window.open(`https://www.tradingview.com/chart/MZ0gFrSs/?symbol=${selectedTicker}`, '_blank');
        }
    });

    // Chart Options Toggles
    const chartOptBtns = document.querySelectorAll('.btn-chart-opt');
    chartOptBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const opt = e.target.getAttribute('data-opt');
            const val = e.target.getAttribute('data-val');
            
            // Toggle active class inside parent group
            const btnGroup = e.target.parentElement;
            btnGroup.querySelectorAll('.btn-chart-opt').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Update options and reload chart
            chartOptions[opt] = val;
            loadModalChart();
        });
    });

    // Watchlist Toggle inside Modal
    elBtnModalWatchlistToggle.addEventListener('click', async () => {
        if (!selectedTicker) return;
        
        elBtnModalWatchlistToggle.disabled = true;
        const inWatchlist = watchlist.includes(selectedTicker);
        
        if (inWatchlist) {
            await removeFromWatchlistApi(selectedTicker);
            setWatchlistButtonState(false);
        } else {
            await addToWatchlistApi(selectedTicker);
            setWatchlistButtonState(true);
        }
        
        elBtnModalWatchlistToggle.disabled = false;
        // Reload dashboard lists
        await loadWatchlistData();
        renderScreenerTable();
    });

    // Refresh Quote inside Modal (Specific Update)
    elBtnModalRefreshQuote.addEventListener('click', async () => {
        if (!selectedTicker) return;
        
        // Spin action
        const refreshIcon = elBtnModalRefreshQuote.querySelector('i');
        refreshIcon.classList.add('fa-spin');
        elBtnModalRefreshQuote.disabled = true;
        
        try {
            const response = await fetch(`/api/stock/${selectedTicker}/update`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                selectedStockDetails = data.details;
                // Update notes display
                watchlistNotes[selectedTicker] = elModalNotesArea.value; // retain typed note
                renderModalData();
                loadModalChart();
                
                // Refresh watchlist list since details might have changed
                await loadWatchlistData();
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (err) {
            console.error(err);
            alert("Connection error while fetching stock update.");
        } finally {
            refreshIcon.classList.remove('fa-spin');
            elBtnModalRefreshQuote.disabled = false;
        }
    });

    // Save Notes
    elBtnSaveNotes.addEventListener('click', async () => {
        if (!selectedTicker) return;
        
        const notes = elModalNotesArea.value;
        elBtnSaveNotes.disabled = true;
        
        try {
            const response = await fetch(`/api/stock/${selectedTicker}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: notes })
            });
            const data = await response.json();
            if (data.success) {
                watchlistNotes[selectedTicker] = notes;
                
                // Show saved indicator
                elNotesStatusMsg.classList.remove('hidden');
                setTimeout(() => {
                    elNotesStatusMsg.classList.add('hidden');
                }, 2000);
            }
        } catch (err) {
            console.error(err);
            alert("Error saving notes.");
        } finally {
            elBtnSaveNotes.disabled = false;
        }
    });

    // Watchlist header sorting triggers
    if (elHeaderWatchlistPrice && elHeaderWatchlistVolume && elHeaderWatchlistChange) {
        elHeaderWatchlistPrice.addEventListener('click', () => {
            handleWatchlistSort('price');
        });
        
        elHeaderWatchlistVolume.addEventListener('click', () => {
            handleWatchlistSort('volume');
        });
        
        elHeaderWatchlistChange.addEventListener('click', () => {
            handleWatchlistSort('change');
        });
    }
}

// Load Screener stocks list from backend
async function loadScreenerData() {
    try {
        const response = await fetch('/api/stocks');
        const data = await response.json();
        if (data.success) {
            screenerStocks = data.stocks;
            elScreenerCount.textContent = screenerStocks.length;
            if (activeTab === 'gainers') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'gainers') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'gainers') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// Load Bullish Scan stocks list from backend
async function loadBullishData() {
    try {
        const response = await fetch('/api/stocks/bullish');
        const data = await response.json();
        if (data.success) {
            bullishStocks = data.stocks;
            elBullishCount.textContent = bullishStocks.length;
            if (activeTab === 'bullish') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'bullish') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'bullish') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// Load Watchlist tickers and cache
// Load Watchlist tickers and cache
async function loadWatchlistData(refresh = false) {
    try {
        const url = refresh ? '/api/watchlist?refresh=true' : '/api/watchlist';
        const response = await fetch(url);
        const data = await response.json();
        if (data.success) {
            watchlist = data.watchlist.tickers;
            watchlistNotes = data.watchlist.notes;
            watchlistCached = data.watchlist.cached_data;
            elWatchlistCount.textContent = `${watchlist.length} stocks`;
            renderWatchlistTable();
        }
    } catch (err) {
        console.error("Error loading watchlist data:", err);
    }
}

// Render Screener Table (Top Gainers or Bullish Scan)
function renderScreenerTable() {
    const tableScreener = document.getElementById('table-screener');
    if (!tableScreener) return;
    const thead = tableScreener.querySelector('thead');
    
    if (activeTab === 'livealerts') {
        renderLiveAlertsTable();
        return;
    }
    
    thead.innerHTML = `
        <tr>
            <th>Ticker</th>
            <th>Company</th>
            <th>Sector</th>
            <th class="text-right">Price</th>
            <th class="text-right">Change</th>
            <th class="text-right">Volume</th>
            <th class="text-center">Action</th>
        </tr>
    `;

    const stocksToRender = 
        activeTab === 'gainers' ? screenerStocks : 
        (activeTab === 'bullish' ? bullishStocks : 
        (activeTab === 'mostactive' ? mostActiveStocks : 
        (activeTab === 'unusualvolume' ? unusualVolumeStocks : 
        (activeTab === 'mostvolatile' ? mostVolatileStocks : breakoutStocks))));
    
    if (stocksToRender.length === 0) {
        elScreenerList.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No stock data available.</td></tr>`;
        return;
    }
    
    elScreenerList.innerHTML = '';
    
    // Compute intersection of all four screeners for super ticker highlighting
    const gainersSet = new Set(screenerStocks.map(s => s.ticker));
    const activeSet = new Set(mostActiveStocks.map(s => s.ticker));
    const unusualSet = new Set(unusualVolumeStocks.map(s => s.ticker));
    const volatileSet = new Set(mostVolatileStocks.map(s => s.ticker));
    const intersectionSet = new Set(
        [...gainersSet].filter(tkr => activeSet.has(tkr) && unusualSet.has(tkr) && volatileSet.has(tkr))
    );
    
    stocksToRender.forEach(stock => {
        const tr = document.createElement('tr');
        
        const isWatchlisted = watchlist.includes(stock.ticker);
        const starClass = isWatchlisted ? 'fa-solid fa-star text-watchlist' : 'fa-regular fa-star';
        
        const changeVal = parseFloat(stock.change);
        const changeClass = changeVal >= 0 ? 'positive' : 'negative';
        const changeSign = changeVal >= 0 ? '+' : '';
        
        const isIntersection = intersectionSet.has(stock.ticker);
        if (isIntersection) {
            tr.classList.add('tr-intersection');
        }
        
        const tickerHTML = isIntersection 
            ? `<span class="ticker-intersection">${stock.ticker}</span><i class="fa-solid fa-crown text-xs ml-1" style="color: #eab308;" title="Super Ticker: Intersection of Gainers, Active, Unusual Volume, & Volatile"></i>`
            : stock.ticker;
            
        // Calculate Stop Loss & Target Price for hovering tooltips
        const cleanPrice = parseFloat(stock.price.replace(/[^0-9.]/g, '')) || 0;
        const slVal = cleanPrice * 0.975;
        const tpVal = cleanPrice * 1.10;
        const priceTooltip = cleanPrice > 0 
            ? `Stop Loss (SL): $${slVal.toFixed(2)} (-2.5%) | Target (TP 4:1): $${tpVal.toFixed(2)} (+10.0%)` 
            : '';
            
        tr.innerHTML = `
            <td class="ticker-cell">${tickerHTML}</td>
            <td class="company-cell">${stock.company}</td>
            <td>${stock.sector}</td>
            <td class="text-right font-medium price-cell-hoverable" title="${priceTooltip}">$${stock.price}</td>
            <td class="text-right"><span class="change-cell ${changeClass}">${changeSign}${stock.change}</span></td>
            <td class="text-right">${stock.volume}</td>
            <td class="text-center" onclick="event.stopPropagation()">
                <button class="btn-icon btn-watchlist-star" data-ticker="${stock.ticker}" title="${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="${starClass}"></i>
                </button>
                <button class="btn-icon btn-row-ai-news" data-ticker="${stock.ticker}" title="AI News Analysis">
                    <i class="fa-solid fa-brain"></i>
                </button>
            </td>
        `;
        
        // Modal trigger on row click
        tr.addEventListener('click', () => {
            openStockDetails(stock.ticker);
        });

        // Ticker hover card trigger & TradingView click
        const tickerCell = tr.querySelector('.ticker-cell');
        tickerCell.addEventListener('mouseenter', (e) => showHoverCard(e, stock.ticker, stock));
        tickerCell.addEventListener('mousemove', moveHoverCard);
        tickerCell.addEventListener('mouseleave', hideHoverCard);
        tickerCell.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://www.tradingview.com/chart/MZ0gFrSs/?symbol=${stock.ticker}`, '_blank');
        });

        // AI News button trigger
        const aiNewsBtn = tr.querySelector('.btn-row-ai-news');
        aiNewsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAiNews(stock.ticker);
        });
        
        // Watchlist Star click trigger
        const starBtn = tr.querySelector('.btn-watchlist-star');
        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tick = starBtn.getAttribute('data-ticker');
            if (watchlist.includes(tick)) {
                starBtn.querySelector('i').className = 'fa-regular fa-star';
                await removeFromWatchlistApi(tick);
            } else {
                starBtn.querySelector('i').className = 'fa-solid fa-star text-watchlist';
                await addToWatchlistApi(tick);
            }
            await loadWatchlistData();
            renderScreenerTable();
        });
        
        elScreenerList.appendChild(tr);
    });
}

// Render Watchlist Table
function renderWatchlistTable() {
    updateWatchlistSortIcons();

    if (watchlist.length === 0) {
        elWatchlistList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <i class="fa-regular fa-star font-lg mb-2"></i>
                    <p>Your watchlist is empty.</p>
                    <p class="text-xs text-muted mt-1">Search a ticker above or click stars in the list to track stocks.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    elWatchlistList.innerHTML = '';
    
    // Sort watchlist copy based on sorting state
    let sortedWatchlist = [...watchlist];
    if (watchlistSortKey) {
        sortedWatchlist.sort((a, b) => {
            const cachedA = watchlistCached[a] || {};
            const cachedB = watchlistCached[b] || {};
            
            let valA, valB;
            if (watchlistSortKey === 'price') {
                valA = parseFloat(cachedA.price) || 0;
                valB = parseFloat(cachedB.price) || 0;
            } else if (watchlistSortKey === 'volume') {
                valA = parseInt((cachedA.volume || '').replace(/,/g, '')) || 0;
                valB = parseInt((cachedB.volume || '').replace(/,/g, '')) || 0;
            } else if (watchlistSortKey === 'change') {
                valA = parseFloat((cachedA.change || '').replace(/%/g, '')) || 0;
                valB = parseFloat((cachedB.change || '').replace(/%/g, '')) || 0;
            }
            
            if (watchlistSortOrder === 'asc') {
                return valA - valB;
            } else {
                return valB - valA;
            }
        });
    }
    
    // Parse volumes to compute heatmap min/max
    const parseVol = (vStr) => parseInt((vStr || '').replace(/,/g, '')) || 0;
    const volumes = sortedWatchlist.map(t => parseVol(watchlistCached[t]?.volume));
    const maxVol = Math.max(...volumes);
    const minVol = Math.min(...volumes);
    
    // Compute intersection of all four screeners for super ticker highlighting
    const gainersSet = new Set(screenerStocks.map(s => s.ticker));
    const activeSet = new Set(mostActiveStocks.map(s => s.ticker));
    const unusualSet = new Set(unusualVolumeStocks.map(s => s.ticker));
    const volatileSet = new Set(mostVolatileStocks.map(s => s.ticker));
    const intersectionSet = new Set(
        [...gainersSet].filter(tkr => activeSet.has(tkr) && unusualSet.has(tkr) && volatileSet.has(tkr))
    );
    
    sortedWatchlist.forEach(ticker => {
        const cached = watchlistCached[ticker] || {};
        const tr = document.createElement('tr');
        
        const price = cached.price || 'N/A';
        const change = cached.change || '0.00%';
        const company = cached.company || 'Loading details...';
        const volume = cached.volume || 'N/A';
        
        const changeVal = parseFloat(change);
        const changeClass = changeVal >= 0 ? 'positive' : 'negative';
        const changeSign = changeVal >= 0 ? '+' : '';
        
        const isIntersection = intersectionSet.has(ticker);
        const isTrendingUp = cached.trend === 'up';
        
        if (isIntersection) {
            tr.classList.add('tr-intersection');
        } else if (isTrendingUp) {
            tr.classList.add('tr-trending-up');
        }
        
        const signalData = watchlistSignals[ticker];
        let signalIndicatorHTML = '';
        if (signalData) {
            const stDir = signalData.supertrend_direction;
            const dotClass = stDir === 1 ? 'buy' : 'sell';
            const dotTitle = stDir === 1 ? 'Supertrend: Bullish (5m)' : 'Supertrend: Bearish (5m)';
            signalIndicatorHTML = `<span class="signal-dot ${dotClass}" title="${dotTitle}"></span>`;
            
            if (signalData.recent_signal && signalData.recent_signal !== 'neutral' && signalData.recent_signal_age <= 3) {
                const isBuy = signalData.recent_signal.startsWith('buy');
                const badgeClass = isBuy ? 'buy' : 'sell';
                const badgeText = isBuy ? 'BUY' : 'SELL';
                signalIndicatorHTML += `<span class="signal-pill ${badgeClass}" style="padding: 1px 5px; font-size: 8px; margin-left: 4px;" title="Recent 5m Signal: ${signalData.recent_signal}">${badgeText}</span>`;
            }
        }
        
        let tickerHTML = signalIndicatorHTML ? `${signalIndicatorHTML} ${ticker}` : ticker;
        if (isIntersection) {
            tickerHTML = signalIndicatorHTML 
                ? `${signalIndicatorHTML} <span class="ticker-intersection">${ticker}</span><i class="fa-solid fa-crown text-xs ml-1" style="color: #eab308;" title="Super Ticker: Intersection of Gainers, Active, Unusual Volume, & Volatile"></i>`
                : `<span class="ticker-intersection">${ticker}</span><i class="fa-solid fa-crown text-xs ml-1" style="color: #eab308;" title="Super Ticker: Intersection of Gainers, Active, Unusual Volume, & Volatile"></i>`;
        } else if (isTrendingUp) {
            tickerHTML = signalIndicatorHTML
                ? `${signalIndicatorHTML} <span>${ticker}</span><i class="fa-solid fa-arrow-trend-up text-gainer animate-pulse ml-1" title="Upward price trend detected over the last 15-25 minutes"></i>`
                : `<span>${ticker}</span><i class="fa-solid fa-arrow-trend-up text-gainer animate-pulse ml-1" title="Upward price trend detected over the last 15-25 minutes"></i>`;
        }
        
        // Append earnings warning if scheduled within 3 days
        if (cached.earnings_soon) {
            tickerHTML += ` <span class="badge-warning animate-pulse" title="WARNING: Upcoming Earnings on ${cached.earnings_date} (within 3 days)! Trading breakouts right before earnings is high-risk due to potential overnight gaps."><i class="fa-solid fa-triangle-exclamation"></i></span>`;
        }
            
        // Calculate Stop Loss & Target Price for hovering tooltips
        const cleanPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;
        const slVal = cleanPrice * 0.975;
        const tpVal = cleanPrice * 1.10;
        const priceTooltip = cleanPrice > 0 
            ? `Stop Loss (SL): $${slVal.toFixed(2)} (-2.5%) | Target (TP 4:1): $${tpVal.toFixed(2)} (+10.0%)` 
            : '';

        const vol = parseVol(volume);
        const ratio = maxVol > minVol ? (vol - minVol) / (maxVol - minVol) : 0.5;
        const rVal = Math.round(99 * ratio + 255 * (1 - ratio));
        const gVal = Math.round(102 * ratio + 255 * (1 - ratio));
        const bVal = Math.round(241 * ratio + 255 * (1 - ratio));
        const aVal = 0.35 * ratio + 0.04 * (1 - ratio);
        const bgCol = `rgba(${rVal}, ${gVal}, ${bVal}, ${aVal})`;

        tr.innerHTML = `
            <td class="ticker-cell">${tickerHTML}</td>
            <td class="company-cell text-xs">${company}</td>
            <td class="text-right font-medium price-cell-hoverable" title="${priceTooltip}">${price !== 'N/A' ? '$' + price : 'N/A'}</td>
            <td class="text-right"><span class="change-cell ${changeClass}">${changeSign}${change}</span></td>
            <td class="text-right"><span class="volume-badge" style="background-color: ${bgCol};">${volume}</span></td>
            <td class="text-center" onclick="event.stopPropagation()">
                <button class="btn-icon btn-row-ai-news" data-ticker="${ticker}" title="AI News Analysis">
                    <i class="fa-solid fa-brain" style="color: #a855f7;"></i>
                </button>
                <button class="btn-icon btn-icon-danger btn-remove-watchlist" data-ticker="${ticker}" title="Remove from Watchlist">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        
        // Modal trigger on row click
        tr.addEventListener('click', () => {
            openStockDetails(ticker);
        });

        // Ticker hover card trigger & TradingView click
        const tickerCell = tr.querySelector('.ticker-cell');
        const stockData = watchlistCached[ticker] || { ticker: ticker };
        tickerCell.addEventListener('mouseenter', (e) => showHoverCard(e, ticker, stockData));
        tickerCell.addEventListener('mousemove', moveHoverCard);
        tickerCell.addEventListener('mouseleave', hideHoverCard);
        tickerCell.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(`https://www.tradingview.com/chart/MZ0gFrSs/?symbol=${ticker}`, '_blank');
        });

        // AI News button trigger
        const aiNewsBtn = tr.querySelector('.btn-row-ai-news');
        aiNewsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAiNews(ticker);
        });
        
        // Trash button trigger
        const trashBtn = tr.querySelector('.btn-remove-watchlist');
        trashBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tick = trashBtn.getAttribute('data-ticker');
            await removeFromWatchlistApi(tick);
            await loadWatchlistData();
            renderScreenerTable();
        });
        
        elWatchlistList.appendChild(tr);
    });
}

// Display error in Screener table
function showScreenerError(message) {
    elScreenerList.innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4 text-loser">
                <i class="fa-solid fa-triangle-exclamation font-lg mb-2"></i>
                <p>Failed to load screener data</p>
                <p class="text-xs text-muted mt-1">${message}</p>
            </td>
        </tr>
    `;
}

// Search form submit
async function handleSearchSubmit() {
    const query = elInputSearch.value.trim().toUpperCase();
    if (!query) return;
    
    hideSearchError();
    elBtnSearchSubmit.disabled = true;
    const originalText = elBtnSearchSubmit.innerHTML;
    elBtnSearchSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading...`;
    
    try {
        const response = await fetch(`/api/stock/${query}`);
        const data = await response.json();
        
        if (data.success) {
            elInputSearch.value = '';
            // Auto add to watchlist if searched successfully
            await addToWatchlistApi(query);
            await loadWatchlistData();
            renderScreenerTable();
            // Open modal
            openStockDetails(query);
        } else {
            showSearchError(data.error || `Stock ticker '${query}' not found.`);
        }
    } catch (err) {
        showSearchError("Connection error while searching ticker.");
        console.error(err);
    } finally {
        elBtnSearchSubmit.disabled = false;
        elBtnSearchSubmit.innerHTML = originalText;
    }
}

function showSearchError(msg) {
    elSearchErrorMsg.textContent = msg;
    elSearchErrorMsg.classList.remove('hidden');
}

function hideSearchError() {
    elSearchErrorMsg.classList.add('hidden');
}

// API Watchlist addition
async function addToWatchlistApi(ticker) {
    try {
        await fetch('/api/watchlist/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: ticker })
        });
    } catch (err) {
        console.error(err);
    }
}

// API Watchlist removal
async function removeFromWatchlistApi(ticker) {
    try {
        await fetch('/api/watchlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker: ticker })
        });
    } catch (err) {
        console.error(err);
    }
}

// Modal handling
async function openStockDetails(ticker) {
    selectedTicker = ticker.toUpperCase().trim();
    showModalSpinner();
    elModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
    
    try {
        const response = await fetch(`/api/stock/${selectedTicker}`);
        const data = await response.json();
        if (data.success) {
            selectedStockDetails = data.details;
            renderModalData();
            loadModalChart();
        } else {
            alert(`Could not load details: ${data.error}`);
            closeModal();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to connect to retrieve details.");
        closeModal();
    }
}

function closeModal() {
    elModal.classList.add('hidden');
    document.body.style.overflow = '';
    selectedTicker = null;
    selectedStockDetails = null;
    // Reset chart options
    chartOptions = { ty: 'c', p: 'd', ta: '1' };
    
    // Clean up Lightweight Chart
    if (lightweightChart) {
        lightweightChart.remove();
        lightweightChart = null;
    }
    elLiveIndicatorChart.classList.add('hidden');
    elModalStrategyCard.classList.add('hidden');
    elStockChart.classList.remove('hidden');
    
    // Reset active classes on chart buttons
    document.querySelectorAll('.btn-chart-opt').forEach(btn => {
        const opt = btn.getAttribute('data-opt');
        const val = btn.getAttribute('data-val');
        if ((opt === 'ty' && val === 'c') || (opt === 'p' && val === 'd') || (opt === 'ta' && val === '1')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function showModalSpinner() {
    elModalTicker.textContent = selectedTicker;
    elModalCompany.textContent = 'Loading...';
    elModalSector.textContent = '';
    elModalIndustry.textContent = '';
    elModalCountry.textContent = '';
    elModalPrice.textContent = '...';
    elModalChange.textContent = '...';
    elModalChange.className = 'value change-text';
    elModalMarketCap.textContent = '...';
    elModalVolume.textContent = '...';
    elModalPE.textContent = '...';
    elModalUpdateTime.textContent = '';
    elModalProfileDesc.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Loading profile...`;
    elModalSnapshotGrid.innerHTML = '';
    elModalNotesArea.value = '';
    elStockChart.src = '';
    elChartLoading.classList.remove('hidden');
}

function setWatchlistButtonState(inWatchlist) {
    if (inWatchlist) {
        elBtnModalWatchlistToggle.innerHTML = `<i class="fa-solid fa-star text-watchlist"></i> <span>Remove Watchlist</span>`;
        elBtnModalWatchlistToggle.className = 'btn btn-full btn-outline border-watchlist';
    } else {
        elBtnModalWatchlistToggle.innerHTML = `<i class="fa-regular fa-star"></i> <span>Add to Watchlist</span>`;
        elBtnModalWatchlistToggle.className = 'btn btn-full btn-outline';
    }
}

// Render data inside details modal
function renderModalData() {
    if (!selectedStockDetails) return;
    
    const s = selectedStockDetails;
    
    // Header
    elModalTicker.textContent = s.ticker;
    elModalCompany.textContent = s.company;
    elModalSector.textContent = s.sector;
    elModalIndustry.textContent = s.industry;
    elModalCountry.textContent = s.country;
    
    // Summary card
    elModalPrice.textContent = `$${s.price}`;
    
    const changeVal = parseFloat(s.change);
    const changeSign = changeVal >= 0 ? '+' : '';
    elModalChange.textContent = `${changeSign}${s.change}`;
    elModalChange.className = `value change-text change-cell ${changeVal >= 0 ? 'positive' : 'negative'}`;
    
    elModalMarketCap.textContent = s.market_cap;
    elModalVolume.textContent = s.volume;
    elModalPE.textContent = s.pe;
    
    const updatedTime = new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elModalUpdateTime.textContent = `Updated: ${updatedTime}`;
    
    // Profile
    elModalProfileDesc.textContent = s.profile;
    
    // Watchlist State button
    const inWatchlist = watchlist.includes(s.ticker);
    setWatchlistButtonState(inWatchlist);
    
    // Custom Notes
    elModalNotesArea.value = watchlistNotes[s.ticker] || '';
    
    // Snapshot financial grid
    elModalSnapshotGrid.innerHTML = '';
    const ignoreKeys = ['Company', 'Price', 'Change', 'Volume', 'Market Cap', 'P/E'];
    
    // Sort keys alphabetically so the grid looks neat, but keep some important ones first
    const snapshotKeys = Object.keys(s.snapshot).filter(k => !ignoreKeys.includes(k)).sort();
    
    if (snapshotKeys.length === 0) {
        elModalSnapshotGrid.innerHTML = `<p class="text-muted text-center py-4" style="grid-column: 1/-1;">No financial metrics available.</p>`;
    } else {
        snapshotKeys.forEach(k => {
            const val = s.snapshot[k];
            const div = document.createElement('div');
            div.className = 'snapshot-item';
            
            // Check if value is green or red (e.g. percentages positive/negative)
            let colorClass = '';
            if (val.includes('%') && !val.startsWith('-')) {
                // If it is a percentage and doesn't start with minus, check if it's positive
                const parsedVal = parseFloat(val);
                if (!isNaN(parsedVal) && parsedVal > 0) {
                    // Check if it's a financial percentage that denotes gain
                    if (k.toLowerCase().includes('perf') || k.toLowerCase().includes('margin') || k.toLowerCase().includes('roe') || k.toLowerCase().includes('roa') || k.toLowerCase().includes('roi')) {
                        colorClass = 'text-gainer';
                    }
                }
            } else if (val.startsWith('-') && val.includes('%')) {
                colorClass = 'text-loser';
            }
            
            div.innerHTML = `
                <span class="snap-lbl">${k}</span>
                <span class="snap-val ${colorClass}">${val}</span>
            `;
            elModalSnapshotGrid.appendChild(div);
        });
    }
}

// Load image chart via Flask proxy
function loadModalChart() {
    if (!selectedTicker) return;
    
    // Cleanup existing Lightweight chart if switching back to image charts
    if (lightweightChart) {
        lightweightChart.remove();
        lightweightChart = null;
    }
    
    if (chartOptions.p === '5m') {
        elStockChart.classList.add('hidden');
        elLiveIndicatorChart.classList.remove('hidden');
        elModalStrategyCard.classList.remove('hidden');
        renderLiveIndicatorChart(selectedTicker);
        return;
    }
    
    elLiveIndicatorChart.classList.add('hidden');
    elModalStrategyCard.classList.add('hidden');
    elStockChart.classList.remove('hidden');
    
    elChartLoading.classList.remove('hidden');
    
    // Request chart with selections
    const chartUrl = `/api/chart/${selectedTicker}?ty=${chartOptions.ty}&p=${chartOptions.p}&ta=${chartOptions.ta}`;
    
    // Pre-load image in memory to prevent blinking
    const imgLoader = new Image();
    imgLoader.src = chartUrl;
    imgLoader.onload = () => {
        elStockChart.src = chartUrl;
        elChartLoading.classList.add('hidden');
    };
    imgLoader.onerror = () => {
        elStockChart.alt = "Failed to load stock chart image.";
        elChartLoading.classList.add('hidden');
    };
}

// Global Refresh logic
async function triggerRefresh() {
    // Add spinning animation to refresh icon
    elRefreshIcon.classList.add('spinning');
    elBtnManualRefresh.disabled = true;
    
    // Refresh screener and watchlist data (with force refresh on watchlist)
    await Promise.all([
        loadWatchlistData(true),
        loadScreenerData(),
        loadBullishData(),
        loadMostActiveData(),
        loadUnusualVolumeData(),
        loadMostVolatileData(),
        loadBreakoutsData(),
        loadSectorRotationData(),
        loadWatchlistSignals()
    ]);
    
    // Stop spinning after a short delay for visual confirmation
    setTimeout(() => {
        elRefreshIcon.classList.remove('spinning');
        elBtnManualRefresh.disabled = false;
    }, 600);
    
    // Reset timer
    resetCountdown();
}

// Countdown timers for auto refresh
function startCountdown() {
    if (countdownTimer) clearInterval(countdownTimer);
    
    countdownTimer = setInterval(async () => {
        // Check market status and health every 60 seconds
        if (refreshCountdown % 60 === 0) {
            await checkMarketStatus();
            await checkMarketHealth();
        }
        
        if (!isMarketOpen) {
            elAutoRefreshTimer.textContent = 'Auto-refresh Paused';
            return;
        }
        
        refreshCountdown--;
        
        if (refreshCountdown <= 0) {
            // Auto refresh triggers
            triggerRefresh();
            resetCountdown();
        } else {
            updateCountdownDisplay();
        }
    }, 1000);
}

function resetCountdown() {
    refreshCountdown = REFRESH_INTERVAL_SECONDS;
    updateCountdownDisplay();
}

function updateCountdownDisplay() {
    const mins = Math.floor(refreshCountdown / 60);
    const secs = refreshCountdown % 60;
    
    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(secs).padStart(2, '0');
    
    elAutoRefreshTimer.textContent = `Auto-refresh in ${formattedMins}:${formattedSecs}`;
}

// Ticker Hover Card Logic
let hoverTimeout = null;

function showHoverCard(event, ticker, stockData) {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    // Set text elements
    elHoverCardTicker.textContent = ticker;
    elHoverCardCompany.textContent = stockData.company || 'Loading details...';
    
    if (stockData.sector && stockData.country && stockData.market_cap) {
        elHoverCardMeta.textContent = `${stockData.sector} • ${stockData.country} • ${stockData.market_cap}`;
        elHoverCardMeta.classList.remove('hidden');
    } else {
        elHoverCardMeta.textContent = '';
        elHoverCardMeta.classList.add('hidden');
    }
    
    // Show spinner and reset image src
    elHoverCardLoading.classList.remove('hidden');
    elHoverCardImg.src = '';
    elHoverCardImg.classList.add('hidden');
    
    // Position card near mouse
    positionHoverCard(event);
    
    // Load image
    const chartUrl = `/api/chart/${ticker}?ty=c&p=d&ta=1&s=m`;
    const imgLoader = new Image();
    imgLoader.src = chartUrl;
    imgLoader.onload = () => {
        // Double check if we are still hovering on this ticker
        if (elHoverCardTicker.textContent === ticker) {
            elHoverCardImg.src = chartUrl;
            elHoverCardImg.classList.remove('hidden');
            elHoverCardLoading.classList.add('hidden');
        }
    };
    imgLoader.onerror = () => {
        if (elHoverCardTicker.textContent === ticker) {
            elHoverCardLoading.innerHTML = `<span class="text-xs text-loser" style="padding: 20px;"><i class="fa-solid fa-triangle-exclamation"></i> Chart preview unavailable</span>`;
        }
    };

    // Show hover card container
    elHoverCard.classList.remove('hidden');
    // Force browser reflow
    elHoverCard.offsetHeight;
    elHoverCard.classList.add('visible');
}

function moveHoverCard(event) {
    positionHoverCard(event);
}

function hideHoverCard() {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    
    elHoverCard.classList.remove('visible');
    hoverTimeout = setTimeout(() => {
        elHoverCard.classList.add('hidden');
        elHoverCardImg.src = '';
        elHoverCardLoading.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    }, 150); // wait for fadeout transition
}

function positionHoverCard(event) {
    const cardWidth = 420;
    const cardHeight = 280; // approximate height
    const margin = 15; // margin from cursor
    
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    
    // Check viewport boundary (right)
    if (x + cardWidth > window.innerWidth) {
        x = event.clientX - cardWidth - margin;
    }
    
    // Check viewport boundary (bottom)
    if (y + cardHeight > window.innerHeight) {
        y = event.clientY - cardHeight - margin;
        if (y < 0) y = 10; // clamp to top
    }
    
    elHoverCard.style.left = `${x}px`;
    elHoverCard.style.top = `${y}px`;
}

// Load Unusual Volume stocks list from backend
async function loadUnusualVolumeData() {
    try {
        const response = await fetch('/api/stocks/unusualvolume');
        const data = await response.json();
        if (data.success) {
            unusualVolumeStocks = data.stocks;
            elUnusualVolumeCount.textContent = unusualVolumeStocks.length;
            if (activeTab === 'unusualvolume') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'unusualvolume') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'unusualvolume') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// Load Most Volatile stocks list from backend
async function loadMostVolatileData() {
    try {
        const response = await fetch('/api/stocks/mostvolatile');
        const data = await response.json();
        if (data.success) {
            mostVolatileStocks = data.stocks;
            elMostVolatileCount.textContent = mostVolatileStocks.length;
            if (activeTab === 'mostvolatile') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'mostvolatile') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'mostvolatile') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// Load Most Active stocks list from backend
async function loadMostActiveData() {
    try {
        const response = await fetch('/api/stocks/mostactive');
        const data = await response.json();
        if (data.success) {
            mostActiveStocks = data.stocks;
            elMostActiveCount.textContent = mostActiveStocks.length;
            if (activeTab === 'mostactive') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'mostactive') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'mostactive') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// Load Breakout stocks list from backend
async function loadBreakoutsData() {
    try {
        const response = await fetch('/api/stocks/breakouts');
        const data = await response.json();
        if (data.success) {
            breakoutStocks = data.stocks;
            elBreakoutsCount.textContent = breakoutStocks.length;
            if (activeTab === 'breakouts') {
                renderScreenerTable();
            }
        } else {
            if (activeTab === 'breakouts') {
                showScreenerError(data.error);
            }
        }
    } catch (err) {
        if (activeTab === 'breakouts') {
            showScreenerError("Unable to connect to Flask server.");
        }
        console.error(err);
    }
}

// AI News Modal Operations
async function openAiNews(ticker) {
    ticker = ticker.toUpperCase().trim();
    elAiNewsTicker.textContent = ticker;
    elAiNewsLoading.classList.remove('hidden');
    elAiNewsContent.classList.add('hidden');
    elAiNewsContent.innerHTML = '';
    elAiNewsModal.classList.remove('hidden');
    
    try {
        const response = await fetch(`/api/stock/${ticker}/ainews`);
        const data = await response.json();
        
        if (data.success) {
            elAiNewsContent.innerHTML = parseMarkdownLineByLine(data.analysis);
            elAiNewsLoading.classList.add('hidden');
            elAiNewsContent.classList.remove('hidden');
        } else {
            alert(`AI Analysis Error: ${data.error}`);
            closeAiModal();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to connect to get AI news analysis.");
        closeAiModal();
    }
}

function closeAiModal() {
    elAiNewsModal.classList.add('hidden');
    elAiNewsContent.innerHTML = '';
}

// Simple Markdown Line-by-Line Parser to HTML
function parseMarkdownLineByLine(md) {
    const lines = md.split('\n');
    let html = '';
    let inList = false;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            continue;
        }
        
        // Headers
        if (line.startsWith('### ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h3>${line.substring(4)}</h3>`;
        } else if (line.startsWith('## ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h2>${line.substring(3)}</h2>`;
        } else if (line.startsWith('# ')) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<h1>${line.substring(2)}</h1>`;
        }
        // List items
        else if (line.startsWith('- ') || line.startsWith('* ')) {
            if (!inList) {
                html += '<ul>';
                inList = true;
            }
            html += `<li>${line.substring(2)}</li>`;
        }
        // Regular paragraphs
        else {
            if (inList) { html += '</ul>'; inList = false; }
            // Apply bold formatting (**text**)
            let formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            html += `<p>${formattedLine}</p>`;
        }
    }
    
    if (inList) {
        html += '</ul>';
    }
    
    return html;
}

// Watchlist sorting helper methods
function handleWatchlistSort(key) {
    if (watchlistSortKey === key) {
        watchlistSortOrder = watchlistSortOrder === 'asc' ? 'desc' : 'asc';
    } else {
        watchlistSortKey = key;
        watchlistSortOrder = 'desc';
    }
    renderWatchlistTable();
}

function updateWatchlistSortIcons() {
    if (!elHeaderWatchlistPrice || !elHeaderWatchlistVolume || !elHeaderWatchlistChange) return;
    const priceIcon = elHeaderWatchlistPrice.querySelector('i');
    const volumeIcon = elHeaderWatchlistVolume.querySelector('i');
    const changeIcon = elHeaderWatchlistChange.querySelector('i');
    if (!priceIcon || !volumeIcon || !changeIcon) return;
    
    priceIcon.className = 'fa-solid fa-sort text-xs opacity-50 ml-1';
    volumeIcon.className = 'fa-solid fa-sort text-xs opacity-50 ml-1';
    changeIcon.className = 'fa-solid fa-sort text-xs opacity-50 ml-1';
    
    if (watchlistSortKey === 'price') {
        priceIcon.className = `fa-solid fa-sort-${watchlistSortOrder === 'asc' ? 'up' : 'down'} text-xs text-primary ml-1`;
    } else if (watchlistSortKey === 'volume') {
        volumeIcon.className = `fa-solid fa-sort-${watchlistSortOrder === 'asc' ? 'up' : 'down'} text-xs text-primary ml-1`;
    } else if (watchlistSortKey === 'change') {
        changeIcon.className = `fa-solid fa-sort-${watchlistSortOrder === 'asc' ? 'up' : 'down'} text-xs text-primary ml-1`;
    }
}

// Check market hours status from backend
async function checkMarketStatus() {
    try {
        const response = await fetch('/api/market-status');
        const data = await response.json();
        if (data.success) {
            isMarketOpen = data.is_open;
            
            if (isMarketOpen) {
                elMarketStatusBar.className = 'market-status-bar open';
                elMarketStatusText.textContent = `Market Open (${data.current_time_est} EST)`;
                elBtnManualRefresh.disabled = false;
                elBtnManualRefresh.title = 'Refresh Screener';
            } else {
                elMarketStatusBar.className = 'market-status-bar closed';
                elMarketStatusText.textContent = `Market Closed (${data.current_time_est} EST)`;
                elBtnManualRefresh.disabled = true;
                elBtnManualRefresh.title = 'Market is closed. Refresh is disabled.';
            }
        }
    } catch (err) {
        console.error("Error checking market status:", err);
    }
}

// Check market health indicators (QQQ 50-day SMA) from backend
async function checkMarketHealth() {
    try {
        const response = await fetch('/api/market-health');
        const data = await response.json();
        if (data.success) {
            if (data.is_healthy) {
                elMarketHealthBar.className = 'market-health-bar healthy';
                elMarketHealthText.textContent = `Market: Healthy (${data.index} > 50 SMA)`;
                elMarketHealthBar.title = `${data.index} is trading at $${data.current_price}, which is ${data.percent_above}% above its 50-day SMA ($${data.sma_50}). Condition is optimal for breakouts.`;
            } else {
                elMarketHealthBar.className = 'market-health-bar unhealthy';
                elMarketHealthText.textContent = `Market: Unhealthy (${data.index} < 50 SMA)`;
                elMarketHealthBar.title = `${data.index} is trading at $${data.current_price}, which is ${data.percent_above}% below its 50-day SMA ($${data.sma_50}). Breakout strategies carry high failure risk in this environment.`;
            }
        }
    } catch (err) {
        console.error("Error checking market health:", err);
    }
}

// Load Sector Rotation and Industry Leaderboard
async function loadSectorRotationData() {
    try {
        const response = await fetch('/api/sector-rotation');
        const data = await response.json();
        if (data.success) {
            renderSectorRotation(data.industries);
        } else {
            showSectorRotationError(data.error || "Failed to calculate rotation.");
        }
    } catch (err) {
        console.error("Error loading sector rotation data:", err);
        showSectorRotationError("Failed to fetch industry leaderboard.");
    }
}

// Render Sector Rotation Panel
function renderSectorRotation(industries) {
    if (!elSectorRotationList) return;
    
    if (!industries || industries.length === 0) {
        elSectorRotationList.innerHTML = `
            <div class="text-center py-4 text-muted">
                <i class="fa-solid fa-triangle-exclamation font-lg mb-2"></i>
                <p>No active momentum clusters detected.</p>
                <p class="text-xs text-muted mt-1">Try refreshing or check back during active market trading hours.</p>
            </div>
        `;
        return;
    }
    
    elSectorRotationList.innerHTML = '';
    
    industries.forEach(ind => {
        const card = document.createElement('div');
        card.className = 'industry-card';
        
        // Define Heat level color string
        let heatColor = '#f59e0b'; // orange default
        if (ind.score >= 10.0) {
            heatColor = '#10b981'; // emerald green for very hot
        } else if (ind.score < 4.0) {
            heatColor = '#6366f1'; // indigo for cooler
        }
        
        // Header
        const header = `
            <div class="industry-header">
                <div class="industry-title">
                    <span class="industry-name">${ind.industry}</span>
                    <span class="sector-name">${ind.sector}</span>
                </div>
                <div>
                    <span class="badge" style="color: ${heatColor}; border-color: ${heatColor}33; background: ${heatColor}11;">
                        Score: ${ind.score}
                    </span>
                </div>
            </div>
        `;
        
        // Leaders
        let leadersHTML = '<div class="leader-stocks">';
        ind.leaders.forEach(l => {
            const changeVal = parseFloat(l.change);
            const changeClass = changeVal >= 0 ? 'text-positive' : 'text-negative';
            const changeSign = changeVal >= 0 ? '+' : '';
            
            leadersHTML += `
                <div class="leader-row" onclick="openStockDetails('${l.ticker}')">
                    <div class="leader-ticker-group">
                        <span class="leader-ticker">${l.ticker}</span>
                        <span class="leader-company" title="${l.company}">${l.company}</span>
                    </div>
                    <div class="leader-price-group">
                        <span class="leader-price">$${l.price}</span>
                        <span class="leader-change ${changeClass}">${changeSign}${l.change}</span>
                    </div>
                </div>
            `;
        });
        leadersHTML += '</div>';
        
        card.innerHTML = header + leadersHTML;
        elSectorRotationList.appendChild(card);
    });
}

function showSectorRotationError(message) {
    if (!elSectorRotationList) return;
    elSectorRotationList.innerHTML = `
        <div class="text-center py-4 text-loser">
            <i class="fa-solid fa-triangle-exclamation font-lg mb-2"></i>
            <p>Error calculating sectors</p>
            <p class="text-xs text-muted mt-1">${message}</p>
        </div>
    `;
}

// Setup Native Drag and Drop Reordering
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.dashboard-panel');
    const containers = document.querySelectorAll('.dashboard-col');

    draggables.forEach(draggable => {
        const handle = draggable.querySelector('.drag-handle');
        if (handle) {
            // Enable dragging only when grabbing the handle
            handle.addEventListener('mousedown', () => {
                draggable.setAttribute('draggable', 'true');
            });
            handle.addEventListener('mouseup', () => {
                draggable.setAttribute('draggable', 'false');
            });
            handle.addEventListener('dragstart', () => {
                draggable.setAttribute('draggable', 'true');
            });
            draggable.addEventListener('dragend', () => {
                draggable.setAttribute('draggable', 'false');
                draggable.classList.remove('dragging');
                saveDashboardLayout();
            });
        }

        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });
    });

    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    container.appendChild(draggable);
                } else {
                    container.insertBefore(draggable, afterElement);
                }
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.dashboard-panel:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Save Dashboard layout order to LocalStorage
function saveDashboardLayout() {
    const colLeft = document.getElementById('col-left');
    const colRight = document.getElementById('col-right');
    if (!colLeft || !colRight) return;

    const layout = {
        colLeft: [...colLeft.querySelectorAll('.dashboard-panel')].map(el => el.id),
        colRight: [...colRight.querySelectorAll('.dashboard-panel')].map(el => el.id)
    };
    localStorage.setItem('gainerflow_dashboard_layout', JSON.stringify(layout));
}

// Load and Restore Dashboard layout order from LocalStorage
function loadDashboardLayout() {
    const colLeft = document.getElementById('col-left');
    const colRight = document.getElementById('col-right');
    if (!colLeft || !colRight) return;

    const panels = {
        'panel-screener': document.getElementById('panel-screener'),
        'panel-watchlist': document.getElementById('panel-watchlist'),
        'panel-sectors': document.getElementById('panel-sectors')
    };

    const saved = localStorage.getItem('gainerflow_dashboard_layout');
    if (saved) {
        try {
            const layout = JSON.parse(saved);
            const placed = new Set();

            if (layout.colLeft) {
                layout.colLeft.forEach(id => {
                    if (panels[id]) {
                        colLeft.appendChild(panels[id]);
                        placed.add(id);
                    }
                });
            }

            if (layout.colRight) {
                layout.colRight.forEach(id => {
                    if (panels[id]) {
                        colRight.appendChild(panels[id]);
                        placed.add(id);
                    }
                });
            }

            // Append any unplaced panels to their default slots in case of schema drift
            Object.keys(panels).forEach(id => {
                if (!placed.has(id) && panels[id]) {
                    if (id === 'panel-screener') {
                        colLeft.appendChild(panels[id]);
                    } else {
colRight.appendChild(panels[id]);
                    }
                }
            });
        } catch (e) {
            console.error("Failed to load dashboard layout:", e);
        }
    }
}

// Render Live Alerts Screener Table
function renderLiveAlertsTable() {
    const tableScreener = document.getElementById('table-screener');
    if (!tableScreener) return;
    const thead = tableScreener.querySelector('thead');
    
    thead.innerHTML = `
        <tr>
            <th>Ticker</th>
            <th>Price</th>
            <th>Change</th>
            <th>Supertrend (5m)</th>
            <th>Cloud State</th>
            <th>Recent Alert</th>
            <th class="text-center">Action</th>
        </tr>
    `;

    elScreenerList.innerHTML = '';
    
    const alertsList = Object.values(watchlistSignals);
    if (alertsList.length === 0) {
        elScreenerList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-muted">
                    <i class="fa-regular fa-bell font-lg mb-2"></i>
                    <p>No active alerts scanned yet.</p>
                    <p class="text-xs text-muted mt-1">Add tickers to your watchlist to enable live trading alerts.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const sortedAlerts = [...alertsList].sort((a, b) => {
        const aHasSig = a.recent_signal && a.recent_signal !== 'neutral' && a.recent_signal_age <= 3;
        const bHasSig = b.recent_signal && b.recent_signal !== 'neutral' && b.recent_signal_age <= 3;
        if (aHasSig && !bHasSig) return -1;
        if (!aHasSig && bHasSig) return 1;
        if (aHasSig && bHasSig) {
            return a.recent_signal_age - b.recent_signal_age;
        }
        return a.ticker.localeCompare(b.ticker);
    });

    sortedAlerts.forEach(alert => {
        const tr = document.createElement('tr');
        
        const isRecentBuy = alert.recent_signal && alert.recent_signal.startsWith('buy') && alert.recent_signal_age <= 3;
        const isRecentSell = alert.recent_signal && alert.recent_signal.startsWith('sell') && alert.recent_signal_age <= 3;
        
        if (isRecentBuy) {
            tr.classList.add('tr-trending-up');
        } else if (isRecentSell) {
            tr.style.borderLeft = '3.5px solid var(--color-loser)';
        }
        
        const stDir = alert.supertrend_direction;
        const stBadge = stDir === 1
            ? `<span class="signal-pill buy"><i class="fa-solid fa-circle-chevron-up"></i> Bullish</span>`
            : `<span class="signal-pill sell"><i class="fa-solid fa-circle-chevron-down"></i> Bearish</span>`;
            
        const price = alert.price;
        const ema12 = alert.ema12;
        const ema34 = alert.ema34;
        
        let cloudText = 'Mixed';
        let cloudClass = 'neutral';
        if (price > Math.max(ema12, ema34) && ema12 > ema34) {
            cloudText = 'Bullish';
            cloudClass = 'bullish';
        } else if (price < Math.min(ema12, ema34) && ema12 < ema34) {
            cloudText = 'Bearish';
            cloudClass = 'bearish';
        }
        const cloudBadge = `<span class="status-badge ${cloudClass}">${cloudText}</span>`;
        
        let signalText = 'None';
        let signalClass = 'text-muted';
        if (alert.recent_signal && alert.recent_signal !== 'neutral') {
            const ageStr = alert.recent_signal_age === 0 ? 'Just Now' : `${alert.recent_signal_age} bars ago`;
            if (alert.recent_signal.startsWith('buy')) {
                signalText = `<i class="fa-solid fa-circle-check"></i> BUY (${ageStr})`;
                signalClass = 'text-gainer font-bold';
            } else {
                signalText = `<i class="fa-solid fa-circle-xmark"></i> SELL (${ageStr})`;
                signalClass = 'text-loser font-bold';
            }
        }
        
        const isWatchlisted = watchlist.includes(alert.ticker);
        const starClass = isWatchlisted ? 'fa-solid fa-star text-watchlist' : 'fa-regular fa-star';
        
        tr.innerHTML = `
            <td class="ticker-cell">${alert.ticker}</td>
            <td class="font-medium">$${alert.price.toFixed(2)}</td>
            <td><span class="change-cell ${alert.change_pct >= 0 ? 'positive' : 'negative'}">${alert.change_pct >= 0 ? '+' : ''}${alert.change_pct.toFixed(2)}%</span></td>
            <td>${stBadge}</td>
            <td>${cloudBadge}</td>
            <td><span class="${signalClass}">${signalText}</span></td>
            <td class="text-center" onclick="event.stopPropagation()">
                <button class="btn-icon btn-watchlist-star" data-ticker="${alert.ticker}" title="${isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                    <i class="${starClass}"></i>
                </button>
                <button class="btn-icon btn-row-ai-news" data-ticker="${alert.ticker}" title="AI News Analysis">
                    <i class="fa-solid fa-brain"></i>
                </button>
            </td>
        `;
        
        tr.addEventListener('click', () => {
            openStockDetails(alert.ticker);
        });
        
        const starBtn = tr.querySelector('.btn-watchlist-star');
        starBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tick = starBtn.getAttribute('data-ticker');
            if (watchlist.includes(tick)) {
                await removeFromWatchlistApi(tick);
            } else {
                await addToWatchlistApi(tick);
            }
            await loadWatchlistData();
            await loadWatchlistSignals();
        });
        
        const aiNewsBtn = tr.querySelector('.btn-row-ai-news');
        aiNewsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAiNews(alert.ticker);
        });
        
        elScreenerList.appendChild(tr);
    });
}

// Load Watchlist signals
async function loadWatchlistSignals() {
    try {
        const response = await fetch('/api/watchlist/signals');
        const data = await response.json();
        if (data.success) {
            watchlistSignals = data.signals;
            
            let activeAlerts = 0;
            Object.values(watchlistSignals).forEach(sig => {
                if (sig.recent_signal && sig.recent_signal.startsWith('buy') && sig.recent_signal_age <= 3) {
                    activeAlerts++;
                }
            });
            
            elLiveAlertsCount.textContent = activeAlerts;
            if (activeAlerts > 0) {
                elLiveAlertsCount.classList.remove('hidden');
                elTabLiveAlerts.querySelector('i').classList.add('animate-pulse');
            } else {
                elLiveAlertsCount.classList.add('hidden');
                elTabLiveAlerts.querySelector('i').classList.remove('animate-pulse');
            }
            
            if (activeTab === 'livealerts') {
                renderScreenerTable();
            }
            
            renderWatchlistTable();
        }
    } catch (err) {
        console.error("Error loading watchlist signals:", err);
    }
}

// Render Live Indicator Chart
async function renderLiveIndicatorChart(ticker) {
    elChartLoading.classList.remove('hidden');
    elLiveIndicatorChart.innerHTML = '';
    
    try {
        const response = await fetch(`/api/stock/${ticker}/indicators?interval=5m`);
        const data = await response.json();
        
        if (!data.success) {
            elLiveIndicatorChart.innerHTML = `<div class="text-center py-4 text-loser"><i class="fa-solid fa-triangle-exclamation font-lg mb-2"></i><p>Failed to load indicators: ${data.error}</p></div>`;
            elChartLoading.classList.add('hidden');
            return;
        }
        
        elChartLoading.classList.add('hidden');
        renderStrategyCard(data.status);
        
        const chartOptionsObj = {
            layout: {
                background: { type: 'solid', color: '#1e222d' },
                textColor: '#d1d4dc',
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.2)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.2)' },
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                secondsVisible: false,
            },
            crosshair: {
                mode: 0,
            }
        };
        
        lightweightChart = LightweightCharts.createChart(elLiveIndicatorChart, chartOptionsObj);
        
        lightweightChartCandleSeries = lightweightChart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });
        
        lightweightChartCandleSeries.setData(data.candles);
        
        lightweightChartEma12Series = lightweightChart.addLineSeries({
            color: '#3b82f6',
            lineWidth: 1.5,
            title: 'EMA 12',
        });
        lightweightChartEma12Series.setData(data.ema12);
        
        lightweightChartEma34Series = lightweightChart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1.5,
            title: 'EMA 34',
        });
        lightweightChartEma34Series.setData(data.ema34);
        
        lightweightChartEma50Series = lightweightChart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 1.5,
            title: 'EMA 50',
        });
        lightweightChartEma50Series.setData(data.ema50);
        
        const supertrendLineData = data.supertrend.map(pt => {
            return {
                time: pt.time,
                value: pt.value,
                color: pt.direction === 1 ? '#10b981' : '#ef4444'
            };
        });
        
        lightweightChartSupertrendSeries = lightweightChart.addLineSeries({
            lineWidth: 2.5,
            title: 'Supertrend',
        });
        lightweightChartSupertrendSeries.setData(supertrendLineData);
        
        const markers = [];
        data.signals.forEach(sig => {
            if (sig.type.startsWith('buy')) {
                markers.push({
                    time: sig.time,
                    position: 'belowBar',
                    color: '#06b6d4',
                    shape: 'arrowUp',
                    text: 'BUY',
                    size: 1.5
                });
            } else if (sig.type.startsWith('sell')) {
                markers.push({
                    time: sig.time,
                    position: 'aboveBar',
                    color: '#ec4899',
                    shape: 'arrowDown',
                    text: 'SELL',
                    size: 1.5
                });
            }
        });
        
        if (markers.length > 0) {
            lightweightChartCandleSeries.setMarkers(markers);
        }
        
        lightweightChart.timeScale().fitContent();
        
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !lightweightChart) return;
            const { width, height } = entries[0].contentRect;
            lightweightChart.resize(width, height);
        });
        resizeObserver.observe(elLiveIndicatorChart);
        
    } catch (err) {
        console.error("Error rendering lightweight chart:", err);
        elLiveIndicatorChart.innerHTML = `<div class="text-center py-4 text-loser"><i class="fa-solid fa-triangle-exclamation font-lg mb-2"></i><p>Connection error loading live chart.</p></div>`;
        elChartLoading.classList.add('hidden');
    }
}

function renderStrategyCard(status) {
    if (!status) return;
    
    const stDir = status.supertrend_direction;
    elStrategySupertrend.className = `value status-badge ${stDir === 1 ? 'bullish' : 'bearish'}`;
    elStrategySupertrend.innerHTML = stDir === 1 
        ? `<i class="fa-solid fa-circle-chevron-up"></i> Bullish ($${status.supertrend.toFixed(2)})`
        : `<i class="fa-solid fa-circle-chevron-down"></i> Bearish ($${status.supertrend.toFixed(2)})`;
        
    const price = status.price;
    const ema12 = status.ema12;
    const ema34 = status.ema34;
    const ema50 = status.ema50;
    
    let biasClass = 'neutral';
    let biasText = 'Neutral / Mixed';
    let biasIcon = '<i class="fa-solid fa-circle-minus"></i>';
    
    if (price > Math.max(ema12, ema34) && ema12 > ema34) {
        biasClass = 'bullish';
        biasText = 'Bullish (12 > 34)';
        biasIcon = '<i class="fa-solid fa-circle-arrow-up"></i>';
    } else if (price < Math.min(ema12, ema34) && ema12 < ema34) {
        biasClass = 'bearish';
        biasText = 'Bearish (12 < 34)';
        biasIcon = '<i class="fa-solid fa-circle-arrow-down"></i>';
    }
    
    elStrategyEmaCloud.className = `value status-badge ${biasClass}`;
    elStrategyEmaCloud.innerHTML = `${biasIcon} ${biasText}`;
    
    const signal = status.signal;
    let signalClass = 'neutral';
    let signalText = 'No Active Signal';
    let signalIcon = '<i class="fa-solid fa-circle-notch"></i>';
    
    if (signal === 'buy_supertrend_flip') {
        signalClass = 'bullish';
        signalText = 'BUY - Supertrend Flip';
        signalIcon = '<i class="fa-solid fa-circle-check"></i>';
    } else if (signal === 'buy_cloud_breakout') {
        signalClass = 'bullish';
        signalText = 'BUY - Cloud Breakout';
        signalIcon = '<i class="fa-solid fa-circle-check"></i>';
    } else if (signal === 'sell_supertrend_flip') {
        signalClass = 'bearish';
        signalText = 'SELL - Supertrend Flip';
        signalIcon = '<i class="fa-solid fa-circle-xmark"></i>';
    } else if (signal === 'sell_cloud_breakdown') {
        signalClass = 'bearish';
        signalText = 'SELL - Cloud Breakdown';
        signalIcon = '<i class="fa-solid fa-circle-xmark"></i>';
    }
    
    elStrategySignal.className = `value status-badge ${signalClass}`;
    elStrategySignal.innerHTML = `${signalIcon} ${signalText}`;
    
    elModalStrategyCard.className = 'sidebar-card strategy-status-card';
    if (signalClass === 'bullish') {
        elModalStrategyCard.classList.add('strategy-card-glow-buy');
    } else if (signalClass === 'bearish') {
        elModalStrategyCard.classList.add('strategy-card-glow-sell');
    }
    
    let recText = '';
    if (signalClass === 'bullish') {
        recText = `<strong>BUY ALERT:</strong> A bullish entry signal has triggered on the 5-minute timeframe. `;
        if (signal === 'buy_supertrend_flip') {
            recText += `The Supertrend has flipped bullish, confirming upward momentum. Stop Loss is set at the Supertrend line ($${status.supertrend.toFixed(2)}) or just below the 34-50 EMA Cloud.`;
        } else {
            recText += `Price has broken out above the 12-34 EMA Cloud while Supertrend remains bullish. This indicates strong continuation. Target a 4:1 reward-to-risk ratio.`;
        }
    } else if (signalClass === 'bearish') {
        recText = `<strong>SELL / SHORT ALERT:</strong> A bearish exit signal has triggered. `;
        if (signal === 'sell_supertrend_flip') {
            recText += `Supertrend has flipped bearish. If long, exit immediately. Consider short positions with a stop above the Supertrend line ($${status.supertrend.toFixed(2)}).`;
        } else {
            recText += `Price has broken down below the 12-34 EMA Cloud. Sell pressure is intensifying. Avoid long positions.`;
        }
    } else {
        if (stDir === 1 && biasClass === 'bullish') {
            recText = `<strong>BULLISH CONTINUATION:</strong> The overall trend is strongly bullish (Supertrend + Cloud aligned). Look for pullback entries into the 12-34 EMA Cloud ($${ema34.toFixed(2)} - $${ema12.toFixed(2)}) for high probability dip-buys.`;
        } else if (stDir === -1 && biasClass === 'bearish') {
            recText = `<strong>BEARISH CONTINUATION:</strong> The overall trend is bearish. Avoid long entries. Resistance is at the 12-34 EMA Cloud ($${ema12.toFixed(2)} - $${ema34.toFixed(2)}).`;
        } else {
            recText = `<strong>TREND TRANSITION:</strong> Supertrend and EMA Clouds are conflicted. Wait for clear alignment (both green or both red) before entering trades.`;
        }
    }
    elStrategyRecommendation.innerHTML = recText;
}
