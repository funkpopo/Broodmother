// 默认提示词模板
const DEFAULT_PROMPT_TEMPLATES = [
  {
    id: 'default-analysis',
    name: '智能分析',
    category: 'analysis',
    content: `请分析以下来自网页{analysisType}的文字内容，并以Markdown格式提供有用的见解、总结或建议：

{content}

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

请确保使用标准Markdown语法，包括标题(##)、列表(-)、粗体(**text**)等格式。`,
    temperature: 0.7,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'summary-simple',
    name: '简洁总结',
    category: 'summary',
    content: `请对以下内容进行简洁总结：

{content}

要求：
1. 用简洁明了的语言概括主要内容
2. 突出关键信息和要点
3. 控制在200字以内
4. 使用Markdown格式`,
    temperature: 0.5,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'detailed-analysis',
    name: '深度分析',
    category: 'analysis',
    content: `请对以下内容进行深度分析：

{content}

请从以下角度进行分析：

## 🎯 核心主题识别
- 主要讨论的话题
- 核心论点或观点

## 📊 内容结构分析
- 逻辑结构
- 论证方式
- 信息层次

## 🔍 关键信息提取
- 重要数据或事实
- 关键概念或术语
- 值得关注的细节

## 💭 深层思考
- 隐含的观点或假设
- 可能的影响或后果
- 相关的背景知识

## 🚀 行动建议
- 实际应用价值
- 后续行动建议
- 进一步学习方向

## 📝 总结评价
- 内容质量评估
- 主要价值所在
- 一句话精华总结`,
    temperature: 0.8,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'translation-analysis',
    name: '翻译分析',
    category: 'translation',
    content: `请将以下内容翻译成{language}，并提供分析：

{content}

请按以下格式提供结果：

## 🌐 翻译结果
（提供准确、流畅的翻译）

## 📝 翻译说明
- 关键术语的翻译选择
- 文化背景的处理方式
- 语言风格的调整

## 💡 内容要点
- 原文的主要信息
- 重要概念解释
- 背景知识补充`,
    temperature: 0.3,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'question-answer',
    name: '问答解析',
    category: 'qa',
    content: `请基于以下内容回答问题或提供解析：

{content}

请按以下方式处理：

## ❓ 问题识别
- 明确提出的问题
- 隐含的疑问点

## 💡 详细解答
- 直接回答问题
- 提供相关解释
- 举例说明

## 🔗 相关知识
- 背景知识补充
- 相关概念解释
- 延伸阅读建议

## 📋 要点总结
- 核心答案
- 关键要点
- 实用建议`,
    temperature: 0.6,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'creative-thinking',
    name: '创意思维',
    category: 'creative',
    content: `请对以下内容进行创意性思考和分析：

{content}

请从创新角度提供见解：

## 🎨 创新视角
- 不同的理解角度
- 创新的应用方式
- 跨领域的连接

## 🚀 灵感启发
- 可能的创意方向
- 新的思考方式
- 突破性的想法

## 🔄 关联思考
- 与其他领域的联系
- 类比和比喻
- 模式识别

## 💎 价值发现
- 潜在的机会
- 未被注意的价值
- 创新的可能性

## 🌟 行动启发
- 具体的创意建议
- 实施的可能路径
- 进一步探索的方向`,
    temperature: 0.9,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// 提示词分类定义
const PROMPT_CATEGORIES = {
  'analysis': {
    name: '分析类',
    nameEn: 'Analysis',
    description: '深度分析和见解提取',
    descriptionEn: 'Deep analysis and insight extraction'
  },
  'summary': {
    name: '总结类',
    nameEn: 'Summary',
    description: '内容概括和要点提取',
    descriptionEn: 'Content summarization and key points'
  },
  'translation': {
    name: '翻译类',
    nameEn: 'Translation',
    description: '多语言翻译和解释',
    descriptionEn: 'Multi-language translation and explanation'
  },
  'qa': {
    name: '问答类',
    nameEn: 'Q&A',
    description: '问题解答和知识解释',
    descriptionEn: 'Question answering and knowledge explanation'
  },
  'creative': {
    name: '创意类',
    nameEn: 'Creative',
    description: '创新思维和灵感启发',
    descriptionEn: 'Creative thinking and inspiration'
  },
  'custom': {
    name: '自定义',
    nameEn: 'Custom',
    description: '用户自定义提示词',
    descriptionEn: 'User-defined prompts'
  }
};

// 可用变量定义
const PROMPT_VARIABLES = {
  '{content}': {
    name: '内容',
    nameEn: 'Content',
    description: '要分析的文本内容',
    descriptionEn: 'Text content to be analyzed'
  },
  '{analysisType}': {
    name: '分析类型',
    nameEn: 'Analysis Type',
    description: '分析类型（选中区域/整个页面）',
    descriptionEn: 'Analysis type (selected area/entire page)'
  },
  '{language}': {
    name: '目标语言',
    nameEn: 'Target Language',
    description: '目标翻译语言',
    descriptionEn: 'Target translation language'
  },
  '{timestamp}': {
    name: '时间戳',
    nameEn: 'Timestamp',
    description: '当前时间',
    descriptionEn: 'Current timestamp'
  },
  '{url}': {
    name: '页面URL',
    nameEn: 'Page URL',
    description: '当前页面的URL',
    descriptionEn: 'Current page URL'
  },
  '{title}': {
    name: '页面标题',
    nameEn: 'Page Title',
    description: '当前页面的标题',
    descriptionEn: 'Current page title'
  }
};

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_PROMPT_TEMPLATES, PROMPT_CATEGORIES, PROMPT_VARIABLES };
} else if (typeof window !== 'undefined') {
  window.DEFAULT_PROMPT_TEMPLATES = DEFAULT_PROMPT_TEMPLATES;
  window.PROMPT_CATEGORIES = PROMPT_CATEGORIES;
  window.PROMPT_VARIABLES = PROMPT_VARIABLES;
}
