document.addEventListener('DOMContentLoaded', () => {
    const addLeagueBtn = document.getElementById('addLeagueBtn');
    const playerLeaguesContainer = document.getElementById('playerLeaguesContainer');
    const leagueStandingsContainer = document.getElementById('leagueStandingsContainer');
    const leagueIdInput = document.getElementById('leagueId');

    let selectedLeagueId = 0;

    // Initialize AG Grid for League Names
    const leagueGridOptions = {
        columnDefs: [
            { headerName: "League Name", field: "name", sort: 'asc', cellClass: 'ag-cell-clickable' }
        ],
        defaultColDef: {
            flex: 1,
            minWidth: 100,
            sortable: true, 
            filter: true
        },
        rowData: [],  // Initialize empty rowData array
        onCellClicked: (event) => {
            if (event.colDef.field === "name") {
                selectedLeagueId = event.data.id; // Correctly capture the league ID
                setStandingsGridDatasource(selectedLeagueId);
            }
        }
    };

    const leagueGrid = agGrid.createGrid(playerLeaguesContainer, leagueGridOptions);

    // Initialize AG Grid for League Standings
    const standingsGridOptions = {
        columnDefs: [
            { headerName: "Rank", field: "rank_sort" },
            {
                headerName: "Manager Name", 
                field: "player_name",
                cellRenderer: (params) => {
                    return `<span style="color: blue; text-decoration: underline; cursor: pointer;">${params.value}</span>`;
                }
            },
            { headerName: "ManagerTeam Name", field: "entry_name" },
            { headerName: "GW Points", field: "event_total" },
            { headerName: "Total Points", field: "total" }
        ],
        defaultColDef: {
            flex: 1,
            minWidth: 100,
            sortable: false,
            filter: false,
        },
        pagination: true,
        paginationPageSize: 50,
        cacheBlockSize: 50,
        rowModelType: 'infinite', // Use infinite row model
        onCellClicked: (event) => {
            if (event.colDef.field === "player_name") {
                window.location.href = `../managers/managers.html?entry=${event.data.entry}`;
            }
        }
    };

    const standingsGrid = agGrid.createGrid(leagueStandingsContainer, standingsGridOptions);

    // Function to read cookies
    const getCookie = (name) => {
        let cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            let cookie = cookies[i].trim();
            if (cookie.indexOf(name + '=') === 0) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }
        return "";
    };

    // Function to set cookies
    const setCookie = (name, value, days) => {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        let expires = "expires=" + d.toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`;
    };

    // Fetch and display leagues from cookies
    const loadPlayerLeagues = () => {
        const playerLeagues = getCookie('playerLeagues');
        if (playerLeagues) {
            const leagues = JSON.parse(playerLeagues); // Deserialize from JSON format
            leagueGrid.updateGridOptions({
                rowData: leagues
            });
        }
        else {
            addLeague("314");
        }
    };

    // Fetch league data and update league grid
    const fetchLeague = async (id) => {
        try {
            const data = await getLeague(id);
            if (data && data.league) {
                return data.league;
            } else {
                alert('No data available for this league.');
                return null;
            }
        } catch (error) {
            console.error('Error fetching league:', error);
            alert('Failed to fetch league data. Please check the League ID.');
        }
    };
    
    // Function to fetch data for a specific page
    const fetchLeagueStandings = async (id, page) => {
        try {
            if (id <= 0) {
                return { rows: [], lastPage: true };
            }

            const data = await getLeague(id, page);
            if (data && data.standings && data.standings.results) {
                return {
                    rows: data.standings.results,
                    lastPage: !data.standings.has_next // Determines if there's more data
                };
            } else {
                return { rows: [], lastPage: true };
            }
        } catch (error) {
            console.error('Error fetching standings:', error);
            return { rows: [], lastPage: true };
        }
    };

    // Function to set the datasource for standings grid
    const setStandingsGridDatasource = (leagueId) => {
        standingsGridOptions.datasource = {
            pageSize: standingsGridOptions.paginationPageSize,
            async getRows(params) {
                const page = Math.floor(params.startRow / standingsGridOptions.paginationPageSize) + 1;
                try {
                    const { rows, lastPage } = await fetchLeagueStandings(leagueId, page);
                    const endRow = lastPage ? params.startRow + rows.length : -1;
                    params.successCallback(rows, endRow);
                } catch (error) {
                    console.error('Error fetching data for grid:', error);
                    params.failCallback();
                }
            }
        };

        standingsGrid.setGridOption('datasource', standingsGridOptions.datasource);
    };

    // Event listener for Add League button
    addLeagueBtn.addEventListener('click', () => {
        const leagueId = leagueIdInput.value.trim();
        addLeague(leagueId);
    });

    async function addLeague(leagueId) {
        if (leagueId) {
            let league = await fetchLeague(leagueId);
            let playerLeagues = getCookie('playerLeagues');
            if (playerLeagues) {
                const leagues = JSON.parse(playerLeagues); // Deserialize from JSON format
                if (!leagues.some(league => league.id === leagueId)) {
                    // Only add if the league isn't already stored
                    leagues.push({ id: leagueId, name: league.name }); // Temporary name until data is fetched
                    setCookie('playerLeagues', JSON.stringify(leagues), 30);

                    leagueGrid.updateGridOptions({
                        rowData: leagues
                    });
                }
            } else {
                if (league) {
                    setCookie('playerLeagues', JSON.stringify([{ id: leagueId, name: league.name }]), 30); // Serialize to JSON format
                    leagueGrid.updateGridOptions({
                        rowData: [league]
                    });
                }
            }
        } else {
            alert('Please enter a valid League ID.');
        }

        leagueIdInput.value = '';
    }

    // Load leagues from cookie on page load
    loadPlayerLeagues();
});