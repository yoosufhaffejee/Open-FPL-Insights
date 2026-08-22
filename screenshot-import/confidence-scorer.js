/**
 * Open-FPL-Insights Screenshot Importer
 * Confidence Scorer
 */

class ConfidenceScorer {
    constructor() {
        this.THRESHOLDS = {
            AUTOMATIC: 0.90,
            NEEDS_REVIEW: 0.75
        };
    }

    score(matcherCandidates, ocrConfidence) {
        if (!matcherCandidates || matcherCandidates.length === 0) {
            return { status: 'unresolved', finalCandidate: null };
        }

        const topCandidate = matcherCandidates[0];
        let finalScore = topCandidate.score;
        
        // Adjust final score slightly based on OCR confidence if it's exceptionally low
        if (ocrConfidence < 50) { 
            finalScore -= 0.1;
        }

        let status = 'unresolved';
        if (finalScore >= this.THRESHOLDS.AUTOMATIC) {
            status = 'automatic';
        } else if (finalScore >= this.THRESHOLDS.NEEDS_REVIEW) {
            status = 'needs-review';
        }

        return {
            status: status,
            confidence: finalScore,
            finalCandidate: topCandidate,
            alternatives: matcherCandidates.slice(1)
        };
    }
}
