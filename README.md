# Open FPL Insights

Open FPL Insights is a feature-rich web application designed to help Fantasy Premier League (FPL) managers make data-driven decisions. It provides live data integration, advanced algorithms, multi-gameweek planning, manager comparisons, and deep statistical analysis — all built with vanilla HTML, CSS, and JavaScript.

## ⚠️ Note on `Angular Admin LTE`

The `Angular Admin LTE` folder is **not** the live version. It is a **Work In Progress** port aiming to migrate the app to an Angular-based architecture. The current functional application lives in the root directory and is built entirely with vanilla HTML/JS.

---

## Features

### 🏠 Main Dashboard (`index.html`)
The central hub of the application. Enter your FPL Manager ID to load your personal team and get started.

- **Pitch View**: Visual 11-man pitch layout with player cards showing names, predicted points, and kit images.
- **Squad Management**: Build and edit your full 15-man squad within your budget.
- **Auto-Pick**: Automatically select a full 15-man squad within budget, respecting position and club limits.
- **Auto-Pick Best 11**: From your squad, automatically determine the optimal starting formation and XI by predicted points.
- **Auto Captain**: Assigns the captaincy to the highest predicted-points player automatically.
- **Predicted Points**: Each player displays their algorithmically calculated predicted GW points.
- **Player Detail Modal**: Click any player to view:
  - Upcoming fixtures with FDR colour-coding
  - Historical performance (points, goals, assists, minutes, xG, xA per game)
  - Predicted points breakdown
  - Price change history & recent match stats
- **Transfer Modal**: Search and filter players by position, team, and price to make transfers.
- **Transfer Suggestions**: Algorithm-driven recommendations for the best transfers to improve your team.
- **Formation Selector**: Enforces legal FPL formations (e.g. 4-4-2, 4-3-3, 3-5-2).
- **Chip Simulation**: Toggle Wildcard / Free Hit modes to plan major squad overhauls.
- **Gameweek Selector**: Switch the active gameweek context throughout the app.
- **Save/Load Team**: Persist your built squad to local storage.
- **Budget Tracker**: Live remaining budget display as you build your team.

---

### 📅 Fixtures Page (`pages/fixtures/`)
Displays all Premier League fixtures for the season.

- Filter by gameweek or by team.
- Fixture difficulty colour-coding for quick visual assessment.
- Upcoming fixtures calendar view.

---

### 🌡️ FDR — Fixture Difficulty Rating (`pages/fdr/`)
A multi-gameweek fixture difficulty heatmap to help plan transfers and identify differentials.

- **Colour-coded Heatmap**: Green (easy) to red (hard) grid showing all 20 PL teams' upcoming schedules.
- **Gameweek Range Selector**: Control how many upcoming gameweeks to display.
- **FDR Score Sorting**: Sort teams by cumulative difficulty over the selected range.
- **Position Filter**: Switch between GK, DEF, MID, and FWD perspectives (attacking vs. defensive FDR).
- **Home/Away Indicator**: Each fixture cell shows H or A.

---

### 📊 Stats Page (`pages/stats/`)
Deep statistical analysis for every player in the Premier League.

- **Sortable, Filterable AgGrid Table** with a comprehensive set of columns including:
  - Goals, Assists, Clean Sheets, Bonus Points, BPS
  - Expected Goals (xG), Expected Assists (xA), xG/90, xA/90
  - Minutes played, Points, Points per game, Points per million
  - ICT Index (Influence, Creativity, Threat)
  - Price, Price change, Selected by %
- **Position & Team Filters**: Quickly narrow down to GK/DEF/MID/FWD and any specific club.
- **Price Range Filter**: Filter players by minimum and maximum price.
- **Column Grouping**: Stats organised into logical categories (attacking, defensive, value).
- **Historic Season Stats**: Toggle to view aggregated stats from previous seasons (sourced from local CSV data).
- **Export to CSV**: Download the current stats table.

---

### 🏆 Leagues Page (`pages/leagues/`)
View and explore FPL mini-leagues you're a member of.

- League standings table with rank, manager name, team name, GW points, and total points.
- Drill into any manager's team by clicking their name.
- Support for both Classic and Head-to-Head (H2H) leagues.
- Previous gameweek results display.

---

### 📡 Live Gameweek Page (`pages/live/`)
Real-time tracking of the current gameweek as matches are played.

- **Live Points**: Current score for each player in your squad, including provisional bonus points.
- **Provisional Bonus Points**: BPS-based provisional bonuses before official confirmation.
- **Live League Standings**: Real-time ranking movement within a selected mini-league.
- **Auto-Refresh**: Periodically polls for updated data during a live gameweek.

---

### 👥 Managers Page (`pages/managers/`)
A powerful multi-manager comparison and analysis tool.

- **Add Multiple Managers**: Input multiple FPL Manager IDs to compare side-by-side.
- **Manager Overview Table**: Rank, team name, manager name, GW score, total points, overall rank, and chips used.
- **Gameweek History Chart**: Line chart showing each manager's points per GW over the season.
- **Captaincy Analysis**: See every manager's captain picks and returns each week.
- **Transfer History**: View transfers made — players in/out, cost, and point impact.
- **Team Value Tracker**: Track how each manager's squad value and bank change over the season.
- **Chip Usage Timeline**: Visual display of when each manager used their Wildcard, Triple Captain, Bench Boost, and Free Hit.
- **Head-to-Head Comparison**: Direct GW-by-GW comparison between two selected managers.
- **Player Ownership Overlap**: Highlights players commonly held across multiple managers.
- **Differential Picks**: Identifies players held by only one (or a subset of) managers.
- **Screenshot Import Tool**: Import a screenshot of an FPL team from the official app and automatically parse it into the comparison tool.

---

### 🗓️ Transfer Planner (`pages/planner/`)
A multi-gameweek transfer planning tool to strategise ahead.

- **Multi-GW Planner**: Plan transfers across several upcoming gameweeks and see the predicted point impact of each move.
- **Chip Planning**: Schedule chip usage (Wildcard, Bench Boost, Triple Captain, Free Hit) across future gameweeks.
- **Squad State Projection**: See your projected 15-man squad for each planned gameweek.
- **Points Projection**: Cumulative predicted points across the planning horizon.
- **Transfer Hit Modelling**: Models −4 pt hits for extra transfers and calculates net gain.
- **Player Search & Replace**: Search for incoming players by position, team, and budget.
- **Undo/Redo**: Step through your planned transfer history.
- **Auto-Suggest Transfers**: Algorithm-driven suggestions for the best transfers to make.
- **Formation Preview**: Visualise the pitch view for each gameweek in your plan.
- **Bench Order Optimisation**: Configure bench priority for each planned gameweek.

---

### 🛠️ Tools Page (`pages/tools/`)
A collection of utility calculators and decision-support tools.

- **Differential Finder**: Identify low-ownership, high-value players compared to your mini-league rivals.
- **Value Analysis**: Players ranked by points per million cost.
- **Bench Boost Calculator**: Estimate expected points from your current bench to assess Bench Boost timing.
- **Triple Captain Calculator**: Simulate triple captain returns for candidate players given upcoming fixtures.
- **Hit Calculator**: Evaluate whether a −4 pt transfer hit is worth taking based on projected point gains.
- **Price Change Predictor**: Highlights players likely to rise or fall in price based on ownership and recent performance.
- **Ownership Analyser**: Shows % ownership of players across your mini-league.

---

## Algorithms

| Algorithm | File | Description |
|---|---|---|
| **Predicted Points** | `algorithms/predictPoints.js` | Calculates expected GW points using historical H2H data, xG, xA, form, opponent strength, home/away advantage, and clean sheet probability. Multiple engine versions available. |
| **Team Optimiser** | `algorithms/optimizeTeam.js` | Selects the best starting 11 and bench order from a 15-man squad, respecting formation constraints and maximising predicted points. |
| **Auto-Pick** | `algorithms/autoPick.js` | Automatically builds a full 15-man squad within budget, applying position and max 3-players-per-club constraints. |
| **Suggested Transfers** | `algorithms/suggestedTransfers.js` | Evaluates all possible single and double transfers, ranking by net predicted point gain after accounting for hit costs. |
| **Historic Stats** | `algorithms/historicStats.js` | Aggregates local historical CSV data and provides head-to-head team stats to power the predicted points engine with past-season context. |

---

## Project Structure

```
Open-FPL-Insights/
├── index.html                  # Main application entry point
├── script.js                   # Core UI logic and squad management
├── data.js                     # Global app state and data initialisation
├── style.css                   # Main stylesheet
├── api/
│   └── requests.js             # FPL API communication (via CORS proxy)
├── algorithms/
│   ├── predictPoints.js        # Predicted points engine
│   ├── optimizeTeam.js         # Starting 11 optimiser
│   ├── autoPick.js             # Auto-squad builder
│   ├── suggestedTransfers.js   # Transfer recommendation engine
│   └── historicStats.js        # Historical data processor
├── helpers/
│   └── helpers.js              # Shared utility functions
├── constants/                  # AgGrid column definitions and app-wide config
├── pages/
│   ├── fdr/                    # Fixture Difficulty Rating heatmap
│   ├── fixtures/               # Season fixture list
│   ├── leagues/                # Mini-league standings
│   ├── live/                   # Live gameweek tracker
│   ├── managers/               # Multi-manager comparison tool
│   ├── planner/                # Multi-GW transfer planner
│   ├── stats/                  # Player statistics explorer
│   └── tools/                  # Utility calculators
├── assets/                     # Images and icons
├── fpl_data.csv                # Local historical player data (multi-season)
├── fpl_data.sqlite             # SQLite version of historical data
└── master_team_list.csv        # Reference list of all historical PL clubs
```

---

## Technologies Used

- **HTML5, CSS3, Vanilla JavaScript** — Core structure, styling, and logic.
- **Bootstrap 5** — Responsive layout and UI components (modals, navbars, cards).
- **AgGrid** — High-performance data grids for player statistics and tabular data.
- **Chart.js** — Charts for manager history, team value tracking, and captaincy analysis.
- **FontAwesome** — Iconography throughout the UI.
- **Cloudflare Workers (CORS Proxy)** — Bypasses CORS restrictions when fetching live data from the official FPL API.
- **SQLite / CSV** — Local historical data storage for multi-season analysis.

---

## Setup / Installation

Since the stable version uses vanilla web technologies, running it locally is straightforward.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yoosufhaffejee/Open-FPL-Insights.git
   ```

2. **Navigate to the project directory:**
   ```bash
   cd Open-FPL-Insights
   ```

3. **Open in a browser** by either:
   - Simply opening `index.html` in your preferred browser, or
   - Serving it with a local dev server for best results:
     ```bash
     # Python
     python -m http.server 8000
     # Node (npx)
     npx serve .
     ```
   Then visit `http://localhost:8000`.

4. **Enter your FPL Manager ID** in the Settings panel on first load to pull your personal team data.

---

## Disclaimer

This project is an independent tool and is not affiliated with, associated with, or endorsed by the Fantasy Premier League or the English Premier League. All FPL data is sourced from the publicly available FPL API.
