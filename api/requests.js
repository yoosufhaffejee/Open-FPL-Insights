window.globalFplLoadedBytes = 0;
window.globalFplTotalBytes = 1753300;

const baseURL = 'https://fantasy.premierleague.com/api/';

const reqType = {
    overview: 'bootstrap-static/',
    gameweeks: 'events/',
    gameweek: 'event',
    fixtures: 'fixtures/',
    player: 'element-summary/',
    manager: 'entry/',
    transfers: 'entry/',
    picks: 'entry/',
    history: 'entry/',
    league: 'leagues-classic/'
}

const proxies = [
    'https://fpl-proxy.pages.dev/?',
    'https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?',
    'https://corsproxy.io/?'
];

let currentProxyIndex = 0;

const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes

const doCORSRequest = async (url, bypassCache = false) => {
    let endpointUrl = baseURL + url;
    
    // Check cache first
    if (!bypassCache) {
        try {
            const cachedStr = sessionStorage.getItem(`fpl_cache_${url}`);
            if (cachedStr) {
                const cachedData = JSON.parse(cachedStr);
                // Validate integrity of cached data
                let isValid = true;
                if (url === 'bootstrap-static/' && (!cachedData.data || !cachedData.data.elements)) isValid = false;
                
                // Check expiry and validity
                if (isValid && Date.now() - cachedData.timestamp < CACHE_EXPIRY) {
                    // Instantly update progress bar if it's a main request so the UI doesn't hang waiting for it
                    if (['bootstrap-static/', 'fixtures/', 'events/'].includes(url) && window.globalFplLoadedBytes !== undefined) {
                        let estimatedTotal = url === 'bootstrap-static/' ? 1594800 : (url === 'fixtures/' ? 131500 : 27000);
                        window.globalFplLoadedBytes += estimatedTotal;
                        let percent = Math.min(Math.round((window.globalFplLoadedBytes / window.globalFplTotalBytes) * 100), 100);
                        const progressEl = document.getElementById('global-progress-bar');
                        if (progressEl) progressEl.style.width = percent + '%';
                    }
                    return cachedData.data;
                } else {
                    sessionStorage.removeItem(`fpl_cache_${url}`);
                }
            }
        } catch (e) {
            console.warn('Cache read error:', e);
        }
    }

    let lastError = null;

    for (let i = currentProxyIndex; i < proxies.length; i++) {
        try {
            const response = await fetch(proxies[i] + endpointUrl);
            if (!response.ok) {
                if (response.status === 503) {
                    const clone = response.clone();
                    const text = await clone.text();
                    if (text.includes('The game is being updated')) {
                        throw new Error('FPL_GAME_UPDATING');
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentLength = response.headers.get('content-length');
            const actualTotal = parseInt(contentLength, 10);
            
            // Adjust estimated total if actual is known for the 3 main requests
            if (['bootstrap-static/', 'fixtures/', 'events/'].includes(url)) {
                let estimatedTotal = url === 'bootstrap-static/' ? 1594800 : (url === 'fixtures/' ? 131500 : 27000);
                if (!isNaN(actualTotal) && actualTotal > 0) {
                    if (window.globalFplTotalBytes) {
                        window.globalFplTotalBytes += (actualTotal - estimatedTotal);
                    }
                }
            }

            // If it's one of the main init requests, we stream it to track progress across all 3
            if (['bootstrap-static/', 'fixtures/', 'events/'].includes(url)) {
                let loaded = 0;
                const reader = response.body.getReader();
                const chunks = [];

                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    loaded += value.length;
                    
                    if (window.globalFplLoadedBytes !== undefined) {
                        window.globalFplLoadedBytes += value.length;
                        let percent = Math.min(Math.round((window.globalFplLoadedBytes / window.globalFplTotalBytes) * 100), 100);
                        
                        const progressEl = document.getElementById('global-progress-bar');
                        const progressTextEl = document.getElementById('global-progress-text');
                        const progressTaskEl = document.getElementById('global-progress-task');
                        
                        if (progressEl) progressEl.style.width = percent + '%';
                        if (progressTextEl) progressTextEl.textContent = percent + '%';
                        if (progressTaskEl) {
                            let taskName = url === 'bootstrap-static/' ? 'Players & Teams' : (url === 'fixtures/' ? 'Fixtures' : 'Gameweeks');
                            progressTaskEl.textContent = `Loading ${taskName}...`;
                        }
                    }
                }
                
                let position = 0;
                let chunksAll = new Uint8Array(loaded || 1); // fallback to 1 to avoid empty array error
                if (loaded > 0) {
                    for(let chunk of chunks) {
                        chunksAll.set(chunk, position);
                        position += chunk.length;
                    }
                }
                const result = new TextDecoder("utf-8").decode(chunksAll);
                const myJson = JSON.parse(result);
                currentProxyIndex = i;
                
                try {
                    sessionStorage.setItem(`fpl_cache_${url}`, JSON.stringify({ timestamp: Date.now(), data: myJson }));
                } catch (e) {
                    console.warn('Cache write error:', e);
                }
                
                return myJson;
            }

            // For other small requests, just use standard json()
            const myJson = await response.json();
            currentProxyIndex = i; // Save successful proxy index
            
            try {
                sessionStorage.setItem(`fpl_cache_${url}`, JSON.stringify({ timestamp: Date.now(), data: myJson }));
            } catch (e) {
                console.warn('Cache write error:', e);
            }
            
            return myJson;
        } catch (e) {
            lastError = e;
            if (e.message === 'FPL_GAME_UPDATING') {
                window.fplGameUpdating = true;
                throw e;
            }
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }
    
    for (let i = 0; i < currentProxyIndex; i++) {
        try {
            const response = await fetch(proxies[i] + endpointUrl);
            if (!response.ok) {
                if (response.status === 503) {
                    const clone = response.clone();
                    const text = await clone.text();
                    if (text.includes('The game is being updated')) {
                        throw new Error('FPL_GAME_UPDATING');
                    }
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            if (e.message === 'FPL_GAME_UPDATING') {
                window.fplGameUpdating = true;
                throw e;
            }
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }

    throw new Error('All proxies failed. Network might be blocking requests.');
}

const getOverview = async (bypassCache = false) => {
    const data = await doCORSRequest(reqType.overview, bypassCache);
    return data;
}

const getGameweeks = async () => {
    const data = await doCORSRequest(reqType.gameweeks);
    return data;
}

const getGameweek = async (id) => {
    const data = await doCORSRequest(`${reqType.gameweek}/${id}/live/`);
    return data;
}

const getFixtures = async (bypassCache = false) => {
    const data = await doCORSRequest(reqType.fixtures, bypassCache);
    return data;
}

const getPlayer = async (id) => {
    const data = await doCORSRequest(`${reqType.player}${id}/`);
    return data;
}

const getManager = async (id) => {
    const data = await doCORSRequest(`${reqType.manager}/${id}/`);
    return data;
}

const getManagerTransfers = async (id) => {
    const data = await doCORSRequest(`${reqType.manager}/${id}/transfers/`);
    return data;
}

const getManagerPicks = async (id, gameweek) => {
    const data = await doCORSRequest(`${reqType.manager}/${id}/event/${gameweek}/picks/`);
    return data;
}

const getManagerHistory = async (id) => {
    const data = await doCORSRequest(`${reqType.manager}/${id}/history/`);
    return data;
}

const getLeague = async (id, pageId = 1) => {
    const baseUrl = `${reqType.league}${id}/standings/`;
    const url = pageId ? `${baseUrl}?page_new_entries=1&page_standings=${pageId}&phase=1` : baseUrl;
    const data = await doCORSRequest(url);
    return data;
};

const doRawCORSRequest = async (fullUrl) => {
    let lastError = null;
    for (let i = currentProxyIndex; i < proxies.length; i++) {
        try {
            const response = await fetch(proxies[i] + fullUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed for raw url. Try next...`);
        }
    }
    for (let i = 0; i < currentProxyIndex; i++) {
        try {
            const response = await fetch(proxies[i] + fullUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed for raw url. Try next...`);
        }
    }
    // Explicitly return null if all proxies fail
    return null;
}

const getPulseLiveFixtures = async () => {
    const cacheKey = 'pulseLiveFixturesCache';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < 5 * 60 * 1000) {
            return data;
        }
    }

    try {
        const latestData = await doRawCORSRequest('https://footballapi.pulselive.com/football/fixtures?comps=1&pageSize=1&page=0&sort=desc');
        const currentSeasonId = latestData.content[0].gameweek.compSeason.id;
        const allData = await doRawCORSRequest(`https://footballapi.pulselive.com/football/fixtures?comps=1&compSeasons=${currentSeasonId}&pageSize=400&page=0`);
        
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: allData.content }));
        return allData.content;
    } catch (e) {
        console.error("Error fetching Pulse Live fixtures", e);
        return [];
    }
}

const getPulseLiveLineup = async (matchId) => {
    try {
        // Use the same footballapi domain as our fixture list – it uses the same IDs
        // and the /football/fixtures/{id} endpoint already contains teamLists with full lineups.
        const data = await doRawCORSRequest(`https://footballapi.pulselive.com/football/fixtures/${matchId}`);

        // Normalise into the shape loadLineups expects
        const teamLists = data.teamLists || [];
        if (!teamLists.length) return null;

        const homeList = teamLists[0] || {};
        const awayList = teamLists[1] || {};

        return {
            home_team: {
                players: homeList.lineup || [],
                substitutes: homeList.substitutes || [],
                formation: homeList.formation ? homeList.formation.label : null
            },
            away_team: {
                players: awayList.lineup || [],
                substitutes: awayList.substitutes || [],
                formation: awayList.formation ? awayList.formation.label : null
            }
        };
    } catch (e) {
        console.error("Error fetching Pulse Live lineups for match", matchId, e);
        return null;
    }
}

const getPulseLiveEvents = async (matchId, page = 0, pageSize = 20) => {
    try {
        const data = await doRawCORSRequest(`https://footballapi.pulselive.com/football/fixtures/${matchId}/textstream/EN?pageSize=${pageSize}&page=${page}&sort=desc`);
        return data.events ? data.events : { content: [], pageInfo: { numPages: 0 } };
    } catch (e) {
        console.error("Error fetching Pulse Live events for match", matchId, e);
        return { content: [], pageInfo: { numPages: 0 } };
    }
}

const getPulseLiveMatchStats = async (matchId) => {
    try {
        const data = await doRawCORSRequest(`https://footballapi.pulselive.com/football/stats/match/${matchId}`);
        return data;
    } catch (e) {
        console.error("Error fetching Pulse Live match stats", matchId, e);
        return null;
    }
}

const getPulseLiveStandings = async (bypassCache = false) => {
    const cacheKey = 'pulseLiveStandingsCache';
    if (!bypassCache) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { timestamp, data } = JSON.parse(cached);
            if (Date.now() - timestamp < 60 * 1000) {
                return data;
            }
        }
    }

    try {
        const latestData = await doRawCORSRequest('https://footballapi.pulselive.com/football/fixtures?comps=1&pageSize=1&page=0&sort=desc');
        const currentSeasonId = latestData.content[0].gameweek.compSeason.id;
        const data = await doRawCORSRequest(`https://footballapi.pulselive.com/football/standings?compSeasons=${currentSeasonId}`);
        
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: data }));
        return data;
    } catch (e) {
        console.error("Error fetching Pulse Live standings", e);
        return null;
    }
}

const getEntryEventPicks = async (entryId, eventId) => {
    try {
        const response = await fetch(`https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (e) {
        return getEntryEventPicksFallback(entryId, eventId);
    }
}

const getEntryEventPicksFallback = async (entryId, eventId) => {
    for (let i = currentProxyIndex; i < proxies.length; i++) {
        try {
            const response = await fetch(`${proxies[i]}https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }
    for (let i = 0; i < currentProxyIndex; i++) {
        try {
            const response = await fetch(`${proxies[i]}https://fantasy.premierleague.com/api/entry/${entryId}/event/${eventId}/picks/`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }
    throw new Error('All proxies failed.');
}
