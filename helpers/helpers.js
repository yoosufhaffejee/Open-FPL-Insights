const positionMap = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
function getTeamShortName(teamId) {
    return teams.find(t => t.id == teamId).short_name;
}

function formatFixtureDate(kickoffTime) {
    const options = {
        weekday: 'long',  // e.g., "Saturday"
        day: 'numeric',   // e.g., "14"
        month: 'long',    // e.g., "September"
        year: 'numeric',  // e.g., "2024"
    };
    
    return new Date(kickoffTime).toLocaleDateString(undefined, options);
}

// Function to format date as "Sat, 14 Sep 16:00"
function formatFixtureDateTime(kickoffTime) {
    const options = {
        weekday: 'short',  // e.g., "Sat"
        day: 'numeric',    // e.g., "14"
        month: 'short',    // e.g., "Sep"
        hour: '2-digit',   // e.g., "16"
        minute: '2-digit'  // e.g., "00"
    };
    return new Date(kickoffTime).toLocaleString(undefined, options); // Remove unwanted comma
}

// Function to get the upcoming gameweek where 'finished' is false
function getUpcomingGameweek() {
    // Prioritize 'is_next' to skip currently in-progress gameweeks where the deadline has passed.
    // Fall back to the first unfinished gameweek if 'is_next' is not set (e.g. before season starts).
    const nextGw = gameweeks.find(gw => gw.is_next);
    if (nextGw) return nextGw;
    return gameweeks.find(gw => gw.finished === false) || gameweeks[gameweeks.length - 1];
}

function getLastGameweekId() {
    // Find the first gameweek where 'finished' is true
    return getUpcomingGameweek().id - 1;
}

// Helper function to get team details by ID
function getTeamById(teamId) {
    return teams.find(team => team.id === teamId);
}

// Helper function to get the difficulty class based on difficulty rating
function getDifficultyClass(difficulty) {
    switch (difficulty) {
        case 2:
            return 'bg-success'; // Green
        case 3:
            return 'bg-secondary'; // Grey
        case 4:
            return 'bg-warning'; // Yellow
        case 5:
            return 'bg-danger'; // Red
        default:
            return 'bg-light'; // Default
    }
}

// Helper function to map position to elementType
function getKeyByValue(pos) {
    const map = {
        gk: 1,  // Example mapping
        def: 2,
        mid: 3,
        fwd: 4
    };
    return map[pos];
}

function getOpponentTeam(playerTeamId, fixture) {
    if (playerTeamId == fixture.team_a) {
        return teams.find(t => t.id == fixture.team_h).name;
    }

    if (playerTeamId == fixture.team_h) {
        return teams.find(t => t.id == fixture.team_a).name;
    }
}
function playerImgOnerror(el, teamCode, elementType) {
    if (!el.dataset.triedShirt) {
        el.dataset.triedShirt = '1';
        el.src = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${elementType == 1 ? "_1" : ""}-110.webp`;
    } else {
        el.onerror = null;
        el.src = 'https://resources.premierleague.com/premierleague/photos/players/250x250/Photo-Missing.png';
    }
}


// --- ONBOARDING UX ---

function _getCookieVal(name) {
    let cookieArr = document.cookie.split(";");
    for(let i = 0; i < cookieArr.length; i++) {
        let cookiePair = cookieArr[i].split("=");
        if(name == cookiePair[0].trim()) {
            return decodeURIComponent(cookiePair[1]);
        }
    }
    return null;
}


}

function showOnboardingModal(assetPrefix = './', forceShow = false) {
    if (!forceShow && localStorage.getItem('fpl_onboarding_seen')) {
        return;
    }
    localStorage.setItem('fpl_onboarding_seen', 'true');
    
    let modal = document.getElementById('fplOnboardingModal');
    if (modal) {
        modal.remove();
    }
    
    const html = `
    <div class="modal fade" id="fplOnboardingModal" tabindex="-1" aria-hidden="true" style="z-index: 10050;">
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content bg-dark text-white border-secondary">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title text-warning fw-bold"><i class="fas fa-info-circle me-2"></i>Help & Setup</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-0">
                    <ul class="nav nav-tabs nav-fill bg-secondary bg-opacity-25 border-bottom border-secondary" id="helpTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active text-white fw-bold py-3" id="about-tab" data-bs-toggle="tab" data-bs-target="#about-pane" type="button" role="tab" aria-controls="about-pane" aria-selected="true">About Open FPL Insights</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link text-white fw-bold py-3" id="setup-tab" data-bs-toggle="tab" data-bs-target="#setup-pane" type="button" role="tab" aria-controls="setup-pane" aria-selected="false">Setup & Import Team</button>
                        </li>
                    </ul>
                    
                    <div class="tab-content p-4" id="helpTabsContent">
                        <!-- ABOUT TAB -->
                        <div class="tab-pane fade show active" id="about-pane" role="tabpanel" aria-labelledby="about-tab" tabindex="0">
                            <h4 class="text-warning mb-3">Welcome to Open FPL Insights!</h4>
                            <p>This is a powerful, open-source companion tool for Fantasy Premier League. We provide advanced metrics, optimal team planners, and live match data.</p>
                            
                            <h5 class="mt-4 text-success"><i class="fas fa-magic me-2"></i>How to add your Team</h5>
                            <p>You don't need a Manager ID to start playing around! You can manually build your team in the <strong>Team</strong> tab by clicking the pitch slots to add players from the grid.</p>
                            <p>If you prefer to import your current FPL team directly, head over to the <strong>Setup & Import Team</strong> tab to learn how to find your Manager ID.</p>
                            <p>Alternatively, you can import your team via a screenshot on the <strong>Team</strong> page!</p>
                            
                            <hr class="border-secondary my-4">
                            
                            <h5 class="text-success"><i class="fas fa-toolbox me-2"></i>Our Tools Overview</h5>
                            <div class="row g-3 mt-2">
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-warning"><i class="fas fa-users me-2"></i>Team & Manager</h6>
                                        <p class="small mb-0">View your current squad layout, analyze player expected points, and monitor your overall global ranking and gameweek history.</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-warning"><i class="fas fa-calendar-alt me-2"></i>Fixtures & FDR</h6>
                                        <p class="small mb-0">Check live fixture scores, explore detailed fixture difficulty ratings (FDR), and analyze player stats and live lineups for upcoming games.</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-warning"><i class="fas fa-route me-2"></i>Transfer Planner</h6>
                                        <p class="small mb-0">Plan your transfers weeks in advance. Model hits, chips (Wildcard, Free Hit, Bench Boost), and rolling free transfers across a 19-gameweek horizon.</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-warning"><i class="fas fa-chart-line me-2"></i>Stats & Leagues</h6>
                                        <p class="small mb-0">Dive deep into player underlying numbers (xG, xA), track price changes, and monitor your mini-league competitors' squads and rank updates.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- SETUP TAB -->
                        <div class="tab-pane fade" id="setup-pane" role="tabpanel" aria-labelledby="setup-tab" tabindex="0">
                            <h4 class="mb-3 text-warning">How to find your Manager ID</h4>
                            <p>To view your specific team and leagues, we need your public FPL Manager ID.</p>
                            
                            <div class="row g-4 mt-2">
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-success fw-bold"><i class="fas fa-desktop me-2"></i>Method 1: From the FPL Website</h6>
                                        <p class="small">1. Log into the official FPL website.<br>2. Click on the <strong>"Points"</strong> tab.<br>3. Look at the URL in your browser's address bar. Your ID is the number right after <code>/entry/</code>.</p>
                                        <div class="text-center mt-2">
                                            <img src="${assetPrefix}assets/How-To-Find-FPL-ID-Screenshot.png" alt="Finding ID on Web" class="img-fluid rounded border border-secondary shadow-sm" onerror="this.style.display='none'">
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card bg-secondary bg-opacity-10 border-secondary h-100 p-3">
                                        <h6 class="text-success fw-bold"><i class="fas fa-mobile-alt me-2"></i>Method 2: Finding your League ID</h6>
                                        <p class="small">1. Go to the <strong>"Leagues & Cups"</strong> tab.<br>2. Click on any classic mini-league you are in.<br>3. The League ID is the number in the URL right after <code>/league/</code>.</p>
                                        <div class="text-center mt-2">
                                            <img src="${assetPrefix}assets/How-To-Find-FPL-League-ID-Screenshot.png" alt="Finding League ID" class="img-fluid rounded border border-secondary shadow-sm" onerror="this.style.display='none'">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
    const m = new bootstrap.Modal(document.getElementById('fplOnboardingModal'));
    m.show();
}


document.addEventListener('DOMContentLoaded', () => {
    let inPagesDir = window.location.pathname.includes('/pages/');
    let assetPrefix = inPagesDir ? '../../' : '';
    
    
    
    // Slight delay to not interrupt initial rendering/fetching
    setTimeout(() => {
        const onboardingSeen = localStorage.getItem('fpl_onboarding_seen');
        const mId = _getCookieVal('managerId');
        
        if (!onboardingSeen && (!mId || mId === '0' || mId === '')) {
            showOnboardingModal(assetPrefix);
        }
    }, 1500);
});

// --- END ONBOARDING UX ---

