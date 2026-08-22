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
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
        // Include common accented characters
        tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -'áéíóúÁÉÍÓÚñÑçÇâêîôûäëïöüãõ"
    });
}

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'process') {
        try {
            await initializeOcr();
            
            self.postMessage({ type: 'progress', message: 'Reading full screenshot...', progress: 30 });
            
            const imageBitmap = payload.imageBitmap;
            const width = imageBitmap.width;
            const height = imageBitmap.height;
            
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0);

            // 1. Run Tesseract on the ENTIRE image
            // We use PSM.AUTO (default) or PSM.SPARSE_TEXT to find all text scattered around
            await ocrWorker.setParameters({
                tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT
            });
            
            const ocrResult = await ocrWorker.recognize(canvas);
            self.postMessage({ type: 'progress', message: 'Matching players...', progress: 85 });
            
            // 2. Extract all words with their Y-coordinates
            const words = ocrResult.data.words || [];
            
            // We will pass the raw words back to the main thread, and the main thread 
            // can use PlayerMatcher to find the players!
            // Wait, we can just do it right here in the worker if we have the players data.
            // But the worker doesn't have the full players list (it was passed to PlayerMatcher in main thread).
            // Actually, in the old architecture, the worker just passed raw OCR text back, and the main thread did the matching.
            
            // Group words into lines based on Y-coordinate proximity to handle two-word names
            const lines = [];
            for (const word of words) {
                // Find a line that this word belongs to
                const cy = (word.bbox.y0 + word.bbox.y1) / 2;
                let foundLine = false;
                for (const line of lines) {
                    if (Math.abs(line.y - cy) < 15) { // within 15 pixels vertically
                        line.words.push(word);
                        foundLine = true;
                        break;
                    }
                }
                if (!foundLine) {
                    lines.push({ y: cy, words: [word] });
                }
            }
            
            const rawTexts = [];
            for (const line of lines) {
                // Sort words left to right
                line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
                const text = line.words.map(w => w.text).join(' ');
                if (text.length > 2) {
                    rawTexts.push({
                        text: text,
                        y: line.y
                    });
                }
            }
            
            // Cleanup
            imageBitmap.close();
            
            self.postMessage({ type: 'complete', rawTexts });
            
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
