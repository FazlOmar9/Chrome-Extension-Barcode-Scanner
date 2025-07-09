// Barcode Scanner Content Script
(async () => {
  // Check if already injected
  if (document.getElementById('barcode-selection-box')) {
    console.log('Barcode scanner already active');
    return;
  }

  console.log('Initializing barcode scanner...');

  // Create selection box
  const selectionBox = document.createElement('div');
  selectionBox.id = 'barcode-selection-box';
  Object.assign(selectionBox.style, {
    position: 'fixed',
    border: '3px dashed #ff0000',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    zIndex: '999999',
    pointerEvents: 'none',
    display: 'none',
    boxShadow: '0 0 10px rgba(255, 0, 0, 0.5)',
  });
  document.body.appendChild(selectionBox);

  // Create instruction overlay
  const instructionOverlay = document.createElement('div');
  instructionOverlay.id = 'barcode-instructions';
  Object.assign(instructionOverlay.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '5px',
    zIndex: '1000000',
    fontFamily: 'Arial, sans-serif',
    fontSize: '14px',
    pointerEvents: 'none',
  });
  instructionOverlay.textContent =
    'Click and drag to select barcode area. Press ESC to cancel.';
  document.body.appendChild(instructionOverlay);

  let isSelecting = false;
  let startX, startY;

  function startSelection(e) {
    if (e.button !== 0) return; // Only left click

    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;

    selectionBox.style.display = 'block';
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';

    document.body.style.cursor = 'crosshair';
    e.preventDefault();
  }

  function updateSelection(e) {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;

    e.preventDefault();
  }

  async function endSelection(e) {
    if (!isSelecting) return;

    isSelecting = false;
    document.body.style.cursor = '';

    const rect = selectionBox.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    console.log(`Selection area: ${width}x${height}`);

    if (width < 10 || height < 10) {
      alert('Please select a larger area (at least 10x10 pixels)');
      cleanup();
      return;
    }

    try {
      instructionOverlay.textContent = 'Processing...';

      // Capture the selected area
      await captureAndAnalyze(rect);
    } catch (error) {
      console.error('Error during capture:', error);
      alert('Error capturing the selected area. Please try again.');
    }

    cleanup();
    e.preventDefault();
  }

  async function captureAndAnalyze(rect) {
    try {
      // Request screen capture from background script using chrome.tabs.captureVisibleTab
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: 'CAPTURE_VISIBLE_TAB',
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.dataUrl) {
              resolve(response.dataUrl);
            } else {
              reject(new Error('Failed to capture screen'));
            }
          }
        );
      });

      // Create a canvas to work with the captured image
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      // Create a new canvas for the selected region
      const regionCanvas = document.createElement('canvas');
      const regionCtx = regionCanvas.getContext('2d');

      // Account for device pixel ratio
      const dpr = window.devicePixelRatio || 1;
      const scaledRect = {
        x: rect.left * dpr,
        y: rect.top * dpr,
        width: rect.width * dpr,
        height: rect.height * dpr,
      };

      regionCanvas.width = scaledRect.width;
      regionCanvas.height = scaledRect.height;

      // Draw the selected region from the captured screenshot
      regionCtx.drawImage(
        img,
        scaledRect.x,
        scaledRect.y,
        scaledRect.width,
        scaledRect.height,
        0,
        0,
        scaledRect.width,
        scaledRect.height
      );

      const regionDataUrl = regionCanvas.toDataURL('image/png');

      // Send to background worker
      const worker = new Worker(chrome.runtime.getURL('barcodeWorker.js'));

      worker.onmessage = (event) => {
        const result = event.data.data;
        console.log('Barcode detection result:', result);

        // Send result back to popup
        chrome.runtime.sendMessage({
          type: 'RESULT',
          data: result || 'No barcode detected',
        });

        worker.terminate();
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
        chrome.runtime.sendMessage({
          type: 'RESULT',
          data: 'Error processing barcode',
        });
        worker.terminate();
      };

      worker.postMessage({ dataUrl });
    } catch (error) {
      console.error('Capture error:', error);
      throw error;
    }
  }

  function cleanup() {
    if (selectionBox && selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
    }
    if (instructionOverlay && instructionOverlay.parentNode) {
      instructionOverlay.parentNode.removeChild(instructionOverlay);
    }

    document.removeEventListener('mousedown', startSelection);
    document.removeEventListener('mousemove', updateSelection);
    document.removeEventListener('mouseup', endSelection);
    document.removeEventListener('keydown', handleKeyPress);

    document.body.style.cursor = '';
  }

  function handleKeyPress(e) {
    if (e.key === 'Escape') {
      cleanup();
      e.preventDefault();
    }
  }

  // Add event listeners
  document.addEventListener('mousedown', startSelection);
  document.addEventListener('mousemove', updateSelection);
  document.addEventListener('mouseup', endSelection);
  document.addEventListener('keydown', handleKeyPress);

  // Auto cleanup after 30 seconds
  setTimeout(cleanup, 30000);

  console.log('Barcode scanner ready. Click and drag to select area.');
})();
