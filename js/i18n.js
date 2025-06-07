// 国际化管理器
class I18nManager {
  constructor() {
    this.currentLanguage = 'zh'; // 默认中文
    this.languages = {};
    this.listeners = [];
    
    // 从存储中加载语言设置
    this.loadLanguageFromStorage();
  }
  
  // 注册语言包
  registerLanguage(lang, data) {
    this.languages[lang] = data;
  }
  
  // 设置当前语言
  setLanguage(lang) {
    if (!this.languages[lang]) {
      
      return false;
    }
    
    this.currentLanguage = lang;
    this.saveLanguageToStorage();
    this.notifyLanguageChange();
    return true;
  }
  
  // 获取当前语言
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  
  // 获取文本
  getText(key, defaultText = null) {
    const langData = this.languages[this.currentLanguage];
    if (!langData) {
      console.warn(`Language pack '${this.currentLanguage}' not found`);
      return defaultText || key;
    }
    
    const text = langData[key];
    if (text === undefined) {
      console.warn(`Translation key '${key}' not found for language '${this.currentLanguage}'`);
      return defaultText || key;
    }
    
    return text;
  }
  
  // 更新页面所有文本
  updateTexts() {
    // 更新带有 data-i18n 属性的元素
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const key = element.getAttribute('data-i18n');
      const text = this.getText(key);
      
      // 检查是否是输入元素的placeholder
      if (element.hasAttribute('data-i18n-placeholder')) {
        element.placeholder = text;
      } else if (element.hasAttribute('data-i18n-title')) {
        element.title = text;
      } else {
        element.textContent = text;
      }
    });
    
    // 触发自定义更新事件
    this.notifyTextUpdate();
  }
  
  // 保存语言设置到存储
  saveLanguageToStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.set({ currentLanguage: this.currentLanguage });
      } else {
        localStorage.setItem('broodmother_language', this.currentLanguage);
      }
    } catch (error) {
      
      // 回退到 localStorage
      localStorage.setItem('broodmother_language', this.currentLanguage);
    }
  }
  
  // 从存储中加载语言设置
  loadLanguageFromStorage() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['currentLanguage'], (result) => {
          if (result.currentLanguage) {
            this.currentLanguage = result.currentLanguage;
            this.notifyLanguageChange();
          }
        });
      } else {
        const saved = localStorage.getItem('broodmother_language');
        if (saved) {
          this.currentLanguage = saved;
        }
      }
    } catch (error) {
      
      // 回退到 localStorage
      const saved = localStorage.getItem('broodmother_language');
      if (saved) {
        this.currentLanguage = saved;
      }
    }
  }
  
  // 添加语言变化监听器
  addLanguageChangeListener(callback) {
    this.listeners.push(callback);
  }
  
  // 移除语言变化监听器
  removeLanguageChangeListener(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  // 通知语言变化
  notifyLanguageChange() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentLanguage);
      } catch (error) {
        
      }
    });
  }
  
  // 通知文本更新
  notifyTextUpdate() {
    // 触发自定义事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('i18nTextUpdated', {
        detail: { language: this.currentLanguage }
      }));
    }
  }
  
  // 切换语言（在中文和英文之间）
  toggleLanguage() {
    const newLang = this.currentLanguage === 'zh' ? 'en' : 'zh';
    this.setLanguage(newLang);
  }
  
  // 获取可用语言列表
  getAvailableLanguages() {
    return Object.keys(this.languages);
  }
  
  // 初始化（在语言包加载完成后调用）
  init() {
    // 确保当前语言有对应的语言包
    if (!this.languages[this.currentLanguage]) {
      console.warn(`Current language '${this.currentLanguage}' not available, falling back to 'zh'`);
      this.currentLanguage = 'zh';
    }
    
    // 应用文本更新
    setTimeout(() => {
      this.updateTexts();
    }, 0);
  }
}

// 创建全局实例
const i18n = new I18nManager();

// 便捷函数
function getText(key, defaultText = null) {
  return i18n.getText(key, defaultText);
}

function setLanguage(lang) {
  return i18n.setLanguage(lang);
}

function getCurrentLanguage() {
  return i18n.getCurrentLanguage();
}

function updateTexts() {
  i18n.updateTexts();
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18nManager, i18n, getText, setLanguage, getCurrentLanguage, updateTexts };
} else if (typeof window !== 'undefined') {
  window.I18nManager = I18nManager;
  window.i18n = i18n;
  window.getText = getText;
  window.setLanguage = setLanguage;
  window.getCurrentLanguage = getCurrentLanguage;
  window.updateTexts = updateTexts;
} 