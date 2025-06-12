// 提示词变量替换函数
function replacePromptVariables(promptContent, variables) {
  let result = promptContent;

  // 替换所有变量
  Object.keys(variables).forEach(key => {
    const placeholder = `{${key}}`;
    const value = variables[key] || '';
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  return result;
}

// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "Translate selected text with AI",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "broodmother_parse",
    title: "BroodMother解析",
    contexts: ["page"]
  });
  
  // 初始化默认主题
  chrome.storage.sync.get(['currentTheme'], (result) => {
    if (!result.currentTheme) {
      chrome.storage.sync.set({ currentTheme: 'light' });
    }
  });
});

// 标签页状态管理
let currentActiveTab = null;

// 监听标签页激活事件
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    currentActiveTab = {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      status: tab.status
    };
    
    console.log('标签页激活:', currentActiveTab);
    
    // 通知sidepanel标签页已切换
    notifySidepanelTabChange(currentActiveTab);
  } catch (error) {
    console.error('获取激活标签页信息失败:', error);
  }
});

// 监听标签页更新事件（URL变化、加载状态等）
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 只关注当前活动标签页的更新
  if (currentActiveTab && tabId === currentActiveTab.id) {
    // 检查是否有重要变化
    if (changeInfo.url || changeInfo.status === 'complete') {
      currentActiveTab = {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        status: tab.status
      };
      
      console.log('标签页更新:', currentActiveTab, changeInfo);
      
      // 通知sidepanel标签页已更新
      notifySidepanelTabChange(currentActiveTab, changeInfo);
    }
  }
});

// 通知sidepanel标签页变化
function notifySidepanelTabChange(tabInfo, changeInfo = null) {
  // 检查是否为受限页面
  if (isRestrictedUrl(tabInfo.url)) {
    tabInfo.isRestricted = true;
    console.log('检测到受限页面:', tabInfo.url);
  }
  
  // 尝试向所有可能的sidepanel发送消息
  chrome.runtime.sendMessage({
    action: "tabChanged",
    tabInfo: tabInfo,
    changeInfo: changeInfo
  }).catch(error => {
    // 如果没有监听器，忽略错误（sidepanel可能未打开）
    console.log('Sidepanel未监听标签页变化事件:', error);
  });
}

// 检查是否为受限URL
function isRestrictedUrl(url) {
  if (!url) return true;
  
  const restrictedPatterns = [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^edge:\/\//,
    /^about:/,
    /^moz-extension:\/\//,
    /^file:\/\//
  ];
  
  return restrictedPatterns.some(pattern => pattern.test(url));
}

// Reusable function to perform translation with failover support
async function performTranslation(selectedText, callback) {
  // 获取配置和故障转移设置
  chrome.storage.sync.get(['configs', 'currentConfigId', 'defaultLanguage', 'apiFailover'], async (settings) => {
    if (chrome.runtime.lastError) {
      callback({ error: '获取配置失败', details: chrome.runtime.lastError.message });
      return;
    }

    const configs = settings.configs || [];
    const currentConfigId = settings.currentConfigId;
    const defaultLanguage = settings.defaultLanguage || 'Chinese';
    const apiFailoverEnabled = settings.apiFailover || false;
    
    if (!configs || configs.length === 0) {
      callback({ error: '未配置API信息，请在扩展弹出窗口中设置' });
      return;
    }
    
    // 构建API配置顺序
    let configsToTry = [];
    
    if (apiFailoverEnabled) {
      // 如果启用故障转移，先尝试当前配置，然后是其他配置
      const currentConfig = configs.find(config => config.id === currentConfigId);
      if (currentConfig) {
        configsToTry.push(currentConfig);
      }
      // 添加其他配置
      configs.forEach(config => {
        if (config.id !== currentConfigId) {
          configsToTry.push(config);
        }
      });
    } else {
      // 如果未启用故障转移，只使用当前配置
      const currentConfig = configs.find(config => config.id === currentConfigId);
      if (currentConfig) {
        configsToTry.push(currentConfig);
      } else {
        callback({ error: '当前配置无效，请在扩展弹出窗口中重新设置' });
        return;
      }
    }
    
    if (configsToTry.length === 0) {
      callback({ error: '没有可用的API配置' });
      return;
    }

    // 尝试API配置
    let lastError = null;
    for (const config of configsToTry) {
      try {
        const result = await tryApiCall(selectedText, defaultLanguage, config);
        if (result.success) {
          callback({
            translatedText: result.translatedText,
            configName: config.name
          });
          return;
        } else {
          lastError = result;
          console.warn(`API配置 "${config.name}" 翻译失败:`, result.details);
        }
      } catch (error) {
        lastError = { error: '网络错误', details: error.message };
        console.warn(`API配置 "${config.name}" 出现异常:`, error.message);
      }
    }

    // 所有配置都失败了
    callback({ 
      error: '所有API配置都翻译失败', 
      details: lastError ? lastError.details : '未知错误'
    });
  });
}

// 尝试单个API调用
async function tryApiCall(selectedText, defaultLanguage, config) {
  const { apiUrl, apiKey, modelName, name } = config;

  if (!apiUrl || !apiKey || !modelName) {
    return { 
      success: false, 
      error: '配置信息不完整', 
      details: `配置 "${name}" 缺少必要信息` 
    };
  }

  if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
    return { 
      success: false, 
      error: 'API URL格式无效', 
      details: `配置 "${name}" 的URL格式无效` 
    };
  }

  const requestBody = {
    model: modelName,
    messages: [
      {
        role: "user",
        content: `Translate the following text into ${defaultLanguage}: '${selectedText}'`
      }
    ]
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15000) // 15秒超时
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { 
        success: false, 
        error: 'API请求失败', 
        details: `配置 "${name}" 返回状态 ${response.status}: ${errorBody}` 
      };
    }

    const data = await response.json();
    
    // 解析API响应
    let translatedText = '';
    if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
      translatedText = data.choices[0].message.content.trim();
    } else if (data.translatedText) {
      translatedText = data.translatedText;
    } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0 && data.translations[0].text) {
      translatedText = data.translations[0].text;
    } else {
      return { 
        success: false, 
        error: '响应格式错误', 
        details: `配置 "${name}" 的响应中未找到翻译文本` 
      };
    }
    
    return { 
      success: true, 
      translatedText: translatedText 
    };

  } catch (error) {
    if (error.name === 'TimeoutError') {
      return { 
        success: false, 
        error: 'API请求超时', 
        details: `配置 "${name}" 请求超时（15秒）` 
      };
    }
    
    return { 
      success: false, 
      error: '网络错误', 
      details: `配置 "${name}" 网络错误: ${error.message}` 
    };
  }
}

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection" && info.selectionText && tab && tab.id) {
    // 执行翻译
    performTranslation(info.selectionText, (result) => {
      // 动态注入content script并发送翻译结果
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_script.js']
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("脚本注入失败:", chrome.runtime.lastError.message);
          return;
        }
        
        // 注入成功后发送翻译结果
        const messagePayload = { action: "displayTranslation", ...result };
        chrome.tabs.sendMessage(tab.id, messagePayload, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("向标签页发送消息时出错:", chrome.runtime.lastError.message);
          }
        });
      });
    });
  } else if (info.menuItemId === "broodmother_parse" && tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Listener for messages from content script or sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  
  // 处理配置变更通知
  if (request.action === "configChanged") {
    
  } else if (request.action === "captureTab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        
        sendResponse({ error: "截图失败", details: chrome.runtime.lastError.message });
        return;
      }
      if (dataUrl) {
        sendResponse({ dataUrl: dataUrl });
      } else {
        
        sendResponse({ error: "截图成功但未返回dataUrl" });
      }
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "extractAndAnalyze") {
    // 处理文字提取和AI分析请求
    handleExtractAndAnalyze(request, sender, sendResponse);
    return true; // 异步响应
  } else if (request.action === "cancelAnalysis") {
    // 处理取消分析请求
    handleCancelAnalysis(request, sender, sendResponse);
    return true; // 异步响应
  } else if (request.action === "getCurrentTab") {
    // 获取当前活动标签页信息
    if (currentActiveTab) {
      // 检查是否为受限页面
      if (isRestrictedUrl(currentActiveTab.url)) {
        currentActiveTab.isRestricted = true;
      }
      sendResponse({ success: true, tabInfo: currentActiveTab });
    } else {
      // 如果没有缓存的标签页信息，实时查询
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const tab = tabs[0];
          currentActiveTab = {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            status: tab.status
          };
          
          // 检查是否为受限页面
          if (isRestrictedUrl(currentActiveTab.url)) {
            currentActiveTab.isRestricted = true;
          }
          
          sendResponse({ success: true, tabInfo: currentActiveTab });
        } else {
          sendResponse({ success: false, error: "无法获取当前标签页" });
        }
      });
      return true; // 异步响应
    }
  }
  
  return true;
});

// 处理取消分析请求
async function handleCancelAnalysis(request, sender, sendResponse) {
  const responseId = request.responseId;
  console.log('收到取消分析请求，responseId:', responseId);
  
  // 检查是否有正在进行的流式响应
  if (currentStreamController && streamResponseId === responseId) {
    console.log('中断进行中的流式响应');
    currentStreamController.abort();
    currentStreamController = null;
    
    sendResponse({ 
      success: true, 
      message: '分析已取消' 
    });
  } else {
    console.log('没有找到匹配的流式响应，可能已完成或被中断');
    sendResponse({ 
      success: true, 
      message: '分析已取消（或已完成）' 
    });
  }
}

// 处理文字提取和AI分析
async function handleExtractAndAnalyze(request, sender, sendResponse) {
  try {
    // 获取当前活动标签页ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0 || !tabs[0].id) {
      sendResponse({ success: false, error: "无法获取当前标签页" });
      return;
    }
    
    const tabId = tabs[0].id;
    
    // 检查并确保内容脚本已加载
    try {
      await ensureContentScriptLoaded(tabId);
    } catch (error) {
      
      sendResponse({ 
        success: false, 
        error: "内容脚本加载失败，请刷新页面后重试" 
      });
      return;
    }
    
    // 向内容脚本发送文字提取请求
    let extractMessage;
    if (request.isSelection && request.selectionRatios) {
      // 提取选中区域文字
      extractMessage = {
        action: "extractTextFromSelection",
        selectionRatios: request.selectionRatios
      };
    } else {
      // 提取整页文字
      extractMessage = {
        action: "extractTextFromPage"
      };
    }
    
    chrome.tabs.sendMessage(tabId, extractMessage, async (extractResponse) => {
      if (chrome.runtime.lastError) {
        
        sendResponse({ 
          success: false, 
          error: "文字提取失败: " + chrome.runtime.lastError.message 
        });
        return;
      }
      
      if (!extractResponse || !extractResponse.success) {
        sendResponse({ 
          success: false, 
          error: "文字提取失败: " + (extractResponse ? extractResponse.error : "未知错误")
        });
        return;
      }
      
      const extractedText = extractResponse.text;
      if (!extractedText || extractedText.trim() === "") {
        sendResponse({ 
          success: false, 
          error: "未提取到文字内容"
        });
        return;
      }
      
      // 调用AI分析
      await performAIAnalysis(extractedText, request.isSelection, sendResponse);
    });
    
  } catch (error) {
    
    sendResponse({ 
      success: false, 
      error: "处理请求时出错: " + error.message 
    });
  }
}

// 确保内容脚本已加载
async function ensureContentScriptLoaded(tabId) {
  try {
    // 尝试发送ping消息检查内容脚本是否响应
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: "ping" }, (response) => {
        if (chrome.runtime.lastError) {
          // 内容脚本未加载，尝试注入
          inject_content_script(tabId)
            .then(resolve)
            .catch(reject);
        } else {
          resolve();
        }
      });
    });
  } catch (error) {
    throw new Error("无法加载内容脚本: " + error.message);
  }
}

// 注入内容脚本
async function inject_content_script(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content_script.js']
    });
    
    // 等待内容脚本初始化
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    throw new Error("脚本注入失败: " + error.message);
  }
}

// 执行AI分析
async function performAIAnalysis(text, isSelection, sendResponse) {
  // 获取当前配置和提示词
  chrome.storage.sync.get(['configs', 'currentConfigId', 'prompts', 'currentPromptId'], async (settings) => {
    if (chrome.runtime.lastError) {
      sendResponse({ 
        success: false, 
        error: '获取配置失败: ' + chrome.runtime.lastError.message 
      });
      return;
    }

    const configs = settings.configs || [];
    const currentConfigId = settings.currentConfigId;
    const prompts = settings.prompts || [];
    const currentPromptId = settings.currentPromptId;

    // 检查是否有配置
    if (!configs || configs.length === 0) {
      sendResponse({
        success: false,
        error: '未配置AI API信息，请在扩展弹出窗口中设置'
      });
      return;
    }

    // 获取当前配置
    const currentConfig = configs.find(config => config.id === currentConfigId);
    if (!currentConfig) {
      sendResponse({
        success: false,
        error: '当前配置无效，请在扩展弹出窗口中重新设置'
      });
      return;
    }

    // 获取当前提示词
    let currentPrompt = null;
    if (currentPromptId) {
      currentPrompt = prompts.find(prompt => prompt.id === currentPromptId);
    }

    // 如果没有找到当前提示词，使用默认提示词或第一个提示词
    if (!currentPrompt && prompts.length > 0) {
      currentPrompt = prompts.find(prompt => prompt.isDefault) || prompts[0];
    }
    
    const { apiUrl, apiKey, modelName, name } = currentConfig;

    if (!apiUrl || !apiKey || !modelName) {
      sendResponse({ 
        success: false, 
        error: '配置信息不完整，请检查API URL、API Key和模型名称' 
      });
      return;
    }

    // 构建分析提示词
    let prompt;

    if (currentPrompt && currentPrompt.content) {
      // 使用自定义提示词并进行变量替换
      prompt = replacePromptVariables(currentPrompt.content, {
        content: text,
        analysisType: isSelection ? "选中区域" : "整个页面",
        language: "Chinese", // 可以从设置中获取
        timestamp: new Date().toLocaleString(),
        url: "", // 可以从标签页信息获取
        title: "" // 可以从标签页信息获取
      });
    } else {
      // 使用默认提示词（向后兼容）
      const analysisType = isSelection ? "选中区域" : "整个页面";
      prompt = `请分析以下来自网页${analysisType}的文字内容，并以Markdown格式提供有用的见解、总结或建议：

${text}

请按以下结构提供分析结果（使用Markdown格式）：

## 📝 内容概要
（简明扼要地总结主要内容）

## 🔍 主要观点
- 关键信息点1
- 关键信息点2
- ...

## 💡 见解与建议
### 应用建议
- 具体建议1
- 具体建议2

### 思考角度
- 可以从哪些角度进一步思考

## 📋 总结
（一句话总结核心价值）

请确保使用标准Markdown语法，包括标题(##)、列表(-)、粗体(**text**)等格式。`;
    }

    // 构建请求体（支持流式输出）
    const requestBody = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      stream: true
    };

    // 如果有自定义提示词，使用其temperature值
    if (currentPrompt && typeof currentPrompt.temperature === 'number') {
      requestBody.temperature = currentPrompt.temperature;
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorDetails = `状态码: ${response.status}`;
        try {
          const errorBody = await response.text();
          errorDetails += `, 响应: ${errorBody}`;
        } catch (e) {
          errorDetails += ', 无法获取详细错误信息';
        }
        sendResponse({ 
          success: false, 
          error: 'AI API请求失败: ' + errorDetails 
        });
        return;
      }

      // 中断任何进行中的流式响应
      if (currentStreamController) {
        console.log('中断进行中的流式响应');
        currentStreamController.abort();
        currentStreamController = null;
      }
      
      // 生成新的响应ID
      const responseId = ++streamResponseId;
      console.log('开始新的流式响应，ID:', responseId);
      
      // 创建新的控制器
      currentStreamController = new AbortController();
      
      // 处理流式响应
      await handleStreamResponse(response, sendResponse, isSelection, responseId, currentStreamController);

    } catch (error) {
      
      sendResponse({ 
        success: false, 
        error: '网络错误或API端点不可访问: ' + error.message 
      });
    }
  });
}

// 全局流式端口存储
let streamPort = null;

// 流式响应控制器
let currentStreamController = null;
let streamResponseId = 0;

// 处理端口连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "stream") {
    // 如果已有连接，先清理旧连接
    if (streamPort) {
      console.log('清理旧的流式端口连接');
      try {
        streamPort.disconnect();
      } catch (error) {
        console.warn('断开旧连接时出错:', error);
      }
    }
    
    streamPort = port;
    console.log('建立新的流式端口连接');
    
    port.onDisconnect.addListener(() => {
      console.log('流式端口连接断开 (background)');
      streamPort = null;
    });
  }
});

// 处理流式响应
async function handleStreamResponse(response, sendResponse, isSelection, responseId, controller) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  
  try {
    console.log(`流式响应 ${responseId} 开始处理`);
    
    // 发送开始信号
    sendResponse({ 
      success: true, 
      isStreaming: true, 
      streamStart: true,
      responseId: responseId
    });

    while (true) {
      // 检查是否被中断
      if (controller.signal.aborted) {
        console.log(`流式响应 ${responseId} 被中断`);
        break;
      }
      
      const { done, value } = await reader.read();
      
      if (done) {
        console.log(`流式响应 ${responseId} 完成`);
        break;
      }

      // 再次检查是否被中断
      if (controller.signal.aborted) {
        console.log(`流式响应 ${responseId} 在处理数据时被中断`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // 保留最后一个可能不完整的行
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        // 在处理每行前检查中断
        if (controller.signal.aborted) {
          console.log(`流式响应 ${responseId} 在解析行时被中断`);
          return;
        }
        
        if (line.trim() === '') continue;
        if (line.trim() === 'data: [DONE]') continue;
        
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6); // 移除 'data: ' 前缀
            const data = JSON.parse(jsonStr);
            
            if (data.choices && data.choices[0] && data.choices[0].delta) {
              const content = data.choices[0].delta.content;
              if (content) {
                fullContent += content;
                
                // 通过端口发送增量内容，包含响应ID
                if (streamPort && !controller.signal.aborted) {
                  streamPort.postMessage({
                    action: "streamUpdate",
                    chunk: content,
                    fullContent: fullContent,
                    isComplete: false,
                    responseId: responseId
                  });
                  
                } else if (!streamPort) {
                  console.warn("流式端口未连接");
                }
              }
            }
          } catch (error) {
            console.warn('解析SSE数据时出错:', error, '原始行:', line);
          }
        }
      }
    }
    
    // 发送完成信号（只有未被中断的情况下）
    if (streamPort && !controller.signal.aborted) {
      streamPort.postMessage({
        action: "streamUpdate",
        chunk: '',
        fullContent: fullContent,
        isComplete: true,
        responseId: responseId
      });
      console.log(`流式响应 ${responseId} 发送完成信号`);
    }
    
  } catch (error) {
    if (controller.signal.aborted) {
      console.log(`流式响应 ${responseId} 被中断:`, error.name);
    } else {
      console.error(`流式响应 ${responseId} 出错:`, error);
      sendResponse({ 
        success: false, 
        error: '处理流式响应时出错: ' + error.message 
      });
    }
  } finally {
    reader.releaseLock();
    // 如果这是当前活动的响应，清理控制器
    if (currentStreamController === controller) {
      currentStreamController = null;
    }
    console.log(`流式响应 ${responseId} 清理完成`);
  }
}

// 添加右键菜单动态更新，根据当前配置显示不同菜单项
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.configs || changes.currentConfigId || changes.defaultLanguage)) {
    chrome.storage.sync.get(['configs', 'currentConfigId', 'defaultLanguage'], (result) => {
      const configs = result.configs || [];
      const currentConfigId = result.currentConfigId;
      const defaultLanguage = result.defaultLanguage || 'Chinese';
      
      // 如果有当前配置，更新右键菜单显示
      if (currentConfigId) {
        const currentConfig = configs.find(config => config.id === currentConfigId);
        if (currentConfig) {
          chrome.contextMenus.update("translateSelection", {
            title: `使用 "${currentConfig.name}" 翻译为${defaultLanguage}`
          });
        }
      }
    });
  }
});
