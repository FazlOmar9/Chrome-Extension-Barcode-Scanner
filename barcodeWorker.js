importScripts('libs/zxing.min.js', 'libs/quagga.min.js');

self.onmessage = function (e) {
  const { dataUrl } = e.data;
  const img = new Image();

  img.onload = function () {
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // First try ZXing
    try {
      const reader = new ZXing.BrowserMultiFormatReader();
      reader.decodeFromImage(img).then(result => {
        self.postMessage({ type: 'RESULT', data: result.text });
      }).catch(() => {
        // Fallback to Quagga
        Quagga.decodeSingle({
          src: dataUrl,
          numOfWorkers: 0,
          inputStream: { size: 800 },
          decoder: { readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "qr_reader"] }
        }, result => {
          if (result && result.codeResult) {
            self.postMessage({ type: 'RESULT', data: result.codeResult.code });
          } else {
            self.postMessage({ type: 'RESULT', data: '' });
          }
        });
      });
    } catch {
      self.postMessage({ type: 'RESULT', data: '' });
    }
  };
  img.src = dataUrl;
};