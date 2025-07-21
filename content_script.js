// Firefox专用内容脚本初始化
console.log('Broodmother内容脚本开始加载...');

const OVERLAY_ID = 'aiTranslatorOverlay';

// 检查运行环境
const isFirefox = typeof browser !== 'undefined';
console.log('运行环境:', isFirefox ? 'Firefox' : 'Chrome');

// 确保在页面完全加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

function initializeContentScript() {
  console.log('内容脚本初始化完成，页面状态:', document.readyState);
  console.log('页面URL:', window.location.href);
}

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

// ====== 选区翻译浮动按钮与气泡实现 ======
let selectionButton = null;
let translationBubble = null;
let streamingBubble = null;
let streamingRect = null;
let lastSelectionText = '';
let lastSelectionRect = null;

function removeSelectionButton() {
  if (selectionButton) {
    selectionButton.remove();
    selectionButton = null;
  }
}

function removeTranslationBubble() {
  if (translationBubble) {
    if (translationBubble._unbind) translationBubble._unbind();
    translationBubble.remove();
    translationBubble = null;
  }
}

function removeStreamingBubble() {
  if (streamingBubble) {
    if (streamingBubble._unbind) streamingBubble._unbind();
    streamingBubble.remove();
    streamingBubble = null;
  }
}

function getSelectionRect() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

function showSelectionButton(rect) {
  removeSelectionButton();
  removeTranslationBubble();
  removeStreamingBubble();
  if (!rect) return;
  selectionButton = document.createElement('button');
  selectionButton.textContent = '翻译';
  selectionButton.className = 'bm-translate-btn';
  selectionButton.style.position = 'fixed';
  selectionButton.style.left = `${rect.left + rect.width / 2 - 24}px`;
  selectionButton.style.top = `${rect.bottom + 8}px`;
  selectionButton.style.zIndex = '2147483647';
  selectionButton.style.padding = '4px 14px';
  selectionButton.style.borderRadius = '6px';
  selectionButton.style.border = '1px solid #cce0ff';
  selectionButton.style.background = '#f0f8ff';
  selectionButton.style.color = '#333';
  selectionButton.style.fontSize = '14px';
  selectionButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
  selectionButton.style.cursor = 'pointer';
  selectionButton.style.transition = 'background 0.2s';
  selectionButton.onmouseenter = () => selectionButton.style.background = '#e6f0ff';
  selectionButton.onmouseleave = () => selectionButton.style.background = '#f0f8ff';
  selectionButton.onclick = () => {
    selectionButton.disabled = true;
    selectionButton.textContent = '翻译中...';
    requestTranslation(lastSelectionText, rect);
  };
  document.body.appendChild(selectionButton);
}

function findNearestPositionedAncestor(node) {
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (el && el !== document.body) {
    const pos = window.getComputedStyle(el).position;
    if (pos === 'relative' || pos === 'absolute' || pos === 'fixed') {
      return el;
    }
    el = el.parentElement;
  }
  return document.body;
}

function findBestBubbleContainer(node) {
  let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  let lastNonBody = null;
  while (el && el !== document.body) {
    const pos = window.getComputedStyle(el).position;
    if (pos === 'relative' || pos === 'absolute' || pos === 'fixed') {
      return el;
    }
    lastNonBody = el;
    el = el.parentElement;
  }
  return lastNonBody || document.body;
}

function getBubbleRelativeRect(rect, container) {
  const containerRect = container.getBoundingClientRect();
  return {
    left: rect.left - containerRect.left + container.scrollLeft,
    top: rect.bottom - containerRect.top + container.scrollTop + 8
  };
}

let bubbleRelocateObserver = null;
function setupBubbleRelocation(bubble, rect, container, updateFn) {
  function relocate() {
    const rel = getBubbleRelativeRect(rect, container);
    updateFn(rel);
  }
  // 监听容器滚动和resize
  container.addEventListener('scroll', relocate, true);
  window.addEventListener('resize', relocate, true);
  // 可选：监听DOM变化
  if (bubbleRelocateObserver) bubbleRelocateObserver.disconnect();
  bubbleRelocateObserver = new MutationObserver(relocate);
  bubbleRelocateObserver.observe(container, { attributes: true, childList: true, subtree: false });
  // 返回解绑函数
  return () => {
    container.removeEventListener('scroll', relocate, true);
    window.removeEventListener('resize', relocate, true);
    if (bubbleRelocateObserver) bubbleRelocateObserver.disconnect();
  };
}

function showTranslationBubble(text, rect, isError = false) {
  removeTranslationBubble();
  const selection = window.getSelection();
  let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  let anchorNode = range ? range.startContainer : null;
  let container = anchorNode ? findBestBubbleContainer(anchorNode) : document.body;
  if (!container) container = document.body;
  const rel = getBubbleRelativeRect(rect, container);
  translationBubble = document.createElement('div');
  translationBubble.className = 'bm-translate-bubble';
  translationBubble.style.position = 'absolute';
  translationBubble.style.left = `${rel.left}px`;
  translationBubble.style.top = `${rel.top}px`;
  translationBubble.style.minWidth = '120px';
  translationBubble.style.maxWidth = container.clientWidth + 'px';
  translationBubble.style.padding = '12px 16px 12px 16px';
  translationBubble.style.borderRadius = '8px';
  translationBubble.style.background = isError ? '#fff0f0' : '#f0f8ff';
  translationBubble.style.color = isError ? '#b00020' : '#333';
  translationBubble.style.border = `1px solid ${isError ? '#ffcccc' : '#cce0ff'}`;
  translationBubble.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
  translationBubble.style.zIndex = '2147483647';
  translationBubble.style.fontSize = '15px';
  translationBubble.style.lineHeight = '1.7';
  translationBubble.style.wordBreak = 'break-word';
  translationBubble.style.fontFamily = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
  translationBubble.innerText = text;
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '×';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '8px';
  closeBtn.style.right = '14px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.color = '#aaa';
  closeBtn.onmouseenter = () => closeBtn.style.color = '#333';
  closeBtn.onmouseleave = () => closeBtn.style.color = '#aaa';
  closeBtn.onclick = removeTranslationBubble;
  translationBubble.appendChild(closeBtn);
  container.appendChild(translationBubble);
  // 动态定位
  let unbind = setupBubbleRelocation(translationBubble, rect, container, rel => {
    translationBubble.style.left = `${rel.left}px`;
    translationBubble.style.top = `${rel.top}px`;
  });
  translationBubble._unbind = unbind;
}

function showStreamingBubble(text, isError = false) {
  removeStreamingBubble();
  if (!streamingRect) return;
  const selection = window.getSelection();
  let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
  let anchorNode = range ? range.startContainer : null;
  let container = anchorNode ? findBestBubbleContainer(anchorNode) : document.body;
  if (!container) container = document.body;
  const rel = getBubbleRelativeRect(streamingRect, container);
  streamingBubble = document.createElement('div');
  streamingBubble.className = 'bm-translate-bubble';
  streamingBubble.style.position = 'absolute';
  streamingBubble.style.left = `${rel.left}px`;
  streamingBubble.style.top = `${rel.top}px`;
  streamingBubble.style.minWidth = '60px';
  streamingBubble.style.maxWidth = container.clientWidth + 'px';
  streamingBubble.style.width = `${Math.max(60, Math.min(container.clientWidth, streamingRect.width))}px`;
  streamingBubble.style.padding = '12px 16px 12px 16px';
  streamingBubble.style.borderRadius = '8px';
  streamingBubble.style.background = isError ? '#fff0f0' : '#f0f8ff';
  streamingBubble.style.color = isError ? '#b00020' : '#333';
  streamingBubble.style.border = `1px solid ${isError ? '#ffcccc' : '#cce0ff'}`;
  streamingBubble.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)';
  streamingBubble.style.zIndex = '2147483647';
  streamingBubble.style.fontSize = '15px';
  streamingBubble.style.lineHeight = '1.7';
  streamingBubble.style.wordBreak = 'break-word';
  streamingBubble.style.fontFamily = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif';
  streamingBubble.innerText = text;
  container.appendChild(streamingBubble);
  // 动态定位
  let unbind = setupBubbleRelocation(streamingBubble, streamingRect, container, rel => {
    streamingBubble.style.left = `${rel.left}px`;
    streamingBubble.style.top = `${rel.top}px`;
  });
  streamingBubble._unbind = unbind;
}

function removeStreamPort() {
  if (streamPort) {
    try { streamPort.disconnect(); } catch (e) {}
    streamPort = null;
  }
}

// ========== 修改 requestTranslation，优先流式 ==========
function requestTranslation(text, rect) {
  removeTranslationBubble();
  removeStreamingBubble();
  // 兼容Chrome/Firefox
  const runtime = window.chrome?.runtime || window.browser?.runtime;
  if (!runtime) {
    showTranslationBubble('无法访问扩展API', rect, true);
    return;
  }
  // 优先尝试流式
  try {
    startStreamingTranslation(text, rect);
  } catch (e) {
    // 回退
    runtime.sendMessage({ action: 'translateSelection', text: text }, (response) => {
      if (!response) {
        showTranslationBubble('未收到翻译响应', rect, true);
        return;
      }
      if (response.error) {
        showTranslationBubble('翻译失败: ' + response.error, rect, true);
      } else if (response.translatedText) {
        showTranslationBubble(response.translatedText, rect, false);
      } else {
        showTranslationBubble('未知翻译响应', rect, true);
      }
      removeSelectionButton();
    });
  }
}

function handleSelectionChange() {
  setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      removeSelectionButton();
      removeTranslationBubble();
      removeStreamingBubble();
      lastSelectionText = '';
      lastSelectionRect = null;
      return;
    }
    const rect = getSelectionRect();
    if (!rect) {
      removeSelectionButton();
      removeTranslationBubble();
      removeStreamingBubble();
      lastSelectionText = '';
      lastSelectionRect = null;
      return;
    }
    lastSelectionText = selection.toString().trim();
    lastSelectionRect = rect;
    showSelectionButton(rect);
  }, 80);
}

document.addEventListener('mouseup', handleSelectionChange);
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') return;
  handleSelectionChange();
});
document.addEventListener('scroll', () => {
  removeSelectionButton();
  removeTranslationBubble();
  removeStreamingBubble();
}, true);
document.addEventListener('mousedown', (e) => {
  if (selectionButton && !selectionButton.contains(e.target)) {
    removeSelectionButton();
  }
  if (translationBubble && !translationBubble.contains(e.target)) {
    removeTranslationBubble();
  }
  if (streamingBubble && !streamingBubble.contains(e.target)) {
    removeStreamingBubble();
  }
});

// == 划词翻译插入实现 ==
(function() {
    const STYLE_ID = 'bm-translate-style';
    const RESULT_CLASS = 'bm-translate-result';
    const CLOSE_CLASS = 'bm-translate-close';
    const BG_COLOR = '#FFF9C4';

    // 注入样式
    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${RESULT_CLASS} {
                background: ${BG_COLOR};
                border-radius: 4px;
                padding: 2px 8px 2px 6px;
                margin-left: 4px;
                box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                display: inline-flex;
                align-items: center;
                font-size: 90%;
                z-index: 2147483647;
            }
            .${CLOSE_CLASS} {
                background: #ffe082;
                border: none;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                margin-left: 6px;
                cursor: pointer;
                font-size: 14px;
                line-height: 18px;
                color: #555;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s;
            }
            .${CLOSE_CLASS}:hover {
                background: #ffd54f;
                color: #222;
            }
        `;
        document.head.appendChild(style);
    }

    // 关闭按钮事件
    function onClose(e) {
        const span = e.target.closest('.' + RESULT_CLASS);
        if (span) span.remove();
        e.stopPropagation();
    }

    // 插入翻译结果
    function insertTranslation(text) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (range.collapsed) return;

        // 避免重复插入
        removeExistingResults();

        // 构造节点
        const span = document.createElement('span');
        span.className = RESULT_CLASS;
        span.style.userSelect = 'none';
        span.tabIndex = -1;
        span.innerText = text;
        // 关闭按钮
        const btn = document.createElement('button');
        btn.className = CLOSE_CLASS;
        btn.type = 'button';
        btn.innerText = '×';
        btn.title = '关闭翻译';
        btn.addEventListener('click', onClose);
        span.appendChild(btn);

        // 插入到选区后
        const afterRange = range.cloneRange();
        afterRange.collapse(false);
        afterRange.insertNode(span);
        // 取消选区
        sel.removeAllRanges();
    }

    // 移除所有已插入的翻译结果
    function removeExistingResults() {
        document.querySelectorAll('.' + RESULT_CLASS).forEach(e => e.remove());
    }

    // 监听划词
    document.addEventListener('mouseup', function(e) {
        setTimeout(() => {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const text = sel.toString().trim();
            if (text) {
                // 这里调用翻译API，示例用Promise.resolve模拟
                // 替换为实际API调用即可
                Promise.resolve('[翻译]' + text).then(result => {
                    injectStyle();
                    insertTranslation(result);
                });
            }
        }, 10);
    });

    // 可选：监听键盘Esc移除所有翻译
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') removeExistingResults();
    });
})();

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
  } else if (request.action === "showSidebar") {
    // 注入或显示自定义侧栏
    let sidebar = document.getElementById('broodmother-sidebar-container');
    if (!sidebar) {
      sidebar = document.createElement('div');
      sidebar.id = 'broodmother-sidebar-container';
      sidebar.style.position = 'fixed';
      sidebar.style.top = '0';
      sidebar.style.right = '0';
      sidebar.style.width = '400px';
      sidebar.style.height = '100vh';
      sidebar.style.zIndex = '2147483647';
      sidebar.style.background = '#fff';
      sidebar.style.boxShadow = '-2px 0 8px rgba(0,0,0,0.15)';
      sidebar.style.borderLeft = '1px solid #e5e7eb';
      sidebar.style.display = 'flex';
      sidebar.style.flexDirection = 'column';
      sidebar.style.transition = 'right 0.2s';
      sidebar.innerHTML = `<iframe src="${chrome.runtime.getURL('sidepanel.html')}" style="width:100%;height:100%;border:none;"></iframe>`;
      document.body.appendChild(sidebar);
      // 监听关闭消息
      window.addEventListener('message', function handleCloseSidebar(event) {
        if (event.data && event.data.action === 'closeBroodmotherSidebar') {
          sidebar.remove();
          window.removeEventListener('message', handleCloseSidebar);
        }
      });
    } else {
      sidebar.style.display = 'flex';
    }
    return true;
  }
});
