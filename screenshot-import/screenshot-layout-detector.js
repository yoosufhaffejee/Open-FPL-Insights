/**
 * Open-FPL-Insights Screenshot Importer
 * Screenshot Layout Detector
 */

class ScreenshotLayoutDetector {
    detect(imageWidth, imageHeight) {
        const aspectRatio = imageHeight / imageWidth;

        // FPL mobile screenshots are usually tall (e.g., 16:9, 19.5:9 portrait)
        if (aspectRatio > 1.2) {
            return {
                supported: true,
                layout: 'fpl-mobile-pitch',
                confidence: 0.9
            };
        }
        
        // Desktop or other layouts
        if (aspectRatio < 1.0) {
            return {
                supported: true, // We'll try our best
                layout: 'fpl-desktop-pitch',
                confidence: 0.5
            };
        }

        return {
            supported: false,
            reason: 'unsupported-layout'
        };
    }
}
