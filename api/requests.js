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
    'https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?',
    'https://corsproxy.io/?'
];

let currentProxyIndex = 0;

const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    let lastError = null;

    for (let i = currentProxyIndex; i < proxies.length; i++) {
        try {
            const response = await fetch(proxies[i] + endpointUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            // Try to track progress if headers exist and it's a large payload
            const contentLength = response.headers.get('content-length');
            if (contentLength && url === reqType.overview) {
                const total = parseInt(contentLength, 10);
                let loaded = 0;
                const reader = response.body.getReader();
                const chunks = [];
                const progressEl = document.getElementById('global-progress-text');

                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    loaded += value.length;
                    if (progressEl) {
                        progressEl.textContent = Math.round((loaded / total) * 100) + '%';
                    }
                }

                let position = 0;
                let chunksAll = new Uint8Array(loaded);
                for(let chunk of chunks) {
                    chunksAll.set(chunk, position);
                    position += chunk.length;
                }
                const result = new TextDecoder("utf-8").decode(chunksAll);
                const myJson = JSON.parse(result);
                currentProxyIndex = i;
                return myJson;
            }

            const myJson = await response.json();
            currentProxyIndex = i; // Save successful proxy index
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }
    
    for (let i = 0; i < currentProxyIndex; i++) {
        try {
            const response = await fetch(proxies[i] + endpointUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const myJson = await response.json();
            currentProxyIndex = i;
            return myJson;
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${proxies[i]} failed. Try next...`);
        }
    }

    throw new Error('All proxies failed. Network might be blocking requests.');
}

const getOverview = async () => {
    const data = await doCORSRequest(reqType.overview);
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

const getFixtures = async () => {
    const data = await doCORSRequest(reqType.fixtures);
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
