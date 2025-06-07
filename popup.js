document.addEventListener('DOMContentLoaded', () => {
  
  
  // 初始化国际化支持
  initializeI18n();
  
  // DOM元素
  const configNameInput = document.getElementById('configName');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const defaultLangSelect = document.getElementById('defaultLang');
  const saveConfigBtn = document.getElementById('saveConfigBtn');
  const addConfigBtn = document.getElementById('addConfigBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const configList = document.getElementById('configList');
  const statusArea = document.getElementById('statusArea');
  const themeOptions = document.querySelectorAll('.theme-option');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // 验证关键DOM元素是否存在
  
    configNameInput: !!configNameInput,
    apiUrlInput: !!apiUrlInput,
    apiKeyInput: !!apiKeyInput,
    modelNameInput: !!modelNameInput,
    defaultLangSelect: !!defaultLangSelect,
    saveConfigBtn: !!saveConfigBtn,
    addConfigBtn: !!addConfigBtn,
    exportBtn: !!exportBtn,
    importBtn: !!importBtn,
    configList: !!configList,
    statusArea: !!statusArea,
    themeOptions: themeOptions.length,
    tabs: tabs.length,
    tabContents: tabContents.length
  });
  
  // 模态框元素
  const deleteModal = document.getElementById('deleteModal');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const modalCloseButtons = document.querySelectorAll('.modal-close');
  const importModal = document.getElementById('importModal');
  const importText = document.getElementById('importText');
  const confirmImportBtn = document.getElementById('confirmImportBtn');
  const cancelImportBtn = document.getElementById('cancelImportBtn');
  
  // 状态变量
  let configs = [];
  let currentConfigId = null;
  let editingConfigId = null;
  let currentTheme = 'light';
  let deleteConfigId = null;
  let defaultLanguage = 'Chinese';
  
  // 显示状态消息
  function showStatus(message, isError = false) {
    
    
    if (!statusArea) {
      
      alert(message); // 回退到alert显示
      return;
    }
    
    statusArea.textContent = message;
    statusArea.style.color = isError ? '#dc3545' : '#198754';
    statusArea.style.backgroundColor = isError ? 'rgba(220, 53, 69, 0.1)' : 'rgba(25, 135, 84, 0.1)';
    statusArea.style.padding = '8px';
    statusArea.style.borderRadius = '4px';
    
    setTimeout(() => {
      if (statusArea) {
        statusArea.textContent = '';
        statusArea.style.backgroundColor = 'transparent';
        statusArea.style.padding = '0';
      }
    }, 3000);
  }
  
  // 生成唯一ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  // 加载配置
  function loadConfigs() {
    chrome.storage.sync.get(['configs', 'currentConfigId', 'currentTheme', 'defaultLanguage'], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('load_config_failed: ' + chrome.runtime.lastError.message, true);
        return;
      }
      
      configs = result.configs || [];
      currentConfigId = result.currentConfigId || null;
      currentTheme = result.currentTheme || 'light';
      defaultLanguage = result.defaultLanguage || 'Chinese';
      
      // 设置默认语言
      if (defaultLangSelect) {
        defaultLangSelect.value = defaultLanguage;
      }
      
      // 应用主题
      applyTheme(currentTheme);
      updateThemeSelector();
      
      // 渲染配置列表
      renderConfigList();
      
      // 如果有当前配置，显示它
      if (currentConfigId) {
        showConfig(currentConfigId);
      } else {
        // 清空表单
        clearConfigForm();
      }
    });
  }
  
  // 保存配置
  function saveConfigs() {
    chrome.storage.sync.set({ configs, currentConfigId, currentTheme, defaultLanguage }, () => {
      if (chrome.runtime.lastError) {
        showStatus('save_config_failed: ' + chrome.runtime.lastError.message, true);
      }
    });
  }
  
  // 添加或更新配置
  function saveConfig() {
    
    
    if (!configNameInput || !apiUrlInput || !apiKeyInput || !modelNameInput) {
      showStatus('表单元素未找到，请重新打开设置页面', true);
      
      return;
    }
    
    const name = configNameInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    const modelName = modelNameInput.value.trim();
    
    
    
    if (!name) {
      showStatus('enter_config_name', true);
      return;
    }
    
    if (!apiUrl) {
      showStatus('enter_api_url', true);
      return;
    }
    
    if (!apiKey) {
      showStatus('enter_api_key', true);
      return;
    }
    
    if (!modelName) {
      showStatus('enter_model_name', true);
      return;
    }
    
    if (editingConfigId) {
      // 更新现有配置
      const index = configs.findIndex(config => config.id === editingConfigId);
      if (index !== -1) {
        configs[index] = {
          id: editingConfigId,
          name,
          apiUrl,
          apiKey,
          modelName
        };
        showStatus('config_updated');
      }
    } else {
      // 添加新配置
      const newConfig = {
        id: generateId(),
        name,
        apiUrl,
        apiKey,
        modelName
      };
      configs.push(newConfig);
      
      // 如果是第一个配置，设置为当前配置
      if (!currentConfigId) {
        currentConfigId = newConfig.id;
      }
      
      showStatus('config_added');
    }
    
    // 保存到存储
    saveConfigs();
    
    // 重新渲染配置列表
    renderConfigList();
    
    // 清空表单
    clearConfigForm();
  }
  
  // 删除配置
  function deleteConfig(id) {
    const index = configs.findIndex(config => config.id === id);
    if (index !== -1) {
      configs.splice(index, 1);
      
      // 如果删除的是当前配置，重置当前配置
      if (currentConfigId === id) {
        currentConfigId = configs.length > 0 ? configs[0].id : null;
      }
      
      // 保存到存储
      saveConfigs();
      
      // 重新渲染配置列表
      renderConfigList();
      
      // 如果有当前配置，显示它
      if (currentConfigId) {
        showConfig(currentConfigId);
      } else {
        clearConfigForm();
      }
      
      showStatus('配置已删除');
    }
  }
  
  // 显示配置详情
  function showConfig(id) {
    const config = configs.find(config => config.id === id);
    if (config) {
      editingConfigId = config.id;
      configNameInput.value = config.name;
      apiUrlInput.value = config.apiUrl;
      apiKeyInput.value = config.apiKey;
      modelNameInput.value = config.modelName;
      
      // 高亮显示当前选中的配置
      const configItems = configList.querySelectorAll('.config-item');
      configItems.forEach(item => {
        if (item.dataset.id === id) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  }
  
  // 清空配置表单
  function clearConfigForm() {
    editingConfigId = null;
    configNameInput.value = '';
    apiUrlInput.value = '';
    apiKeyInput.value = '';
    modelNameInput.value = '';
    
    // 清除选中状态
    const configItems = configList.querySelectorAll('.config-item');
    configItems.forEach(item => {
      item.classList.remove('active');
    });
  }
  
  // 渲染配置列表
  function renderConfigList() {
    configList.innerHTML = '';
    
    if (configs.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'config-item';
      emptyItem.textContent = '暂无配置，请添加';
      configList.appendChild(emptyItem);
      return;
    }
    
    configs.forEach(config => {
      const configItem = document.createElement('div');
      configItem.className = 'config-item';
      if (config.id === currentConfigId) {
        configItem.classList.add('active');
      }
      configItem.dataset.id = config.id;
      
      const nameSpan = document.createElement('span');
      nameSpan.textContent = config.name;
      configItem.appendChild(nameSpan);
      
      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.display = 'flex';
      buttonsDiv.style.gap = '5px';
      
      // 使用按钮
      const useButton = document.createElement('button');
      useButton.textContent = '使用';
      useButton.className = 'btn-primary';
      useButton.style.padding = '4px 8px';
      useButton.style.fontSize = '12px';
      useButton.addEventListener('click', (e) => {
        e.stopPropagation();
        currentConfigId = config.id;
        saveConfigs();
        renderConfigList();
        showStatus(`已切换到配置: ${config.name}`);
      });
      buttonsDiv.appendChild(useButton);
      
      // 编辑按钮
      const editButton = document.createElement('button');
      editButton.textContent = '编辑';
      editButton.className = 'btn-secondary';
      editButton.style.padding = '4px 8px';
      editButton.style.fontSize = '12px';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfig(config.id);
      });
      buttonsDiv.appendChild(editButton);
      
      // 删除按钮
      const deleteButton = document.createElement('button');
      deleteButton.textContent = '删除';
      deleteButton.className = 'btn-danger';
      deleteButton.style.padding = '4px 8px';
      deleteButton.style.fontSize = '12px';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConfigId = config.id;
        showDeleteModal();
      });
      buttonsDiv.appendChild(deleteButton);
      
      configItem.appendChild(buttonsDiv);
      configList.appendChild(configItem);
      
      // 点击配置项，显示配置详情
      configItem.addEventListener('click', () => {
        showConfig(config.id);
      });
    });
  }
  
  // 导出配置
  function exportConfigs() {
    if (configs.length === 0) {
      showStatus('没有可导出的配置', true);
      return;
    }
    
    // 创建一个副本以隐藏API密钥中间部分
    const exportConfigs = configs.map(config => {
      // 保持API密钥的前5个字符和后5个字符，中间用*号代替
      const apiKey = config.apiKey;
      let maskedApiKey = apiKey;
      if (apiKey && apiKey.length > 10) {
        maskedApiKey = apiKey.substring(0, 5) + '*'.repeat(apiKey.length - 10) + apiKey.substring(apiKey.length - 5);
      }
      
      return {
        ...config,
        apiKey: maskedApiKey
      };
    });
    
    const exportData = {
      configs: exportConfigs,
      exportDate: new Date().toISOString()
    };
    
    const exportJson = JSON.stringify(exportData, null, 2);
    
    // 创建临时textarea用于复制
    const textarea = document.createElement('textarea');
    textarea.value = exportJson;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    showStatus('配置已复制到剪贴板');
  }
  
  // 导入配置
  function importConfigs() {
    try {
      const importData = JSON.parse(importText.value);
      
      if (!importData.configs || !Array.isArray(importData.configs)) {
        showStatus('无效的配置数据', true);
        return;
      }
      
      // 检查每个配置是否有必要的字段
      const validConfigs = importData.configs.filter(config => {
        return config.name && config.apiUrl && config.apiKey && config.modelName;
      });
      
      if (validConfigs.length === 0) {
        showStatus('导入的配置数据无效', true);
        return;
      }
      
      // 确保每个配置都有唯一ID
      validConfigs.forEach(config => {
        if (!config.id) {
          config.id = generateId();
        }
      });
      
      // 如果是追加模式，合并配置
      const existingNames = configs.map(config => config.name);
      validConfigs.forEach(config => {
        // 如果已存在同名配置，添加后缀
        let newName = config.name;
        let counter = 1;
        while (existingNames.includes(newName)) {
          newName = `${config.name} (${counter})`;
          counter++;
        }
        config.name = newName;
        existingNames.push(newName);
      });
      
      // 添加到现有配置
      configs = [...configs, ...validConfigs];
      
      // 如果没有当前配置，设置第一个导入的配置为当前配置
      if (!currentConfigId && configs.length > 0) {
        currentConfigId = configs[0].id;
      }
      
      // 保存配置
      saveConfigs();
      
      // 重新渲染配置列表
      renderConfigList();
      
      // 关闭导入模态框
      hideImportModal();
      
      showStatus(`成功导入 ${validConfigs.length} 个配置`);
    } catch (error) {
      showStatus('导入失败: ' + error.message, true);
    }
  }
  
  // 应用主题
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
    
    // 保存主题设置
    saveConfigs();
  }
  
  // 更新主题选择器状态
  function updateThemeSelector() {
    themeOptions.forEach(option => {
      if (option.dataset.theme === currentTheme) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }
  
  // 显示删除确认模态框
  function showDeleteModal() {
    deleteModal.style.display = 'flex';
  }
  
  // 隐藏删除确认模态框
  function hideDeleteModal() {
    deleteModal.style.display = 'none';
  }
  
  // 显示导入模态框
  function showImportModal() {
    importModal.style.display = 'flex';
    importText.value = '';
  }
  
  // 隐藏导入模态框
  function hideImportModal() {
    importModal.style.display = 'none';
  }
  
  // 初始化
  function init() {
    // 加载配置
    loadConfigs();
    
    // 保存配置按钮点击事件
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', saveConfig);
      
    } else {
      
    }
    
    // 添加配置按钮点击事件
    if (addConfigBtn) {
      addConfigBtn.addEventListener('click', () => {
        clearConfigForm();
      });
      
    } else {
      
    }
    
    // 导出按钮点击事件
    if (exportBtn) {
      exportBtn.addEventListener('click', exportConfigs);
      
    } else {
      
    }
    
    // 导入按钮点击事件
    if (importBtn) {
      importBtn.addEventListener('click', showImportModal);
      
    } else {
      
    }
    
    // 确认导入按钮点击事件
    if (confirmImportBtn) {
      confirmImportBtn.addEventListener('click', importConfigs);
      
    } else {
      
    }
    
    // 取消导入按钮点击事件
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', hideImportModal);
      
    } else {
      
    }
    
    // 主题选项点击事件
    if (themeOptions && themeOptions.length > 0) {
      themeOptions.forEach(option => {
        option.addEventListener('click', () => {
          const theme = option.dataset.theme;
          applyTheme(theme);
          updateThemeSelector();
        });
      });
      
    } else {
      
    }
    
    // 确认删除按钮点击事件
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => {
        if (deleteConfigId) {
          deleteConfig(deleteConfigId);
          deleteConfigId = null;
          hideDeleteModal();
        }
      });
      
    } else {
      
    }
    
    // 取消删除按钮点击事件
    if (cancelDeleteBtn) {
      cancelDeleteBtn.addEventListener('click', hideDeleteModal);
      
    } else {
      
    }
    
    // 关闭模态框按钮点击事件
    if (modalCloseButtons && modalCloseButtons.length > 0) {
      modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
          hideDeleteModal();
          hideImportModal();
        });
      });
      
    } else {
      
    }
    
    // 标签页切换事件
    if (tabs && tabs.length > 0) {
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const tabId = tab.dataset.tab;
          
          // 更新标签状态
          tabs.forEach(t => {
            if (t.dataset.tab === tabId) {
              t.classList.add('active');
            } else {
              t.classList.remove('active');
            }
          });
          
          // 更新内容区域
          if (tabContents && tabContents.length > 0) {
            tabContents.forEach(content => {
              if (content.id === tabId + '-tab') {
                content.classList.add('active');
              } else {
                content.classList.remove('active');
              }
            });
          }
        });
      });
      
    } else {
      
    }
    
    // 默认语言选择事件
    if (defaultLangSelect) {
      defaultLangSelect.addEventListener('change', () => {
        defaultLanguage = defaultLangSelect.value;
        saveConfigs();
        showStatus('默认语言已更新');
      });
      
    } else {
      
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
    const languageToggle = document.getElementById('languageToggle');
    const languageLabel = document.getElementById('languageLabel');
    
    if (languageToggle && languageLabel) {
      languageToggle.addEventListener('click', () => {
        i18n.toggleLanguage();
        updateLanguageLabel();
        showStatus(getText('language_switched'));
      });
      
      // 初始化语言标签
      updateLanguageLabel();
    }
    
    // 监听语言变化事件
    i18n.addLanguageChangeListener((newLang) => {
      updateLanguageLabel();
      updateAllTexts();
    });
    
    // 监听文本更新事件
    window.addEventListener('i18nTextUpdated', () => {
      updateAllTexts();
    });
  }
  
  // 更新语言切换按钮标签
  function updateLanguageLabel() {
    const languageLabel = document.getElementById('languageLabel');
    if (languageLabel) {
      const currentLang = i18n.getCurrentLanguage();
      languageLabel.textContent = currentLang === 'zh' ? '中' : 'EN';
    }
  }
  
  // 更新所有需要特殊处理的文本
  function updateAllTexts() {
    // 更新状态消息中的硬编码文本
    const currentLang = i18n.getCurrentLanguage();
    
    // 更新 placeholder 文本
    const configNameInput = document.getElementById('configName');
    const apiKeyInput = document.getElementById('apiKey');
    const modelNameInput = document.getElementById('modelName');
    
    if (configNameInput) {
      configNameInput.placeholder = currentLang === 'zh' ? '输入配置名称' : 'Enter configuration name';
    }
    if (apiKeyInput) {
      apiKeyInput.placeholder = currentLang === 'zh' ? '输入API密钥' : 'Enter API key';
    }
    if (modelNameInput) {
      modelNameInput.placeholder = currentLang === 'zh' ? '例如：gpt-3.5-turbo' : 'e.g.: gpt-3.5-turbo';
    }
    
    // 重新渲染配置列表（如果存在）
    if (configs.length > 0) {
      renderConfigList();
    }
  }
  
  // 重写showStatus函数以支持多语言
  const originalShowStatus = showStatus;
  showStatus = function(messageKey, isError = false) {
    let message;
    // 如果传入的是翻译键，则获取翻译文本
    if (typeof messageKey === 'string' && i18n && i18n.languages[i18n.getCurrentLanguage()]) {
      const translatedText = getText(messageKey);
      // 如果找到翻译则使用翻译，否则使用原文本
      message = translatedText !== messageKey ? translatedText : messageKey;
    } else {
      message = messageKey;
    }
    
    originalShowStatus(message, isError);
  };
  
  // 初始化
  init();
});
