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

// Reusable function to perform translation
async function performTranslation(selectedText, callback) {
  // 获取当前配置和默认语言
  chrome.storage.sync.get(['configs', 'currentConfigId', 'defaultLanguage'], async (settings) => {
    if (chrome.runtime.lastError) {
      callback({ error: '获取配置失败', details: chrome.runtime.lastError.message });
      return;
    }

    const configs = settings.configs || [];
    const currentConfigId = settings.currentConfigId;
    const defaultLanguage = settings.defaultLanguage || 'Chinese';
    
    // 检查是否有配置
    if (!configs || configs.length === 0) {
      callback({ error: '未配置API信息，请在扩展弹出窗口中设置' });
      return;
    }
    
    // 获取当前配置
    const currentConfig = configs.find(config => config.id === currentConfigId);
    if (!currentConfig) {
      callback({ error: '当前配置无效，请在扩展弹出窗口中重新设置' });
      return;
    }
    
    const { apiUrl, apiKey, modelName, name } = currentConfig;

    // 日志记录
    console.log('使用配置:', name);
    console.log('API URL:', apiUrl);
    console.log('API Key (前5字符):', apiKey ? apiKey.substring(0, 5) + '...' : '未设置');
    console.log('模型名称:', modelName);
    console.log('目标语言:', defaultLanguage);

    if (!apiUrl || !apiKey || !modelName) {
      callback({ error: '配置信息不完整，请检查API URL、API Key和模型名称' });
      return;
    }

    if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
      callback({ error: 'API URL格式无效，必须以http://或https://开头' });
      return;
    }

    // 构建请求体
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
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        let errorDetails = `状态码: ${response.status}. `;
        try {
          const errorBody = await response.text();
          errorDetails += `响应内容: ${errorBody}`;
        } catch (e) {
          errorDetails += '无法获取API错误详情';
        }
        callback({ error: 'API请求失败', details: errorDetails });
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        callback({ error: '无法解析API响应为JSON', details: e.message });
        return;
      }
      
      // 解析API响应，支持多种格式
      let translatedText = '';
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        translatedText = data.choices[0].message.content.trim();
      } else if (data.translatedText) {
        translatedText = data.translatedText;
      } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0 && data.translations[0].text) {
        translatedText = data.translations[0].text;
      } else {
        callback({ error: '未在API响应中找到翻译文本，请检查响应结构', details: JSON.stringify(data) });
        return;
      }
      
      // 向页面发送翻译结果
      callback({ 
        translatedText: translatedText,
        configName: name // 返回使用的配置名称
      });

    } catch (error) {
      console.error('API调用失败:', error);
      callback({ error: '网络错误或API端点不可访问', details: error.message });
    }
  });
}

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection" && info.selectionText && tab) {
    performTranslation(info.selectionText, (result) => { 
      if (tab.id) {
        const messagePayload = { action: "displayTranslation", ...result };
        chrome.tabs.sendMessage(tab.id, messagePayload, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("无法向标签页发送消息:", tab.id, chrome.runtime.lastError.message);
          }
        });
      } else {
        console.warn("在无ID的标签页上点击了上下文菜单:", tab);
      }
    });
  } else if (info.menuItemId === "broodmother_parse" && tab && tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Listener for messages from content script or sidepanel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("背景脚本收到消息:", request);
  
  // 处理配置变更通知
  if (request.action === "configChanged") {
    console.log("配置已更新");
  } else if (request.action === "captureTab") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error("截图失败:", chrome.runtime.lastError.message);
        sendResponse({ error: "截图失败", details: chrome.runtime.lastError.message });
        return;
      }
      if (dataUrl) {
        sendResponse({ dataUrl: dataUrl });
      } else {
        console.error("截图成功但未返回dataUrl");
        sendResponse({ error: "截图成功但未返回dataUrl" });
      }
    });
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === "extractAndAnalyze") {
    // 处理文字提取和AI分析请求
    handleExtractAndAnalyze(request, sender, sendResponse);
    return true; // 异步响应
  }
  
  return true;
});

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
      console.error("内容脚本加载失败:", error);
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
        console.error("文字提取失败:", chrome.runtime.lastError.message);
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
    console.error("处理提取和分析请求时出错:", error);
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
  // 获取当前配置
  chrome.storage.sync.get(['configs', 'currentConfigId'], async (settings) => {
    if (chrome.runtime.lastError) {
      sendResponse({ 
        success: false, 
        error: '获取配置失败: ' + chrome.runtime.lastError.message 
      });
      return;
    }

    const configs = settings.configs || [];
    const currentConfigId = settings.currentConfigId;
    
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
    
    const { apiUrl, apiKey, modelName, name } = currentConfig;

    if (!apiUrl || !apiKey || !modelName) {
      sendResponse({ 
        success: false, 
        error: '配置信息不完整，请检查API URL、API Key和模型名称' 
      });
      return;
    }

    // 构建分析提示词
    const analysisType = isSelection ? "选中区域" : "整个页面";
    const prompt = `请分析以下来自网页${analysisType}的文字内容，并提供有用的见解、总结或建议：

${text}

请提供：
1. 内容概要
2. 主要观点或信息
3. 可能的应用建议或思考角度`;

    // 构建请求体
    const requestBody = {
      model: modelName,
      messages: [
        {
          role: "user",
          content: prompt
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

      let data;
      try {
        data = await response.json();
      } catch (e) {
        sendResponse({ 
          success: false, 
          error: '无法解析AI API响应: ' + e.message 
        });
        return;
      }
      
      // 解析API响应
      let analysisResult = '';
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        analysisResult = data.choices[0].message.content.trim();
      } else {
        sendResponse({ 
          success: false, 
          error: '未在API响应中找到分析结果，响应格式可能不兼容' 
        });
        return;
      }
      
      sendResponse({ 
        success: true, 
        result: analysisResult 
      });

    } catch (error) {
      console.error('AI API调用失败:', error);
      sendResponse({ 
        success: false, 
        error: '网络错误或API端点不可访问: ' + error.message 
      });
    }
  });
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
