let opening;

async function openGame() {
  const gameUrl = chrome.runtime.getURL('index.html');
  // Inspect only our own extension pages; no browsing-history permission is needed.
  const contexts = await chrome.runtime.getContexts({contextTypes: ['TAB']});
  const existing = contexts.find(context => {
    const url = new URL(context.documentUrl);
    url.search = ''; url.hash = '';
    return url.href === gameUrl;
  });
  if (existing?.tabId >= 0) {
    await chrome.tabs.update(existing.tabId, {active: true});
    await chrome.windows.update(existing.windowId, {focused: true});
  } else {
    await chrome.tabs.create({url: gameUrl});
  }
}

chrome.action.onClicked.addListener(() => {
  if (opening) return;
  opening = openGame().catch(error => console.error('Could not open Sunny Kart', error))
    .finally(() => {opening = undefined;});
});
