const OVERLAY_ID = 'aiTranslatorOverlay';

// 获取当前主题设置
function getCurrentTheme(callback) {
  chrome.storage.sync.get(['currentTheme'], (result) => {
    const theme = result.currentTheme || 'light';
    
    // 如果是自动主题，检测系统主题
    if (theme === 'auto') {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      callback(prefersDarkMode ? 'dark' : 'light');
    } else {
      callback(theme);
    }
  });
}

// 根据主题获取样式
function getThemeStyles(theme) {
  const styles = {
    light: {
      backgroundColor: '#f0f8ff',
      textColor: '#333',
      borderColor: '#cce0ff',
      errorBackgroundColor: '#fff0f0',
      errorBorderColor: '#ffcccc'
    },
    dark: {
      backgroundColor: '#2d3748',
      textColor: '#e2e8f0',
      borderColor: '#4a5568',
      errorBackgroundColor: '#4a2c2c',
      errorBorderColor: '#742a2a'
    }
  };
  
  return styles[theme] || styles.light;
}

function showTranslationOverlay(textToShow, configInfo = null, isError = false) {
  // 移除现有浮层
  const existingOverlay = document.getElementById(OVERLAY_ID);
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // 获取当前主题
  getCurrentTheme(theme => {
    const styles = getThemeStyles(theme);
    
    // 创建浮层
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    
    // 基础样式
    overlay.style.position = 'fixed';
    overlay.style.top = '20px';
    overlay.style.right = '20px';
    overlay.style.padding = '15px';
    overlay.style.borderRadius = '8px';
    overlay.style.boxShadow = theme === 'dark' 
      ? '0 5px 15px rgba(0,0,0,0.5)' 
      : '0 5px 15px rgba(0,0,0,0.15)';
    overlay.style.zIndex = '2147483647';
    overlay.style.maxWidth = '350px';
    overlay.style.maxHeight = '250px';
    overlay.style.overflowY = 'auto';
    overlay.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    overlay.style.fontSize = '14px';
    overlay.style.lineHeight = '1.6';
    overlay.style.transition = 'all 0.2s ease';
    
    // 应用主题样式
    overlay.style.backgroundColor = isError ? styles.errorBackgroundColor : styles.backgroundColor;
    overlay.style.color = styles.textColor;
    overlay.style.border = `1px solid ${isError ? styles.errorBorderColor : styles.borderColor}`;
    
    // 配置信息（如果有）
    if (configInfo && !isError) {
      const configHeader = document.createElement('div');
      configHeader.style.marginBottom = '10px';
      configHeader.style.fontSize = '12px';
      configHeader.style.color = theme === 'dark' ? '#a0aec0' : '#6c757d';
      configHeader.style.borderBottom = `1px solid ${styles.borderColor}`;
      configHeader.style.paddingBottom = '5px';
      configHeader.textContent = `使用配置: ${configInfo}`;
      overlay.appendChild(configHeader);
    }

    // 内容
    const content = document.createElement('div');
    content.innerText = textToShow;
    overlay.appendChild(content);

    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '8px';
    closeButton.style.right = '10px';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = theme === 'dark' ? '#a0aec0' : '#aaa';
    closeButton.style.transition = 'color 0.2s';
    closeButton.onmouseover = () => closeButton.style.color = theme === 'dark' ? '#e2e8f0' : '#333';
    closeButton.onmouseout = () => closeButton.style.color = theme === 'dark' ? '#a0aec0' : '#aaa';
    closeButton.onclick = () => overlay.remove();
    overlay.appendChild(closeButton);

    document.body.appendChild(overlay);
    
    // 添加进入动画
    setTimeout(() => {
      overlay.style.opacity = '1';
      overlay.style.transform = 'translateY(0)';
    }, 10);
  });
}

function getVisibleTextNodes(element, textNodes) {
  if (element.nodeType === Node.TEXT_NODE) {
    if (element.textContent.trim().length > 0) {
      // Check if the element is visible
      const style = window.getComputedStyle(element.parentNode);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) { // Ensure it has dimensions
            textNodes.push(element);
        }
      }
    }
  } else if (element.nodeType === Node.ELEMENT_NODE) {
    // Filter out script, style, noscript, and iframe tags
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT'].includes(element.tagName)) {
      return;
    }
    // Check visibility for elements too, to prune branches early
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }
    for (let i = 0; i < element.childNodes.length; i++) {
      getVisibleTextNodes(element.childNodes[i], textNodes);
    }
  }
}

function extractAllText() {
  const allTextNodes = [];
  getVisibleTextNodes(document.body, allTextNodes);
  return allTextNodes.map(node => node.textContent.trim()).join('\n');
}

function checkOverlap(rectA, rectB) {
  // rectA is the selection rectangle { x, y, width, height }
  // rectB is the element's bounding client rect { left, top, right, bottom, width, height }
  const overlap = !(rectA.x + rectA.width < rectB.left || // Selection is to the left of element
                  rectA.x > rectB.right ||           // Selection is to the right of element
                  rectA.y + rectA.height < rectB.top || // Selection is above element
                  rectA.y > rectB.bottom);           // Selection is below element
  return overlap;
}

function extractTextFromRegion(selectionRatios) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const selectionAbs = {
    x: selectionRatios.x * viewportWidth,
    y: selectionRatios.y * viewportHeight,
    width: selectionRatios.width * viewportWidth,
    height: selectionRatios.height * viewportHeight
  };
  selectionAbs.right = selectionAbs.x + selectionAbs.width;
  selectionAbs.bottom = selectionAbs.y + selectionAbs.height;

  const visibleTextNodes = [];
  getVisibleTextNodes(document.body, visibleTextNodes);
  
  const selectedTexts = [];
  const processedElements = new Set();

  for (const node of visibleTextNodes) {
    let element = node.parentNode;
    if (element && !processedElements.has(element)) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const elementRect = range.getBoundingClientRect();

        if (elementRect.width > 0 && elementRect.height > 0 && checkOverlap(selectionAbs, elementRect)) {
            selectedTexts.push(node.textContent.trim());
            let currentElement = element;
            while(currentElement && currentElement !== document.body) {
                processedElements.add(currentElement);
                currentElement = currentElement.parentNode;
            }
        }
    }
  }
  return selectedTexts.join('\n');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    console.warn("Message received from unknown sender:", sender);
    return false;
  }

  if (request.action === "ping") {
    // 响应ping消息，确认内容脚本已加载
    sendResponse({ success: true, message: "pong" });
    return true;
  } else if (request.action === "displayTranslation") {
    if (chrome.runtime.lastError) {
      showTranslationOverlay('接收消息时出错: ' + chrome.runtime.lastError.message, null, true);
      return;
    }
    if (request.error) {
      let errorMessage = '翻译错误: ' + request.error;
      if (request.details) {
        errorMessage += '\n详情: ' + request.details.replace(/\\n/g, '\n');
      }
      showTranslationOverlay(errorMessage, null, true);
    } else if (request.translatedText) {
      showTranslationOverlay(request.translatedText, request.configName, false);
    } else {
      showTranslationOverlay('收到意外或空的翻译响应', null, true);
    }
  } else if (request.action === "extractTextFromSelection") {
    // 新的选择区域文字提取
    if (request.selectionRatios) {
      try {
        const text = extractTextFromRegion(request.selectionRatios);
        sendResponse({ success: true, text: text });
      } catch (e) {
        
        sendResponse({ success: false, error: "提取选中区域文字失败: " + e.message });
      }
    } else {
      sendResponse({ success: false, error: "未提供选择区域坐标" });
    }
    return true;
  } else if (request.action === "extractTextFromPage") {
    // 新的整页文字提取
    try {
      const text = extractAllText();
      sendResponse({ success: true, text: text });
    } catch (e) {
      
      sendResponse({ success: false, error: "提取页面文字失败: " + e.message });
    }
    return true;
  } else if (request.action === "getTextSelection") {
    // 保持向后兼容的旧API
    if (request.coordinates) {
      try {
        const text = extractTextFromRegion(request.coordinates);
        sendResponse({ text: text });
      } catch (e) {
        
        sendResponse({ error: "Error extracting text from region: " + e.message });
      }
    } else {
      sendResponse({ error: "Coordinates not provided for selection" });
    }
    return true;
  } else if (request.action === "getTextAll") {
    // 保持向后兼容的旧API
    try {
      const text = extractAllText();
      sendResponse({ text: text });
    } catch (e) {
      
      sendResponse({ error: "Error extracting all text: " + e.message });
    }
    return true;
  }
});
