chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE') {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Inject new content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content_new.js'],
    });
  } else if (msg.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      sendResponse({ dataUrl });
    });
    // Required for async response
    return true;
  }
});
