# Open-FPL-Insights Screenshot Importer

## Overview
This feature allows users to import their FPL teams entirely client-side using OCR (Tesseract.js). It runs in the browser, extracting player names from standard FPL pitch screenshots and fuzzy-matching them to the application's Canonical player dataset.

## Architecture
1. **ScreenshotImporter**: Orchestrates the UI and Worker.
2. **ScreenshotWorker**: Web Worker that performs layout detection, image processing, and OCR.
3. **PlayerCardDetector**: Extracts crops based on standard FPL pitch layouts.
4. **ImagePreprocessor**: Converts the image crops to black-and-white to enhance OCR reliability.
5. **Tesseract.js**: The chosen OCR engine. We initialize it in the worker and keep it alive for the entire 15-player scan.
6. **PlayerMatcher**: Custom string-matching logic optimized for FPL names, ignoring accents and using Levenshtein distance.

## Privacy
- The screenshot never leaves the browser.
- No analytics telemetry regarding the screenshot is uploaded.
- Completely compatible with static hosting (GitHub Pages).

## Development and Benchmarking
To test the OCR matching offline:
1. Open `tests/screenshot-import/index.html` in your browser.
2. Verify that fuzzy typos ("Fernades", "Szoboslai") correctly resolve.

## Adding new screenshot layouts
To support Squad view or other languages, edit `screenshot-layout-detector.js` to detect the layout, and add a mapping configuration in `player-card-detector.js` that maps out the bounding boxes of the player names.
