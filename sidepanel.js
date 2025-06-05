// HTML转义函数，防止XSS攻击
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
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
        console.log("检测到用户手动滚动");
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
      console.error("Could not get active tab ID for sidepanel.");
      analysisResultDiv.innerHTML = `<div class="error-message">无法获取当前标签页信息。</div>`;
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

  // 建立流式端口连接
  streamPort = chrome.runtime.connect({ name: "stream" });
  streamPort.onMessage.addListener((message) => {
    if (message.action === "streamUpdate") {
      handleStreamUpdate(message.chunk, message.fullContent, message.isComplete);
    }
  });
  
  streamPort.onDisconnect.addListener(() => {
    console.log("流式端口连接已断开");
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
    // 重置流式状态
    isStreamingActive = false;
    streamBuffer = '';
    
    // 创建优化的流式界面
    const loadingMessage = isSelection ? "正在分析选中范围..." : "正在分析整个页面...";
    analysisResultDiv.innerHTML = `
      <div class="streaming-container">
        <div class="streaming-header">
          <div class="loading-message">${loadingMessage}</div>
          <button id="cancel-stream" class="cancel-button" style="display: none;" title="取消分析">
            <span class="cancel-icon">✕</span>
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
        analysisResultDiv.innerHTML = `<div class="error-message">分析失败: ${chrome.runtime.lastError.message}</div>`;
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
              analysisResultDiv.innerHTML = `<div class="info-message">分析已取消</div>`;
            };
          }
          
          // 更新加载消息
          const loadingDiv = analysisResultDiv.querySelector('.loading-message');
          if (loadingDiv) {
            loadingDiv.textContent = '正在接收AI分析结果...';
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
        backToBottomBtn.innerHTML = '↓ 返回底部';
        backToBottomBtn.title = '返回到最新内容';
        
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
    console.log("收到流式更新:", chunk.length > 20 ? chunk.substring(0, 20) + "..." : chunk, "是否完成:", isComplete);
    
    if (!isStreamingActive) {
      console.log("流式输出未激活，忽略更新");
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
        console.error('Markdown解析错误:', error);
        target.innerHTML = `<div class="error-message">Markdown解析失败</div><pre>${escapeHtml(content)}</pre>`;
      }
    } else {
      // 如果marked库未加载，回退到纯文本显示
      target.innerHTML = `<pre>${escapeHtml(content)}</pre>`;
    }
  }
});