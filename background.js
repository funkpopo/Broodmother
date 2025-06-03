chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translateText') {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], (settings) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: 'Failed to retrieve settings.', details: chrome.runtime.lastError.message });
        return true;
      }

      if (!settings.apiUrl || !settings.apiKey) {
        sendResponse({ error: 'API URL or Key not configured.' });
        return true;
      }

      // Basic URL validation
      if (!settings.apiUrl.startsWith('http://') && !settings.apiUrl.startsWith('https://')) {
        sendResponse({ error: 'API URL is invalid. It must start with http:// or https://.' });
        return true;
      }

      (async () => {
        try {
          const response = await fetch(settings.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': settings.apiKey
            },
            body: JSON.stringify({ text: request.selectedText })
          });

          if (!response.ok) {
            let errorDetails = `Status: ${response.status}. `;
            try {
              const errorBody = await response.text(); // Try to get more details from API
              errorDetails += `Response: ${errorBody}`;
            } catch (e) {
              errorDetails += 'Could not retrieve error body from API response.';
            }
            sendResponse({ error: 'API request failed.', details: errorDetails });
            return;
          }

          let data;
          try {
            data = await response.json();
          } catch (e) {
            sendResponse({ error: 'Failed to parse API response as JSON.', details: e.message });
            return;
          }

          let translatedText = '';
          if (data.translatedText) {
            translatedText = data.translatedText;
          } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0 && data.translations[0].text) {
            translatedText = data.translations[0].text;
          } else {
            sendResponse({ error: 'Translated text not found in API response.', details: JSON.stringify(data) });
            return;
          }
          sendResponse({ translatedText: translatedText });

        } catch (error) { // Catches network errors and others from fetch itself
          console.error('API call failed:', error);
          sendResponse({ error: 'Network error or API endpoint not reachable.', details: error.message });
        }
      })(); // Immediately invoke the async function
    });
    return true; // Indicates that sendResponse will be called asynchronously
  }
});
