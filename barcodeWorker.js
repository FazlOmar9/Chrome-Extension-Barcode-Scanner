// Simple barcode detection worker without external libraries
self.onmessage = function (e) {
  // Accept both {dataUrl} and {imageData} for flexibility
  const { dataUrl, imageData } = e.data;

  // If imageData is provided directly, skip image loading
  if (imageData && imageData.data && imageData.width && imageData.height) {
    try {
      const result = detectBarcodePattern(imageData);
      self.postMessage({ type: 'RESULT', data: result });
    } catch (error) {
      self.postMessage({ type: 'RESULT', data: 'Error processing imageData' });
    }
    return;
  }

  if (
    !dataUrl ||
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith('data:image')
  ) {
    self.postMessage({ type: 'RESULT', data: 'No image data provided' });
    return;
  }

  try {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function () {
      try {
        if (!img.width || !img.height) {
          self.postMessage({
            type: 'RESULT',
            data: 'Image has invalid dimensions',
          });
          return;
        }
        let canvas, ctx;
        // OffscreenCanvas is not supported in all browsers/workers
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(img.width, img.height);
          ctx = canvas.getContext('2d');
        } else {
          // fallback for environments without OffscreenCanvas
          const temp = self.document
            ? self.document.createElement('canvas')
            : null;
          if (!temp) {
            self.postMessage({ type: 'RESULT', data: 'Canvas not supported' });
            return;
          }
          temp.width = img.width;
          temp.height = img.height;
          ctx = temp.getContext('2d');
          canvas = temp;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const result = detectBarcodePattern(imageData);
        self.postMessage({ type: 'RESULT', data: result });
      } catch (error) {
        self.postMessage({ type: 'RESULT', data: 'Error processing image' });
      }
    };
    img.onerror = function () {
      self.postMessage({ type: 'RESULT', data: 'Error loading image' });
    };
    img.src = dataUrl;
  } catch (error) {
    self.postMessage({ type: 'RESULT', data: 'Worker error' });
  }
};

function detectBarcodePattern(imageData) {
  const { data, width, height } = imageData;

  // Simple pattern detection - look for alternating dark/light patterns
  // This is a basic implementation - in a real app you'd use proper barcode libraries

  let barcodeFound = false;
  let sampleLines = 0;
  const requiredLines = Math.min(10, height / 4);

  // Sample horizontal lines looking for barcode patterns
  for (
    let y = Math.floor(height * 0.3);
    y < Math.floor(height * 0.7);
    y += Math.floor(height / 20)
  ) {
    if (sampleLines >= requiredLines) break;

    const linePattern = [];
    let currentState = null;
    let stateLength = 0;

    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      // Convert to grayscale and determine if dark or light
      const gray = (r + g + b) / 3;
      const isDark = gray < 128;

      if (currentState === null) {
        currentState = isDark;
        stateLength = 1;
      } else if (currentState === isDark) {
        stateLength++;
      } else {
        linePattern.push(stateLength);
        currentState = isDark;
        stateLength = 1;
      }
    }

    if (stateLength > 0) {
      linePattern.push(stateLength);
    }

    // Check if this line has barcode-like patterns
    if (linePattern.length >= 10 && hasValidBarcodePattern(linePattern)) {
      barcodeFound = true;
      sampleLines++;
    }
  }

  if (barcodeFound && sampleLines >= 3) {
    return `Barcode detected (${width}x${height} region)`;
  } else {
    return 'No barcode pattern found';
  }
}

function hasValidBarcodePattern(pattern) {
  // Check for alternating pattern characteristic of barcodes
  if (pattern.length < 10) return false;

  // Calculate ratios between adjacent bars
  const ratios = [];
  for (let i = 1; i < pattern.length; i++) {
    const ratio = pattern[i] / pattern[i - 1];
    ratios.push(ratio);
  }

  // Look for reasonable variation in bar widths (characteristic of barcodes)
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);

  // Barcodes typically have ratios between 1:1 and 4:1
  return minRatio > 0.25 && maxRatio < 4 && ratios.length >= 8;
}
