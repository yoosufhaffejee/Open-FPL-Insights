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
function playerImgOnerror(el, teamCode) {
    if (!el.dataset.triedShirt) {
        el.dataset.triedShirt = '1';
        el.src = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-110.webp`;
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

function addHelpNavButton(assetPrefix) {
    // Attempt to add a Help button to the navbar if it exists
    const navUl = document.querySelector('.navbar-nav');
    if (navUl && !document.getElementById('nav-help-btn')) {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.id = 'nav-help-btn';
        li.innerHTML = `<a class="nav-link text-warning" href="#" onclick="showOnboardingModal('${assetPrefix}', true)"><i class="fas fa-question-circle"></i> Help & Setup</a>`;
        navUl.appendChild(li);
    }
}

function showOnboardingModal(assetPrefix, force = false) {
    if (document.getElementById('fplOnboardingModal')) {
        let m = new bootstrap.Modal(document.getElementById('fplOnboardingModal'));
        m.show();
        return;
    }

    const modalHtml = `
    <div class="modal fade" id="fplOnboardingModal" tabindex="-1" aria-labelledby="fplOnboardingModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content bg-dark text-white border-secondary">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title fw-bold text-success" id="fplOnboardingModalLabel"><i class="fas fa-rocket me-2"></i>Welcome to Open FPL Insights!</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close" onclick="dismissOnboarding()"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-4">To get the most out of our powerful tools (like the live manager tracker and the multi-week planner), you'll need to know your <strong>FPL Team ID</strong> or <strong>League ID</strong>. Here is a quick guide on how to find them.</p>
                    
                    <ul class="nav nav-pills mb-3" id="onboarding-pills-tab" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="pills-team-id-tab" data-bs-toggle="pill" data-bs-target="#pills-team-id" type="button" role="tab">Your Team ID</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="pills-friend-id-tab" data-bs-toggle="pill" data-bs-target="#pills-friend-id" type="button" role="tab">Friend's Team ID</button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="pills-league-id-tab" data-bs-toggle="pill" data-bs-target="#pills-league-id" type="button" role="tab">League ID</button>
                        </li>
                    </ul>
                    
                    <div class="tab-content border border-secondary rounded p-3 bg-black" id="onboarding-pills-tabContent">
                        <div class="tab-pane fade show active" id="pills-team-id" role="tabpanel">
                            <h6 class="text-warning mb-3">Finding Your Team / Player ID</h6>
                            <ol class="mb-3">
                                <li>Go to the Fantasy Premier League site and log in.</li>
                                <li>Click on the <strong>Pick Team</strong> or <strong>Points</strong> tab.</li>
                                <li>Click on <strong>Gameweek History</strong> (or Transfer History).</li>
                                <li>Look at the address bar URL at the top of your browser.</li>
                                <li>Copy the number that appears right after <code>/entry/</code> (e.g., if it says <code>.../entry/123456/...</code>, your ID is <strong>123456</strong>).</li>
                            </ol>
                            <img src="${assetPrefix}assets/How-To-Find-FPL-ID-Screenshot.png" class="img-fluid rounded border border-secondary mb-3" alt="How to find FPL ID" onerror="this.style.display='none'">
                            <div class="ratio ratio-16x9">
                                <iframe src="https://www.youtube.com/embed/t21mrr34vnk?start=4" title="YouTube video" allowfullscreen></iframe>
                            </div>
                        </div>
                        
                        <div class="tab-pane fade" id="pills-friend-id" role="tabpanel">
                            <h6 class="text-warning mb-3">Finding a Friend's Team ID</h6>
                            <ol class="mb-3">
                                <li>Log in and click on the <strong>Leagues & Cups</strong> tab.</li>
                                <li>Open any mini-league that your friend belongs to.</li>
                                <li>Click on your friend's team name in the standings list.</li>
                                <li>Extract their team ID from the URL number right after <code>/entry/</code>.</li>
                            </ol>
                        </div>
                        
                        <div class="tab-pane fade" id="pills-league-id" role="tabpanel">
                            <h6 class="text-warning mb-3">Finding a League ID</h6>
                            <ol class="mb-3">
                                <li>Go to the <strong>Leagues & Cups</strong> tab on the FPL website.</li>
                                <li>Click on the specific mini-league you want the ID for.</li>
                                <li>Check your browser's address bar URL; the league ID is the unique number shown after <code>/leagues/</code> (alternatively, private league codes/IDs are listed in the league details section on your screen).</li>
                            </ol>
                            <img src="${assetPrefix}assets/How-To-Find-FPL-League-ID-Screenshot.png" class="img-fluid rounded border border-secondary" alt="How to find FPL League ID" onerror="this.style.display='none'">
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-secondary">
                    <button type="button" class="btn btn-success" data-bs-dismiss="modal" onclick="dismissOnboarding()">Got it, let's go!</button>
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    let m = new bootstrap.Modal(document.getElementById('fplOnboardingModal'));
    m.show();
}

window.dismissOnboarding = function() {
    localStorage.setItem('fpl_onboarding_seen', 'true');
}

document.addEventListener('DOMContentLoaded', () => {
    let inPagesDir = window.location.pathname.includes('/pages/');
    let assetPrefix = inPagesDir ? '../../' : '';
    
    addHelpNavButton(assetPrefix);
    
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

