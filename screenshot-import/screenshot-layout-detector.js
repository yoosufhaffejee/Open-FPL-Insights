/**
 * Open-FPL-Insights Screenshot Importer
 * Screenshot Layout Detector
 */

class ScreenshotLayoutDetector {
    detect(imageWidth, imageHeight) {
        const aspectRatio = imageHeight / imageWidth;

        // FPL mobile screenshots are usually tall (e.g., 16:9, 19.5:9 portrait)
        if (aspectRatio >= 1.0) {
            return {
                supported: true,
                layout: 'fpl-mobile-pitch',
                confidence: 0.9
            };
        }
        
        // Desktop or other wider layouts
        if (aspectRatio < 1.0) {
            return {
                supported: true,
                layout: 'fpl-desktop-pitch',
                confidence: 0.8
            };
        }

        // Catch-all (should never reach here since everything is >= 1.0 or < 1.0, but good for safety)
        return {
            supported: true,
            layout: 'fpl-mobile-pitch',
            confidence: 0.5
        };
    }
}
