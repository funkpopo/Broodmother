document.addEventListener('DOMContentLoaded', () => {
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const thumbnailImage = document.getElementById('thumbnail-image');
  const selectionBox = document.getElementById('selection-box');
  const analyzeSelectionButton = document.getElementById('analyze-selection');
  const analyzePageButton = document.getElementById('analyze-page');
  const analysisResultDiv = document.getElementById('analysis-result');

  let tabId = null;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let displayWidth = 0;
  let displayHeight = 0;
  let lastCaptureTime = 0; // Track last capture time for throttling

  analyzeSelectionButton.disabled = true;

  let refreshInterval = null;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].id) {
      tabId = tabs[0].id;
      requestThumbnail();
      
      // Start automatic refresh every 500ms
      refreshInterval = setInterval(() => {
        // Only refresh if the page is visible (sidepanel is open)
        if (document.hidden) {
          console.log("Page hidden, skipping thumbnail refresh");
          return;
        }
        
        // Always check for the current active tab before refreshing
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs.length > 0 && tabs[0].id) {
            const newTabId = tabs[0].id;
            if (newTabId !== tabId) {
              console.log("Active tab changed from", tabId, "to", newTabId);
              tabId = newTabId;
              // Clear selection when tab changes
              selectionBox.style.display = 'none';
              analyzeSelectionButton.disabled = true;
              currentSelectionRatios = null;
            }
            console.log("Auto-refreshing thumbnail for tab:", tabId);
            requestThumbnail();
          }
        });
      }, 500); // Refresh every 500ms (2 times per second)
    } else {
      console.error("Could not get active tab ID for sidepanel.");
      analysisResultDiv.textContent = "无法获取当前标签页信息。";
      analyzePageButton.disabled = true;
      analyzeSelectionButton.disabled = true; 
    }
  });

  // Clean up interval when the page is unloaded
  window.addEventListener('beforeunload', () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  });

  function requestThumbnail() {
    if (!tabId) return;
    
    // Throttle to prevent exceeding Chrome's capture rate limit
    const now = Date.now();
    const minInterval = 500; // Minimum 500ms between captures
    if (now - lastCaptureTime < minInterval) {
      console.log("Throttling screenshot request, too frequent");
      return;
    }
    lastCaptureTime = now;
    
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending captureTab message:", chrome.runtime.lastError.message);
        analysisResultDiv.textContent = `截图通讯错误: ${chrome.runtime.lastError.message}`;
        return;
      }
      if (response && response.dataUrl) {
        thumbnailImage.src = response.dataUrl;
        thumbnailImage.onload = () => {
          naturalWidth = thumbnailImage.naturalWidth;
          naturalHeight = thumbnailImage.naturalHeight;
          displayWidth = thumbnailImage.offsetWidth;
          displayHeight = thumbnailImage.offsetHeight;
          console.log(`Thumbnail loaded: Nat(${naturalWidth}x${naturalHeight}), Disp(${displayWidth}x${displayHeight})`);
          if (displayWidth === 0 || displayHeight === 0) {
            console.warn("Thumbnail display dimensions are zero. May affect selection.");
            // Optionally try to re-measure after a short delay if layout might not be complete
          }
        };
        thumbnailImage.onerror = () => {
          console.error("Failed to load thumbnail image from data URL.");
          analysisResultDiv.textContent = "无法加载页面缩略图。";
        };
      } else if (response && response.error) {
        console.error("Error capturing tab:", response.details);
        analysisResultDiv.textContent = `截图失败: ${response.details}`;
      } else {
        console.error("Invalid response when capturing tab:", response);
        analysisResultDiv.textContent = "获取页面缩略图失败 (无效响应)。";
      }
    });
  }

  let drawing = false;
  let startX_display, startY_display; // Relative to thumbnailImage's displayed top-left
  let currentSelectionRatios = null; // Stores {x_ratio, y_ratio, width_ratio, height_ratio}

  thumbnailContainer.addEventListener('mousedown', (e) => {
    // Ensure image has loaded and display dimensions are known
    if (displayWidth === 0 || displayHeight === 0) {
        console.warn("Thumbnail dimensions not ready for selection.");
        drawing = false;
        return;
    }
    // Only draw on the image itself or its immediate container if image is the only child
    if (e.target !== thumbnailImage && e.target !== thumbnailContainer) return; 

    const rect = thumbnailImage.getBoundingClientRect();
    startX_display = e.clientX - rect.left;
    startY_display = e.clientY - rect.top;

    // Clamp start coordinates to be within the displayed image bounds
    startX_display = Math.max(0, Math.min(startX_display, displayWidth));
    startY_display = Math.max(0, Math.min(startY_display, displayHeight));

    selectionBox.style.left = startX_display + 'px';
    selectionBox.style.top = startY_display + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    drawing = true;
    analyzeSelectionButton.disabled = true;
    currentSelectionRatios = null;
  });

  thumbnailContainer.addEventListener('mousemove', (e) => {
    if (!drawing) return;

    const rect = thumbnailImage.getBoundingClientRect();
    let currentX_display = e.clientX - rect.left;
    let currentY_display = e.clientY - rect.top;

    currentX_display = Math.max(0, Math.min(currentX_display, displayWidth));
    currentY_display = Math.max(0, Math.min(currentY_display, displayHeight));

    const width_display = Math.abs(currentX_display - startX_display);
    const height_display = Math.abs(currentY_display - startY_display);
    const newX_display = Math.min(startX_display, currentX_display);
    const newY_display = Math.min(startY_display, currentY_display);

    selectionBox.style.left = newX_display + 'px';
    selectionBox.style.top = newY_display + 'px';
    selectionBox.style.width = width_display + 'px';
    selectionBox.style.height = height_display + 'px';
  });

  function finalizeSelection() {
    if (!drawing) return;
    drawing = false;
    const selWidth_display = parseFloat(selectionBox.style.width);
    const selHeight_display = parseFloat(selectionBox.style.height);

    if (selWidth_display > 5 && selHeight_display > 5) { // Minimum selection size
      const selX_display = parseFloat(selectionBox.style.left);
      const selY_display = parseFloat(selectionBox.style.top);

      currentSelectionRatios = {
        x_ratio: selX_display / displayWidth,
        y_ratio: selY_display / displayHeight,
        width_ratio: selWidth_display / displayWidth,
        height_ratio: selHeight_display / displayHeight
      };
      analyzeSelectionButton.disabled = false;
      console.log('Selection (ratios):', currentSelectionRatios);
    } else {
      selectionBox.style.display = 'none';
      analyzeSelectionButton.disabled = true;
      currentSelectionRatios = null;
    }
  }

  thumbnailContainer.addEventListener('mouseup', finalizeSelection);
  // Handle mouse leaving the container while drawing
  thumbnailContainer.addEventListener('mouseleave', (e) => {
    if (drawing) {
        finalizeSelection();
    }
  });

  function performAnalysis(text) {
    // Placeholder for actual analysis logic
    // For now, just display the text.
    // Future: implement summarization and key point extraction.
    return `提取的文本内容 (共 ${text.length} 字符):
-----------------------------
${text}`; 
  }

  analyzeSelectionButton.addEventListener('click', () => {
    if (currentSelectionRatios && tabId) {
      analysisResultDiv.textContent = '分析选中范围中...';
      chrome.tabs.sendMessage(tabId, { action: "getTextSelection", coordinates: currentSelectionRatios }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending getTextSelection message:", chrome.runtime.lastError.message);
          analysisResultDiv.textContent = `无法发送分析请求: ${chrome.runtime.lastError.message}`;
          return;
        }
        if (response && response.text) {
          const analysis = performAnalysis(response.text);
          analysisResultDiv.textContent = analysis;
        } else if (response && response.error) {
          console.error("Error extracting selected text:", response.error);
          analysisResultDiv.textContent = `提取选中区域文本失败: ${response.error}`;
        } else {
          analysisResultDiv.textContent = "提取选中区域文本失败 (未知响应)。";
        }
      });
    } else {
      analysisResultDiv.textContent = '请先在缩略图上选择一个区域，或无法获取当前标签页。';
    }
  });

  // Function to perform full page text analysis
  function analyzeFullPageText() {
    if (tabId) {
      analysisResultDiv.textContent = '分析整个页面中...';
      chrome.tabs.sendMessage(tabId, { action: "getTextAll" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending getTextAll message:", chrome.runtime.lastError.message);
          analysisResultDiv.textContent = `无法发送分析请求: ${chrome.runtime.lastError.message}`;
          return;
        }
        if (response && response.text) {
          const analysis = performAnalysis(response.text);
          analysisResultDiv.textContent = analysis;
        } else if (response && response.error) {
          console.error("Error extracting all text:", response.error);
          analysisResultDiv.textContent = `提取页面所有文本失败: ${response.error}`;
        } else {
          analysisResultDiv.textContent = "提取页面所有文本失败 (未知响应)。";
        }
      });
    } else {
      analysisResultDiv.textContent = '无法获取当前标签页。';
    }
  }

  analyzePageButton.addEventListener('click', () => {
    analyzeFullPageText(); // Call the refactored function
  });



}); 