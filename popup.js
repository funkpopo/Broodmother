document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusMessage = document.getElementById('statusArea'); // Use the dedicated div

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? 'red' : 'green';
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 3000);
  }

  // Load settings when the popup is opened
  chrome.storage.sync.get(['apiUrl', 'apiKey'], (result) => {
    if (chrome.runtime.lastError) {
      showStatus('Error loading settings: ' + chrome.runtime.lastError.message, true);
      return;
    }
    if (result.apiUrl) {
      apiUrlInput.value = result.apiUrl;
    }
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Add event listener for the "Save" button
  saveButton.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value;
    const apiKey = apiKeyInput.value;

    chrome.storage.sync.set({ apiUrl, apiKey }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings: ' + chrome.runtime.lastError.message, true);
      } else {
        showStatus('Settings saved!', false);
      }
    });
  });
});
