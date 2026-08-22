/**
 * Open-FPL-Insights Screenshot Importer
 * Tesseract.js OCR Engine
 */

class TesseractOcrEngine extends ScreenshotOcrEngine {
    constructor() {
        super();
        this.worker = null;
    }

    async initialize() {
        if (!window.Tesseract) {
            // Load Tesseract.js dynamically if not present
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
                document.head.appendChild(script);
            });
        }

        this.worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {} // console.log(m) for debugging
        });
        
        // Optimize for single line / small text snippets
        await this.worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
            tessedit_char_whitelist: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ -'"
        });
    }

    async recognize(canvas) {
        if (!this.worker) {
            throw new Error("Worker not initialized");
        }
        
        const result = await this.worker.recognize(canvas);
        return {
            text: result.data.text.trim(),
            confidence: result.data.confidence
        };
    }

    async dispose() {
        if (this.worker) {
            await this.worker.terminate();
            this.worker = null;
        }
    }
}
