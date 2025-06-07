// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示选择反馈信息
function showSelectionFeedback(message, type = 'info', duration = 3000) {
  // 移除现有的反馈
  const existingFeedback = document.getElementById('selection-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }
  
  // 创建反馈元素
  const feedback = document.createElement('div');
  feedback.id = 'selection-feedback';
  feedback.className = `selection-feedback feedback-${type}`;
  feedback.textContent = message;
  
  // 添加到缩略图容器
  const thumbnailContainer = document.getElementById('thumbnail-container');
  if (thumbnailContainer) {
    thumbnailContainer.appendChild(feedback);
    
    // 添加进入动画
    setTimeout(() => {
      feedback.classList.add('show');
    }, 10);
    
    // 自动移除
    setTimeout(() => {
      feedback.classList.remove('show');
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.remove();
        }
      }, 300);
    }, duration);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 初始化国际化支持
  initializeI18n();
  
  // 初始化主题
  loadTheme();
  
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const thumbnailImage = document.getElementById('thumbnail-image');
  const selectionBox = document.getElementById('selection-box');
  const analyzeSelectionButton = document.getElementById('analyze-selection');
  const analyzePageButton = document.getElementById('analyze-page');
  const analysisResultDiv = document.getElementById('analysis-result');
  const thumbnailOverlay = document.getElementById('thumbnail-overlay');
  
  // 流式输出相关变量
  let isStreamingActive = false;
  let streamBuffer = '';
  let cancelStreamButton = null;
  let streamPort = null;
  let renderTimer = null;
  let userHasScrolled = false;
  let lastScrollTop = 0;
  let currentResponseId = null;

  // 优化的打字机效果渲染器
  class TypewriterRenderer {
    constructor(targetElement, options = {}) {
      this.targetElement = targetElement;
      this.charDelay = options.charDelay || 30; // 每个字符显示延迟（毫秒）
      this.isActive = false;
      this.lastRenderedContent = '';
      this.pendingContent = '';
      this.animationId = null;
      this.isRendering = false;
      this.observer = null;
    }

    start() {
      this.isActive = true;
      this.lastRenderedContent = '';
      this.pendingContent = '';
      this.isRendering = false;
      
      // 清空目标元素
      if (this.targetElement) {
        this.targetElement.innerHTML = '';
      }
    }

    stop() {
      this.isActive = false;
      this.isRendering = false;
      if (this.animationId) {
        clearTimeout(this.animationId);
        this.animationId = null;
      }
    }

    updateContent(newContent) {
      if (!this.isActive || !newContent) return;
      
      // 防止内容重复
      if (newContent === this.pendingContent) return;
      
      this.pendingContent = newContent;
      
      // 如果当前没有在渲染，开始渲染过程
      if (!this.isRendering) {
        this.startTypewriting();
      }
    }

    startTypewriting() {
      if (!this.isActive || this.isRendering) return;
      
      this.isRendering = true;
      this.typeNextSegment();
    }

    typeNextSegment() {
      if (!this.isActive || !this.pendingContent) {
        this.isRendering = false;
        return;
      }

      // 检查是否需要更新内容
      if (this.lastRenderedContent.length >= this.pendingContent.length) {
        this.isRendering = false;
        return;
      }

      // 计算需要添加的字符数量（批量添加以提高性能）
      const charsToAdd = Math.min(5, this.pendingContent.length - this.lastRenderedContent.length);
      const newContent = this.pendingContent.slice(0, this.lastRenderedContent.length + charsToAdd);
      
      this.lastRenderedContent = newContent;
      this.renderToElement(newContent);
      
      // 继续下一段
      this.animationId = setTimeout(() => {
        if (this.isActive) {
          this.typeNextSegment();
        }
      }, this.charDelay);
    }

    renderToElement(content) {
      if (!this.targetElement || !this.isActive) return;
      
      try {
        // 使用更稳定的渲染方式
        requestAnimationFrame(() => {
          if (!this.isActive || !this.targetElement) return;
          
          if (typeof marked !== 'undefined') {
            try {
              const htmlContent = marked.parse(content);
              this.targetElement.innerHTML = htmlContent;
            } catch (markdownError) {
              // Markdown 解析失败时显示原文
              this.targetElement.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(content)}</pre>`;
            }
          } else {
            this.targetElement.innerHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(content)}</pre>`;
          }
        });
      } catch (error) {
        console.warn('渲染失败:', error);
      }
    }

    forceComplete(finalContent) {
      this.stop();
      this.lastRenderedContent = finalContent;
      this.pendingContent = finalContent;
      this.renderToElement(finalContent);
    }
  }

  // 全局打字机渲染器实例
  let typewriterRenderer = null;

  let tabId = null;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let displayWidth = 0;
  let displayHeight = 0;
  let lastCaptureTime = 0;
  let currentTabUrl = null;
  let errorCount = 0;
  const maxErrorCount = 5;
  let currentTheme = 'light';

  // 缩放相关变量
  let currentZoom = 1.0;
  const minZoom = 0.2; // 最小20%
  const maxZoom = 3.0; // 最大300%
  const zoomStep = 0.1;
  
  // 平移相关变量
  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let currentPanX = 0;
  let currentPanY = 0;

  analyzeSelectionButton.disabled = true;

  // 选择框交互状态
  let currentSelectionRatios = null; // 存储相对于缩略图的比例 {x, y, width, height}
  let isDragging = false;
  let isResizing = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let resizeHandle = null;
  let originalSelection = null;

  // 添加滚动检测
  const analysisResultContainer = document.getElementById('analysis-result-container');
  if (analysisResultContainer) {
    analysisResultContainer.addEventListener('scroll', () => {
      const currentScrollTop = analysisResultContainer.scrollTop;
      const scrollHeight = analysisResultContainer.scrollHeight;
      const clientHeight = analysisResultContainer.clientHeight;
      
      // 检测用户是否手动滚动（不在底部）
      const isAtBottom = Math.abs(scrollHeight - clientHeight - currentScrollTop) < 5;
      
      if (!isAtBottom && Math.abs(currentScrollTop - lastScrollTop) > 5) {
        userHasScrolled = true;
        showBackToBottomButton();
        
      } else if (isAtBottom) {
        userHasScrolled = false;
        hideBackToBottomButton();
      }
      
      lastScrollTop = currentScrollTop;
    });
  }

  // 初始化 - 从background获取当前标签页信息
  initializeCurrentTab();

  // 监听窗口尺寸变化
  window.addEventListener('resize', () => {
    // 只在用户没有进行选择操作时更新选择框位置
    if (!drawing && !isDragging && !isResizing && !isPanning) {
      updateSelectionDisplay();
    }
  });

  // 初始化当前标签页信息
  function initializeCurrentTab() {
    console.log('开始初始化当前标签页信息...');
    chrome.runtime.sendMessage({ action: "getCurrentTab" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('获取当前标签页失败:', chrome.runtime.lastError);
        showError();
        return;
      }
      
      console.log('收到标签页信息响应:', response);
      
      if (response && response.success && response.tabInfo) {
        console.log('成功获取标签页信息，开始更新:', response.tabInfo);
        updateTabInfo(response.tabInfo);
      } else {
        console.error('无法获取标签页信息:', response);
        showError();
      }
    });
  }

  // 清理错误信息的辅助函数
  function clearErrorMessages() {
    // 清除分析结果区域的错误信息
    if (analysisResultDiv.innerHTML.includes('error-message')) {
      analysisResultDiv.innerHTML = '';
    }
    // 隐藏overlay
    hideOverlay();
  }

  // 更新标签页信息
  function updateTabInfo(tabInfo) {
    const newTabId = tabInfo.id;
    const newTabUrl = tabInfo.url;
    
    // 检查是否为受限页面
    if (tabInfo.isRestricted) {
      showRestrictedPageError(newTabUrl);
      return;
    }
    
    // 清除之前的错误信息（从受限页面切换到正常页面时）
    clearErrorMessages();
    
    // 重新启用按钮（如果之前被禁用）
    analyzePageButton.disabled = false;
    
    if (newTabId !== tabId || !tabId) {
      console.log('标签页切换:', { from: tabId, to: newTabId });
      tabId = newTabId;
      currentTabUrl = newTabUrl;
      clearThumbnail();
      errorCount = 0;
      requestThumbnail();
      // 重启自动刷新
      startAutoRefresh();
    } else if (newTabUrl !== currentTabUrl) {
      console.log('标签页URL变化:', { from: currentTabUrl, to: newTabUrl });
      currentTabUrl = newTabUrl;
      clearThumbnail();
      errorCount = 0;
      requestThumbnail();
      // 重启自动刷新
      startAutoRefresh();
    } else {
      // 即使标签页和URL都没变，如果当前没有缩略图，也要请求
      if (!thumbnailImage.src) {
        console.log('缩略图缺失，重新请求截图');
        requestThumbnail();
      }
    }
  }

  // 显示受限页面错误
  function showRestrictedPageError(url) {
    const currentLang = i18n.getCurrentLanguage();
    const restrictedMessage = currentLang === 'zh' ? 
      '当前页面为浏览器系统页面，插件无法访问。请切换到普通网页使用。' : 
      'Current page is a browser system page, extension cannot access it. Please switch to a regular webpage.';
    
    analysisResultDiv.innerHTML = `<div class="error-message">${restrictedMessage}</div>`;
    showOverlay(restrictedMessage);
    analyzePageButton.disabled = true;
    analyzeSelectionButton.disabled = true;
    clearThumbnail();
  }

  // 显示错误状态
  function showError() {
    const currentLang = i18n && i18n.getCurrentLanguage ? i18n.getCurrentLanguage() : 'zh';
    const errorMessage = currentLang === 'zh' ? 
      '无法获取当前标签页信息' : 
      'Cannot get current tab information';
    
    analysisResultDiv.innerHTML = `<div class="error-message">${errorMessage}</div>`;
    analyzePageButton.disabled = true;
    analyzeSelectionButton.disabled = true;
  }

  // 监听来自background的标签页变化通知
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "tabChanged" && message.tabInfo) {
      console.log('收到标签页变化通知:', message.tabInfo);
      updateTabInfo(message.tabInfo);
    }
  });

  // 页面预览自动刷新机制
  let autoRefreshInterval = null;
  
  function startAutoRefresh() {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
      // 只在页面可见且有有效tabId时才刷新
      if (!document.hidden && tabId && errorCount < maxErrorCount) {
        console.log('自动刷新页面预览');
        requestThumbnail();
      }
    }, 1000); // 1秒刷新一次
  }

  // 启动自动刷新
  startAutoRefresh();

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
    }
  });

  // 建立流式端口连接
  resetStreamConnection();

  // 重置流式连接的函数
  function resetStreamConnection() {
    console.log('重置流式连接...');
    
    // 安全断开现有连接
    if (streamPort) {
      try {
        streamPort.disconnect();
      } catch (error) {
        console.warn('断开流式连接时出错:', error);
      }
      streamPort = null;
    }
    
    // 重新建立连接
    try {
      streamPort = chrome.runtime.connect({ name: "stream" });
      
      // 重新绑定消息监听器
      streamPort.onMessage.addListener((message) => {
        if (message.action === "streamUpdate") {
          console.log('收到流式更新:', {
            chunkLength: message.chunk?.length || 0,
            fullContentLength: message.fullContent?.length || 0,
            isComplete: message.isComplete,
            responseId: message.responseId,
            currentResponseId: currentResponseId,
            isStreamingActive: isStreamingActive
          });
          
          // 首先检查流式状态
          if (!isStreamingActive) {
            console.warn('流式状态未激活，忽略消息');
            return;
          }
          
          // 检查响应ID是否匹配当前分析
          if (message.responseId && currentResponseId && message.responseId !== currentResponseId) {
            console.warn(`收到过期的流式消息 (responseId: ${message.responseId}, 当前: ${currentResponseId})，已忽略`);
            return;
          }
          
          // 检查DOM元素是否存在
          const streamContentDiv = document.getElementById('stream-content');
          if (!streamContentDiv) {
            console.warn('流式内容容器不存在，可能分析已重置');
            return;
          }
          
          // 处理流式更新
          handleStreamUpdate(message.chunk, message.fullContent, message.isComplete, message.responseId);
        }
      });
      
      streamPort.onDisconnect.addListener(() => {
        console.log('流式端口连接断开');
        streamPort = null;
      });
      
      console.log('流式连接重置完成');
    } catch (error) {
      console.error('重新建立流式连接失败:', error);
      streamPort = null;
    }
  }

  function showOverlay(message) {
    const overlayContent = thumbnailOverlay.querySelector('.overlay-content p');
    overlayContent.textContent = message;
    thumbnailOverlay.classList.remove('hidden');
  }

  function hideOverlay() {
    thumbnailOverlay.classList.add('hidden');
  }

  function clearThumbnail() {
    thumbnailImage.src = '';
    selectionBox.style.display = 'none';
    analyzeSelectionButton.disabled = true;
    currentSelectionRatios = null;
    naturalWidth = 0;
    naturalHeight = 0;
    displayWidth = 0;
    displayHeight = 0;
  }

  function requestThumbnail() {
    if (!tabId) {
      showOverlay("无法获取当前标签页信息");
      return;
    }
    
    const now = Date.now();
    const minInterval = 200; // 减少到200ms，提高响应速度
    if (now - lastCaptureTime < minInterval) {
      
      return;
    }
    lastCaptureTime = now;
    
    if (errorCount === 0) {
      hideOverlay();
    } else {
      const currentLang = i18n.getCurrentLanguage();
      const retryMessage = currentLang === 'zh' ? '正在重试获取截图...' : 'Retrying screenshot...';
      showOverlay(retryMessage);
    }
    
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (chrome.runtime.lastError) {
        
        errorCount++;
        if (errorCount >= maxErrorCount) {
          const currentLang = i18n.getCurrentLanguage();
          const serviceUnavailableMessage = currentLang === 'zh' ? '截图服务暂时不可用，将继续自动重试' : 'Screenshot service temporarily unavailable, will continue retrying';
          showOverlay(serviceUnavailableMessage);
        }
        return;
      }
      
      if (response && response.dataUrl) {
        errorCount = 0;
        thumbnailImage.src = response.dataUrl;
        thumbnailImage.onload = () => {
          naturalWidth = thumbnailImage.naturalWidth;
          naturalHeight = thumbnailImage.naturalHeight;
          displayWidth = thumbnailImage.offsetWidth;
          displayHeight = thumbnailImage.offsetHeight;
          
          
          hideOverlay();
          updateSelectionDisplay();
          
          if (displayWidth === 0 || displayHeight === 0) {
            console.warn("Thumbnail display dimensions are zero. May affect selection.");
          }
        };
        thumbnailImage.onerror = () => {
          
          errorCount++;
          const currentLang = i18n.getCurrentLanguage();
          const loadErrorMessage = currentLang === 'zh' ? '无法加载页面缩略图，自动重试中...' : 'Cannot load page thumbnail, retrying...';
          showOverlay(loadErrorMessage);
        };
      } else if (response && response.error) {
        
        errorCount++;
        if (errorCount >= maxErrorCount) {
          const currentLang = i18n.getCurrentLanguage();
          const unavailableMessage = currentLang === 'zh' ? '截图功能暂时不可用，将继续自动重试' : 'Screenshot function temporarily unavailable, will continue retrying';
          showOverlay(unavailableMessage);
        } else {
          const currentLang = i18n.getCurrentLanguage();
          const retryMessage = currentLang === 'zh' ? '正在重试获取截图...' : 'Retrying screenshot...';
          showOverlay(retryMessage);
        }
      } else {
        
        errorCount++;
        if (errorCount >= maxErrorCount) {
          const currentLang = i18n.getCurrentLanguage();
          const serviceErrorMessage = currentLang === 'zh' ? '截图服务异常，将继续自动重试' : 'Screenshot service error, will continue retrying';
          showOverlay(serviceErrorMessage);
        } else {
          const currentLang = i18n.getCurrentLanguage();
          const retryMessage = currentLang === 'zh' ? '正在重试获取截图...' : 'Retrying screenshot...';
          showOverlay(retryMessage);
        }
      }
    });
  }

  // 获取缩略图在容器中的位置和尺寸
  function getThumbnailBounds() {
    if (!thumbnailImage || displayWidth === 0 || displayHeight === 0) {
      return null;
    }
    
    const containerRect = thumbnailContainer.getBoundingClientRect();
    const imageRect = thumbnailImage.getBoundingClientRect();
    
    return {
      left: imageRect.left - containerRect.left,
      top: imageRect.top - containerRect.top,
      width: displayWidth * currentZoom,
      height: displayHeight * currentZoom
    };
  }

  // 应用缩放和平移变换
  function applyTransform() {
    const translateX = currentPanX;
    const translateY = currentPanY;
    
    thumbnailImage.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    thumbnailImage.style.transformOrigin = 'top left';
    
    // 更新显示尺寸
    displayWidth = naturalWidth;
    displayHeight = naturalHeight;
    
    // 只在用户没有进行选择操作时更新选择框位置
    if (!drawing && !isDragging && !isResizing) {
      updateSelectionDisplay();
    }
    
    // 更新缩放级别显示
    updateZoomDisplay();
    
    // 显示缩放信息
    const currentLang = i18n.getCurrentLanguage();
    const zoomMessage = currentLang === 'zh' ? `缩放: ${Math.round(currentZoom * 100)}%` : `Zoom: ${Math.round(currentZoom * 100)}%`;
    showSelectionFeedback(zoomMessage, 'info', 1500);
  }

  // 仅应用平移变换，不触发选择框更新
  function applyPanTransform() {
    const translateX = currentPanX;
    const translateY = currentPanY;
    
    thumbnailImage.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    thumbnailImage.style.transformOrigin = 'top left';
  }

  // 更新缩放级别显示
  function updateZoomDisplay() {
    const zoomLevelSpan = document.getElementById('zoom-level');
    if (zoomLevelSpan) {
      zoomLevelSpan.textContent = Math.round(currentZoom * 100) + '%';
    }
  }

  // 处理缩放
  function handleZoom(delta, centerX = 0, centerY = 0) {
    const oldZoom = currentZoom;
    
    if (delta > 0) {
      currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
    } else {
      currentZoom = Math.max(minZoom, currentZoom - zoomStep);
    }
    
    // 如果缩放级别改变，调整平移以保持缩放中心点
    if (currentZoom !== oldZoom) {
      const zoomRatio = currentZoom / oldZoom;
      
      // 计算相对于容器的中心点
      const containerRect = thumbnailContainer.getBoundingClientRect();
      const relativeX = centerX - containerRect.left;
      const relativeY = centerY - containerRect.top;
      
      // 调整平移以保持缩放中心
      currentPanX = relativeX - (relativeX - currentPanX) * zoomRatio;
      currentPanY = relativeY - (relativeY - currentPanY) * zoomRatio;
      
      // 限制平移范围
      constrainPan();
      
      applyTransform();
    }
  }

  // 限制平移范围，防止图片移出容器太远
  function constrainPan() {
    const containerRect = thumbnailContainer.getBoundingClientRect();
    const scaledWidth = displayWidth * currentZoom;
    const scaledHeight = displayHeight * currentZoom;
    
    // 允许图片部分移出视图，但至少保留20%在视图内
    const minVisibleRatio = 0.2;
    const maxPanX = scaledWidth * (1 - minVisibleRatio);
    const minPanX = -scaledWidth * (1 - minVisibleRatio);
    const maxPanY = scaledHeight * (1 - minVisibleRatio);
    const minPanY = -scaledHeight * (1 - minVisibleRatio);
    
    currentPanX = Math.max(minPanX, Math.min(maxPanX, currentPanX));
    currentPanY = Math.max(minPanY, Math.min(maxPanY, currentPanY));
  }

  // 重置缩放和平移
  function resetTransform() {
    currentZoom = 1.0;
    currentPanX = 0;
    currentPanY = 0;
    applyTransform();
    const currentLang = i18n.getCurrentLanguage();
    const resetMessage = currentLang === 'zh' ? '已重置缩放' : 'Zoom reset';
    showSelectionFeedback(resetMessage, 'info');
  }

  // 更新选择框显示
  function updateSelectionDisplay() {
    // 如果用户正在进行选择操作，不要自动更新位置
    if (drawing || isDragging || isResizing || isPanning) {
      return;
    }
    
    if (!currentSelectionRatios) {
      return;
    }
    
    const bounds = getThumbnailBounds();
    if (!bounds) {
      return;
    }
    
    const left = bounds.left + bounds.width * currentSelectionRatios.x;
    const top = bounds.top + bounds.height * currentSelectionRatios.y;
    const width = bounds.width * currentSelectionRatios.width;
    const height = bounds.height * currentSelectionRatios.height;
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    selectionBox.style.display = 'block';
    
    
  }

  // 更新缩放按钮可见性
  function updateZoomControlsVisibility() {
    const zoomControls = document.querySelector('.zoom-controls');
    if (!zoomControls) return;
    
    // 如果正在进行任何选择操作，隐藏缩放按钮
    const isSelecting = drawing || isDragging || isResizing;
    zoomControls.style.display = isSelecting ? 'none' : 'flex';
  }

  // 鼠标按下事件 - 开始创建选择框或拖拽
  thumbnailContainer.addEventListener('mousedown', (e) => {
    // 检查是否是中键或按住Ctrl的左键（平移模式）
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      isPanning = true;
      
      const containerRect = thumbnailContainer.getBoundingClientRect();
      panStartX = e.clientX - containerRect.left - currentPanX;
      panStartY = e.clientY - containerRect.top - currentPanY;
      
      thumbnailContainer.style.cursor = 'grabbing';
      showSelectionFeedback('平移模式', 'info', 1000);
      return;
    }
    
    if (displayWidth === 0 || displayHeight === 0) {
      console.warn("Thumbnail dimensions not ready for selection.");
      showSelectionFeedback('缩略图尚未加载完成，请稍后再试', 'warning');
      return;
    }

    const bounds = getThumbnailBounds();
    if (!bounds) {
      showSelectionFeedback('无法获取缩略图边界信息', 'error');
      return;
    }
    
    const containerRect = thumbnailContainer.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    // 检查是否点击在调整手柄上
    if (e.target.classList.contains('resize-handle')) {
      startResize(e, e.target.className);
      return;
    }
    
    // 检查是否点击在选择框内（拖拽移动）
    if (e.target === selectionBox || selectionBox.contains(e.target)) {
      startDrag(e);
      return;
    }
    
    // 检查是否点击在缩略图上（创建新选择框）
    if (e.target === thumbnailImage || thumbnailContainer.contains(e.target)) {
      // 计算相对于缩略图的坐标
      const relativeX = mouseX - bounds.left;
      const relativeY = mouseY - bounds.top;
      
      // 严格检查是否在缩略图实际区域内
      if (relativeX >= 0 && relativeX <= bounds.width && 
          relativeY >= 0 && relativeY <= bounds.height &&
          e.target === thumbnailImage) { // 只有点击在图片上才能开始选择
        startNewSelection(mouseX, mouseY, bounds);
        showSelectionFeedback('开始创建选择区域', 'info', 1500);
      } else {
        showSelectionFeedback('请在页面预览图片上点击', 'warning');
      }
    }
    
    e.preventDefault();
    e.stopPropagation();
  });

  let drawing = false;
  let startX_container, startY_container;

  function startNewSelection(mouseX, mouseY, bounds) {
    drawing = true;
    updateZoomControlsVisibility(); // 隐藏缩放按钮
    
    // 确保起始点在缩略图边界内
    const constrainedStartX = Math.max(bounds.left, Math.min(bounds.left + bounds.width, mouseX));
    const constrainedStartY = Math.max(bounds.top, Math.min(bounds.top + bounds.height, mouseY));
    
    startX_container = constrainedStartX;
    startY_container = constrainedStartY;
    
    selectionBox.style.left = constrainedStartX + 'px';
    selectionBox.style.top = constrainedStartY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    
    currentSelectionRatios = null;
    analyzeSelectionButton.disabled = true;
  }

  function startDrag(e) {
    isDragging = true;
    updateZoomControlsVisibility(); // 隐藏缩放按钮
    selectionBox.classList.add('dragging');
    
    const containerRect = thumbnailContainer.getBoundingClientRect();
    dragStartX = e.clientX - containerRect.left;
    dragStartY = e.clientY - containerRect.top;
    
    // 保存当前选择框的像素坐标，避免使用比例计算导致的重置
    originalSelection = {
      left: parseFloat(selectionBox.style.left) || 0,
      top: parseFloat(selectionBox.style.top) || 0,
      width: parseFloat(selectionBox.style.width) || 0,
      height: parseFloat(selectionBox.style.height) || 0
    };
    
    
  }

  function startResize(e, handleClass) {
    isResizing = true;
    updateZoomControlsVisibility(); // 隐藏缩放按钮
    selectionBox.classList.add('resizing');
    
    resizeHandle = handleClass;
    const containerRect = thumbnailContainer.getBoundingClientRect();
    dragStartX = e.clientX - containerRect.left;
    dragStartY = e.clientY - containerRect.top;
    
    // 保存当前选择框的像素坐标，避免使用比例计算导致的重置
    originalSelection = {
      left: parseFloat(selectionBox.style.left) || 0,
      top: parseFloat(selectionBox.style.top) || 0,
      width: parseFloat(selectionBox.style.width) || 0,
      height: parseFloat(selectionBox.style.height) || 0
    };
    
    
  }

  // 鼠标移动事件
  let mouseMoveThrottle = null;
  document.addEventListener('mousemove', (e) => {
    // 防抖处理，提升性能
    if (mouseMoveThrottle) {
      clearTimeout(mouseMoveThrottle);
    }
    
    mouseMoveThrottle = setTimeout(() => {
      const containerRect = thumbnailContainer.getBoundingClientRect();
      const mouseX = e.clientX - containerRect.left;
      const mouseY = e.clientY - containerRect.top;
      
      if (isPanning) {
        // 平移缩略图
        const containerRect = thumbnailContainer.getBoundingClientRect();
        currentPanX = e.clientX - containerRect.left - panStartX;
        currentPanY = e.clientY - containerRect.top - panStartY;
        
        constrainPan();
        applyPanTransform();
      } else if (drawing) {
        // 创建新选择框
        const bounds = getThumbnailBounds();
        if (!bounds) {
          // 如果无法获取边界，停止绘制
          drawing = false;
          updateZoomControlsVisibility(); // 显示缩放按钮
          selectionBox.style.display = 'none';
          return;
        }
        
        // 检查鼠标是否还在缩略图区域内
        const relativeX = mouseX - bounds.left;
        const relativeY = mouseY - bounds.top;
        const isInBounds = relativeX >= -20 && relativeX <= bounds.width + 20 && 
                          relativeY >= -20 && relativeY <= bounds.height + 20;
        
        if (!isInBounds) {
          // 鼠标移出太远，使用边界坐标
          const constrainedMouseX = Math.max(bounds.left, Math.min(bounds.left + bounds.width, mouseX));
          const constrainedMouseY = Math.max(bounds.top, Math.min(bounds.top + bounds.height, mouseY));
          
          const width = Math.abs(constrainedMouseX - startX_container);
          const height = Math.abs(constrainedMouseY - startY_container);
          
          const newLeft = Math.min(startX_container, constrainedMouseX);
          const newTop = Math.min(startY_container, constrainedMouseY);
          
          selectionBox.style.left = newLeft + 'px';
          selectionBox.style.top = newTop + 'px';
          selectionBox.style.width = width + 'px';
          selectionBox.style.height = height + 'px';
          
          if (width >= 5 && height >= 5) {
            showSelectionFeedback(`创建中: ${Math.round(width)}×${Math.round(height)} 像素`, 'info', 500);
          }
        } else {
          // 正常绘制逻辑
          const width = Math.abs(mouseX - startX_container);
          const height = Math.abs(mouseY - startY_container);
          
          const newLeft = Math.min(startX_container, mouseX);
          const newTop = Math.min(startY_container, mouseY);
          
          // 限制选择框在缩略图边界内
          const constrainedLeft = Math.max(bounds.left, Math.min(bounds.left + bounds.width, newLeft));
          const constrainedTop = Math.max(bounds.top, Math.min(bounds.top + bounds.height, newTop));
          const constrainedRight = Math.max(bounds.left, Math.min(bounds.left + bounds.width, newLeft + width));
          const constrainedBottom = Math.max(bounds.top, Math.min(bounds.top + bounds.height, newTop + height));
          
          const constrainedWidth = constrainedRight - constrainedLeft;
          const constrainedHeight = constrainedBottom - constrainedTop;
          
          selectionBox.style.left = constrainedLeft + 'px';
          selectionBox.style.top = constrainedTop + 'px';
          selectionBox.style.width = Math.max(0, constrainedWidth) + 'px';
          selectionBox.style.height = Math.max(0, constrainedHeight) + 'px';
          
          // 实时显示选择信息
          if (constrainedWidth >= 5 && constrainedHeight >= 5) {
            showSelectionFeedback(`创建中: ${Math.round(constrainedWidth)}×${Math.round(constrainedHeight)} 像素`, 'info', 500);
          }
        }
      } else if (isDragging) {
        // 拖拽移动选择框
        const deltaX = mouseX - dragStartX;
        const deltaY = mouseY - dragStartY;
        
        const bounds = getThumbnailBounds();
        if (bounds) {
          const newLeft = Math.max(bounds.left, 
            Math.min(bounds.left + bounds.width - originalSelection.width, 
              originalSelection.left + deltaX));
          const newTop = Math.max(bounds.top,
            Math.min(bounds.top + bounds.height - originalSelection.height,
              originalSelection.top + deltaY));
          
          selectionBox.style.left = newLeft + 'px';
          selectionBox.style.top = newTop + 'px';
        }
      } else if (isResizing) {
        // 调整选择框大小
        handleResize(mouseX, mouseY);
      }
    }, 8); // 8ms 防抖，约120fps
  });

  // 处理选择框调整大小
  function handleResize(mouseX, mouseY) {
    const bounds = getThumbnailBounds();
    if (!bounds) return;
    
    const deltaX = mouseX - dragStartX;
    const deltaY = mouseY - dragStartY;
    
    let newLeft = originalSelection.left;
    let newTop = originalSelection.top;
    let newWidth = originalSelection.width;
    let newHeight = originalSelection.height;
    
    if (resizeHandle.includes('handle-n')) {
      const proposedTop = originalSelection.top + deltaY;
      newTop = Math.max(bounds.top, Math.min(bounds.top + bounds.height - 5, proposedTop));
      newHeight = originalSelection.height + (originalSelection.top - newTop);
    }
    if (resizeHandle.includes('handle-s')) {
      const maxHeight = bounds.top + bounds.height - originalSelection.top;
      newHeight = Math.max(5, Math.min(maxHeight, originalSelection.height + deltaY));
    }
    if (resizeHandle.includes('handle-w')) {
      const proposedLeft = originalSelection.left + deltaX;
      newLeft = Math.max(bounds.left, Math.min(bounds.left + bounds.width - 5, proposedLeft));
      newWidth = originalSelection.width + (originalSelection.left - newLeft);
    }
    if (resizeHandle.includes('handle-e')) {
      const maxWidth = bounds.left + bounds.width - originalSelection.left;
      newWidth = Math.max(5, Math.min(maxWidth, originalSelection.width + deltaX));
    }
    
    // 确保最小尺寸（降低到5px）
    newWidth = Math.max(5, newWidth);
    newHeight = Math.max(5, newHeight);
    
    // 确保不超出边界
    if (newLeft + newWidth > bounds.left + bounds.width) {
      newWidth = bounds.left + bounds.width - newLeft;
    }
    if (newTop + newHeight > bounds.top + bounds.height) {
      newHeight = bounds.top + bounds.height - newTop;
    }
    
    selectionBox.style.left = newLeft + 'px';
    selectionBox.style.top = newTop + 'px';
    selectionBox.style.width = newWidth + 'px';
    selectionBox.style.height = newHeight + 'px';
    
    // 实时显示调整信息
    const tempWidth = Math.round(newWidth);
    const tempHeight = Math.round(newHeight);
  }

  // 鼠标释放事件
  document.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      thumbnailContainer.style.cursor = '';
      showSelectionFeedback('平移完成', 'info', 1000);
      // 平移结束后更新选择框显示
      updateSelectionDisplay();
    } else if (drawing) {
      drawing = false;
      updateZoomControlsVisibility(); // 显示缩放按钮
      finalizeSelection();
    } else if (isDragging) {
      isDragging = false;
      updateZoomControlsVisibility(); // 显示缩放按钮
      selectionBox.classList.remove('dragging');
      finalizeSelection();
    } else if (isResizing) {
      isResizing = false;
      updateZoomControlsVisibility(); // 显示缩放按钮
      selectionBox.classList.remove('resizing');
      resizeHandle = null;
      finalizeSelection();
    }
  });

  // 双击清除选择
  thumbnailContainer.addEventListener('dblclick', (e) => {
    if (e.target === thumbnailImage || e.target === thumbnailContainer) {
      clearSelection();
      showSelectionFeedback('已清除选择区域', 'info');
    }
  });

  // 右键菜单功能
  thumbnailContainer.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    
    if (currentSelectionRatios) {
      showSelectionContextMenu(e.clientX, e.clientY);
    } else {
      showSelectionFeedback('请先创建选择区域', 'warning');
    }
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSelection();
      showSelectionFeedback('已取消选择', 'info');
    } else if (e.key === 'Delete' && currentSelectionRatios) {
      clearSelection();
      showSelectionFeedback('已删除选择区域', 'info');
    } else if (e.key === '0' && e.ctrlKey) {
      // Ctrl+0 重置缩放
      e.preventDefault();
      resetTransform();
    }
  });

  // 鼠标滚轮缩放
  thumbnailContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    
    // 获取鼠标位置作为缩放中心
    const centerX = e.clientX;
    const centerY = e.clientY;
    
    // 处理缩放
    handleZoom(-e.deltaY / 100, centerX, centerY);
  });

  // 清除选择的函数
  function clearSelection() {
    selectionBox.style.display = 'none';
    currentSelectionRatios = null;
    analyzeSelectionButton.disabled = true;
    
    // 清除相关状态
    drawing = false;
    isDragging = false;
    isResizing = false;
    resizeHandle = null;
    
    updateZoomControlsVisibility(); // 显示缩放按钮
  }

  // 显示右键菜单
  function showSelectionContextMenu(x, y) {
    // 移除现有菜单
    const existingMenu = document.getElementById('selection-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'selection-context-menu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.zIndex = '2000';

    const menuItems = [
      {
        label: '分析选中区域',
        action: () => {
          if (currentSelectionRatios) {
            performAnalysis(true);
          }
        }
      },
      {
        label: '复制选择信息',
        action: () => {
          if (currentSelectionRatios) {
            const info = `选择区域: ${(currentSelectionRatios.width * 100).toFixed(1)}% × ${(currentSelectionRatios.height * 100).toFixed(1)}%`;
            navigator.clipboard.writeText(info);
          }
        }
      },
      {
        label: '清除选择',
        action: () => {
          clearSelection();
          showSelectionFeedback('已清除选择区域', 'info');
        }
      },
      { label: '---' }, // 分隔线
      {
        label: `缩放: ${Math.round(currentZoom * 100)}%`,
        action: () => {} // 只显示信息，不执行动作
      },
      {
        label: '放大 (+)',
        action: () => {
          const containerRect = thumbnailContainer.getBoundingClientRect();
          handleZoom(1, containerRect.left + containerRect.width / 2, containerRect.top + containerRect.height / 2);
        }
      },
      {
        label: '缩小 (-)',
        action: () => {
          const containerRect = thumbnailContainer.getBoundingClientRect();
          handleZoom(-1, containerRect.left + containerRect.width / 2, containerRect.top + containerRect.height / 2);
        }
      },
      {
        label: '重置缩放',
        action: () => {
          resetTransform();
        }
      }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      
      if (item.label === '---') {
        // 分隔线
        menuItem.className = 'context-menu-separator';
      } else {
        menuItem.className = 'context-menu-item';
        menuItem.textContent = item.label;
        
        // 如果有动作函数，添加点击事件
        if (item.action && typeof item.action === 'function') {
          menuItem.onclick = () => {
            item.action();
            menu.remove();
          };
        } else {
          // 没有动作的项目（如显示信息的项目）
          menuItem.style.color = '#999';
          menuItem.style.cursor = 'default';
        }
      }
      
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // 点击其他地方关闭菜单
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 10);
  }

  function finalizeSelection() {
    
    
    const bounds = getThumbnailBounds();
    if (!bounds) {
      return;
    }
    
    const selectionLeft = parseFloat(selectionBox.style.left) || 0;
    const selectionTop = parseFloat(selectionBox.style.top) || 0;
    const selectionWidth = parseFloat(selectionBox.style.width) || 0;
    const selectionHeight = parseFloat(selectionBox.style.height) || 0;

    
    

    // 降低最小尺寸要求，支持更小范围的选择
    const minSize = 5; // 从20px降低到5px
    if (selectionWidth < minSize || selectionHeight < minSize) {
      selectionBox.style.display = 'none';
      analyzeSelectionButton.disabled = true;
      currentSelectionRatios = null;
      showSelectionFeedback('选择区域太小，请选择至少5x5像素的区域', 'warning');
      return;
    }

    // 精确计算相对于缩略图的位置
    const relativeLeft = selectionLeft - bounds.left;
    const relativeTop = selectionTop - bounds.top;
    
    // 检查选择框是否完全在缩略图内
    if (relativeLeft < 0 || relativeTop < 0 || 
        relativeLeft + selectionWidth > bounds.width || 
        relativeTop + selectionHeight > bounds.height) {
      showSelectionFeedback('选择区域超出了页面范围，请重新选择', 'error');
      // 自动修正到边界内
      const correctedLeft = Math.max(bounds.left, Math.min(bounds.left + bounds.width - selectionWidth, selectionLeft));
      const correctedTop = Math.max(bounds.top, Math.min(bounds.top + bounds.height - selectionHeight, selectionTop));
      const correctedWidth = Math.min(selectionWidth, bounds.width - (correctedLeft - bounds.left));
      const correctedHeight = Math.min(selectionHeight, bounds.height - (correctedTop - bounds.top));
      
      selectionBox.style.left = correctedLeft + 'px';
      selectionBox.style.top = correctedTop + 'px';
      selectionBox.style.width = correctedWidth + 'px';
      selectionBox.style.height = correctedHeight + 'px';
      
      // 重新计算修正后的相对位置
      const newRelativeLeft = correctedLeft - bounds.left;
      const newRelativeTop = correctedTop - bounds.top;
      
      currentSelectionRatios = {
        x: newRelativeLeft / bounds.width,
        y: newRelativeTop / bounds.height,
        width: correctedWidth / bounds.width,
        height: correctedHeight / bounds.height
      };
    } else {
      // 计算相对于缩略图的比例
      currentSelectionRatios = {
        x: relativeLeft / bounds.width,
        y: relativeTop / bounds.height,
        width: selectionWidth / bounds.width,
        height: selectionHeight / bounds.height
      };
    }
    
    // 确保比例在有效范围内（使用更高精度）
    currentSelectionRatios.x = Math.max(0, Math.min(1, currentSelectionRatios.x));
    currentSelectionRatios.y = Math.max(0, Math.min(1, currentSelectionRatios.y));
    currentSelectionRatios.width = Math.max(0, Math.min(1 - currentSelectionRatios.x, currentSelectionRatios.width));
    currentSelectionRatios.height = Math.max(0, Math.min(1 - currentSelectionRatios.y, currentSelectionRatios.height));

    // 显示选择信息
    const areaPercent = (currentSelectionRatios.width * currentSelectionRatios.height * 100).toFixed(1);
    showSelectionFeedback(`已选择 ${Math.round(selectionWidth)}×${Math.round(selectionHeight)} 像素区域 (${areaPercent}% 页面)`, 'success');
    
    
    analyzeSelectionButton.disabled = false;
  }

  // 分析选中范围
  analyzeSelectionButton.addEventListener('click', () => {
    if (currentSelectionRatios) {
      performAnalysis(true);
    }
  });

  // 分析整个页面
  analyzePageButton.addEventListener('click', () => {
    performAnalysis(false);
  });

  // 缩放控制按钮事件
  document.getElementById('zoom-in').addEventListener('click', () => {
    const containerRect = thumbnailContainer.getBoundingClientRect();
    handleZoom(1, containerRect.left + containerRect.width / 2, containerRect.top + containerRect.height / 2);
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    const containerRect = thumbnailContainer.getBoundingClientRect();
    handleZoom(-1, containerRect.left + containerRect.width / 2, containerRect.top + containerRect.height / 2);
  });

  document.getElementById('zoom-reset').addEventListener('click', () => {
    resetTransform();
  });

  function performAnalysis(isSelection) {
    // 完全重置所有状态，避免前一次分析的影响
    console.log('开始新的分析，重置所有状态...');
    
    // 1. 停止任何进行中的流式传输
    isStreamingActive = false;
    streamBuffer = '';
    userHasScrolled = false;
    lastScrollTop = 0;
    currentResponseId = null;
    
    // 停止现有的打字机渲染器
    if (typewriterRenderer) {
      typewriterRenderer.stop();
      typewriterRenderer = null;
    }
    
    // 2. 清理定时器
    if (renderTimer) {
      cancelAnimationFrame(renderTimer);
      renderTimer = null;
    }
    
    // 3. 重置流式连接
    resetStreamConnection();
    
    // 4. 完全清空分析结果容器
    analysisResultDiv.innerHTML = '';
    
    // 5. 强制重绘，确保UI立即更新
    analysisResultDiv.offsetHeight; // 触发重排
    
    // 6. 隐藏返回底部按钮
    hideBackToBottomButton();
    
    // 7. 创建全新的流式界面
    const loadingMessage = isSelection ? getText('analysis_in_progress') + " (" + getText('analyze_selection') + ")" : getText('analysis_in_progress') + " (" + getText('analyze_page') + ")";
    analysisResultDiv.innerHTML = `
      <div class="streaming-container">
        <div class="streaming-header">
          <div class="loading-message">${loadingMessage}</div>
          <button id="cancel-stream" class="cancel-button" style="display: none;" title="${getText('stop_analysis')}">
          </button>
        </div>
        <div id="stream-content" class="stream-content"></div>
      </div>
    `;
    
    // 8. 获取取消按钮引用并绑定新的事件处理器
    cancelStreamButton = document.getElementById('cancel-stream');
    
    const message = {
      action: "extractAndAnalyze",
      isSelection: isSelection,
      text: isSelection ? 
        `请求提取页面选中区域的文本（区域相对比例: x=${currentSelectionRatios.x.toFixed(3)}, y=${currentSelectionRatios.y.toFixed(3)}, w=${currentSelectionRatios.width.toFixed(3)}, h=${currentSelectionRatios.height.toFixed(3)}）` :
        "请求提取并分析整个页面的文本内容"
    };
    
    if (isSelection) {
      message.selectionRatios = currentSelectionRatios;
    }
    
    // 立即激活流式状态，等待接收消息
    isStreamingActive = true;
    console.log('流式状态已激活，等待分析结果...');
    
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        // 出错时重置状态
        isStreamingActive = false;
        analysisResultDiv.innerHTML = `<div class="error-message">${getText('analysis_failed')}: ${chrome.runtime.lastError.message}</div>`;
        return;
      }
      
      if (response && response.success) {
        if (response.isStreaming && response.streamStart) {
          // 确认流式输出已开始，设置当前响应ID
          currentResponseId = response.responseId;
          console.log('后台确认流式输出已开始，响应ID:', currentResponseId);
          streamBuffer = '';
          
          // 初始化打字机渲染器
          const streamContentDiv = document.getElementById('stream-content');
          if (streamContentDiv) {
            typewriterRenderer = new TypewriterRenderer(streamContentDiv, {
              charDelay: 1 // 每个字符1毫秒延迟，提供更平滑的体验
            });
            typewriterRenderer.start();
          }
          
          // 显示取消按钮并绑定事件处理器
          if (cancelStreamButton) {
            cancelStreamButton.style.display = 'inline-block';
            
            // 清理旧的事件监听器（如果存在）
            cancelStreamButton.onclick = null;
            
            // 绑定新的取消事件处理器
            cancelStreamButton.onclick = () => {
              console.log('用户取消分析');
              
              // 1. 立即停用流式状态
              isStreamingActive = false;
              
              // 2. 通知后端中断当前流式响应
              if (currentResponseId) {
                chrome.runtime.sendMessage({
                  action: "cancelAnalysis",
                  responseId: currentResponseId
                }, (response) => {
                  if (chrome.runtime.lastError) {
                    console.warn('通知后端取消分析失败:', chrome.runtime.lastError.message);
                  } else {
                    console.log('已通知后端取消分析:', response);
                  }
                });
              }
              
              // 3. 停止打字机渲染器
              if (typewriterRenderer) {
                typewriterRenderer.stop();
                typewriterRenderer = null;
              }
              
              // 4. 清理定时器
              if (renderTimer) {
                cancelAnimationFrame(renderTimer);
                renderTimer = null;
              }
              
              // 5. 优化中断后的内容显示
              const streamContentDiv = document.getElementById('stream-content');
              if (streamContentDiv && streamBuffer) {
                // 渲染已有的内容，然后重构整个布局
                renderMarkdownContent(streamBuffer, streamContentDiv);
                
                // 重构布局，移除空白区域
                setTimeout(() => {
                  const content = streamContentDiv.innerHTML;
                  if (content.trim()) {
                    // 如果有内容，直接显示在分析结果区域
                    analysisResultDiv.innerHTML = content;
                  } else {
                    // 如果没有内容，显示中断消息
                    analysisResultDiv.innerHTML = `<div class="info-message">${getText('analysis_cancelled')}</div>`;
                  }
                }, 100);
              } else {
                // 如果没有流式内容，显示中断消息
                analysisResultDiv.innerHTML = `<div class="info-message">${getText('analysis_cancelled')}</div>`;
              }
              
              // 6. 隐藏取消按钮和加载状态（延迟执行避免闪烁）
              setTimeout(() => {
                if (cancelStreamButton) {
                  cancelStreamButton.style.display = 'none';
                }
                const loadingDiv = analysisResultDiv.querySelector('.loading-message');
                if (loadingDiv) {
                  loadingDiv.style.display = 'none';
                }
                const streamingContainer = analysisResultDiv.querySelector('.streaming-container');
                if (streamingContainer) {
                  // 移除流式容器的结构，只保留内容
                  const streamContent = streamingContainer.querySelector('.stream-content');
                  if (streamContent && streamContent.innerHTML.trim()) {
                    analysisResultDiv.innerHTML = streamContent.innerHTML;
                  }
                }
                             }, 150);
               
               // 7. 隐藏返回底部按钮
               hideBackToBottomButton();
               
               // 8. 重置状态
              streamBuffer = '';
              userHasScrolled = false;
              lastScrollTop = 0;
              currentResponseId = null;
              
              console.log('分析取消完成');
            };
          }
          
          // 更新加载消息
          const loadingDiv = analysisResultDiv.querySelector('.loading-message');
          if (loadingDiv) {
            const currentLang = i18n.getCurrentLanguage();
        loadingDiv.textContent = getText('analysis_in_progress');
          }
        } else {
          // 非流式响应（备用处理）
          const result = response.result || "分析完成，但没有返回结果";
          renderMarkdownContent(result);
        }
      } else {
        analysisResultDiv.innerHTML = `<div class="error-message">分析失败: ${response ? response.error : "未知错误"}</div>`;
      }
    });
  }

  // 防抖渲染函数
  function debouncedRender(content, targetElement, isComplete = false, responseId = null) {
    if (renderTimer) {
      cancelAnimationFrame(renderTimer);
    }
    
    renderTimer = requestAnimationFrame(() => {
      // 验证响应ID，防止渲染过期内容
      if (responseId && currentResponseId && responseId !== currentResponseId) {
        console.warn(`跳过过期渲染 (responseId: ${responseId}, 当前: ${currentResponseId})`);
        return;
      }
      
      // 再次检查流式状态
      if (!isStreamingActive) {
        console.warn('流式状态已停用，跳过渲染');
        return;
      }
      
      renderMarkdownContent(content, targetElement);
      
      // 智能滚动到底部
      if (!userHasScrolled) {
        scrollToBottom(targetElement || analysisResultDiv);
      }
      
      if (isComplete) {
        // 流式传输完成的最终处理
        completeStreamRendering();
      }
    });
  }
  
  // 智能滚动到底部
  function scrollToBottom(element) {
    const container = element.closest('#analysis-result-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
  
  // 显示返回底部按钮
  function showBackToBottomButton() {
    if (!isStreamingActive) return;
    
    let backToBottomBtn = document.getElementById('back-to-bottom-btn');
    if (!backToBottomBtn) {
      const container = document.getElementById('analysis-result-container');
      if (container) {
        backToBottomBtn = document.createElement('button');
        backToBottomBtn.id = 'back-to-bottom-btn';
        backToBottomBtn.className = 'back-to-bottom-btn';
        const currentLang = i18n.getCurrentLanguage();
        backToBottomBtn.innerHTML = currentLang === 'zh' ? '↓ 返回底部' : '↓ Back to Bottom';
        backToBottomBtn.title = getText('back_to_bottom');
        
        backToBottomBtn.addEventListener('click', () => {
          scrollToBottom(analysisResultDiv);
          userHasScrolled = false;
          hideBackToBottomButton();
        });
        
        container.appendChild(backToBottomBtn);
      }
    }
    
    if (backToBottomBtn) {
      backToBottomBtn.style.display = 'block';
    }
  }
  
  // 隐藏返回底部按钮
  function hideBackToBottomButton() {
    const backToBottomBtn = document.getElementById('back-to-bottom-btn');
    if (backToBottomBtn) {
      backToBottomBtn.style.display = 'none';
    }
  }
  
  // 完成流式渲染
  function completeStreamRendering() {
    console.log('完成流式渲染，开始清理...');
    
    // 彻底停用流式状态
    isStreamingActive = false;
    
    // 停止打字机渲染器
    if (typewriterRenderer) {
      typewriterRenderer.stop();
      typewriterRenderer = null;
    }
    
    // 清理定时器
    if (renderTimer) {
      cancelAnimationFrame(renderTimer);
      renderTimer = null;
    }
    
    // 优化完成后的布局，移除流式容器结构
    setTimeout(() => {
      const streamingContainer = analysisResultDiv.querySelector('.streaming-container');
      if (streamingContainer) {
        const streamContent = streamingContainer.querySelector('.stream-content');
        if (streamContent && streamContent.innerHTML.trim()) {
          // 直接将内容移到分析结果区域，移除多余结构
          analysisResultDiv.innerHTML = streamContent.innerHTML;
        }
      }
    }, 200);
    
    // 隐藏加载消息和取消按钮
    const loadingDiv = analysisResultDiv.querySelector('.loading-message');
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }
    
    if (cancelStreamButton) {
      cancelStreamButton.style.display = 'none';
      // 清理事件监听器
      cancelStreamButton.onclick = null;
      cancelStreamButton = null;
    }
    
    // 隐藏返回底部按钮
    hideBackToBottomButton();
    
    // 最终渲染完整内容，清理流式容器
    if (streamBuffer) {
      renderMarkdownContent(streamBuffer);
    }
    
    // 重置所有相关状态
    streamBuffer = '';
    userHasScrolled = false;
    lastScrollTop = 0;
    currentResponseId = null;
    
    console.log('流式渲染清理完成');
  }

  // 处理流式更新
  function handleStreamUpdate(chunk, fullContent, isComplete, responseId = null) {
    // 严格的状态检查，防止过期消息处理
    if (!isStreamingActive) {
      return;
    }
    
    // 验证响应ID
    if (responseId && currentResponseId && responseId !== currentResponseId) {
      return;
    }
    
    // 更新缓冲区
    streamBuffer = fullContent || '';
    
    // 使用打字机渲染器更新内容
    if (typewriterRenderer && typewriterRenderer.isActive) {
      typewriterRenderer.updateContent(streamBuffer);
    } else {
      // 回退到直接渲染
      const streamContentDiv = document.getElementById('stream-content');
      if (streamContentDiv) {
        renderMarkdownContent(streamBuffer, streamContentDiv);
      }
    }
    
    // 智能滚动到底部（减少频率）
    if (!userHasScrolled) {
      requestAnimationFrame(() => {
        const streamContentDiv = document.getElementById('stream-content');
        if (streamContentDiv) {
          scrollToBottom(streamContentDiv);
        }
      });
    }
    
    // 如果流式传输完成，执行最终处理
    if (isComplete) {
      setTimeout(() => {
        if (typewriterRenderer && typewriterRenderer.isActive) {
          typewriterRenderer.forceComplete(streamBuffer);
        }
        completeStreamRendering();
      }, 100); // 减少延迟
    }
  }
  
  // 渲染Markdown内容
  function renderMarkdownContent(content, targetElement = null) {
    const target = targetElement || analysisResultDiv;
    
    if (typeof marked !== 'undefined') {
      try {
        const htmlContent = marked.parse(content);
        target.innerHTML = htmlContent;
      } catch (error) {
        
        const currentLang = i18n.getCurrentLanguage();
        const errorMessage = currentLang === 'zh' ? 'Markdown解析失败' : 'Markdown parsing failed';
        target.innerHTML = `<div class="error-message">${errorMessage}</div><pre>${escapeHtml(content)}</pre>`;
      }
    } else {
      // 如果marked库未加载，回退到纯文本显示
      target.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
    }
  }
  
  // 初始化国际化
  function initializeI18n() {
    // 注册语言包
    if (typeof zh !== 'undefined') {
      i18n.registerLanguage('zh', zh);
    }
    if (typeof en !== 'undefined') {
      i18n.registerLanguage('en', en);
    }
    
    // 初始化i18n管理器
    i18n.init();
    
    // 添加语言切换按钮事件
    const languageToggleSide = document.getElementById('languageToggleSide');
    const languageLabelSide = document.getElementById('languageLabelSide');
    
    if (languageToggleSide && languageLabelSide) {
      languageToggleSide.addEventListener('click', () => {
        // 切换语言
        i18n.toggleLanguage();
        
        // 立即更新界面
        updateLanguageLabelSide();
        i18n.updateTexts();
        updateSidepanelTexts();
        
        // 显示状态提示
        showSelectionFeedback(getText('language_switched'), 'success');
      });
      
      // 初始化语言标签
      updateLanguageLabelSide();
    }
    
    // 监听语言变化事件
    i18n.addLanguageChangeListener((newLang) => {
      updateLanguageLabelSide();
      updateSidepanelTexts();
    });
    
    // 监听文本更新事件
    window.addEventListener('i18nTextUpdated', () => {
      updateSidepanelTexts();
    });
  }
  
  // 更新侧边栏语言切换按钮标签
  function updateLanguageLabelSide() {
    const languageLabelSide = document.getElementById('languageLabelSide');
    if (languageLabelSide) {
      const currentLang = i18n.getCurrentLanguage();
      languageLabelSide.textContent = currentLang === 'zh' ? '中' : 'EN';
    }
  }
  
  // 更新侧边栏中需要特殊处理的文本
  function updateSidepanelTexts() {
    const currentLang = i18n.getCurrentLanguage();
    
    // 更新缩放控制按钮的title属性
    const zoomControls = document.querySelectorAll('.zoom-control');
    zoomControls.forEach(control => {
      const zoomValue = control.getAttribute('data-zoom');
      if (zoomValue === 'in') {
        control.title = getText('zoom_in');
      } else if (zoomValue === 'out') {
        control.title = getText('zoom_out');
      } else if (zoomValue === 'reset') {
        control.title = getText('zoom_reset');
      }
    });
    
    // 更新返回底部按钮文本（如果存在）
    const backToBottomBtn = document.getElementById('back-to-bottom-btn');
    if (backToBottomBtn) {
      backToBottomBtn.innerHTML = currentLang === 'zh' ? '↓ 返回底部' : '↓ Back to Bottom';
      backToBottomBtn.title = getText('back_to_bottom');
    }
    
    // 更新分析按钮状态
    if (analyzeSelectionButton) {
      analyzeSelectionButton.disabled = !currentSelectionRatios;
    }
    
    // 如果有错误消息在显示，需要更新
    const errorMessages = document.querySelectorAll('.error-message');
    errorMessages.forEach(msg => {
      const text = msg.textContent;
      if (text.includes('无法获取当前标签页信息') || text.includes('Cannot get current tab information')) {
        msg.textContent = getText('cannot_get_tab_info');
      } else if (text.includes('截图失败') || text.includes('Screenshot failed')) {
        msg.textContent = getText('screenshot_failed');
      } else if (text.includes('分析失败') || text.includes('Analysis failed')) {
        msg.textContent = getText('analysis_failed');
      }
    });
    
    // 更新选择相关的反馈文本
    const feedbackElements = document.querySelectorAll('.selection-feedback');
    feedbackElements.forEach(feedback => {
      const text = feedback.textContent;
      if (text.includes('选择已清除') || text.includes('Selection cleared')) {
        feedback.textContent = getText('selection_cleared');
      } else if (text.includes('选择已确定') || text.includes('Selection finalized')) {
        feedback.textContent = getText('selection_finalized');
      }
    });
  }

  // 主题管理函数
  function loadTheme() {
    chrome.storage.sync.get(['currentTheme'], (result) => {
      if (chrome.runtime.lastError) {
        
        return;
      }
      
      currentTheme = result.currentTheme || 'light';
      applyTheme(currentTheme);
    });

    // 监听storage变化，实时同步主题和语言设置
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.currentTheme) {
        const newTheme = changes.currentTheme.newValue;
        if (newTheme !== currentTheme) {
          currentTheme = newTheme;
          applyTheme(currentTheme);
        }
      }
      
      // 监听语言变化，实现跨页面语言同步
      if (namespace === 'sync' && changes.currentLanguage) {
        const newLanguage = changes.currentLanguage.newValue;
        if (newLanguage !== i18n.getCurrentLanguage()) {
          i18n.setLanguage(newLanguage);
          updateLanguageLabelSide();
          i18n.updateTexts();
          updateSidepanelTexts();
        }
      }
    });
  }

  function applyTheme(theme) {
    currentTheme = theme;
    document.body.className = theme + '-theme';
    
    // 如果是自动主题，检测系统主题
    if (theme === 'auto') {
      const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.body.className = (prefersDarkMode ? 'dark' : 'light') + '-theme';
      
      // 监听系统主题变化
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (currentTheme === 'auto') {
          document.body.className = (e.matches ? 'dark' : 'light') + '-theme';
        }
      });
    }
  }
});