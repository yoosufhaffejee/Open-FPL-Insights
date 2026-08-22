/**
 * Open-FPL-Insights Screenshot Importer
 * Player Matcher
 */

class PlayerMatcher {
    constructor(players, teams) {
        this.players = players;
        this.teams = teams;
    }

    normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\u00C0-\u00FF'-]/g, '') // Remove most punctuation except hyphens/apostrophes and letters
            .replace(/[']/g, '') // Remove apostrophes
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
    }

    // Basic Levenshtein distance
    levenshtein(a, b) {
        const matrix = [];

        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1) // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    similarity(s1, s2) {
        let longer = s1;
        let shorter = s2;
        if (s1.length < s2.length) {
            longer = s2;
            shorter = s1;
        }
        const longerLength = longer.length;
        if (longerLength === 0) {
            return 1.0;
        }
        return (longerLength - this.levenshtein(longer, shorter)) / parseFloat(longerLength);
    }

    match(ocrText, position = null, team = null) {
        const normalizedOcr = this.normalizeText(ocrText);
        if (!normalizedOcr || normalizedOcr.length < 2) return [];

        const candidates = [];
        const ocrWords = normalizedOcr.split(/\s+/);

        for (const player of this.players) {
            const normalizedWebName = this.normalizeText(player.web_name);
            const normalizedFirstName = this.normalizeText(player.first_name);
            const normalizedSecondName = this.normalizeText(player.second_name);
            const normalizedFullName = `${normalizedFirstName} ${normalizedSecondName}`;

            let score = 0;

            const paddedOcr = ` ${normalizedOcr} `;
            const paddedWebName = ` ${normalizedWebName} `;
            const paddedSecondName = ` ${normalizedSecondName} `;

            // 1. Exact Match or Perfect Substring Match
            if (normalizedWebName === normalizedOcr || normalizedFullName === normalizedOcr) {
                score = 1.0;
            } else if (paddedOcr.includes(paddedWebName) || paddedOcr.includes(` ${normalizedFullName} `)) {
                score = 1.0;
            } else if (normalizedSecondName.length > 3 && paddedOcr.includes(paddedSecondName)) {
                score = 0.95;
            } else {
                // 2. Fuzzy match against individual words to ignore garbage text
                let bestSim = 0;
                
                for (const word of ocrWords) {
                    if (word.length < 3) continue;
                    bestSim = Math.max(bestSim, this.similarity(word, normalizedWebName));
                    if (normalizedSecondName.length > 3) {
                        bestSim = Math.max(bestSim, this.similarity(word, normalizedSecondName));
                    }
                }
                
                for (let i = 0; i < ocrWords.length - 1; i++) {
                    const pair = `${ocrWords[i]} ${ocrWords[i+1]}`;
                    bestSim = Math.max(bestSim, this.similarity(pair, normalizedWebName));
                    bestSim = Math.max(bestSim, this.similarity(pair, normalizedFullName));
                }

                score = bestSim;
            }

            // 3. Apply position/team constraints (bonuses/penalties)
            if (position && player.element_type === position) {
                score += 0.05; // small bump for correct position
            } else if (position) {
                score -= 0.1; // penalty for wrong position
            }

            candidates.push({
                playerId: player.id,
                player: player,
                playerName: player.web_name,
                score: Math.min(1.0, score) // clamp to 1.0
            });
        }

        // Sort by highest score, then break ties using ownership popularity
        candidates.sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            const aSelected = parseFloat(a.player.selected_by_percent || "0");
            const bSelected = parseFloat(b.player.selected_by_percent || "0");
            return bSelected - aSelected;
        });

        return candidates.slice(0, 3); // Return top 3
    }
}
