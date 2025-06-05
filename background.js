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
        // Fallback or specific error if dataUrl is null but no chrome.runtime.lastError
        console.error("截图成功但未返回dataUrl");
        sendResponse({ error: "截图成功但未返回dataUrl" });
      }
    });
    return true; // Indicates that the response is sent asynchronously
  }
  
  // 返回true表示sendResponse可能会异步调用 (如果其他分支也需要异步)
  // 如果所有分支都是同步的，或者只有这个是异步的，则这里的 return true 对于这个分支是关键的。
  // 对于同步分支，可以不返回或返回false。
  // 保持 return true 以确保异步操作正常工作。
  return true;
});



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
