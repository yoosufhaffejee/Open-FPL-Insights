//https://resources.premierleague.com/premierleague/photos/players/110x140/p118748.png
document.addEventListener('DOMContentLoaded', () => {
    const rows = document.querySelectorAll('.row');

    rows.forEach(row => {
        const playerCount = row.children.length;

        // Dynamic column layout for each row based on the number of players
        row.style.gridTemplateColumns = `repeat(${playerCount}, 1fr)`;
    });
});


const proxyURL = 'https://gh-pages-cors.haffejeeyoosuf1.workers.dev/?';
const baseURL = 'https://fantasy.premierleague.com/api/';

const reqType = {
    bootstrap: 'bootstrap-static/', //Overview
    element: 'element-summary/', //Players (playderID)
    events: 'events/', // Get all gameweeks
    event: 'event/',  //A selected gameweek
    entry: 'entry/', //Get a team
    elementTypes: 'element-types/', // Get all player positions
    fixtures: 'fixtures/', //Get all fixtures
    gameweekFixtures: 'fixtures/?event/', //Get all fixtures for a specified gameweek (gameweek number)
    gameweekLive: 'event/gw?/live/', //Get GW live data
    managerTeam: 'entry/teamId?/',
    teams: 'teams/', //Get all teams,
    leagueClassicStanding: 'leagues-classic/' //Get league standing at current gameweek.
}

const doCORSRequest = async (url) => {
    let endpointUrl = baseURL + url;
    const response = await fetch(proxyURL + endpointUrl);
    const myJson = await response.json();
    return myJson
}

const getBootstrap = async () => {
    const data = await doCORSRequest(reqType.bootstrap);
    return data;
}

const getGameweeks = async () => {
    const data = await doCORSRequest(reqType.events);
    return data;
}

const getLeague = async (id) => {
    const data = await doCORSRequest(`${reqType.leagueClassicStanding}${id}/standings/`);
    return data;
}

const getPlayer = async (id) => {
    const data = await doCORSRequest(`${reqType.element}${id}/`);
    return data;
}

const getFixtures = async () => {
    const data = await doCORSRequest(reqType.fixtures);
    return data;
}

const getTeam = async (id) => {
    const data = await doCORSRequest(`${reqType.entry}/${id}/`);
    return data;
}

const getTeamyByGW = async (id, gameweek) => {
    const data = await doCORSRequest(`${reqType.entry}/${id}/${reqType.event}/${gameweek}/picks/`);
    return data;
}

//Fetch data and render the grid once the data is resolved
getBootstrap().then(data => {
    let players = data.elements;
    players.sort((a, b) => b.total_points - a.total_points);

    new gridjs.Grid({
        columns: [
            {
                id: 'id',
                name: "ID",
                hidden: true
            },
            {
                id: 'code',
                name: "Code",
                hidden: true
            },
            {
                id: 'photo',
                name: "Photo",
                hidden: true
            },
            {
                id: 'element_type',
                name: "Element Type",
                hidden: true
            },
            {
                id: 'web_name',
                name: "Web Name",
                width: '7%'
            },
            {
                id: 'first_name',
                name: "First Name",
                hidden: true
            },
            {
                id: 'second_name',
                name: "Second Name",
                hidden: true
            },
            {
                id: 'now_cost',
                name: "Price",
                data: (row) => (row.now_cost / 10),
                width: '5%'
            },
            {
                id: 'total_points',
                name: "Total Points",
                width: '7%'
            },
            {
                id: 'form',
                name: "Form",
                data: (row) => parseFloat(row.form),
                width: '5%'
            },
            {
                id: 'ep_this',
                name: "Predicted Points",
                data: (row) => parseFloat(row.ep_this),
                width: '10%'
            },
            {
                id: 'ep_next',
                name: "Next Predicted Points",
                data: (row) => parseFloat(row.ep_next),
                width: '12%'
            },
            {
                id: 'chance_of_playing_this_round',
                name: "Chance of Playing This Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '15%'
            },
            {
                id: 'chance_of_playing_next_round',
                name: "Chance of Playing Next Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '15%'
            },
            {
                id: 'dreamteam_count',
                name: "Dreamteam Count",
                width: '10%'
            },
            {
                id: 'event_points',
                name: "Event Points",
                width: '10%'
            },
            {
                id: 'in_dreamteam',
                name: "In Dreamteam",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False",
                width: '10%'
            },
            {
                id: 'points_per_game',
                name: "Points per Game",
                data: (row) => parseFloat(row.points_per_game),
                width: '10%'
            },
            {
                id: 'selected_by_percent',
                name: "Selected by Percent (%)",
                data: (row) => parseFloat(row.selected_by_percent),
                width: '10%'
            },
            {
                id: 'special',
                name: "Special",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False",
                width: '5%'
            },
            {
                id: 'squad_number',
                name: "Squad Number",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '10%'
            },
            {
                id: 'status',
                name: "Status",
                width: '5%'
            },
            {
                id: 'team',
                name: "Team",
                width: '5%'
            },
            {
                id: 'team_code',
                name: "Team Code",
                width: '7%'
            },
            {
                id: 'transfers_in',
                name: "Transfers In",
                width: '10%'
            },
            {
                id: 'transfers_in_event',
                name: "Transfers In Event",
                width: '10%'
            },
            {
                id: 'transfers_out',
                name: "Transfers Out",
                width: '10%'
            },
            {
                id: 'transfers_out_event',
                name: "Transfers Out Event",
                width: '10%'
            },
            {
                id: 'value_form',
                name: "Value Form",
                data: (row) => parseFloat(row.value_form),
                width: '7%'
            },
            {
                id: 'value_season',
                name: "Value Season",
                data: (row) => parseFloat(row.value_season),
                width: '10%'
            },
            {
                id: 'minutes',
                name: "Minutes",
                width: '7%'
            },
            {
                id: 'goals_scored',
                name: "Goals Scored",
                width: '10%'
            },
            {
                id: 'assists',
                name: "Assists",
                width: '7%'
            },
            {
                id: 'clean_sheets',
                name: "Clean Sheets",
                width: '10%'
            },
            {
                id: 'goals_conceded',
                name: "Goals Conceded",
                width: '10%'
            },
            {
                id: 'own_goals',
                name: "Own Goals",
                width: '7%'
            },
            {
                id: 'penalties_saved',
                name: "Penalties Saved",
                width: '10%'
            },
            {
                id: 'penalties_missed',
                name: "Penalties Missed",
                width: '10%'
            },
            {
                id: 'yellow_cards',
                name: "Yellow Cards",
                width: '10%'
            },
            {
                id: 'red_cards',
                name: "Red Cards",
                width: '7%'
            },
            {
                id: 'saves',
                name: "Saves",
                width: '5%'
            },
            {
                id: 'bonus',
                name: "Bonus",
                width: '5%'
            },
            {
                id: 'bps',
                name: "BPS",
                width: '5%'
            },
            {
                id: 'influence',
                name: "Influence",
                data: (row) => parseFloat(row.influence),
                width: '7%'
            },
            {
                id: 'creativity',
                name: "Creativity",
                data: (row) => parseFloat(row.creativity),
                width: '7%'
            },
            {
                id: 'threat',
                name: "Threat",
                data: (row) => parseFloat(row.threat),
                width: '5%'
            },
            {
                id: 'ict_index',
                name: "ICT Index",
                data: (row) => parseFloat(row.ict_index),
                width: '7%'
            },
            {
                id: 'starts',
                name: "Starts",
                width: '5%'
            },
            {
                id: 'expected_goals',
                name: "Expected Goals",
                data: (row) => parseFloat(row.expected_goals),
                width: '10%'
            },
            {
                id: 'expected_assists',
                name: "Expected Assists",
                data: (row) => parseFloat(row.expected_assists),
                width: '10%'
            },
            {
                id: 'expected_goal_involvements',
                name: "Expected Goal Involvements",
                data: (row) => parseFloat(row.expected_goal_involvements),
                width: '15%'
            },
            {
                id: 'expected_goals_conceded',
                name: "Expected Goals Conceded",
                data: (row) => parseFloat(row.expected_goals_conceded),
                width: '15%'
            },
            {
                id: 'influence_rank',
                name: "Influence Rank",
                width: '10%'
            },
            {
                id: 'influence_rank_type',
                name: "Influence Rank Type",
                width: '10%'
            },
            {
                id: 'creativity_rank',
                name: "Creativity Rank",
                width: '10%'
            },
            {
                id: 'creativity_rank_type',
                name: "Creativity Rank Type",
                width: '10%'
            },
            {
                id: 'threat_rank',
                name: "Threat Rank",
                width: '10%'
            },
            {
                id: 'threat_rank_type',
                name: "Threat Rank Type",
                width: '10%'
            },
            {
                id: 'ict_index_rank',
                name: "ICT Index Rank",
                width: '10%'
            },
            {
                id: 'ict_index_rank_type',
                name: "ICT Index Rank Type",
                width: '10%'
            },
            {
                id: 'corners_and_indirect_freekicks_order',
                name: "Corners and Indirect Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '10%'
            },
            {
                id: 'corners_and_indirect_freekicks_text',
                name: "Corners and Indirect Freekicks Text",
                width: '10%'
            },
            {
                id: 'direct_freekicks_order',
                name: "Direct Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '10%'
            },
            {
                id: 'direct_freekicks_text',
                name: "Direct Freekicks Text",
                width: '10%'
            },
            {
                id: 'penalties_order',
                name: "Penalties Order",
                formatter: (cell) => cell == null ? "N/A" : cell,
                width: '10%'
            },
            {
                id: 'penalties_text',
                name: "Penalties Text",
                width: '10%'
            },
            {
                id: 'expected_goals_per_90',
                name: "Expected Goals per 90",
                width: '10%'
            },
            {
                id: 'saves_per_90',
                name: "Saves per 90",
                width: '10%'
            },
            {
                id: 'expected_assists_per_90',
                name: "Expected Assists per 90",
                width: '15%'
            },
            {
                id: 'expected_goal_involvements_per_90',
                name: "Expected Goal Involvements per 90",
                width: '15%'
            },
            {
                id: 'expected_goals_conceded_per_90',
                name: "Expected Goals Conceded per 90",
                width: '15%'
            },
            {
                id: 'goals_conceded_per_90',
                name: "Goals Conceded per 90",
                width: '15%'
            },
            {
                id: 'now_cost_rank',
                name: "Now Cost Rank",
                width: '10%'
            },
            {
                id: 'now_cost_rank_type',
                name: "Now Cost Rank Type",
                width: '10%'
            },
            {
                id: 'form_rank',
                name: "Form Rank",
                width: '10%'
            },
            {
                id: 'form_rank_type',
                name: "Form Rank Type",
                width: '10%'
            },
            {
                id: 'points_per_game_rank',
                name: "Points per Game Rank",
                width: '10%'
            },
            {
                id: 'points_per_game_rank_type',
                name: "Points per Game Rank Type",
                width: '10%'
            },
            {
                id: 'selected_rank',
                name: "Selected Rank",
                width: '10%'
            },
            {
                id: 'selected_rank_type',
                name: "Selected Rank Type",
                width: '10%'
            },
            {
                id: 'starts_per_90',
                name: "Starts per 90",
                width: '10%'
            },
            {
                id: 'clean_sheets_per_90',
                name: "Clean Sheets per 90",
                width: '10%'
            },
            {
                id: 'news',
                name: "News",
                width: '10%'
            },
            {
                id: 'news_added',
                name: "News Added",
                data: (row) => new Date(row.news_added).toISOString(),
                width: '10%'
            },
            {
                id: 'cost_change_event',
                name: "Cost Change Event",
                width: '10%'
            },
            {
                id: 'cost_change_event_fall',
                name: "Cost Change Event Fall",
                width: '10%'
            },
            {
                id: 'cost_change_start',
                name: "Cost Change Start",
                width: '10%'
            },
            {
                id: 'cost_change_start_fall',
                name: "Cost Change Start Fall",
                width: '10%'
            }
        ],
        data: data.elements,
        fixedHeader: true,
        resizable: true,
        search: true,
        sort: true,
        autoWidth: true,
        pagination: {
            limit: 10,
            summary: true
          }
    }).render(document.getElementById("wrapper"));
}).catch(error => {
    console.error('Error:', error);
});