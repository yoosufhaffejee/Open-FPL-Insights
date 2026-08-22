/**
 * Open-FPL-Insights Screenshot Importer
 * Player Card Detector
 */

class PlayerCardDetector {
    constructor() {}

    findPitchBounds(canvas, width, height) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const step = 5; 
        const imgData = ctx.getImageData(0, 0, width, height).data;
        
        let minX = width, minY = height, maxX = 0, maxY = 0;
        
        // Arrays to count green pixels per row and column
        const rowCounts = new Int32Array(height);
        const colCounts = new Int32Array(width);
        
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const i = (y * width + x) * 4;
                const r = imgData[i];
                const g = imgData[i+1];
                const b = imgData[i+2];
                
                // Lenient pitch green heuristic
                if (g > 60 && g > r * 1.15 && g > b * 1.15) {
                    rowCounts[y]++;
                    colCounts[x]++;
                }
            }
        }
        
        // Find bounds by requiring a minimum threshold of green pixels
        // The pitch is large, so at least 5% of the dimension should be green in a valid pitch row/col
        const xThreshold = (height / step) * 0.05;
        const yThreshold = (width / step) * 0.05;

        for (let x = 0; x < width; x += step) {
            if (colCounts[x] > xThreshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
            }
        }
        
        for (let y = 0; y < height; y += step) {
            if (rowCounts[y] > yThreshold) {
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX <= minX || maxY <= minY) {
            // Fallback
            return { x: 0, y: 0, width: width, height: height };
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    getExpectedRegions(layout, imageWidth, imageHeight, sourceCanvas = null) {
        const regions = [];
        
        let pitchX = 0;
        let pitchY = 0;
        let pitchWidth = imageWidth;
        let pitchHeight = imageHeight;

        if (sourceCanvas) {
            const bounds = this.findPitchBounds(sourceCanvas, imageWidth, imageHeight);
            pitchX = bounds.x;
            pitchY = bounds.y;
            pitchWidth = bounds.width;
            pitchHeight = bounds.height;
        }

        // Now we calculate everything relative to the GREEN pitch area!
        // FPL uses two completely different responsive layouts:
        // 1. Mobile (Tall): The Substitutes box is an overlay INSIDE the green pitch.
        // 2. Desktop (Wide): The Substitutes box is appended BELOW the green pitch on the purple background.
        
        const isMobilePitch = (pitchHeight / pitchWidth) > 1.1;

        const nameWidthPct = 0.22; 
        const nameHeightPct = 0.08; 
        
        let rows;
        if (isMobilePitch) {
            rows = [
                { name: 'GK',  y: 0.16, counts: [1], type: 1 },
                { name: 'DEF', y: 0.34, counts: [3, 4, 5], type: 2 },
                { name: 'MID', y: 0.53, counts: [2, 3, 4, 5], type: 3 },
                { name: 'FWD', y: 0.72, counts: [1, 2, 3], type: 4 },
                { name: 'BENCH', y: 0.90, counts: [4], type: null }
            ];
        } else {
            rows = [
                { name: 'GK',  y: 0.21, counts: [1], type: 1 },
                { name: 'DEF', y: 0.46, counts: [3, 4, 5], type: 2 },
                { name: 'MID', y: 0.71, counts: [2, 3, 4, 5], type: 3 },
                { name: 'FWD', y: 0.94, counts: [1, 2, 3], type: 4 },
                { name: 'BENCH', y: 1.22, counts: [4], type: null }
            ];
        }

        let slotIndex = 0;

        for (const row of rows) {
            for (const count of row.counts) {
                const spacing = 1.0 / (count + 1);
                for (let i = 1; i <= count; i++) {
                    const xCenter = spacing * i;
                    
                    const boxX = pitchX + (xCenter - (nameWidthPct / 2)) * pitchWidth;
                    const boxY = pitchY + (row.y * pitchHeight);
                    
                    const boxWidth = nameWidthPct * pitchWidth;
                    const boxHeight = nameHeightPct * pitchHeight;

                    // Clamp bounds to image dimensions so we don't error out on cropped edges
                    const clampedX = Math.max(0, Math.min(boxX, imageWidth - 1));
                    const clampedY = Math.max(0, Math.min(boxY, imageHeight - 1));
                    const clampedWidth = Math.min(boxWidth - (clampedX - boxX), imageWidth - clampedX);
                    const clampedHeight = Math.min(boxHeight - (clampedY - boxY), imageHeight - clampedY);

                    if (clampedWidth > 5 && clampedHeight > 5) { // Ensure area is large enough to OCR
                        regions.push({
                            slotIndex: slotIndex++,
                            rowName: row.name,
                            expectedPosition: row.type, 
                            bounds: {
                                x: clampedX,
                                y: clampedY,
                                width: clampedWidth,
                                height: clampedHeight
                            }
                        });
                    }
                }
            }
        }

        return regions;
    }
}
