/**
 * Open-FPL-Insights Screenshot Importer
 * Player Card Detector
 */

class PlayerCardDetector {
    constructor() {}

    findPitchBounds(canvas, width, height) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const step = 5; // Sample every 5th pixel for speed
        const imgData = ctx.getImageData(0, 0, width, height).data;
        
        let minX = width, minY = height, maxX = 0, maxY = 0;
        let foundGreen = false;

        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const i = (y * width + x) * 4;
                const r = imgData[i];
                const g = imgData[i+1];
                const b = imgData[i+2];
                
                // Very lenient pitch green heuristic
                if (g > 60 && g > r * 1.15 && g > b * 1.15) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                    foundGreen = true;
                }
            }
        }

        if (!foundGreen) {
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
        } else if (layout === 'fpl-desktop-pitch') {
            pitchX = imageWidth * 0.38;
            pitchWidth = imageWidth * 0.57;
        }

        const nameWidthPct = 0.25; 
        const nameHeightPct = 0.07;
        
        const rows = [
            { name: 'GK',  y: 0.16, counts: [1], type: 1 },
            { name: 'DEF', y: 0.34, counts: [3, 4, 5], type: 2 },
            { name: 'MID', y: 0.52, counts: [2, 3, 4, 5], type: 3 },
            { name: 'FWD', y: 0.70, counts: [1, 2, 3], type: 4 },
            { name: 'BENCH', y: 0.90, counts: [4], type: null }
        ];

        let slotIndex = 0;

        for (const row of rows) {
            for (const count of row.counts) {
                const spacing = 1.0 / (count + 1);
                for (let i = 1; i <= count; i++) {
                    const xCenter = spacing * i;
                    
                    const boxX = pitchX + Math.max(0, (xCenter - (nameWidthPct / 2)) * pitchWidth);
                    const boxY = pitchY + (row.y * pitchHeight);
                    
                    regions.push({
                        slotIndex: slotIndex++,
                        rowName: row.name,
                        expectedPosition: row.type, 
                        bounds: {
                            x: boxX,
                            y: boxY,
                            width: Math.min(pitchWidth, nameWidthPct * pitchWidth),
                            height: Math.min(pitchHeight, nameHeightPct * pitchHeight)
                        }
                    });
                }
            }
        }

        return regions;
    }
}
