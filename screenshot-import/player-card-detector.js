/**
 * Open-FPL-Insights Screenshot Importer
 * Player Card Detector
 */

class PlayerCardDetector {
    constructor() {}

    getExpectedRegions(layout, imageWidth, imageHeight) {
        const regions = [];

        // FPL Mobile Pitch typical proportions
        // Row 1 (GK): ~10-20% Y
        // Row 2 (DEF): ~25-35% Y
        // Row 3 (MID): ~45-55% Y
        // Row 4 (FWD): ~65-75% Y
        // Row 5 (Bench): ~85-95% Y

        // We will define the maximum possible slots for each row.
        // The OCR will run on all, and we'll discard empty ones.
        
        // Name tag height is usually ~3-5% of image height
        // Name tag width is usually ~15-20% of image width
        
        const nameWidthPct = 0.18;
        const nameHeightPct = 0.04;
        
        const rows = [
            { name: 'GK',  y: 0.16, count: 1, type: 1 },
            { name: 'DEF', y: 0.32, count: 5, type: 2 },
            { name: 'MID', y: 0.53, count: 5, type: 3 },
            { name: 'FWD', y: 0.72, count: 3, type: 4 },
            { name: 'BENCH', y: 0.90, count: 4, type: null }
        ];

        let slotIndex = 0;

        for (const row of rows) {
            const spacing = 1.0 / (row.count + 1);
            for (let i = 1; i <= row.count; i++) {
                const xCenter = spacing * i;
                
                regions.push({
                    slotIndex: slotIndex++,
                    rowName: row.name,
                    expectedPosition: row.type, // 1=GK, 2=DEF, 3=MID, 4=FWD
                    bounds: {
                        x: Math.max(0, (xCenter - (nameWidthPct / 2)) * imageWidth),
                        y: row.y * imageHeight,
                        width: nameWidthPct * imageWidth,
                        height: nameHeightPct * imageHeight
                    }
                });
            }
        }

        return regions;
    }
}
