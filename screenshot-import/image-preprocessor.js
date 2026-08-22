/**
 * Open-FPL-Insights Screenshot Importer
 * Image Preprocessor
 */

class ImagePreprocessor {
    constructor() {}

    createCanvas(width, height) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(width, height);
        }
        const c = document.createElement('canvas');
        c.width = width;
        c.height = height;
        return c;
    }

    /**
     * Extracts a crop from the source image and returns multiple preprocessed variants for OCR.
     */
    async processRegion(sourceCanvas, bounds) {
        const scale = 2;
        const width = Math.max(1, bounds.width * scale);
        const height = Math.max(1, bounds.height * scale);
        
        // Create a canvas for the crop
        const cropCanvas = this.createCanvas(width, height);
        const ctx = cropCanvas.getContext('2d', { willReadFrequently: true });
        
        // Draw the cropped region, scaled up
        ctx.drawImage(
            sourceCanvas,
            bounds.x, bounds.y, bounds.width, bounds.height, // Source
            0, 0, width, height        // Destination
        );

        const variants = [];

        // Variant A: Upscaled Original
        variants.push({
            name: 'original',
            canvas: this.cloneCanvas(cropCanvas)
        });

        // Variant B: Grayscale + Contrast/Threshold
        const thresholdCanvas = this.cloneCanvas(cropCanvas);
        this.applyThreshold(thresholdCanvas);
        variants.push({
            name: 'threshold',
            canvas: thresholdCanvas
        });

        return variants;
    }

    cloneCanvas(source) {
        const c = this.createCanvas(source.width, source.height);
        c.getContext('2d').drawImage(source, 0, 0);
        return c;
    }

    applyThreshold(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and apply high contrast threshold
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Standard luminance
            let v = (0.299 * r + 0.587 * g + 0.114 * b);
            
            // FPL name tags are usually dark text on light background or white on dark.
            // A simple threshold at 128 (middle gray) to force pure B&W
            // Invert if we detect it's a dark background? 
            // For now, just stark contrast
            v = v > 140 ? 255 : 0; 

            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
        }

        ctx.putImageData(imageData, 0, 0);
    }
}
