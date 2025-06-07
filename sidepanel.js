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

  let refreshInterval = null;

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

  // 初始化
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].id) {
      tabId = tabs[0].id;
      currentTabUrl = tabs[0].url;
      requestThumbnail();
      
      // 启动自动刷新机制
      startAutoRefresh();
    } else {
      
      analysisResultDiv.innerHTML = `<div class="error-message">${getText('cannot_get_tab_info')}</div>`;
      analyzePageButton.disabled = true;
      analyzeSelectionButton.disabled = true; 
    }
  });

  // 监听窗口尺寸变化
  window.addEventListener('resize', () => {
    // 只在用户没有进行选择操作时更新选择框位置
    if (!drawing && !isDragging && !isResizing && !isPanning) {
      updateSelectionDisplay();
    }
  });

  // 启动自动刷新
  function startAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
      // 只在页面可见时刷新
      if (document.hidden) {
        
        return;
      }
      
      // 检查当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id) {
          const newTabId = tabs[0].id;
          const newTabUrl = tabs[0].url;
          
          if (newTabId !== tabId) {
            
            tabId = newTabId;
            currentTabUrl = newTabUrl;
            clearThumbnail();
            errorCount = 0;
          } else if (newTabUrl !== currentTabUrl) {
            
            currentTabUrl = newTabUrl;
            clearThumbnail();
            errorCount = 0;
          }
          
          // 自动尝试截图
          if (errorCount < maxErrorCount) {
            requestThumbnail();
          }
        }
      });
    }, 500);
  }

  // 停止自动刷新
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
  });

  // 建立流式端口连接
  streamPort = chrome.runtime.connect({ name: "stream" });
  streamPort.onMessage.addListener((message) => {
    if (message.action === "streamUpdate") {
      handleStreamUpdate(message.chunk, message.fullContent, message.isComplete);
    }
  });
  
  streamPort.onDisconnect.addListener(() => {
    
    streamPort = null;
  });

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
    const minInterval = 500;
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
      finalizeSelection();
    } else if (isDragging) {
      isDragging = false;
      selectionBox.classList.remove('dragging');
      finalizeSelection();
    } else if (isResizing) {
      isResizing = false;
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
    // 重置流式状态
    isStreamingActive = false;
    streamBuffer = '';
    
    // 创建优化的流式界面
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
    
    // 获取取消按钮引用
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
    
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        analysisResultDiv.innerHTML = `<div class="error-message">${getText('analysis_failed')}: ${chrome.runtime.lastError.message}</div>`;
        return;
      }
      
      if (response && response.success) {
        if (response.isStreaming && response.streamStart) {
          // 开始流式输出
          isStreamingActive = true;
          streamBuffer = '';
          
          // 显示取消按钮
          if (cancelStreamButton) {
            cancelStreamButton.style.display = 'inline-block';
            cancelStreamButton.onclick = () => {
              isStreamingActive = false;
              
              // 保留已显示的内容，添加中断标识
              const streamContentDiv = document.getElementById('stream-content');
              if (streamContentDiv && streamBuffer) {
                // 先渲染已有的Markdown内容
                renderMarkdownContent(streamBuffer, streamContentDiv);
              } else {
                // 如果没有流式内容，显示中断消息
                analysisResultDiv.innerHTML = `<div class="info-message">${getText('analysis_cancelled')}</div>`;
              }
              
              // 隐藏取消按钮和加载状态
              cancelStreamButton.style.display = 'none';
              const loadingDiv = analysisResultDiv.querySelector('.loading-message');
              if (loadingDiv) {
                loadingDiv.style.display = 'none';
              }
              
              // 隐藏返回底部按钮
              hideBackToBottomButton();
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
  function debouncedRender(content, targetElement, isComplete = false) {
    if (renderTimer) {
      cancelAnimationFrame(renderTimer);
    }
    
    renderTimer = requestAnimationFrame(() => {
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
    isStreamingActive = false;
    
    // 隐藏加载消息和取消按钮
    const loadingDiv = analysisResultDiv.querySelector('.loading-message');
    if (loadingDiv) {
      loadingDiv.style.display = 'none';
    }
    
    if (cancelStreamButton) {
      cancelStreamButton.style.display = 'none';
    }
    
    // 隐藏返回底部按钮
    hideBackToBottomButton();
    
    // 最终渲染完整内容，清理流式容器
    renderMarkdownContent(streamBuffer);
    
    // 重置用户滚动状态
    userHasScrolled = false;
  }

  // 处理流式更新
  function handleStreamUpdate(chunk, fullContent, isComplete) {
    
    
    if (!isStreamingActive) {
      
      return; // 如果流已被取消，忽略更新
    }
    
    streamBuffer = fullContent;
    
    const streamContentDiv = document.getElementById('stream-content');
    if (streamContentDiv) {
      // 使用防抖渲染
      debouncedRender(streamBuffer, streamContentDiv, isComplete);
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