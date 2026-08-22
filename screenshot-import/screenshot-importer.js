class ScreenshotImporter {
    constructor(players, teams, playerMatcher, confidenceScorer, layoutDetector) {
        this.players = players;
        this.teams = teams;
        this.matcher = playerMatcher; 
        this.confidenceScorer = confidenceScorer;
        this.layoutDetector = layoutDetector;
        
        this.worker = null;
        
        // Listeners for UI
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
    }

    async processImage(file) {
        try {
            if (this.onProgress) this.onProgress({ message: 'Loading image...', progress: 5 });

            const imageBitmap = await createImageBitmap(file);
            
            // Start worker
            if (this.worker) {
                this.worker.postMessage({ type: 'dispose' });
            }
            
            this.worker = new Worker('screenshot-import/screenshot-worker.js');
            
            this.worker.onmessage = (e) => {
                const { type, payload, message, progress, rawTexts, error } = e.data;
                
                if (type === 'progress') {
                    if (this.onProgress) this.onProgress({ message, progress });
                } else if (type === 'complete') {
                    this.handleWorkerComplete(rawTexts);
                } else if (type === 'error') {
                    if (this.onError) this.onError(new Error(error));
                }
            };
            
            // Transfer imageBitmap to worker
            this.worker.postMessage({
                type: 'process',
                payload: { imageBitmap }
            }, [imageBitmap]);

        } catch (error) {
            if (this.onError) this.onError(error);
        }
    }

    handleWorkerComplete(rawTexts) {
        if (!this.matcher) {
            console.error("PlayerMatcher not initialized!");
            return;
        }

        if (!rawTexts) return;
        
        console.log("Raw OCR Texts:", rawTexts);
        
        const matchedPlayers = [];

        // 1. Match each line of text against the player database
        for (const line of rawTexts) {
            const candidates = this.matcher.match(line.text);
            
            if (candidates && candidates.length > 0) {
                const best = candidates[0];
                if (best.score > 0.75) {
                    matchedPlayers.push({
                        player: best.player,
                        confidence: best.score,
                        y: line.y,
                        originalText: line.text
                    });
                }
            }
        }
        
        // 2. Deduplicate
        const uniqueMap = new Map();
        for (const match of matchedPlayers) {
            const id = match.player.id;
            if (!uniqueMap.has(id) || uniqueMap.get(id).confidence < match.confidence) {
                uniqueMap.set(id, match);
            }
        }
        
        const uniquePlayers = Array.from(uniqueMap.values());
        uniquePlayers.sort((a, b) => a.y - b.y);
        
        console.log("Final Unique Players sorted by Y:", uniquePlayers);
        
        if (this.onComplete) {
            // Because we changed the return structure to be much simpler:
            // We just format it back to what the UI index.html expects
            const formattedResults = uniquePlayers.map((match, i) => {
                return {
                    region: { slotIndex: i, rowName: (i >= 11 ? 'BENCH' : 'PITCH') },
                    ocrText: match.originalText,
                    match: {
                        status: match.confidence > 0.9 ? 'automatic' : 'needs-review',
                        confidence: match.confidence,
                        finalCandidate: {
                            playerId: match.player.id,
                            player: match.player,
                            score: match.confidence
                        }
                    }
                };
            });
            this.onComplete(formattedResults);
        }
    }
    
    cancel() {
        if (this.worker) {
            this.worker.postMessage({ type: 'dispose' });
            this.worker = null;
        }
    }
}
