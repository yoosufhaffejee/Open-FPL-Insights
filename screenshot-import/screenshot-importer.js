/**
 * Open-FPL-Insights Screenshot Importer
 * Main Orchestrator
 */

class ScreenshotImporter {
    constructor(players, teams) {
        this.players = players;
        this.teams = teams;
        
        this.layoutDetector = new ScreenshotLayoutDetector();
        this.matcher = new PlayerMatcher(players, teams);
        this.confidenceScorer = new ConfidenceScorer();
        
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
            
            const layoutCheck = this.layoutDetector.detect(imageBitmap.width, imageBitmap.height);
            if (!layoutCheck.supported) {
                throw new Error("We couldn't recognise this as an FPL team screenshot. Please upload a screenshot of your Fantasy Team page.");
            }

            // Start worker
            if (this.worker) {
                this.worker.postMessage({ type: 'dispose' });
            }
            
            this.worker = new Worker('screenshot-import/screenshot-worker.js');
            
            this.worker.onmessage = (e) => {
                const { type, payload, message, progress, results, error } = e.data;
                
                if (type === 'progress') {
                    if (this.onProgress) this.onProgress({ message, progress });
                } else if (type === 'complete') {
                    this.handleWorkerComplete(results);
                } else if (type === 'error') {
                    if (this.onError) this.onError(new Error(error));
                }
            };
            
            // Catch synchronous worker errors (e.g. OffscreenCanvas not defined on iOS < 16.4)
            this.worker.onerror = (error) => {
                if (this.onError) this.onError(new Error("Worker failed to start. Your browser might not support OffscreenCanvas."));
            };
            
            // Transfer imageBitmap to worker
            this.worker.postMessage({
                type: 'process',
                payload: { imageBitmap, layout: layoutCheck.layout }
            }, [imageBitmap]);

        } catch (error) {
            if (this.onError) this.onError(error);
        }
    }

    handleWorkerComplete(ocrResults) {
        if (this.onProgress) this.onProgress({ message: 'Matching players...', progress: 95 });

        console.log("Worker returned OCR results:", ocrResults);

        const finalResults = [];

        for (const result of ocrResults) {
            let bestCandidates = [];
            let bestConfidence = 0;
            let ocrConf = 0;
            let bestRawText = "";
            
            for (const variant of result.variants) {
                if (!variant.text || variant.text.length < 2) continue;
                
                const candidates = this.matcher.match(variant.text, result.position);
                if (candidates.length > 0 && candidates[0].score > bestConfidence) {
                    bestConfidence = candidates[0].score;
                    bestCandidates = candidates;
                    ocrConf = variant.confidence;
                    bestRawText = variant.text;
                }
            }
            
            if (bestCandidates.length > 0) {
                const scoreResult = this.confidenceScorer.score(bestCandidates, ocrConf);
                
                finalResults.push({
                    slotIndex: result.slotIndex,
                    rowName: result.rowName,
                    position: result.position,
                    rawText: bestRawText,
                    match: scoreResult
                });
            }
        }
        
        console.log("Final matched results:", finalResults);

        // Filter out unresolved or low-confidence matches before deduplication
        const validResults = finalResults.filter(r => r.match.status !== 'unresolved' && r.match.confidence > 0.4);

        // Deduplicate globally: If multiple crops found the same player (due to overlapping formation scanning), keep the highest confidence one.
        const playerMap = new Map();
        for (const res of validResults) {
            const pid = res.match.finalCandidate.playerId;
            if (!playerMap.has(pid) || playerMap.get(pid).match.confidence < res.match.confidence) {
                playerMap.set(pid, res);
            }
        }

        const uniqueResults = Array.from(playerMap.values());
        
        console.log("Unique results after deduplication:", uniqueResults);

        if (this.onProgress) this.onProgress({ message: 'Complete', progress: 100 });
        if (this.onComplete) this.onComplete(uniqueResults);
    }
    
    cancel() {
        if (this.worker) {
            this.worker.postMessage({ type: 'dispose' });
            this.worker = null;
        }
    }
}
