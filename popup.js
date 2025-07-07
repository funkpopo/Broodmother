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
  const configForm = document.getElementById('configForm');

  // 提示词相关DOM元素
  const promptList = document.getElementById('promptList');
  const addPromptBtn = document.getElementById('addPromptBtn');
  const promptForm = document.getElementById('promptForm');
  const promptNameInput = document.getElementById('promptName');
  const promptCategorySelect = document.getElementById('promptCategory');
  const promptTemperatureInput = document.getElementById('promptTemperature');
  const promptContentTextarea = document.getElementById('promptContent');
  const savePromptBtn = document.getElementById('savePromptBtn');
  const cancelPromptBtn = document.getElementById('cancelPromptBtn');
  const categoryFilter = document.getElementById('categoryFilter');
  const variableHelp = document.getElementById('variableHelp');
  const exportPromptsBtn = document.getElementById('exportPromptsBtn');
  const importPromptsBtn = document.getElementById('importPromptsBtn');
  const resetPromptsBtn = document.getElementById('resetPromptsBtn');
  
  // 验证关键DOM元素是否存在
  console.log({
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

  // 提示词模态框元素
  const deletePromptModal = document.getElementById('deletePromptModal');
  const confirmDeletePromptBtn = document.getElementById('confirmDeletePromptBtn');
  const cancelDeletePromptBtn = document.getElementById('cancelDeletePromptBtn');
  const importPromptsModal = document.getElementById('importPromptsModal');
  const importPromptsText = document.getElementById('importPromptsText');
  const confirmImportPromptsBtn = document.getElementById('confirmImportPromptsBtn');
  const cancelImportPromptsBtn = document.getElementById('cancelImportPromptsBtn');
  const resetPromptsModal = document.getElementById('resetPromptsModal');
  const confirmResetPromptsBtn = document.getElementById('confirmResetPromptsBtn');
  const cancelResetPromptsBtn = document.getElementById('cancelResetPromptsBtn');
  
  // 状态变量
  let configs = [];
  let currentConfigId = null;
  let editingConfigId = null;
  let currentTheme = 'light';
  let deleteConfigId = null;
  let defaultLanguage = 'Chinese';
  let apiFailoverEnabled = false;

  // 提示词相关变量
  let prompts = [];
  let currentPromptId = null;
  let editingPromptId = null;
  let deletePromptId = null;
  let currentCategoryFilter = 'all';
  
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

  // 测试API配置
  function testApiConfig(config) {
    if (!config || !config.apiUrl || !config.apiKey || !config.modelName) {
      showStatus(getText('test_failed') + ': 配置信息不完整', true);
      return;
    }

    // 显示测试中状态
    showStatus(getText('testing_api'));

    // 构建测试请求
    const testMessage = "ping, just reply 'pong'";
    const requestBody = {
      model: config.modelName,
      messages: [
        {
          role: "user",
          content: testMessage
        }
      ]
    };

    // 发送测试请求
    fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.apiKey
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10000) // 10秒超时
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      // 检查响应格式
      let hasValidResponse = false;
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        hasValidResponse = true;
      } else if (data.translatedText) {
        hasValidResponse = true;
      } else if (data.translations && Array.isArray(data.translations) && data.translations.length > 0) {
        hasValidResponse = true;
      }

      if (hasValidResponse) {
        showStatus(getText('test_success') + ` (${config.name})`);
      } else {
        showStatus(getText('test_failed') + ': 响应格式无效', true);
      }
    })
    .catch(error => {
      let errorMessage = getText('test_failed');
      if (error.name === 'TimeoutError') {
        errorMessage += ': 请求超时';
      } else if (error.message.includes('HTTP')) {
        errorMessage += ': ' + error.message;
      } else {
        errorMessage += ': 网络错误';
      }
      showStatus(errorMessage, true);
    });
  }
  
  // 加载配置
  function loadConfigs() {
    chrome.storage.sync.get(['configs', 'currentConfigId', 'currentTheme', 'defaultLanguage', 'apiFailover', 'prompts', 'currentPromptId'], (result) => {
      if (chrome.runtime.lastError) {
        showStatus('load_config_failed: ' + chrome.runtime.lastError.message, true);
        return;
      }
      
      configs = result.configs || [];
      currentConfigId = result.currentConfigId || null;
      currentTheme = result.currentTheme || 'light';
      defaultLanguage = result.defaultLanguage || 'Chinese';
      apiFailoverEnabled = result.apiFailover || false;

      // 加载提示词数据
      prompts = result.prompts || [];
      currentPromptId = result.currentPromptId || null;

      // 如果没有提示词，初始化默认提示词
      if (prompts.length === 0 && typeof DEFAULT_PROMPT_TEMPLATES !== 'undefined') {
        prompts = [...DEFAULT_PROMPT_TEMPLATES];
        currentPromptId = prompts.find(p => p.isDefault)?.id || prompts[0]?.id;
      }
      
      // 设置默认语言
      if (defaultLangSelect) {
        defaultLangSelect.value = defaultLanguage;
      }
      
      // 设置API故障转移开关
      const apiFailoverCheckbox = document.getElementById('apiFailover');
      if (apiFailoverCheckbox) {
        apiFailoverCheckbox.checked = apiFailoverEnabled;
      }
      
      // 应用主题
      applyTheme(currentTheme);
      updateThemeSelector();
      
      // 渲染配置列表
      renderConfigList();

      // 渲染提示词列表
      renderPromptList();

      // 初始化变量帮助
      initializeVariableHelp();

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
    const apiFailoverCheckbox = document.getElementById('apiFailover');
    if (apiFailoverCheckbox) {
      apiFailoverEnabled = apiFailoverCheckbox.checked;
    }
    
    chrome.storage.sync.set({
      configs,
      currentConfigId,
      currentTheme,
      defaultLanguage,
      apiFailover: apiFailoverEnabled,
      prompts,
      currentPromptId
    }, () => {
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
      if (configForm) {
        configForm.style.display = 'block';
      }
      
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
      const currentLang = i18n.getCurrentLanguage();
      emptyItem.textContent = currentLang === 'zh' ? '暂无配置，请添加' : 'No configurations, please add one';
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
      
      // 测试按钮
      const testButton = document.createElement('button');
      testButton.textContent = getText('test_config');
      testButton.className = 'btn-secondary';
      testButton.style.padding = '4px 8px';
      testButton.style.fontSize = '12px';
      testButton.addEventListener('click', (e) => {
        e.stopPropagation();
        testApiConfig(config);
      });
      buttonsDiv.appendChild(testButton);
      
      // 使用按钮
      const useButton = document.createElement('button');
      useButton.textContent = getText('use_config');
      useButton.className = 'btn-primary';
      useButton.style.padding = '4px 8px';
      useButton.style.fontSize = '12px';
      useButton.addEventListener('click', (e) => {
        e.stopPropagation();
        currentConfigId = config.id;
        saveConfigs();
        renderConfigList();
        const currentLang = i18n.getCurrentLanguage();
        const message = currentLang === 'zh' ? `已切换到配置: ${config.name}` : `Switched to config: ${config.name}`;
        showStatus(message);
      });
      buttonsDiv.appendChild(useButton);
      
      // 编辑按钮
      const editButton = document.createElement('button');
      editButton.textContent = getText('edit_config');
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
      deleteButton.textContent = getText('delete_config');
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

  // ==================== 提示词管理功能 ====================

  // 生成提示词唯一ID
  function generatePromptId() {
    return 'prompt-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // 渲染提示词列表
  function renderPromptList() {
    if (!promptList) return;

    promptList.innerHTML = '';

    // 过滤提示词
    const filteredPrompts = prompts.filter(prompt => {
      if (currentCategoryFilter === 'all') return true;
      return prompt.category === currentCategoryFilter;
    });

    if (filteredPrompts.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'config-item';
      const currentLang = i18n.getCurrentLanguage();
      emptyItem.textContent = currentLang === 'zh' ? '暂无提示词，请添加' : 'No prompts, please add one';
      promptList.appendChild(emptyItem);
      return;
    }

    filteredPrompts.forEach(prompt => {
      const promptItem = document.createElement('div');
      promptItem.className = 'config-item';
      if (prompt.id === currentPromptId) {
        promptItem.classList.add('active');
      }
      promptItem.dataset.id = prompt.id;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${prompt.name} (${getCategoryDisplayName(prompt.category)})`;
      if (prompt.isDefault) {
        nameSpan.textContent += ' ⭐';
      }
      promptItem.appendChild(nameSpan);

      const buttonsDiv = document.createElement('div');
      buttonsDiv.style.display = 'flex';
      buttonsDiv.style.gap = '5px';

      // 使用按钮
      const useButton = document.createElement('button');
      useButton.textContent = getText('use_config');
      useButton.className = 'btn-primary';
      useButton.style.padding = '4px 8px';
      useButton.style.fontSize = '12px';
      useButton.addEventListener('click', (e) => {
        e.stopPropagation();
        setCurrentPrompt(prompt.id);
      });
      buttonsDiv.appendChild(useButton);

      // 编辑按钮
      const editButton = document.createElement('button');
      editButton.textContent = getText('edit_config');
      editButton.className = 'btn-secondary';
      editButton.style.padding = '4px 8px';
      editButton.style.fontSize = '12px';
      editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showPromptForm(prompt.id);
      });
      buttonsDiv.appendChild(editButton);

      // 设为默认按钮
      if (!prompt.isDefault) {
        const defaultButton = document.createElement('button');
        defaultButton.textContent = getText('set_as_default');
        defaultButton.className = 'btn-secondary';
        defaultButton.style.padding = '4px 8px';
        defaultButton.style.fontSize = '12px';
        defaultButton.addEventListener('click', (e) => {
          e.stopPropagation();
          setDefaultPrompt(prompt.id);
        });
        buttonsDiv.appendChild(defaultButton);
      }

      // 删除按钮
      const deleteButton = document.createElement('button');
      deleteButton.textContent = getText('delete_config');
      deleteButton.className = 'btn-danger';
      deleteButton.style.padding = '4px 8px';
      deleteButton.style.fontSize = '12px';
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePromptId = prompt.id;
        showDeletePromptModal();
      });
      buttonsDiv.appendChild(deleteButton);

      promptItem.appendChild(buttonsDiv);
      promptList.appendChild(promptItem);

      // 点击提示词项，显示编辑表单
      promptItem.addEventListener('click', () => {
        showPromptForm(prompt.id);
      });
    });
  }

  // 获取分类显示名称
  function getCategoryDisplayName(category) {
    const currentLang = i18n.getCurrentLanguage();
    if (typeof PROMPT_CATEGORIES !== 'undefined' && PROMPT_CATEGORIES[category]) {
      return currentLang === 'zh' ? PROMPT_CATEGORIES[category].name : PROMPT_CATEGORIES[category].nameEn;
    }
    return category;
  }

  // 设置当前提示词
  function setCurrentPrompt(promptId) {
    currentPromptId = promptId;
    saveConfigs();
    renderPromptList();
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      const currentLang = i18n.getCurrentLanguage();
      const message = currentLang === 'zh' ? `已切换到提示词: ${prompt.name}` : `Switched to prompt: ${prompt.name}`;
      showStatus(message);
    }
  }

  // 设置默认提示词
  function setDefaultPrompt(promptId) {
    // 清除所有默认标记
    prompts.forEach(p => p.isDefault = false);
    // 设置新的默认提示词
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      prompt.isDefault = true;
      saveConfigs();
      renderPromptList();
      showStatus(getText('default_prompt_set'));
    }
  }

  // 显示提示词编辑表单
  function showPromptForm(promptId = null) {
    if (!promptForm) return;

    editingPromptId = promptId;

    if (promptId) {
      // 编辑现有提示词
      const prompt = prompts.find(p => p.id === promptId);
      if (prompt) {
        promptNameInput.value = prompt.name;
        promptCategorySelect.value = prompt.category;
        promptTemperatureInput.value = prompt.temperature;
        promptContentTextarea.value = prompt.content;
      }
    } else {
      // 添加新提示词
      clearPromptForm();
    }

    promptForm.style.display = 'block';
  }

  // 清空提示词表单
  function clearPromptForm() {
    editingPromptId = null;
    if (promptNameInput) promptNameInput.value = '';
    if (promptCategorySelect) promptCategorySelect.value = 'custom';
    if (promptTemperatureInput) promptTemperatureInput.value = '0.7';
    if (promptContentTextarea) promptContentTextarea.value = '';
    if (promptForm) promptForm.style.display = 'none';
  }

  // 保存提示词
  function savePrompt() {
    if (!promptNameInput || !promptContentTextarea) {
      showStatus('表单元素未找到', true);
      return;
    }

    const name = promptNameInput.value.trim();
    const category = promptCategorySelect.value;
    const temperature = parseFloat(promptTemperatureInput.value);
    const content = promptContentTextarea.value.trim();

    if (!name) {
      showStatus(getText('prompt_name_required'), true);
      return;
    }

    if (!content) {
      showStatus(getText('prompt_content_required'), true);
      return;
    }

    if (isNaN(temperature) || temperature < 0 || temperature > 2) {
      showStatus(getText('temperature_range_error'), true);
      return;
    }

    const now = new Date().toISOString();

    if (editingPromptId) {
      // 更新现有提示词
      const index = prompts.findIndex(p => p.id === editingPromptId);
      if (index !== -1) {
        prompts[index] = {
          ...prompts[index],
          name,
          category,
          temperature,
          content,
          updatedAt: now
        };
        showStatus(getText('prompt_updated'));
      }
    } else {
      // 添加新提示词
      const newPrompt = {
        id: generatePromptId(),
        name,
        category,
        temperature,
        content,
        isDefault: false,
        createdAt: now,
        updatedAt: now
      };
      prompts.push(newPrompt);

      // 如果是第一个提示词，设置为当前提示词
      if (!currentPromptId) {
        currentPromptId = newPrompt.id;
      }

      showStatus(getText('prompt_saved'));
    }

    // 保存到存储
    saveConfigs();

    // 重新渲染列表
    renderPromptList();

    // 清空表单
    clearPromptForm();
  }

  // 删除提示词
  function deletePrompt(promptId) {
    const index = prompts.findIndex(p => p.id === promptId);
    if (index !== -1) {
      prompts.splice(index, 1);

      // 如果删除的是当前提示词，重置当前提示词
      if (currentPromptId === promptId) {
        currentPromptId = prompts.length > 0 ? prompts[0].id : null;
      }

      // 保存到存储
      saveConfigs();

      // 重新渲染列表
      renderPromptList();

      showStatus(getText('prompt_deleted'));
    }
  }

  // 初始化变量帮助
  function initializeVariableHelp() {
    if (!variableHelp || typeof PROMPT_VARIABLES === 'undefined') return;

    variableHelp.innerHTML = '';

    Object.keys(PROMPT_VARIABLES).forEach(variable => {
      const button = document.createElement('button');
      button.textContent = variable;
      button.className = 'btn-secondary';
      button.style.padding = '2px 6px';
      button.style.fontSize = '11px';
      button.style.margin = '2px';
      button.title = PROMPT_VARIABLES[variable].description;

      button.addEventListener('click', () => {
        insertVariableIntoPrompt(variable);
      });

      variableHelp.appendChild(button);
    });
  }

  // 插入变量到提示词内容中
  function insertVariableIntoPrompt(variable) {
    if (!promptContentTextarea) return;

    const textarea = promptContentTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const newText = text.substring(0, start) + variable + text.substring(end);
    textarea.value = newText;

    // 设置光标位置
    const newCursorPos = start + variable.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  }

  // 导出提示词
  function exportPrompts() {
    if (prompts.length === 0) {
      showStatus(getText('no_configs_to_export'), true);
      return;
    }

    const exportData = {
      prompts: prompts,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };

    const exportJson = JSON.stringify(exportData, null, 2);

    // 创建临时textarea用于复制
    const textarea = document.createElement('textarea');
    textarea.value = exportJson;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    showStatus(getText('prompts_exported'));
  }

  // 导入提示词
  function importPrompts() {
    if (!importPromptsText) return;

    try {
      const importData = JSON.parse(importPromptsText.value);

      if (!importData.prompts || !Array.isArray(importData.prompts)) {
        showStatus(getText('invalid_prompt_data'), true);
        return;
      }

      // 检查每个提示词是否有必要的字段
      const validPrompts = importData.prompts.filter(prompt => {
        return prompt.name && prompt.content && prompt.category;
      });

      if (validPrompts.length === 0) {
        showStatus(getText('invalid_prompt_data'), true);
        return;
      }

      // 确保每个提示词都有唯一ID和必要字段
      const now = new Date().toISOString();
      validPrompts.forEach(prompt => {
        if (!prompt.id) {
          prompt.id = generatePromptId();
        }
        if (typeof prompt.temperature !== 'number') {
          prompt.temperature = 0.7;
        }
        if (typeof prompt.isDefault !== 'boolean') {
          prompt.isDefault = false;
        }
        if (!prompt.createdAt) {
          prompt.createdAt = now;
        }
        prompt.updatedAt = now;
      });

      // 如果是追加模式，合并提示词
      const existingNames = prompts.map(p => p.name);
      validPrompts.forEach(prompt => {
        // 如果已存在同名提示词，添加后缀
        let newName = prompt.name;
        let counter = 1;
        while (existingNames.includes(newName)) {
          newName = `${prompt.name} (${counter})`;
          counter++;
        }
        prompt.name = newName;
        existingNames.push(newName);
      });

      // 添加到现有提示词
      prompts = [...prompts, ...validPrompts];

      // 如果没有当前提示词，设置第一个导入的提示词为当前提示词
      if (!currentPromptId && prompts.length > 0) {
        currentPromptId = prompts[0].id;
      }

      // 保存提示词
      saveConfigs();

      // 重新渲染列表
      renderPromptList();

      // 关闭导入模态框
      hideImportPromptsModal();

      showStatus(`${getText('prompts_imported')}: ${validPrompts.length}`);
    } catch (error) {
      showStatus(getText('invalid_prompt_data') + ': ' + error.message, true);
    }
  }

  // 重置提示词为默认
  function resetPrompts() {
    if (typeof DEFAULT_PROMPT_TEMPLATES !== 'undefined') {
      prompts = [...DEFAULT_PROMPT_TEMPLATES];
      currentPromptId = prompts.find(p => p.isDefault)?.id || prompts[0]?.id;

      // 保存提示词
      saveConfigs();

      // 重新渲染列表
      renderPromptList();

      // 关闭重置模态框
      hideResetPromptsModal();

      showStatus(getText('prompts_reset'));
    }
  }

  // 显示删除提示词模态框
  function showDeletePromptModal() {
    if (deletePromptModal) {
      deletePromptModal.style.display = 'flex';
    }
  }

  // 隐藏删除提示词模态框
  function hideDeletePromptModal() {
    if (deletePromptModal) {
      deletePromptModal.style.display = 'none';
    }
  }

  // 显示导入提示词模态框
  function showImportPromptsModal() {
    if (importPromptsModal && importPromptsText) {
      importPromptsModal.style.display = 'flex';
      importPromptsText.value = '';
    }
  }

  // 隐藏导入提示词模态框
  function hideImportPromptsModal() {
    if (importPromptsModal) {
      importPromptsModal.style.display = 'none';
    }
  }

  // 显示重置提示词模态框
  function showResetPromptsModal() {
    if (resetPromptsModal) {
      resetPromptsModal.style.display = 'flex';
    }
  }

  // 隐藏重置提示词模态框
  function hideResetPromptsModal() {
    if (resetPromptsModal) {
      resetPromptsModal.style.display = 'none';
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
        if (configForm) {
          configForm.style.display = 'block';
        }
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
        showStatus('default_language_updated');
      });
      
    } else {
      
    }
    
    // API故障转移开关事件
    const apiFailoverCheckbox = document.getElementById('apiFailover');
    if (apiFailoverCheckbox) {
      apiFailoverCheckbox.addEventListener('change', () => {
        saveConfigs();
        const currentLang = i18n.getCurrentLanguage();
        const message = currentLang === 'zh' ? '设置已保存' : 'Settings saved';
        showStatus(message);
      });
    }

    // ==================== 提示词相关事件监听器 ====================

    // 添加提示词按钮点击事件
    if (addPromptBtn) {
      addPromptBtn.addEventListener('click', () => {
        showPromptForm();
      });
    }

    // 保存提示词按钮点击事件
    if (savePromptBtn) {
      savePromptBtn.addEventListener('click', savePrompt);
    }

    // 取消编辑提示词按钮点击事件
    if (cancelPromptBtn) {
      cancelPromptBtn.addEventListener('click', clearPromptForm);
    }

    // 分类筛选器变化事件
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        currentCategoryFilter = categoryFilter.value;
        renderPromptList();
      });
    }

    // 导出提示词按钮点击事件
    if (exportPromptsBtn) {
      exportPromptsBtn.addEventListener('click', exportPrompts);
    }

    // 导入提示词按钮点击事件
    if (importPromptsBtn) {
      importPromptsBtn.addEventListener('click', showImportPromptsModal);
    }

    // 重置提示词按钮点击事件
    if (resetPromptsBtn) {
      resetPromptsBtn.addEventListener('click', showResetPromptsModal);
    }

    // 确认删除提示词按钮点击事件
    if (confirmDeletePromptBtn) {
      confirmDeletePromptBtn.addEventListener('click', () => {
        if (deletePromptId) {
          deletePrompt(deletePromptId);
          deletePromptId = null;
          hideDeletePromptModal();
        }
      });
    }

    // 取消删除提示词按钮点击事件
    if (cancelDeletePromptBtn) {
      cancelDeletePromptBtn.addEventListener('click', hideDeletePromptModal);
    }

    // 确认导入提示词按钮点击事件
    if (confirmImportPromptsBtn) {
      confirmImportPromptsBtn.addEventListener('click', importPrompts);
    }

    // 取消导入提示词按钮点击事件
    if (cancelImportPromptsBtn) {
      cancelImportPromptsBtn.addEventListener('click', hideImportPromptsModal);
    }

    // 确认重置提示词按钮点击事件
    if (confirmResetPromptsBtn) {
      confirmResetPromptsBtn.addEventListener('click', resetPrompts);
    }

    // 取消重置提示词按钮点击事件
    if (cancelResetPromptsBtn) {
      cancelResetPromptsBtn.addEventListener('click', hideResetPromptsModal);
    }

    // 更新关闭模态框按钮点击事件，包含提示词模态框
    if (modalCloseButtons && modalCloseButtons.length > 0) {
      modalCloseButtons.forEach(button => {
        button.addEventListener('click', () => {
          hideDeleteModal();
          hideImportModal();
          hideDeletePromptModal();
          hideImportPromptsModal();
          hideResetPromptsModal();
        });
      });
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
        // 切换语言
        i18n.toggleLanguage();
        
        // 立即更新界面
        updateLanguageLabel();
        i18n.updateTexts();
        updateAllTexts();
        
        // 显示状态提示
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
    const currentLang = i18n.getCurrentLanguage();
    
    // 更新 placeholder 文本
    const configNameInput = document.getElementById('configName');
    const apiKeyInput = document.getElementById('apiKey');
    const modelNameInput = document.getElementById('modelName');
    const importText = document.getElementById('importText');
    
    if (configNameInput) {
      configNameInput.placeholder = getText('config_name');
    }
    if (apiKeyInput) {
      apiKeyInput.placeholder = getText('api_key');
    }
    if (modelNameInput) {
      modelNameInput.placeholder = currentLang === 'zh' ? '例如：gpt-3.5-turbo' : 'e.g.: gpt-3.5-turbo';
    }
    if (importText) {
      importText.placeholder = getText('import_config_placeholder');
    }
    
    // 更新下拉选项文本
    const defaultLangSelect = document.getElementById('defaultLang');
    if (defaultLangSelect) {
      const currentValue = defaultLangSelect.value;
      if (currentLang === 'zh') {
        defaultLangSelect.innerHTML = `
          <option value="Chinese">中文</option>
          <option value="English">英文</option>
          <option value="Japanese">日文</option>
          <option value="Korean">韩文</option>
          <option value="French">法文</option>
          <option value="German">德文</option>
          <option value="Spanish">西班牙文</option>
        `;
      } else {
        defaultLangSelect.innerHTML = `
          <option value="Chinese">Chinese</option>
          <option value="English">English</option>
          <option value="Japanese">Japanese</option>
          <option value="Korean">Korean</option>
          <option value="French">French</option>
          <option value="German">German</option>
          <option value="Spanish">Spanish</option>
        `;
      }
      defaultLangSelect.value = currentValue;
    }
    
    // 更新API故障转移标签和说明
    const apiFailoverLabel = document.querySelector('label[for="apiFailover"]');
    const apiFailoverHelpText = document.querySelector('label[for="apiFailover"] + small');
    if (apiFailoverLabel) {
      apiFailoverLabel.textContent = currentLang === 'zh' ? 'API自动故障转移:' : 'API Auto Failover:';
    }
    if (apiFailoverHelpText) {
      apiFailoverHelpText.textContent = currentLang === 'zh' ? 
        '开启后，当主API失败时会自动尝试其他配置的API' : 
        'When enabled, automatically tries other API configs if the primary fails';
    }
    
    // 重新渲染配置列表（如果存在）
    if (configs.length > 0) {
      renderConfigList();
    }

    // 重新渲染提示词列表（如果存在）
    if (prompts.length > 0) {
      renderPromptList();
    }

    // 更新提示词相关的placeholder文本
    if (promptNameInput) {
      promptNameInput.placeholder = getText('prompt_name');
    }
    if (promptContentTextarea) {
      promptContentTextarea.placeholder = getText('prompt_content');
    }
    if (importPromptsText) {
      importPromptsText.placeholder = getText('import_config_placeholder');
    }

    // 更新分类选择器选项
    if (categoryFilter) {
      const currentValue = categoryFilter.value;
      categoryFilter.innerHTML = `
        <option value="all">${getText('all_categories')}</option>
        <option value="analysis">${getText('category_analysis')}</option>
        <option value="summary">${getText('category_summary')}</option>
        <option value="translation">${getText('category_translation')}</option>
        <option value="qa">${getText('category_qa')}</option>
        <option value="creative">${getText('category_creative')}</option>
        <option value="custom">${getText('category_custom')}</option>
      `;
      categoryFilter.value = currentValue;
    }

    if (promptCategorySelect) {
      const currentValue = promptCategorySelect.value;
      promptCategorySelect.innerHTML = `
        <option value="analysis">${getText('category_analysis')}</option>
        <option value="summary">${getText('category_summary')}</option>
        <option value="translation">${getText('category_translation')}</option>
        <option value="qa">${getText('category_qa')}</option>
        <option value="creative">${getText('category_creative')}</option>
        <option value="custom">${getText('category_custom')}</option>
      `;
      promptCategorySelect.value = currentValue;
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
