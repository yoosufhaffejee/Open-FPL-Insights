// Open-FPL-Insights Screenshot Importer
// Screenshot Worker

self.importScripts(
    './player-card-detector.js',
    './image-preprocessor.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
);

let ocrWorker = null;
let cardDetector = new PlayerCardDetector();
let preprocessor = new ImagePreprocessor();

async function initializeOcr() {
    if (ocrWorker) return;
    
    self.postMessage({ type: 'progress', message: 'Loading OCR Engine...', progress: 10 });
    
    ocrWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => {} 
    });
    
    await ocrWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        // Include common accented characters
        tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -'áéíóúÁÉÍÓÚñÑçÇâêîôûäëïöüãõ"
    });
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'process') {
        try {
            await initializeOcr();
            
            self.postMessage({ type: 'progress', message: 'Detecting layout...', progress: 20 });
            
            const imageBitmap = payload.imageBitmap;
            const layout = payload.layout || 'fpl-mobile-pitch';
            const width = imageBitmap.width;
            const height = imageBitmap.height;
            
            // Draw to offscreen canvas to allow pixel manipulation
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);

            self.postMessage({ type: 'progress', message: 'Preparing player regions...', progress: 30 });
            const regions = cardDetector.getExpectedRegions(layout, width, height, canvas);
            
            const results = [];
            const totalRegions = regions.length;

            for (let i = 0; i < totalRegions; i++) {
                const region = regions[i];
                
                self.postMessage({ 
                    type: 'progress', 
                    message: `Reading players (${i + 1}/${totalRegions})...`, 
                    progress: 30 + Math.floor((i / totalRegions) * 50) 
                });

                // Convert bounds to actual pixels for the offscreen canvas
                const variants = await preprocessor.processRegion(canvas, region.bounds);
                
                const regionResults = [];

                for (const variant of variants) {
                    // Tesseract.js in Web Worker can accept OffscreenCanvas or ImageBitmap
                    // OffscreenCanvas is standard. Let's try recognizing the canvas.
                    
                    try {
                        const ocrResult = await ocrWorker.recognize(variant.canvas);
                        regionResults.push({
                            text: ocrResult.data.text.trim(),
                            confidence: ocrResult.data.confidence,
                            source: variant.name
                        });
                    } catch (ocrErr) {
                        console.error('OCR Error on variant', variant.name, ocrErr);
                    }
                }
                
                results.push({
                    slotIndex: region.slotIndex,
                    rowName: region.rowName,
                    position: region.expectedPosition,
                    variants: regionResults
                });
            }

            self.postMessage({ type: 'progress', message: 'Matching players...', progress: 85 });
            
            // Cleanup
            imageBitmap.close();
            
            self.postMessage({ type: 'complete', results });
            
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    } else if (type === 'dispose') {
        if (ocrWorker) {
            await ocrWorker.terminate();
            ocrWorker = null;
        }
        self.close();
    }
};
