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
