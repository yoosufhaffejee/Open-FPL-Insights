var gridOptions;
function setupGridOptions(filteredPlayers) {
    // Grid Options: Contains all of the Data Grid configurations
    gridOptions = {
        rowData: filteredPlayers,
        defaultColDef: {
            sortable: true,
            filter: true,
            resizable: true,
        },
        pagination: true,
        paginationPageSize: 10,
        paginationPageSizeSelector: [10, 20, 50, 100, 1000],
        columnDefs: [
            {
                headerName: 'Actions',
                width: 85,
                pinned: 'left',
                filter: false,
                cellRenderer: (params) => {
                    const button = document.createElement('button');
                    button.className = 'btn btn-primary';
                    button.disabled = myPlayers.some(player => player?.web_name == params.data.web_name) ||
                        !canAddPlayer(params.data.element_type) ||
                        bankBalance + 5 <= params.data.now_cost / 10;
                    button.innerText = '+';
                    button.addEventListener('click', () => {
                        //myPlayers.push(allPlayers.find(player => player.id == params.data.id));
                        addPlayer(allPlayers.find(player => player.id == params.data.id));
                        updateTeamUI();
                        grid.refreshCells();
                        document.getElementById('saveButton').disabled = false;
                        document.getElementById('autoPickButton').disabled = true;
                    });
                    return button;
                }
            },
            { headerName: 'ID', field: 'id', hide: true },
            { headerName: 'Code', field: 'code', hide: true },
            { headerName: 'Photo', field: 'photo', hide: true },
            { headerName: 'Element Type', field: 'element_type', hide: true },
            { headerName: 'Web Name', width: 150, field: 'web_name', floatingFilter: true, pinned: 'left' },
            { headerName: 'First Name', field: 'first_name', hide: true },
            { headerName: 'Second Name', field: 'second_name', hide: true },
            {
                headerName: 'Price',
                field: 'now_cost',
                width: 100,
                valueGetter: (params) => params.data.now_cost / 10
            },
            { headerName: 'Total Points', width: 150, field: 'total_points' },
            {
                headerName: 'Form',
                field: 'form',
                width: 100,
                valueGetter: (params) => parseFloat(params.data.form)
            },
            {
                headerName: 'Predicted Points',
                field: 'ep_this',
                width: 150,
                valueGetter: (params) => parseFloat(params.data.ep_this)
            },
            {
                headerName: 'Next Predicted Points',
                field: 'ep_next',
                width: 150,
                valueGetter: (params) => parseFloat(params.data.ep_next)
            },
            {
                headerName: 'Chance of Playing This Round (%)',
                field: 'chance_of_playing_this_round',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                headerName: 'Chance of Playing Next Round (%)',
                field: 'chance_of_playing_next_round',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            { headerName: 'Dreamteam Count', field: 'dreamteam_count', width: 250 },
            { headerName: 'Event Points', field: 'event_points' },
            {
                headerName: 'In Dreamteam',
                field: 'in_dreamteam',
                valueFormatter: (params) => params.value === null ? "N/A" : params.value ? "True" : "False"
            },
            {
                headerName: 'Points per Game',
                field: 'points_per_game',
                valueGetter: (params) => parseFloat(params.data.points_per_game)
            },
            {
                headerName: 'Selected by Percent (%)',
                field: 'selected_by_percent',
                valueGetter: (params) => parseFloat(params.data.selected_by_percent)
            },
            {
                headerName: 'Special',
                field: 'special',
                valueFormatter: (params) => params.value === null ? "N/A" : params.value ? "True" : "False"
            },
            {
                headerName: 'Squad Number',
                field: 'squad_number',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            { headerName: 'Status', field: 'status' },
            { headerName: 'Team', field: 'team' },
            { headerName: 'Team Code', field: 'team_code' },
            { headerName: 'Transfers In', field: 'transfers_in' },
            { headerName: 'Transfers In Event', field: 'transfers_in_event' },
            { headerName: 'Transfers Out', field: 'transfers_out' },
            { headerName: 'Transfers Out Event', field: 'transfers_out_event', width: 300 },
            {
                headerName: 'Value Form',
                field: 'value_form',
                valueGetter: (params) => parseFloat(params.data.value_form)
            },
            {
                headerName: 'Value Season',
                field: 'value_season',
                valueGetter: (params) => parseFloat(params.data.value_season)
            },
            { headerName: 'Minutes', field: 'minutes' },
            { headerName: 'Goals Scored', field: 'goals_scored' },
            { headerName: 'Assists', field: 'assists' },
            { headerName: 'Clean Sheets', field: 'clean_sheets' },
            { headerName: 'Goals Conceded', field: 'goals_conceded' },
            { headerName: 'Own Goals', field: 'own_goals' },
            { headerName: 'Penalties Saved', field: 'penalties_saved' },
            { headerName: 'Penalties Missed', field: 'penalties_missed' },
            { headerName: 'Yellow Cards', field: 'yellow_cards' },
            { headerName: 'Red Cards', field: 'red_cards' },
            { headerName: 'Saves', field: 'saves' },
            { headerName: 'Bonus', field: 'bonus' },
            { headerName: 'BPS', field: 'bps' },
            {
                headerName: 'Influence',
                field: 'influence',
                valueGetter: (params) => parseFloat(params.data.influence)
            },
            {
                headerName: 'Creativity',
                field: 'creativity',
                valueGetter: (params) => parseFloat(params.data.creativity)
            },
            {
                headerName: 'Threat',
                field: 'threat',
                valueGetter: (params) => parseFloat(params.data.threat)
            },
            {
                headerName: 'ICT Index',
                field: 'ict_index',
                valueGetter: (params) => parseFloat(params.data.ict_index)
            },
            { headerName: 'Starts', field: 'starts' },
            {
                headerName: 'Expected Goals',
                field: 'expected_goals',
                valueGetter: (params) => parseFloat(params.data.expected_goals)
            },
            {
                headerName: 'Expected Assists',
                field: 'expected_assists',
                valueGetter: (params) => parseFloat(params.data.expected_assists)
            },
            {
                headerName: 'Expected Goal Involvements',
                field: 'expected_goal_involvements',
                valueGetter: (params) => parseFloat(params.data.expected_goal_involvements)
            },
            {
                headerName: 'Expected Goals Conceded',
                field: 'expected_goals_conceded',
                valueGetter: (params) => parseFloat(params.data.expected_goals_conceded)
            },
            { headerName: 'Influence Rank', field: 'influence_rank' },
            { headerName: 'Influence Rank Type', field: 'influence_rank_type' },
            { headerName: 'Creativity Rank', field: 'creativity_rank' },
            { headerName: 'Creativity Rank Type', field: 'creativity_rank_type' },
            { headerName: 'Threat Rank', field: 'threat_rank' },
            { headerName: 'Threat Rank Type', field: 'threat_rank_type' },
            { headerName: 'ICT Index Rank', field: 'ict_index_rank' },
            { headerName: 'ICT Index Rank Type', field: 'ict_index_rank_type' },
            {
                headerName: 'Corners and Indirect Freekicks Order',
                field: 'corners_and_indirect_freekicks_order',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'corners_and_indirect_freekicks_text',
                headerName: "Corners and Indirect Freekicks Text",
            },
            {
                headerName: 'Direct Freekicks Order',
                field: 'direct_freekicks_order',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'direct_freekicks_text',
                headerName: "Direct Freekicks Text",
            },
            {
                headerName: 'Penalties Order',
                field: 'penalties_order',
                valueFormatter: (params) => params.value == null ? "N/A" : params.value
            },
            {
                field: 'penalties_text',
                headerName: "Penalties Text",
            },
            {
                headerName: 'Expected Goals per 90',
                field: 'expected_goals_per_90',
                valueGetter: (params) => parseFloat(params.data.expected_goals_per_90)
            },
            {
                headerName: 'Saves per 90',
                field: 'saves_per_90',
                valueGetter: (params) => parseFloat(params.data.saves_per_90)
            },
            {
                headerName: 'Expected Assists per 90',
                field: 'expected_assists_per_90',
                valueGetter: (params) => parseFloat(params.data.expected_assists_per_90)
            },
            {
                headerName: 'Expected Goal Involvements per 90',
                field: 'expected_goal_involvements_per_90',
                valueGetter: (params) => parseFloat(params.data.expected_goal_involvements_per_90)
            },
            {
                headerName: 'Expected Goals Conceded per 90',
                field: 'expected_goals_conceded_per_90',
                valueGetter: (params) => parseFloat(params.data.expected_goals_conceded_per_90)
            },
            { headerName: 'Goals Conceded per 90', field: 'goals_conceded_per_90' },
            { field: 'now_cost_rank', headerName: "Now Cost Rank" },
            { field: 'now_cost_rank_type', headerName: "Now Cost Rank Type" },
            {
                field: 'form_rank',
                headerName: "Form Rank",
            },
            {
                field: 'form_rank_type',
                headerName: "Form Rank Type",
            },
            {
                field: 'points_per_game_rank',
                headerName: "Points per Game Rank",
            },
            {
                field: 'points_per_game_rank_type',
                headerName: "Points per Game Rank Type",
            },
            {
                field: 'selected_rank',
                headerName: "Selected Rank",
            },
            {
                field: 'selected_rank_type',
                headerName: "Selected Rank Type",
            },
            {
                field: 'starts_per_90',
                headerName: "Starts per 90",
            },
            {
                field: 'clean_sheets_per_90',
                headerName: "Clean Sheets per 90",
            },
            {
                field: 'news',
                headerName: "News",
            },
            {
                field: 'news_added',
                headerName: "News Added",
            },
            {
                field: 'cost_change_event',
                headerName: "Cost Change Event",
            },
            {
                field: 'cost_change_event_fall',
                headerName: "Cost Change Event Fall",
            },
            {
                field: 'cost_change_start',
                headerName: "Cost Change Start",
            },
            {
                field: 'cost_change_start_fall',
                headerName: "Cost Change Start Fall",
            },
        ]
    };
}