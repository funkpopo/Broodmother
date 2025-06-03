// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "Translate selected text with AI",
    contexts: ["selection"]
  });
});

// Reusable function to perform translation
async function performTranslation(selectedText, callback) {
  chrome.storage.sync.get(['apiUrl', 'apiKey'], async (settings) => {
    if (chrome.runtime.lastError) {
      callback({ error: 'Failed to retrieve settings.', details: chrome.runtime.lastError.message });
      return;
    }

    if (!settings.apiUrl || !settings.apiKey) {
      callback({ error: 'API URL or Key not configured.' });
      return;
    }

    if (!settings.apiUrl.startsWith('http://') && !settings.apiUrl.startsWith('https://')) {
      callback({ error: 'API URL is invalid. It must start with http:// or https://.' });
      return;
    }

    try {
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': settings.apiKey
        },
        body: JSON.stringify({ text: selectedText })
      });

      if (!response.ok) {
        let errorDetails = `Status: ${response.status}. `;
        try {
          const errorBody = await response.text();
          errorDetails += `Response: ${errorBody}`;
        } catch (e) {
          errorDetails += 'Could not retrieve error body from API response.';
        }
        callback({ error: 'API request failed.', details: errorDetails });
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        callback({ error: 'Failed to parse API response as JSON.', details: e.message });
        return;
      }

      let translatedText = '';
      if (data.translatedText) {
        translatedText = data.translatedText;
      } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0 && data.translations[0].text) {
        translatedText = data.translations[0].text;
      } else {
        callback({ error: 'Translated text not found in API response.', details: JSON.stringify(data) });
        return;
      }
      callback({ translatedText: translatedText });

    } catch (error) {
      console.error('API call failed:', error);
      callback({ error: 'Network error or API endpoint not reachable.', details: error.message });
    }
  });
}

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection" && info.selectionText && tab) {
    performTranslation(info.selectionText, (result) => {
      if (tab.id) {
        const messagePayload = { action: "displayTranslation", ...result };
        chrome.tabs.sendMessage(tab.id, messagePayload, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Failed to send message to tab:", tab.id, chrome.runtime.lastError.message);
            // Optionally, alert the user from background if tab messaging fails, though less common.
            // For example, by creating a temporary notification if the content script isn't there.
          }
        });
      } else {
        console.warn("Context menu clicked on a tab without an ID:", tab);
      }
    });
  }
});

// Listener for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // The 'translateText' action previously handled here is now primarily driven by the context menu.
  // If you had other actions, they would remain here.
  // For example:
  // if (request.action === 'someOtherAction') {
  //   // ... handle someOtherAction ...
  //   sendResponse({ status: 'someOtherAction processed' });
  //   return true; // if async
  // }

  // If no other actions are handled by this listener, it can be significantly simplified or
  // even removed if content_script.js no longer sends other types of messages.
  // For now, we'll leave it to acknowledge it's been reviewed.
  console.log("Message received in background.js:", request);
  // If you need to respond to *any* message, even if not handled:
  // sendResponse({ status: "Message received, but no specific action taken for this type." });
  // return false; // If not async. If any path is async, it should be true.
});
