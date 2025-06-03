document.addEventListener('mouseup', () => {
  const selectedText = window.getSelection().toString().trim();

  if (selectedText) {
    chrome.runtime.sendMessage(
      {
        action: 'translateText',
        selectedText: selectedText
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // Handle errors from chrome.runtime.sendMessage itself
          alert('Error sending message to background script: ' + chrome.runtime.lastError.message);
          return;
        }

        if (response.error) {
          let errorMessage = 'Translation Error: ' + response.error;
          if (response.details) {
            errorMessage += '\nDetails: ' + response.details;
          }
          alert(errorMessage);
        } else if (response.translatedText) {
          alert('Translation: ' + response.translatedText);
        } else {
          // This case should ideally be covered by error handling in background.js
          // (e.g., "Translated text not found in API response")
          alert('Received an unexpected or empty response from the background script.');
        }
      }
    );
  }
});
