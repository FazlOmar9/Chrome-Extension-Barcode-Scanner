chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content.js only (html2canvas is already embedded in it)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});
