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

    // Temporary Logging Added
    console.log('Attempting API call. Retrieved settings:');
    console.log('API URL:', settings.apiUrl);
    console.log('API Key (first 5 chars):', settings.apiKey ? settings.apiKey.substring(0, 5) + '...' : 'undefined/empty');


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
          'Authorization': 'Bearer ' + settings.apiKey // MODIFIED: Using Bearer token
        },
        body: JSON.stringify({ text: selectedText }) // selectedText comes from performTranslation's argument
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
    // Pass info.selectionText to performTranslation
    performTranslation(info.selectionText, (result) => { 
      if (tab.id) {
        const messagePayload = { action: "displayTranslation", ...result };
        chrome.tabs.sendMessage(tab.id, messagePayload, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Failed to send message to tab:", tab.id, chrome.runtime.lastError.message);
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
  console.log("Message received in background.js:", request);
  // Note: The 'selectedText' for the API call is now passed as an argument 
  // to performTranslation, not taken from 'request.selectedText' here.
});
