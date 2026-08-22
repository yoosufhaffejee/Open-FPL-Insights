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

    getExpectedRegions(layout, imageWidth, imageHeight, sourceCanvas) {
        const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, imageWidth, imageHeight).data;
        
        // 1. Find all Y-clusters (horizontal bands of white pixels representing name plates)
        const whiteRows = new Int32Array(imageHeight);
        
        for (let y = 0; y < imageHeight; y += 2) {
            for (let x = 0; x < imageWidth; x += 4) {
                const i = (y * imageWidth + x) * 4;
                const r = imgData[i];
                const g = imgData[i+1];
                const b = imgData[i+2];
                // FPL Name Plates are white (use >220 for compression artifacts)
                if (r > 220 && g > 220 && b > 220) {
                    whiteRows[y]++;
                }
            }
        }
        
        const yClusters = [];
        let currentY = null;
        
        // A single name plate spans ~15% of width. Since we step x by 4, max white is width/4.
        // We set a very low threshold (2%) to catch even a single name plate in a row.
        const minWhiteY = (imageWidth / 4) * 0.02; 
        
        for (let y = 0; y < imageHeight; y += 2) {
            if (whiteRows[y] > minWhiteY) {
                if (!currentY) currentY = { start: y, end: y };
                else currentY.end = y;
            } else {
                if (currentY) {
                    // Close cluster if gap is too large (allow tiny gaps)
                    if (y - currentY.end > (imageHeight * 0.01)) {
                        yClusters.push(currentY);
                        currentY = null;
                    }
                }
            }
        }
        if (currentY) yClusters.push(currentY);
        
        // Filter out thin lines (e.g. pitch lines, text artifacts)
        const minHeight = imageHeight * 0.015; 
        const validYClusters = yClusters.filter(c => (c.end - c.start) > minHeight);
        
        const regions = [];
        let slotIndex = 0;
        
        // For each detected row of name plates, we generate overlapping X-regions.
        // This covers every possible formation (1 to 5 players per row).
        const possibleCounts = [1, 2, 3, 4, 5];
        const nameWidthPct = 0.22; // Safe width for any device
        
        let yClusterIndex = 0;
        const rowLabels = ['GK', 'DEF', 'MID', 'FWD', 'BENCH'];
        
        for (const yC of validYClusters) {
            // Give Tesseract some breathing room (10px padding)
            const padding = 10;
            
            // Assign a nice UI label if we found exactly 5 rows
            let rowName = `Row ${yClusterIndex + 1}`;
            let expectedPosition = null;
            if (validYClusters.length === 5 && yClusterIndex < 5) {
                rowName = rowLabels[yClusterIndex];
                // FPL element_types: 1=GK, 2=DEF, 3=MID, 4=FWD
                if (yClusterIndex < 4) {
                    expectedPosition = yClusterIndex + 1; 
                }
            }
            
            // The white pixel cluster might include white shirts (like Spurs), making the box too tall.
            // The text (name plate) is always at the bottom of the player card.
            // We cap the height to the bottom 6% of the image height to isolate the text.
            const maxNamePlateHeight = imageHeight * 0.06;
            const actualStart = Math.max(yC.start, yC.end - maxNamePlateHeight);
            
            const bY = Math.max(0, Math.floor(actualStart - padding));
            const bH = Math.min(imageHeight - bY, Math.floor((yC.end - actualStart) + padding * 2));
            
            for (const count of possibleCounts) {
                const spacing = 1.0 / count;
                for (let i = 0; i < count; i++) {
                    const xCenter = (i + 0.5) * spacing;
                    const boxWidth = nameWidthPct * imageWidth;
                    const boxX = (xCenter * imageWidth) - (boxWidth / 2);
                    
                    const bX = Math.floor(Math.max(0, boxX));
                    const bW = Math.floor(Math.min(imageWidth - bX, boxWidth));
                    
                    if (bW > 20 && bH > 10) {
                        regions.push({
                            slotIndex: slotIndex++,
                            rowName: rowName,
                            expectedPosition: expectedPosition, 
                            bounds: {
                                x: bX,
                                y: bY,
                                width: bW,
                                height: bH
                            }
                        });
                    }
                }
            }
            yClusterIndex++;
        }
        
        return regions;
    }
}
