/**
 * Fundamental Page Logic
 */

const tg = window.Telegram?.WebApp;
const API_URL = '/api/web';

// DOM Elements
const symbolSearch = document.getElementById('symbol-search');
const displaySymbol = document.getElementById('display-symbol');
const displayName = document.getElementById('display-name');
const displayPrice = document.getElementById('display-price');
const displayCurrency = document.getElementById('display-currency');

// Tab Logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        // Update Buttons
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update Content
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) content.classList.add('active');
        });

        if (tg) tg.HapticFeedback.impactOccurred('light');

        if (tabId === 'radar') {
            loadRadarData();
        }
    });

    // Toggle Kinerja (Quarterly vs Annual)
    const btnQ = document.getElementById('btn-show-quarterly');
    const btnY = document.getElementById('btn-show-yearly');
    if (btnQ && btnY) {
        btnQ.onclick = () => {
            btnQ.classList.add('active');
            btnY.classList.remove('active');
            renderPerformanceTable(window.fundamentalData, 'quarterly');
        };
        btnY.onclick = () => {
            btnY.classList.add('active');
            btnQ.classList.remove('active');
            renderPerformanceTable(window.fundamentalData, 'yearly');
        };
    }
});

// Utilities
const fmtNum = (num) => num != null ? num.toLocaleString('id-ID') : '-';
const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';
const fmtCap = (val) => {
    if (val == null) return '-';
    if (val >= 1e12) return (val / 1e12).toFixed(2) + ' T';
    if (val >= 1e9) return (val / 1e9).toFixed(2) + ' M';
    return val.toLocaleString();
};
const fmtDate = (val) => {
    if (!val) return '-';
    let d = new Date(val);
    if (typeof val === 'number' && d.getFullYear() < 2000) {
        d = new Date(val * 1000);
    }
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

function handleCooldown(data) {
    if (data && data.error === 'COOLDOWN') {
        const cdOverlay = document.getElementById('cooldown-overlay');
        if (cdOverlay) cdOverlay.classList.remove('hidden');
        return true;
    }
    return false;
}

/**
 * Fetch Fundamental Data
 */
async function loadFundamentalData(symbol) {
    if (!symbol) return;

    // Set Loading State
    displayName.innerText = "Mengambil data...";
    displaySymbol.innerText = symbol.toUpperCase();

    try {
        const token = localStorage.getItem('aston_session_token');
        if (!token) {
            alert("Sesi berakhir, silakan buka ulang aplikasi.");
            return;
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'fundamental', symbol })
        });

        const result = await response.json();
        if (handleCooldown(result)) return;
        if (result.success && result.data) {
            renderData(result.data);

            // Sync theme if provided
            if (result.active_theme && window.themeEngine) {
                window.themeEngine.applyTheme(result.active_theme);
            }
        } else {
            displayName.innerText = "Data tidak ditemukan.";
            if (tg) tg.HapticFeedback.notificationOccurred('error');
        }
    } catch (error) {
        console.error("Load Error:", error);
        displayName.innerText = "Gagal memuat data.";
    }
}

/**
 * Format & Render Data to UI
 */
function renderData(data) {
    // Header

    // Header
    const sym = data.symbol || '';
    displaySymbol.innerText = sym.split('.')[0];
    displayName.innerText = data.name || 'Unknown Ticker';
    displayPrice.innerText = fmtNum(data.price);
    displayCurrency.innerText = data.currency || 'IDR';

    // Profile Tab
    document.getElementById('info-sector').innerText = data.profile.sector || '-';
    document.getElementById('info-industry').innerText = data.profile.industry || '-';
    document.getElementById('info-employees').innerText = data.profile.employees ? data.profile.employees.toLocaleString() : '-';
    document.getElementById('info-website').innerText = data.profile.website || '-';

    // Format Summary: Split into paragraphs for better readability
    const summary = data.profile.summary || 'N/A';
    const formattedSummary = summary.split('. ').map(s => s.trim()).reduce((acc, sent, idx) => {
        const lastPara = acc[acc.length - 1];
        if (!lastPara || lastPara.length > 300) {
            acc.push(sent + '.');
        } else {
            acc[acc.length - 1] += ' ' + sent + '.';
        }
        return acc;
    }, []).join('\n\n');

    document.getElementById('info-summary').innerText = formattedSummary;

    // Valuation Tab
    document.getElementById('val-mkt-cap').innerText = fmtCap(data.valuation.marketCap);
    document.getElementById('val-pe').innerText = data.valuation.peRatio ? data.valuation.peRatio.toFixed(2) + 'x' : '-';
    document.getElementById('val-fpe').innerText = data.valuation.forwardPE ? data.valuation.forwardPE.toFixed(2) + 'x' : '-';
    document.getElementById('val-peg').innerText = data.valuation.pegRatio ? data.valuation.pegRatio.toFixed(2) : '-';
    document.getElementById('val-pbv').innerText = data.valuation.pbRatio ? data.valuation.pbRatio.toFixed(2) + 'x' : '-';
    document.getElementById('val-ps').innerText = data.valuation.priceToSales ? data.valuation.priceToSales.toFixed(2) + 'x' : '-';
    document.getElementById('val-ev-ebitda').innerText = data.valuation.evToEbitda ? data.valuation.evToEbitda.toFixed(2) + 'x' : '-';
    document.getElementById('val-ev').innerText = fmtCap(data.valuation.enterpriceValue);

    // Growth & Profitability
    document.getElementById('gro-rev').innerHTML = colorizeGrowth(data.growth.revenueGrowth);
    document.getElementById('gro-ear').innerHTML = colorizeGrowth(data.growth.earningsGrowth);

    document.getElementById('pro-roe').innerText = fmtPct(data.profitability.roe);
    document.getElementById('pro-roa').innerText = fmtPct(data.profitability.roa);
    document.getElementById('pro-gross').innerText = fmtPct(data.profitability.grossMargin);
    document.getElementById('pro-op').innerText = fmtPct(data.profitability.operatingMargin);
    document.getElementById('pro-net').innerText = fmtPct(data.profitability.profitMargin);

    // CashFlow
    document.getElementById('cf-op').innerText = fmtCap(data.cashflow.operatingCashflow);
    document.getElementById('cf-free').innerText = fmtCap(data.cashflow.freeCashflow);
    document.getElementById('cf-cash').innerText = fmtCap(data.cashflow.totalCash);
    document.getElementById('cf-debt').innerText = fmtCap(data.cashflow.totalDebt);
    document.getElementById('cf-quick').innerText = data.cashflow.quickRatio ? data.cashflow.quickRatio.toFixed(2) : '-';
    document.getElementById('cf-current').innerText = data.cashflow.currentRatio ? data.cashflow.currentRatio.toFixed(2) : '-';

    // Ownership
    document.getElementById('own-insider').innerText = fmtPct(data.holders.insiderHoldersPercent);
    document.getElementById('own-inst').innerText = fmtPct(data.holders.institutionsHoldersPercent);
    document.getElementById('own-count').innerText = fmtNum(data.holders.institutionsCount);

    // Performance Rendering (Default: Quarterly)
    renderPerformanceTable(data, 'quarterly');

    // Peers Rendering
    renderPeers(data);

    // Advanced Data
    renderInsights(data);
    renderInsiders(data);
    renderDividends(data);
}

/**
 * Render Performance Table (Switchable between Quarterly/Yearly)
 */
function renderPerformanceTable(data, type = 'quarterly') {
    const qBody = document.getElementById('quarterly-body');
    if (!qBody || !data) return;

    qBody.innerHTML = '';
    const items = type === 'yearly' ? data.yearly : data.quarterly;

    if (items && items.length > 0) {
        // Find max revenue for scaling bars
        const maxRev = Math.max(...items.map(q => q.revenue || 0));

        items.forEach(q => {
            const tr = document.createElement('tr');
            const revPct = maxRev > 0 ? (q.revenue / maxRev * 100) : 0;
            const dateStr = q.date || q.fiscalQuarter || '-';

            tr.innerHTML = `
                <td class="label-col">
                    <div style="color: var(--accent-primary); font-weight: 700;">${dateStr}</div>
                    <div class="bar-container" style="height: 6px; margin-top: 4px; background: rgba(255,255,255,0.05);">
                        <div class="bar-fill" style="width: ${revPct}%;"></div>
                    </div>
                </td>
                <td class="value-col">${fmtCap(q.revenue)}</td>
                <td class="value-col" style="color: ${q.earnings >= 0 ? 'var(--positive)' : 'var(--negative)'}">${fmtCap(q.earnings)}</td>
            `;
            qBody.appendChild(tr);
        });
    } else {
        qBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; opacity: 0.5;">Data ${type} tidak tersedia.</td></tr>`;
    }
}

/**
 * Render Whales (Institutional Holders)
 */
function renderWhales(data) {
    const whaleBody = document.getElementById('whales-body');
    const whaleCard = document.getElementById('whales-card');
    if (!whaleBody || !whaleCard) return;

    whaleBody.innerHTML = '';

    const owners = data.holders.institutionOwnership ? data.holders.institutionOwnership.ownershipList : [];

    if (owners && owners.length > 0) {
        whaleCard.style.display = 'block';
        owners.slice(0, 10).forEach(owner => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="label-col" style="font-size: 0.8rem; line-height: 1.3;">
                    ${owner.organization}
                    <div style="font-size: 0.7rem; color: var(--text-secondary);">${fmtDate(owner.reportDate)}</div>
                </td>
                <td class="value-col">
                    <div>${fmtPct(owner.pctHeld)}</div>
                    ${owner.pctChange ? `<div style="font-size: 0.65rem; color: ${owner.pctChange >= 0 ? 'var(--positive)' : 'var(--negative)'}">${owner.pctChange >= 0 ? '+' : ''}${(owner.pctChange * 100).toFixed(2)}%</div>` : ''}
                </td>
                <td class="value-col">${fmtCap(owner.value)}</td>
            `;
            whaleBody.appendChild(tr);
        });
    } else {
        whaleCard.style.display = 'none';
    }
}

/**
 * Render Insider Transactions
 */
function renderInsiders(data) {
    const insBody = document.getElementById('insider-body');
    const insCard = document.getElementById('insider-card');
    if (!insBody || !insCard) return;

    insBody.innerHTML = '';

    // Yahoo Finance return insiderTransactions.transactions array
    const txs = data.insiderTransactions ? data.insiderTransactions.transactions : [];

    if (txs && txs.length > 0) {
        insCard.style.display = 'block';
        txs.slice(0, 10).forEach(tx => {
            const tr = document.createElement('tr');
            const isBuy = tx.transactionText ? tx.transactionText.toLowerCase().includes('buy') : true;
            const colorClass = isBuy ? 'tag-positive' : 'tag-negative';
            const icon = isBuy ? 'fa-plus' : 'fa-minus';

            tr.innerHTML = `
                <td class="label-col" style="font-size: 0.8rem; line-height: 1.3;">
                    <div style="font-weight: 700; color: var(--text-primary);">${tx.filerName || 'Unknown'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary);">${tx.filerRelation || ''}</div>
                </td>
                <td class="value-col">
                    <span class="tag ${colorClass}">${tx.transactionText || 'Trans'}</span>
                    <div style="font-size: 0.65rem; color: var(--text-secondary); margin-top: 4px;">${fmtDate(tx.startDate)}</div>
                </td>
                <td class="value-col">
                    <div style="font-size: 0.85rem;">${fmtNum(tx.shares)}</div>
                    <div style="font-size: 0.65rem; opacity: 0.6;">Shares</div>
                </td>
            `;
            insBody.appendChild(tr);
        });
    } else {
        insCard.style.display = 'none';
    }
}

/**
 * Render INSIGHTS Tab
 */
function renderInsights(data) {
    // Health Radar Badges
    const radar = document.getElementById('health-radar');
    if (radar) {
        radar.innerHTML = '';
        const badges = [];

        // Logic for badges
        if (data.valuation.pbRatio < 1) badges.push({ text: 'Undervalued', icon: 'fa-gem', type: 'positive' });
        if (data.growth.earningsGrowth > 0.15) badges.push({ text: 'High Growth', icon: 'fa-rocket', type: 'positive' });
        if (data.profitability.roe > 0.15) badges.push({ text: 'Efficient', icon: 'fa-bolt', type: 'positive' });
        if (data.cashflow.totalCash > data.cashflow.totalDebt) badges.push({ text: 'Cash Rich', icon: 'fa-piggy-bank', type: 'positive' });
        if (data.valuation.peRatio > 25) badges.push({ text: 'Expensive', icon: 'fa-tag', type: 'warning' });
        if (data.cashflow.currentRatio < 1) badges.push({ text: 'Low Liquidity', icon: 'fa-droplet-slash', type: 'danger' });

        badges.forEach(b => {
            const el = document.createElement('div');
            el.className = `badge badge-${b.type}`;
            el.innerHTML = `<i class="fa-solid ${b.icon}"></i> ${b.text}`;
            radar.appendChild(el);
        });

        if (badges.length === 0) radar.innerHTML = '<span style="opacity: 0.5; font-size: 0.8rem;">No significant health signals.</span>';
    }

    // Analyst Data - Recommendation Badge
    const recBadge = document.getElementById('ins-rec-badge');
    if (recBadge) {
        const rawRec = (data.target.rec || 'buy').toLowerCase();
        recBadge.innerText = rawRec.replace('_', ' ');
        recBadge.className = `rec-badge rec-${rawRec}`;
        recBadge.style.display = 'inline-block';
    }

    // Target Price (Rounded)
    const targetPrice = data.target.mean;
    document.getElementById('ins-target').innerText = targetPrice ?
        data.currency + ' ' + Math.floor(targetPrice).toLocaleString('id-ID') : '-';

    document.getElementById('ins-upside').innerHTML = data.target.upside != null ?
        colorizeGrowth(data.target.upside) : '-';

    // Consensus Sentiment Bar
    const consensus = data.target.consensus;
    const cBarBuy = document.getElementById('c-bar-buy');
    const cBarHold = document.getElementById('c-bar-hold');
    const cBarSell = document.getElementById('c-bar-sell');

    if (consensus && cBarBuy) {
        const total = (consensus.buy || 0) + (consensus.hold || 0) + (consensus.sell || 0);
        if (total > 0) {
            cBarBuy.style.width = ((consensus.buy || 0) / total * 100) + '%';
            cBarHold.style.width = ((consensus.hold || 0) / total * 100) + '%';
            cBarSell.style.width = ((consensus.sell || 0) / total * 100) + '%';
            cBarBuy.style.opacity = '1';
            cBarHold.style.opacity = '1';
            cBarSell.style.opacity = '1';
        } else {
            // Fallback: Split colors equally with low opacity
            cBarBuy.style.width = '33.33%';
            cBarHold.style.width = '33.33%';
            cBarSell.style.width = '33.33%';
            cBarBuy.style.opacity = '0.2';
            cBarHold.style.opacity = '0.2';
            cBarSell.style.opacity = '0.2';
        }
        document.getElementById('c-count-buy').innerText = consensus.buy || 0;
        document.getElementById('c-count-hold').innerText = consensus.hold || 0;
        document.getElementById('c-count-sell').innerText = consensus.sell || 0;
    }

    // News
    const newsCont = document.getElementById('news-container');
    if (newsCont) {
        newsCont.innerHTML = '';
        if (data.news && data.news.length > 0) {
            data.news.forEach(n => {
                const item = document.createElement('a');
                item.href = n.link;
                item.target = '_blank';
                item.className = 'news-item';
                const date = fmtDate(n.providerPublishTime);

                item.innerHTML = `
                    <div class="news-title">${n.title}</div>
                    <div class="news-meta">
                        <span><i class="fa-solid fa-building"></i> ${n.publisher}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${date}</span>
                    </div>
                `;
                newsCont.appendChild(item);
            });
        } else {
            newsCont.innerHTML = '<div style="opacity: 0.5; font-size: 0.8rem;">Tidak ada berita terbaru ditemukan.</div>';
        }
    }
}

/**
 * Render Dividends
 */
function renderDividends(data) {
    const fmtPct = (num) => num != null ? (num * 100).toFixed(2) + '%' : '-';

    if (data.dividends) {
        document.getElementById('div-yield').innerText = fmtPct(data.dividends.yield);
        document.getElementById('div-rate').innerText = data.dividends.rate ? data.currency + ' ' + data.dividends.rate : '-';
        document.getElementById('div-payout').innerText = fmtPct(data.dividends.payoutRatio);

        if (data.dividends.exDate) {
            document.getElementById('div-exdate').innerText = fmtDate(data.dividends.exDate);
        } else {
            document.getElementById('div-exdate').innerText = '-';
        }
    }
}

function colorizeGrowth(val) {
    if (val == null) return '-';
    const num = (val * 100).toFixed(2);
    const colorClass = val >= 0 ? 'tag-positive' : 'tag-negative';
    const icon = val >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
    return `<span class="tag ${colorClass}"><i class="fa-solid ${icon}"></i> ${num}%</span>`;
}

/**
 * Render Peers (Competitors)
 */
function renderPeers(data) {
    const container = document.getElementById('peers-container');
    if (!container) return;

    container.innerHTML = '';

    if (data.peers && data.peers.length > 0) {
        data.peers.forEach(symbol => {
            const div = document.createElement('div');
            div.className = 'news-item';
            div.style.cursor = 'pointer';
            div.style.padding = '15px';
            div.onclick = () => {
                const searchInput = document.getElementById('symbol-search');
                if (searchInput) {
                    searchInput.value = symbol;
                    loadFundamentalData(symbol);
                }
            };

            div.innerHTML = `
                <div class="news-content" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="news-title" style="color: var(--accent-primary); border: none; font-size: 1rem; font-weight: 700;">${symbol.split('.')[0]}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">Klik untuk analisa mendalam</div>
                    </div>
                    <i class="fa-solid fa-chevron-right" style="opacity: 0.5;"></i>
                </div>
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<div style="padding: 20px; text-align: center; opacity: 0.5;">Data kompetitor tidak ditemukan.</div>';
    }
}

let radarCache = null;
let radarCacheTime = 0;

/**
 * Load Radar (Discovery) Data
 */
async function loadRadarData() {
    const idxBody = document.getElementById('radar-idx-body');
    if (!idxBody) return;

    // Use Cache (5 min)
    if (radarCache && (Date.now() - radarCacheTime < 5 * 60 * 1000)) {
        renderRadar(radarCache);
        return;
    }

    try {
        idxBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px;">Memantau pasar...</td></tr>';

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('jwt_token')}`
            },
            body: JSON.stringify({ action: 'discovery' })
        });

        const res = await response.json();
        if (res.success && res.data) {
            radarCache = res.data;
            radarCacheTime = Date.now();
            renderRadar(res.data);
        } else {
            throw new Error(res.error || 'Failed');
        }
    } catch (e) {
        console.error("Radar Error:", e);
        idxBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--negative);">Gagal memuat Radar.</td></tr>';
    }
}

/**
 * Render Radar UI
 */
function renderRadar(data) {
    const idxBody = document.getElementById('radar-idx-body');
    const trendingList = document.getElementById('radar-trending');
    const gainersList = document.getElementById('radar-gainers');

    if (idxBody && data.idxLeaders) {
        idxBody.innerHTML = '';
        data.idxLeaders.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => {
                const search = document.getElementById('symbol-search');
                if (search) {
                    search.value = item.symbol.split('.')[0];
                    loadFundamentalData(item.symbol);
                }
            };
            tr.innerHTML = `
                <td class="label-col">
                    <div style="font-weight: 700; color: var(--accent-primary);">${item.symbol.split('.')[0]}</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;">${item.name}</div>
                </td>
                <td class="value-col">${fmtNum(item.price)}</td>
                <td class="value-col">${colorizeGrowth(item.change / 100)}</td>
            `;
            idxBody.appendChild(tr);
        });
    }

    if (trendingList && data.trending) {
        trendingList.innerHTML = '';
        data.trending.forEach(item => {
            const div = document.createElement('div');
            div.className = 'news-item';
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.onclick = () => {
                const search = document.getElementById('symbol-search');
                if (search) {
                    search.value = item.symbol;
                    loadFundamentalData(item.symbol);
                }
            };
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700; color: var(--accent-primary);">${item.symbol}</span>
                    <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem; opacity: 0.5;"></i>
                </div>
            `;
            trendingList.appendChild(div);
        });
    }

    if (gainersList && data.gainers) {
        gainersList.innerHTML = '';
        data.gainers.forEach(item => {
            const div = document.createElement('div');
            div.className = 'news-item';
            div.style.padding = '8px 12px';
            div.style.cursor = 'pointer';
            div.onclick = () => {
                const search = document.getElementById('symbol-search');
                if (search) {
                    search.value = item.symbol;
                    loadFundamentalData(item.symbol);
                }
            };
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: 700;">${item.symbol}</span>
                    <span style="color: var(--positive); font-weight: 600;">+${(item.change).toFixed(2)}%</span>
                </div>
            `;
            gainersList.appendChild(div);
        });
    }
}

// Search Handler
symbolSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const sym = symbolSearch.value.trim();
        if (sym) {
            loadFundamentalData(sym);
            symbolSearch.blur();
            if (tg) tg.HapticFeedback.impactOccurred('medium');
        }
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const symbol = urlParams.get('symbol') || 'BBCA';
    loadFundamentalData(symbol);

    // Toggle Kinerja (Quarterly vs Annual)
    const btnQ = document.getElementById('btn-show-quarterly');
    const btnY = document.getElementById('btn-show-yearly');
    if (btnQ && btnY) {
        btnQ.onclick = () => {
            btnQ.classList.add('active');
            btnY.classList.remove('active');
            renderPerformanceTable(window.fundamentalData, 'quarterly');
        };
        btnY.onclick = () => {
            btnY.classList.add('active');
            btnQ.classList.remove('active');
            renderPerformanceTable(window.fundamentalData, 'yearly');
        };
    }

    if (tg) {
        tg.expand();
        tg.ready();
    }
});
