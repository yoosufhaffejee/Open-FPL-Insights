document.addEventListener('DOMContentLoaded', () => {

    let fixtures = [];
    getFixtures().then(data => {
        fixtures = data;
        updateGameweek();
    });

    let currentGW = selectedGameweek;

    function renderFixtures() {
        const fixturesContent = document.getElementById('fixtures-content');
        const gameweekData = fixtures.filter(f => f.event == currentGW);
        fixturesContent.innerHTML = '';

        let currentDate = '';

        gameweekData.forEach(fixture => {
            const homeTeam = teams.find(team => team.id === fixture.team_h);
            const awayTeam = teams.find(team => team.id === fixture.team_a);

            const fixtureDate = new Date(fixture.kickoff_time).toLocaleDateString();
            if (currentDate !== fixtureDate) {
                const dateHeader = document.createElement('h4');
                dateHeader.className = 'fixture-date';
                dateHeader.textContent = fixtureDate;
                fixturesContent.appendChild(dateHeader);
                currentDate = fixtureDate;
            }

            const fixtureRow = document.createElement('div');
            fixtureRow.className = 'accordion-item';
            fixtureRow.innerHTML = `
                <h2 class="accordion-header" id="heading${fixture.code}">
                    <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${fixture.code}" aria-expanded="true" aria-controls="collapse${fixture.code}">
                        <div class="d-flex justify-content-between w-100">
                            <div class="d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${homeTeam.code}.png" class="team-logo me-2" alt="${homeTeam.short_name}">
                                <span>${homeTeam.short_name}</span>
                            </div>
                            <div>${fixture.finished ? 
                                `${fixture.team_h_score ? fixture.team_h_score : '0'} - ${fixture.team_a_score ? fixture.team_a_score : '0'}` :
                                new Date(fixture.kickoff_time).toLocaleTimeString()}</div>
                            <div class="d-flex align-items-center">
                                <img src="https://resources.premierleague.com/premierleague/badges/100/t${awayTeam.code}.png" class="team-logo me-2" alt="${awayTeam.short_name}">
                                <span>${awayTeam.short_name}</span>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="collapse${fixture.code}" class="accordion-collapse collapse" aria-labelledby="heading${fixture.code}">
                    <div class="accordion-body">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Stat</th>
                                    <th>${homeTeam.short_name}</th>
                                    <th>${awayTeam.short_name}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Goals Scored</td>
                                    <td>${getStatDetails(fixture, 'goals_scored', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'goals_scored', 'a')}</td>
                                </tr>
                                <tr>
                                    <td>Assists</td>
                                    <td>${getStatDetails(fixture, 'assists', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'assists', 'a')}</td>
                                </tr>
                                <tr>
                                    <td>Yellow Cards</td>
                                    <td>${getStatDetails(fixture, 'yellow_cards', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'yellow_cards', 'a')}</td>
                                </tr>
                                <tr>
                                    <td>Saves</td>
                                    <td>${getStatDetails(fixture, 'saves', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'saves', 'a')}</td>
                                </tr>
                                <tr>
                                    <td>Bonus</td>
                                    <td>${getStatDetails(fixture, 'bonus', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'bonus', 'a')}</td>
                                </tr>
                                <tr>
                                    <td>Bonus Points System</td>
                                    <td>${getStatDetails(fixture, 'bps', 'h')}</td>
                                    <td>${getStatDetails(fixture, 'bps', 'a')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            fixturesContent.appendChild(fixtureRow);
        });
    }

    function getStatDetails(fixture, identifier, teamName) {
        const stats = fixture.stats.find(stat => stat.identifier === identifier);
        if (!stats) return 'None';

        return stats[teamName].map(stat => {
            const player = allPlayers.find(p => p.id === stat.element);
            return `${player ? player.web_name : 'Unknown'} (${stat.value})`;
        }).join('<br>');
    }

    function updateGameweek() {
        document.getElementById('gameweek').textContent = `Gameweek ${currentGW}`;
        renderFixtures();
    }

    document.getElementById('prevGW').addEventListener('click', () => {
        if (currentGW > 1) {
            currentGW--;
            updateGameweek();
        }
    });

    document.getElementById('nextGW').addEventListener('click', () => {
        if (fixtures.some(f => f.event === currentGW + 1)) {
            currentGW++;
            updateGameweek();
        }
    });
});