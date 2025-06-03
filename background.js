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
  // Fetch settings (add modelName)
  chrome.storage.sync.get(['apiUrl', 'apiKey', 'modelName'], async (settings) => {
    if (chrome.runtime.lastError) {
      callback({ error: 'Failed to retrieve settings.', details: chrome.runtime.lastError.message });
      return;
    }

    // Temporary Logging (updated)
    console.log('Attempting API call. Retrieved settings:');
    console.log('API URL:', settings.apiUrl);
    console.log('API Key (first 5 chars):', settings.apiKey ? settings.apiKey.substring(0, 5) + '...' : 'undefined/empty');
    console.log('Using Model Name:', settings.modelName); // Added modelName to logging

    if (!settings.apiUrl || !settings.apiKey) {
      callback({ error: 'API URL or Key not configured.' });
      return;
    }
    // Add check for modelName
    if (!settings.modelName) {
      callback({ error: 'AI Model Name not configured.' });
      return;
    }

    if (!settings.apiUrl.startsWith('http://') && !settings.apiUrl.startsWith('https://')) {
      callback({ error: 'API URL is invalid. It must start with http:// or https://.' });
      return;
    }

    // Construct the new request body
    const requestBody = {
      model: settings.modelName,
      messages: [
        {
          role: "user",
          content: "Translate the following text into Chinese: '" + selectedText + "'"
        }
      ]
    };

    try {
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.apiKey
        },
        body: JSON.stringify(requestBody) // Use the new requestBody
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
      
      // IMPORTANT: The response structure will likely change with the new request body.
      // This part needs to be adapted based on the actual API response for chat/completion models.
      // For now, we'll assume a common structure like OpenAI's:
      // { "choices": [{ "message": { "content": "..." } }] }
      let translatedText = '';
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        translatedText = data.choices[0].message.content.trim();
      } else if (data.translatedText) { // Keep old path for a bit as a fallback if structure is different
        translatedText = data.translatedText;
      } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0 && data.translations[0].text) {
        translatedText = data.translations[0].text;
      } else {
        callback({ error: 'Translated text not found in API response. Check response structure.', details: JSON.stringify(data) });
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
});
