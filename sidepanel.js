document.addEventListener('DOMContentLoaded', () => {
  const thumbnailContainer = document.getElementById('thumbnail-container');
  const thumbnailImage = document.getElementById('thumbnail-image');
  const selectionBox = document.getElementById('selection-box');
  const analyzeSelectionButton = document.getElementById('analyze-selection');
  const analyzePageButton = document.getElementById('analyze-page');
  const analysisResultDiv = document.getElementById('analysis-result');
  const thumbnailOverlay = document.getElementById('thumbnail-overlay');

  let tabId = null;
  let naturalWidth = 0;
  let naturalHeight = 0;
  let displayWidth = 0;
  let displayHeight = 0;
  let lastCaptureTime = 0;
  let currentTabUrl = null;
  let errorCount = 0;
  const maxErrorCount = 5;

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

  // 初始化
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0 && tabs[0].id) {
      tabId = tabs[0].id;
      currentTabUrl = tabs[0].url;
      requestThumbnail();
      
      // 启动自动刷新机制
      startAutoRefresh();
    } else {
      console.error("Could not get active tab ID for sidepanel.");
      analysisResultDiv.textContent = "无法获取当前标签页信息。";
      analyzePageButton.disabled = true;
      analyzeSelectionButton.disabled = true; 
    }
  });

  // 监听窗口尺寸变化
  window.addEventListener('resize', () => {
    updateSelectionDisplay();
  });

  // 启动自动刷新
  function startAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(() => {
      // 只在页面可见时刷新
      if (document.hidden) {
        console.log("Page hidden, skipping thumbnail refresh");
        return;
      }
      
      // 检查当前活动标签页
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id) {
          const newTabId = tabs[0].id;
          const newTabUrl = tabs[0].url;
          
          if (newTabId !== tabId) {
            console.log("Active tab changed from", tabId, "to", newTabId);
            tabId = newTabId;
            currentTabUrl = newTabUrl;
            clearThumbnail();
            errorCount = 0;
          } else if (newTabUrl !== currentTabUrl) {
            console.log("URL changed from", currentTabUrl, "to", newTabUrl);
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
      console.log("Throttling screenshot request, too frequent");
      return;
    }
    lastCaptureTime = now;
    
    if (errorCount === 0) {
      hideOverlay();
    } else {
      showOverlay("正在重试获取截图...");
    }
    
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending captureTab message:", chrome.runtime.lastError.message);
        errorCount++;
        if (errorCount >= maxErrorCount) {
          showOverlay("截图服务暂时不可用，将继续自动重试");
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
          console.log(`Thumbnail loaded: Nat(${naturalWidth}x${naturalHeight}), Disp(${displayWidth}x${displayHeight})`);
          
          hideOverlay();
          updateSelectionDisplay();
          
          if (displayWidth === 0 || displayHeight === 0) {
            console.warn("Thumbnail display dimensions are zero. May affect selection.");
          }
        };
        thumbnailImage.onerror = () => {
          console.error("Failed to load thumbnail image from data URL.");
          errorCount++;
          showOverlay("无法加载页面缩略图，自动重试中...");
        };
      } else if (response && response.error) {
        console.error("Error capturing tab:", response.details);
        errorCount++;
        if (errorCount >= maxErrorCount) {
          showOverlay("截图功能暂时不可用，将继续自动重试");
        } else {
          showOverlay("正在重试获取截图...");
        }
      } else {
        console.error("Invalid response when capturing tab:", response);
        errorCount++;
        if (errorCount >= maxErrorCount) {
          showOverlay("截图服务异常，将继续自动重试");
        } else {
          showOverlay("正在重试获取截图...");
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
      width: displayWidth,
      height: displayHeight
    };
  }

  // 更新选择框显示
  function updateSelectionDisplay() {
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
    
    console.log(`Selection updated: ${left},${top} ${width}x${height}`);
  }

  // 鼠标按下事件 - 开始创建选择框或拖拽
  thumbnailContainer.addEventListener('mousedown', (e) => {
    if (displayWidth === 0 || displayHeight === 0) {
      console.warn("Thumbnail dimensions not ready for selection.");
      return;
    }

    const bounds = getThumbnailBounds();
    if (!bounds) {
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
    if (e.target === thumbnailImage) {
      // 计算相对于缩略图的坐标
      const relativeX = mouseX - bounds.left;
      const relativeY = mouseY - bounds.top;
      
      if (relativeX >= 0 && relativeX <= bounds.width && 
          relativeY >= 0 && relativeY <= bounds.height) {
        startNewSelection(mouseX, mouseY, bounds);
      }
    }
    
    e.preventDefault();
  });

  let drawing = false;
  let startX_container, startY_container;

  function startNewSelection(mouseX, mouseY, bounds) {
    drawing = true;
    startX_container = mouseX;
    startY_container = mouseY;
    
    selectionBox.style.left = mouseX + 'px';
    selectionBox.style.top = mouseY + 'px';
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
    
    originalSelection = {
      left: parseInt(selectionBox.style.left),
      top: parseInt(selectionBox.style.top),
      width: parseInt(selectionBox.style.width),
      height: parseInt(selectionBox.style.height)
    };
  }

  function startResize(e, handleClass) {
    isResizing = true;
    selectionBox.classList.add('resizing');
    
    resizeHandle = handleClass;
    const containerRect = thumbnailContainer.getBoundingClientRect();
    dragStartX = e.clientX - containerRect.left;
    dragStartY = e.clientY - containerRect.top;
    
    originalSelection = {
      left: parseInt(selectionBox.style.left),
      top: parseInt(selectionBox.style.top),
      width: parseInt(selectionBox.style.width),
      height: parseInt(selectionBox.style.height)
    };
  }

  // 鼠标移动事件
  document.addEventListener('mousemove', (e) => {
    const containerRect = thumbnailContainer.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    
    if (drawing) {
      // 创建新选择框
      const width = Math.abs(mouseX - startX_container);
      const height = Math.abs(mouseY - startY_container);
      
      selectionBox.style.left = Math.min(startX_container, mouseX) + 'px';
      selectionBox.style.top = Math.min(startY_container, mouseY) + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
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
      newTop = Math.max(bounds.top, originalSelection.top + deltaY);
      newHeight = originalSelection.height + (originalSelection.top - newTop);
    }
    if (resizeHandle.includes('handle-s')) {
      newHeight = Math.min(bounds.top + bounds.height - originalSelection.top, 
        originalSelection.height + deltaY);
    }
    if (resizeHandle.includes('handle-w')) {
      newLeft = Math.max(bounds.left, originalSelection.left + deltaX);
      newWidth = originalSelection.width + (originalSelection.left - newLeft);
    }
    if (resizeHandle.includes('handle-e')) {
      newWidth = Math.min(bounds.left + bounds.width - originalSelection.left,
        originalSelection.width + deltaX);
    }
    
    // 确保最小尺寸
    newWidth = Math.max(20, newWidth);
    newHeight = Math.max(20, newHeight);
    
    selectionBox.style.left = newLeft + 'px';
    selectionBox.style.top = newTop + 'px';
    selectionBox.style.width = newWidth + 'px';
    selectionBox.style.height = newHeight + 'px';
  }

  // 鼠标释放事件
  document.addEventListener('mouseup', (e) => {
    if (drawing) {
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

  function finalizeSelection() {
    const bounds = getThumbnailBounds();
    if (!bounds) {
      return;
    }
    
    const selectionLeft = parseInt(selectionBox.style.left) || 0;
    const selectionTop = parseInt(selectionBox.style.top) || 0;
    const selectionWidth = parseInt(selectionBox.style.width) || 0;
    const selectionHeight = parseInt(selectionBox.style.height) || 0;

    // 检查选择框是否有效
    if (selectionWidth < 20 || selectionHeight < 20) {
      selectionBox.style.display = 'none';
      analyzeSelectionButton.disabled = true;
      currentSelectionRatios = null;
      return;
    }

    // 计算相对于缩略图的比例
    const relativeLeft = selectionLeft - bounds.left;
    const relativeTop = selectionTop - bounds.top;
    
    currentSelectionRatios = {
      x: relativeLeft / bounds.width,
      y: relativeTop / bounds.height,
      width: selectionWidth / bounds.width,
      height: selectionHeight / bounds.height
    };
    
    // 确保比例在有效范围内
    currentSelectionRatios.x = Math.max(0, Math.min(1, currentSelectionRatios.x));
    currentSelectionRatios.y = Math.max(0, Math.min(1, currentSelectionRatios.y));
    currentSelectionRatios.width = Math.max(0, Math.min(1 - currentSelectionRatios.x, currentSelectionRatios.width));
    currentSelectionRatios.height = Math.max(0, Math.min(1 - currentSelectionRatios.y, currentSelectionRatios.height));

    console.log("Selection ratios:", currentSelectionRatios);
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

  function performAnalysis(isSelection) {
    analysisResultDiv.textContent = isSelection ? "正在分析选中范围..." : "正在分析整个页面...";
    
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
        analysisResultDiv.textContent = "分析失败: " + chrome.runtime.lastError.message;
        return;
      }
      
      if (response && response.success) {
        analysisResultDiv.textContent = response.result || "分析完成，但没有返回结果";
      } else {
        analysisResultDiv.textContent = "分析失败: " + (response ? response.error : "未知错误");
      }
    });
  }
});