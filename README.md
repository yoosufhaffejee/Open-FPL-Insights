# Open FPL Insights

Open FPL Insights is a web application designed to help Fantasy Premier League (FPL) managers make data-driven decisions. It allows you to build, track, and optimize your FPL team using live data from the official FPL API along with historical data, providing advanced insights like predicted points and optimal team formations.

## Features

- **Live Data Integration**: Fetches real-time data such as gameweeks, fixtures, player stats, and league standings directly from the Fantasy Premier League API (using a CORS proxy).
- **Predicted Points Algorithm**: Calculates expected player points for upcoming fixtures based on historical performance against specific opponents, expected goals/assists per 90, clean sheets, opponent strength, and current form.
- **Team Management**: Build your 15-man squad within the budget, adhering to valid FPL formation rules.
- **Auto-Pick & Team Optimization**: Algorithms to automatically pick a valid team, determine the best starting 11 based on predicted points, and automatically assign the captaincy to maximize points.
- **Detailed Player Insights**: View upcoming fixtures, historical performance, recent matches, and underlying expected stats (xG, xA) for every player.
- **Live Gameweek Tracking**: View your real-time gameweek points and overall performance.
- **Historical Data Support**: Leverages local CSV files to provide deeper context based on past seasons and previous head-to-head match-ups.

## ⚠️ Important Note regarding `Angular Admin LTE`

Please note that the folder `Angular Admin LTE` is **not** the live version of the site available on GitHub Pages. It is currently a Work In Progress (WIP) port, aiming to migrate the vanilla HTML, CSS, and JavaScript implementation over to an Angular-based architecture.

The current functional web application is built entirely using vanilla HTML/JS and is located in the root directory.

## Technologies Used

- **HTML5, CSS3, Vanilla JavaScript**: Core structure, styling, and logic.
- **Bootstrap 5**: Responsive layout and UI components (modals, navbars, etc.).
- **AgGrid**: Powerful data grids for rendering complex player statistics and tabular data.
- **FontAwesome**: Iconography.
- **Cloudflare Workers (Proxy)**: Used to bypass CORS restrictions when fetching live data from the official FPL API.

## Setup / Installation

Since the current stable version is built with vanilla web technologies, running it locally is very straightforward.

1. Clone the repository:
   ```bash
   git clone https://github.com/yoosufhaffejee/Open-FPL-Insights.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Open-FPL-Insights
   ```
3. Open `index.html` in your preferred web browser, or serve it using a local development server (e.g., Live Server in VS Code, or Python's `http.server`):
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000` in your browser.

## Project Structure

- `index.html`: The main entry point of the application.
- `script.js` & `data.js`: Core logic for UI updates, filtering, and data initialization.
- `api/`: Contains `requests.js` for handling all communication with the FPL API.
- `algorithms/`: Includes the core logic for calculating predicted points (`predictPoints.js`), optimizing the team (`optimizeTeam.js`), and auto-picking players (`autoPick.js`).
- `assets/`: Image assets and icons.
- `constants/`: Configuration files (e.g., AgGrid setups).
- `pages/`: Additional HTML pages for specific views (e.g., Fixtures, Leagues).
- `Angular Admin LTE/`: The WIP Angular port.

## Disclaimer

This project is an independent tool and is not affiliated with, associated with, or endorsed by the Fantasy Premier League or the English Premier League.
