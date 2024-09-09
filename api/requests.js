const proxyURL = 'https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?';
const baseURL = 'https://fantasy.premierleague.com/api/';

const reqType = {
    overview: 'bootstrap-static/', //Overview
    gameweeks: 'events/', // Get all gameweeks
    gameweek: 'event/',  //A selected gameweek
    fixtures: 'fixtures/', //Get all fixtures
    player: 'element-summary/', //Players (playderID)
    manager: 'entry/', //Get manager data (Id)
    transfers: 'entry/', //entry/id/transfers
    picks: 'entry/', //entry/id/event/GW-ID/picks
    history: 'entry/', //entry/id/history
    league: 'leagues-classic/' //Get league standing at current gameweek.
}

const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    const response = await fetch(proxyURL + endpointUrl);
    const myJson = await response.json();
    return myJson
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
    const data = await doCORSRequest(`${reqType.gameweek}/${id}/`);
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
