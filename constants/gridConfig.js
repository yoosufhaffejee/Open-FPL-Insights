var gridOptions;
function setupGridOptions(filteredPlayers) {
    // Grid Options: Contains all of the Data Grid configurations
    gridOptions = {
        
        rowData: filteredPlayers,
        defaultColDef: {
            sortable: true,
            filter: true,
            floatingFilter: true,
            resizable: true,
        },
        pagination: true,
        paginationPageSize: 10,
        paginationPageSizeSelector: [10, 20, 50, 100, 1000],
        columnDefs: [
            {
                headerName: 'Actions',
                width: 65,
                pinned: 'left',
                filter: false,
                cellRenderer: (params) => {
                    const button = document.createElement('button');
                    button.className = 'btn btn-primary btn-sm';
                    button.disabled = myPlayers.some(player => player?.web_name == params.data.web_name) ||
                        !canAddPlayer(params.data.element_type) ||
                        bankBalance + 5 <= params.data.now_cost / 10;
                    button.innerText = '+';
                    button.addEventListener('click', () => {
                        addPlayer(allPlayers.find(player => player.id == params.data.id));
                        updateTeamUI();
                        grid.refreshCells();
                        document.getElementById('saveButton').disabled = false;

                    });
                    return button;
                }
            },
            { headerName: 'ID', field: 'id', hide: true },
            { headerName: 'Code', field: 'code', hide: true },
            { headerName: 'Photo', field: 'photo', hide: true },
            { 
                headerName: 'Player', 
                width: 180, 
                field: 'web_name', 
                floatingFilter: true, 
                pinned: 'left',
                cellRenderer: (params) => {
                    if (!params.data) return '';
                    let injuryIcon = '';
                    let chance = params.data.chance_of_playing_next_round;
                    if (chance != null && chance < 100) {
                        let color = chance === 0 ? 'text-danger' : 'text-warning';
                        injuryIcon = `<i class="fa-solid fa-triangle-exclamation ${color}" title="${params.data.news}"></i>`;
                    }
                    return `<div class="d-flex align-items-center" style="height: 100%;">
                                <img src="https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${params.data.team_code}-66.webp" style="width: 20px; margin-right: 8px;">
                                <span>${params.value}</span>
                                ${injuryIcon ? `<span class="ms-2" style="font-size: 0.9em; cursor: help;">${injuryIcon}</span>` : ''}
                            </div>`;
                }
            },
            { headerName: 'First Name', field: 'first_name', hide: true },
            { headerName: 'Second Name', field: 'second_name', hide: true },
            { 
                headerName: 'Pos', 
                field: 'element_type', 
                width: 80, 
                valueGetter: (params) => {
                    const posMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
                    return posMap[params.data.element_type] || params.data.element_type;
                }
            },
            {
                headerName: 'Price',
                field: 'now_cost',
                width: 100,
                valueGetter: (params) => params.data.now_cost / 10,
                cellRenderer: (params) => {
                    let change = params.data.cost_change_event;
                    let icon = '';
                    if (change > 0) icon = '<i class="fa-solid fa-caret-up text-success ms-1" title="Price rose this week"></i>';
                    else if (change < 0) icon = '<i class="fa-solid fa-caret-down text-danger ms-1" title="Price fell this week"></i>';
                    return `<span style="color: #4caf50; font-weight: 500;">&pound;${params.value.toFixed(1)}m</span>${icon}`;
                }
            },
            { headerName: 'Total Points', width: 120, field: 'total_points' },
            {
                headerName: 'Form',
                field: 'form',
                width: 100,
                valueGetter: (params) => parseFloat(params.data.form),
                cellClass: params => params.value >= 5 ? 'text-success fw-bold' : (params.value >= 3 ? 'text-warning' : '')
            },
            {
                headerName: 'Selected by %',
                field: 'selected_by_percent',
                width: 140,
                valueGetter: (params) => isNaN(parseFloat(params.data.selected_by_percent)) ? 0 : parseFloat(params.data.selected_by_percent),
                cellRenderer: (params) => {
                    let val = params.value;
                    if (!val) return '0%';
                    return val + '%';
                }
            },
            {
                headerName: 'Playing Chance (%)',
                field: 'chance_of_playing_next_round',
                width: 170,
                valueFormatter: (params) => params.value == null ? "100" : params.value,
                cellRenderer: (params) => {
                    let val = params.value;
                    let news = params.data.news ? `title="${params.data.news}"` : '';
                    if (val === 'N/A' || val == 100 || val == null) return '<span class="badge bg-success">100%</span>';
                    if (val == 0) return `<span class="badge bg-danger" ${news} style="cursor: help;">0%</span>`;
                    return `<span class="badge bg-warning text-dark" ${news} style="cursor: help;">${val}%</span>`;
                }
            },
            {
                headerName: 'DC per 90',
                field: 'defensive_contribution_per_90',
                width: 150,
                valueGetter: (params) => parseFloat(params.data.defensive_contribution_per_90) || 0
            },
            {
                headerValueGetter: () => typeof selectedGameweek !== 'undefined' ? `Exp Pts GW${selectedGameweek}` : 'Exp Pts',
                colId: 'custom_exp_pts',
                width: 150,
                valueGetter: (params) => {
                    if (typeof getPredictedPointsForGW !== 'function' || typeof selectedGameweek === 'undefined') return 0;
                    return getPredictedPointsForGW(params.data, selectedGameweek);
                },
                valueFormatter: params => params.value.toFixed(2),
                cellClass: params => {
                    let pts = params.value;
                    let isDefGk = params.data.element_type === 1 || params.data.element_type === 2;
                    if (isDefGk) {
                        return pts > 5.5 ? 'pts-elite fw-bold' : (pts >= 4.0 ? 'pts-good fw-bold' : (pts >= 2.5 ? 'pts-avg fw-bold' : 'pts-bad fw-bold'));
                    } else {
                        return pts > 6.5 ? 'pts-elite fw-bold' : (pts >= 4.5 ? 'pts-good fw-bold' : (pts >= 3.0 ? 'pts-avg fw-bold' : 'pts-bad fw-bold'));
                    }
                }
            },
            {
                headerValueGetter: () => typeof selectedGameweek !== 'undefined' ? `Exp Pts GW${selectedGameweek + 1}` : 'Next Exp Pts',
                colId: 'custom_exp_pts_next',
                width: 150,
                valueGetter: (params) => {
                    if (typeof getPredictedPointsForGW !== 'function' || typeof selectedGameweek === 'undefined') return 0;
                    return getPredictedPointsForGW(params.data, selectedGameweek + 1);
                },
                valueFormatter: params => params.value.toFixed(2),
                cellClass: params => {
                    let pts = params.value;
                    let isDefGk = params.data.element_type === 1 || params.data.element_type === 2;
                    if (isDefGk) {
                        return pts > 5.5 ? 'pts-elite fw-bold' : (pts >= 4.0 ? 'pts-good fw-bold' : (pts >= 2.5 ? 'pts-avg fw-bold' : 'pts-bad fw-bold'));
                    } else {
                        return pts > 6.5 ? 'pts-elite fw-bold' : (pts >= 4.5 ? 'pts-good fw-bold' : (pts >= 3.0 ? 'pts-avg fw-bold' : 'pts-bad fw-bold'));
                    }
                }
            },
            {
                headerName: 'Value Season',
                field: 'value_season',
                valueGetter: (params) => isNaN(parseFloat(params.data.value_season)) ? 0 : parseFloat(params.data.value_season)
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
                valueGetter: (params) => isNaN(parseFloat(params.data.influence)) ? 0 : parseFloat(params.data.influence)
            },
            {
                headerName: 'Creativity',
                field: 'creativity',
                valueGetter: (params) => isNaN(parseFloat(params.data.creativity)) ? 0 : parseFloat(params.data.creativity)
            },
            {
                headerName: 'Threat',
                field: 'threat',
                valueGetter: (params) => isNaN(parseFloat(params.data.threat)) ? 0 : parseFloat(params.data.threat)
            },
            {
                headerName: 'ICT Index',
                field: 'ict_index',
                valueGetter: (params) => isNaN(parseFloat(params.data.ict_index)) ? 0 : parseFloat(params.data.ict_index)
            },
            { headerName: 'Starts', field: 'starts' },
            {
                headerName: 'Expected Goals',
                field: 'expected_goals',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goals)) ? 0 : parseFloat(params.data.expected_goals)
            },
            {
                headerName: 'Expected Assists',
                field: 'expected_assists',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_assists)) ? 0 : parseFloat(params.data.expected_assists)
            },
            {
                headerName: 'Expected Goal Involvements',
                field: 'expected_goal_involvements',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goal_involvements)) ? 0 : parseFloat(params.data.expected_goal_involvements)
            },
            {
                headerName: 'Expected Goals Conceded',
                field: 'expected_goals_conceded',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goals_conceded)) ? 0 : parseFloat(params.data.expected_goals_conceded)
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
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goals_per_90)) ? 0 : parseFloat(params.data.expected_goals_per_90)
            },
            {
                headerName: 'Saves per 90',
                field: 'saves_per_90',
                valueGetter: (params) => isNaN(parseFloat(params.data.saves_per_90)) ? 0 : parseFloat(params.data.saves_per_90)
            },
            {
                headerName: 'Expected Assists per 90',
                field: 'expected_assists_per_90',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_assists_per_90)) ? 0 : parseFloat(params.data.expected_assists_per_90)
            },
            {
                headerName: 'Expected Goal Involvements per 90',
                field: 'expected_goal_involvements_per_90',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goal_involvements_per_90)) ? 0 : parseFloat(params.data.expected_goal_involvements_per_90)
            },
            {
                headerName: 'Expected Goals Conceded per 90',
                field: 'expected_goals_conceded_per_90',
                valueGetter: (params) => isNaN(parseFloat(params.data.expected_goals_conceded_per_90)) ? 0 : parseFloat(params.data.expected_goals_conceded_per_90)
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
