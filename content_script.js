chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check if the message is from our extension's background script
  // This is a good practice, especially if other extensions might send messages.
  if (sender.id !== chrome.runtime.id) {
    return; // Ignore messages from other extensions
  }

  if (request.action === "displayTranslation") {
    if (chrome.runtime.lastError) {
        // Handle errors from the messaging system itself if any occur here
        alert('Error receiving message from background script: ' + chrome.runtime.lastError.message);
        return; // Stop further processing
    }

    if (request.error) {
      let errorMessage = 'Translation Error: ' + request.error;
      if (request.details) {
        errorMessage += '\nDetails: ' + request.details;
      }
      alert(errorMessage);
    } else if (request.translatedText) {
      alert('Translation: ' + request.translatedText);
    } else {
      // This case implies the background script sent a 'displayTranslation' action
      // without either 'translatedText' or 'error'. This should be rare
      // given the background script's logic.
      alert('Received an incomplete translation response from the background script.');
    }
    
    // Acknowledge message receipt if background script expects a response (optional)
    // For chrome.tabs.sendMessage, a response isn't always strictly necessary unless 
    // the sender's callback is designed to wait for it or handle chrome.runtime.lastError.
    // sendResponse({ status: "Message processed by content script." });
    // No need to return true if sendResponse is not called or called synchronously.
  }
});
