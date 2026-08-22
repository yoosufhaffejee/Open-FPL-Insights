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
            .replace(/[^\w\sÀ-ÿ'-]/g, '') // Remove most punctuation except hyphens/apostrophes and letters
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

        for (const player of this.players) {
            const normalizedWebName = this.normalizeText(player.web_name);
            const normalizedFirstName = this.normalizeText(player.first_name);
            const normalizedSecondName = this.normalizeText(player.second_name);
            const normalizedFullName = `${normalizedFirstName} ${normalizedSecondName}`;

            let score = 0;

            // 1. Exact match (highly favored)
            if (normalizedWebName === normalizedOcr || normalizedFullName === normalizedOcr) {
                score = 1.0;
            } else if (normalizedSecondName === normalizedOcr) {
                score = 0.95;
            } else {
                // 2. Fuzzy match
                const webNameSim = this.similarity(normalizedOcr, normalizedWebName);
                const fullNameSim = this.similarity(normalizedOcr, normalizedFullName);
                const secondNameSim = this.similarity(normalizedOcr, normalizedSecondName);

                score = Math.max(webNameSim, fullNameSim, secondNameSim);
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

        // Sort by highest score
        candidates.sort((a, b) => b.score - a.score);

        return candidates.slice(0, 3); // Return top 3
    }
}
