const OVERLAY_ID = 'aiTranslatorOverlay';

function showTranslationOverlay(textToShow, isError = false) {
  // Remove existing overlay if any
  const existingOverlay = document.getElementById(OVERLAY_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay div
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  
  // Styling
  overlay.style.position = 'fixed';
  overlay.style.top = '20px';
  overlay.style.right = '20px';
  overlay.style.backgroundColor = isError ? '#fff0f0' : '#f0f8ff'; // Lighter red/blue
  overlay.style.border = isError ? '1px solid #ffcccc' : '1px solid #cce0ff';
  overlay.style.padding = '15px';
  overlay.style.borderRadius = '8px'; // Slightly more rounded
  overlay.style.boxShadow = '0 5px 15px rgba(0,0,0,0.15)'; // Softer shadow
  overlay.style.zIndex = '2147483647'; // Max z-index
  overlay.style.maxWidth = '350px'; // Slightly wider
  overlay.style.maxHeight = '250px'; // Slightly taller
  overlay.style.overflowY = 'auto';
  overlay.style.fontFamily = 'Arial, sans-serif'; // Common sans-serif font
  overlay.style.fontSize = '14px';
  overlay.style.lineHeight = '1.6';
  overlay.style.color = '#333'; // Darker text for readability

  // Content
  const content = document.createElement('div');
  // Use innerText to preserve line breaks from error details, but let browser handle HTML entities if any.
  // For direct translation, textContent is fine. For error messages with details, innerText is better.
  content.innerText = textToShow; 
  overlay.appendChild(content);

  // Close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×'; // Nicer 'X'
  closeButton.style.position = 'absolute';
  closeButton.style.top = '8px'; // Adjusted for padding
  closeButton.style.right = '10px'; // Adjusted for padding
  closeButton.style.background = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.fontSize = '20px'; // Larger for easier clicking
  closeButton.style.cursor = 'pointer';
  closeButton.style.color = '#aaa'; // Softer color
  closeButton.onmouseover = () => closeButton.style.color = '#333'; // Darken on hover
  closeButton.onmouseout = () => closeButton.style.color = '#aaa'; // Revert color
  closeButton.onclick = () => overlay.remove();
  overlay.appendChild(closeButton);

  document.body.appendChild(overlay);

  // Optional: Auto-remove overlay after some time if it's not an error
  if (!isError) {
    setTimeout(() => {
      // Check if it's still the same overlay before removing
      const currentOverlay = document.getElementById(OVERLAY_ID);
      if (currentOverlay === overlay) { // Ensure it wasn't replaced by another message
         // currentOverlay.remove(); // Uncomment to enable auto-remove
      }
    }, 7000); // Auto-remove after 7 seconds for non-error messages
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    return; // Ignore messages from other extensions
  }

  if (request.action === "displayTranslation") {
    if (chrome.runtime.lastError) {
      showTranslationOverlay('Error receiving message from background script: ' + chrome.runtime.lastError.message, true);
      return;
    }
    if (request.error) {
      let errorMessage = 'Translation Error: ' + request.error;
      if (request.details) {
        // Replace literal \n with actual newlines for display in innerText
        errorMessage += '\nDetails: ' + request.details.replace(/\\n/g, '\n');
      }
      showTranslationOverlay(errorMessage, true);
    } else if (request.translatedText) {
      showTranslationOverlay(request.translatedText, false);
    } else {
      showTranslationOverlay('Received an unexpected or empty response for translation from the background script.', true);
    }
  }
  // sendResponse can be used if background expects an ack, but not needed here.
});
