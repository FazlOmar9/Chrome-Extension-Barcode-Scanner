document.getElementById('captureBtn').addEventListener('click', async () => {
  document.getElementById('status').textContent = 'Status: Detecting…';
  chrome.runtime.sendMessage({ type: 'CAPTURE' });
});

document.getElementById('copyBtn').addEventListener('click', () => {
  const text = document.getElementById('result').innerText;
  navigator.clipboard.writeText(text);
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'RESULT') {
    const resultEl = document.getElementById('result');
    resultEl.innerText = msg.data || 'No barcode found';
    document.getElementById('copyBtn').style.display = 'inline-block';
    document.getElementById('status').textContent = 'Status: Done';
  }
});