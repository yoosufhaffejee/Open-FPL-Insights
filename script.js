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
            // {
            //     id: 'id',
            //     name: "ID",
            // },
            // {
            //     id: 'code',
            //     name: "Code",
            // },
            // {
            //     id: 'photo',
            //     name: "Photo",
            // },
            // {
            //     id: 'element_type',
            //     name: "Element Type",
            // },
            {
                id: 'web_name',
                name: "Web Name",
            },
            // {
            //     id: 'first_name',
            //     name: "First Name",
            // },
            // {
            //     id: 'second_name',
            //     name: "Second Name",
            // },
            {
                id: 'now_cost',
                name: "Price",
                data: (row) => (row.now_cost / 10)
            },
            {
                id: 'total_points',
                name: "Total Points"
            },
            {
                id: 'form',
                name: "Form",
                data: (row) => parseFloat(row.form)
            },
            {
                id: 'ep_this',
                name: "EP This",
                data: (row) => parseFloat(row.ep_this)
            },
            {
                id: 'ep_next',
                name: "EP Next",
                data: (row) => parseFloat(row.ep_next)
            },
            {
                id: 'chance_of_playing_next_round',
                name: "Chance of Playing Next Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'chance_of_playing_this_round',
                name: "Chance of Playing This Round (%)",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'dreamteam_count',
                name: "Dreamteam Count",
            },
            {
                id: 'event_points',
                name: "Event Points",
            },
            {
                id: 'in_dreamteam',
                name: "In Dreamteam",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False"
            },
            {
                id: 'points_per_game',
                name: "Points per Game",
                data: (row) => parseFloat(row.points_per_game)
            },
            {
                id: 'selected_by_percent',
                name: "Selected by Percent (%)",
                data: (row) => parseFloat(row.selected_by_percent)
            },
            {
                id: 'special',
                name: "Special",
                formatter: (cell) => cell === null ? "N/A" : cell ? "True" : "False"
            },
            {
                id: 'squad_number',
                name: "Squad Number",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'status',
                name: "Status",
            },
            {
                id: 'team',
                name: "Team",
            },
            {
                id: 'team_code',
                name: "Team Code",
            },
            {
                id: 'transfers_in',
                name: "Transfers In",
            },
            {
                id: 'transfers_in_event',
                name: "Transfers In Event",
            },
            {
                id: 'transfers_out',
                name: "Transfers Out",
            },
            {
                id: 'transfers_out_event',
                name: "Transfers Out Event",
            },
            {
                id: 'value_form',
                name: "Value Form",
                data: (row) => parseFloat(row.value_form)
            },
            {
                id: 'value_season',
                name: "Value Season",
                data: (row) => parseFloat(row.value_season)
            },
            {
                id: 'minutes',
                name: "Minutes",
            },
            {
                id: 'goals_scored',
                name: "Goals Scored",
            },
            {
                id: 'assists',
                name: "Assists",
            },
            {
                id: 'clean_sheets',
                name: "Clean Sheets",
            },
            {
                id: 'goals_conceded',
                name: "Goals Conceded",
            },
            {
                id: 'own_goals',
                name: "Own Goals",
            },
            {
                id: 'penalties_saved',
                name: "Penalties Saved",
            },
            {
                id: 'penalties_missed',
                name: "Penalties Missed",
            },
            {
                id: 'yellow_cards',
                name: "Yellow Cards",
            },
            {
                id: 'red_cards',
                name: "Red Cards",
            },
            {
                id: 'saves',
                name: "Saves",
            },
            {
                id: 'bonus',
                name: "Bonus",
            },
            {
                id: 'bps',
                name: "BPS",
            },
            {
                id: 'influence',
                name: "Influence",
                data: (row) => parseFloat(row.influence)
            },
            {
                id: 'creativity',
                name: "Creativity",
                data: (row) => parseFloat(row.creativity)
            },
            {
                id: 'threat',
                name: "Threat",
                data: (row) => parseFloat(row.threat)
            },
            {
                id: 'ict_index',
                name: "ICT Index",
                data: (row) => parseFloat(row.ict_index)
            },
            {
                id: 'starts',
                name: "Starts",
            },
            {
                id: 'expected_goals',
                name: "Expected Goals",
                data: (row) => parseFloat(row.expected_goals)
            },
            {
                id: 'expected_assists',
                name: "Expected Assists",
                data: (row) => parseFloat(row.expected_assists)
            },
            {
                id: 'expected_goal_involvements',
                name: "Expected Goal Involvements",
                data: (row) => parseFloat(row.expected_goal_involvements)
            },
            {
                id: 'expected_goals_conceded',
                name: "Expected Goals Conceded",
                data: (row) => parseFloat(row.expected_goals_conceded)
            },
            {
                id: 'influence_rank',
                name: "Influence Rank",
            },
            {
                id: 'influence_rank_type',
                name: "Influence Rank Type",
            },
            {
                id: 'creativity_rank',
                name: "Creativity Rank",
            },
            {
                id: 'creativity_rank_type',
                name: "Creativity Rank Type",
            },
            {
                id: 'threat_rank',
                name: "Threat Rank",
            },
            {
                id: 'threat_rank_type',
                name: "Threat Rank Type",
            },
            {
                id: 'ict_index_rank',
                name: "ICT Index Rank",
            },
            {
                id: 'ict_index_rank_type',
                name: "ICT Index Rank Type",
            },
            {
                id: 'corners_and_indirect_freekicks_order',
                name: "Corners and Indirect Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'corners_and_indirect_freekicks_text',
                name: "Corners and Indirect Freekicks Text",
            },
            {
                id: 'direct_freekicks_order',
                name: "Direct Freekicks Order",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'direct_freekicks_text',
                name: "Direct Freekicks Text",
            },
            {
                id: 'penalties_order',
                name: "Penalties Order",
                formatter: (cell) => cell == null ? "N/A" : cell
            },
            {
                id: 'penalties_text',
                name: "Penalties Text",
            },
            {
                id: 'expected_goals_per_90',
                name: "Expected Goals per 90",
            },
            {
                id: 'saves_per_90',
                name: "Saves per 90",
            },
            {
                id: 'expected_assists_per_90',
                name: "Expected Assists per 90",
            },
            {
                id: 'expected_goal_involvements_per_90',
                name: "Expected Goal Involvements per 90",
            },
            {
                id: 'expected_goals_conceded_per_90',
                name: "Expected Goals Conceded per 90",
            },
            {
                id: 'goals_conceded_per_90',
                name: "Goals Conceded per 90",
            },
            {
                id: 'now_cost_rank',
                name: "Now Cost Rank",
            },
            {
                id: 'now_cost_rank_type',
                name: "Now Cost Rank Type",
            },
            {
                id: 'form_rank',
                name: "Form Rank",
            },
            {
                id: 'form_rank_type',
                name: "Form Rank Type",
            },
            {
                id: 'points_per_game_rank',
                name: "Points per Game Rank",
            },
            {
                id: 'points_per_game_rank_type',
                name: "Points per Game Rank Type",
            },
            {
                id: 'selected_rank',
                name: "Selected Rank",
            },
            {
                id: 'selected_rank_type',
                name: "Selected Rank Type",
            },
            {
                id: 'starts_per_90',
                name: "Starts per 90",
            },
            {
                id: 'clean_sheets_per_90',
                name: "Clean Sheets per 90",
            },
            {
                id: 'news',
                name: "News",
            },
            {
                id: 'news_added',
                name: "News Added",
                data: (row) => new Date(row.news_added).toISOString()
            },
            {
                id: 'cost_change_event',
                name: "Cost Change Event",
            },
            {
                id: 'cost_change_event_fall',
                name: "Cost Change Event Fall",
            },
            {
                id: 'cost_change_start',
                name: "Cost Change Start",
            },
            {
                id: 'cost_change_start_fall',
                name: "Cost Change Start Fall",
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