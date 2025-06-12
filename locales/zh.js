// 中文语言包
const zh = {
  // 通用
  'save': '保存',
  'cancel': '取消',
  'delete': '删除',
  'edit': '编辑',
  'add': '添加',
  'export': '导出',
  'import': '导入',
  'confirm': '确认',
  'close': '关闭',
  'settings': '设置',
  'language': '语言',
  
  // popup界面 - 标题和标签
  'extension_title': 'Broodmother Settings',
  'config_name': '配置名称',
  'api_url': 'API URL',
  'api_key': 'API Key',
  'model_name': '模型名称',
  'default_lang': '默认翻译语言',
  'current_config': '当前配置',
  'config_management': '配置管理',
  'theme_settings': '主题设置',
  
  // popup界面 - 按钮
  'save_config': '保存配置',
  'add_config': '添加配置',
  'export_configs': '导出配置',
  'import_configs': '导入配置',
  'test_config': '测试',
  'use_config': '使用',
  'edit_config': '编辑',
  'delete_config': '删除',
  
  // popup界面 - 状态消息
  'config_saved': '配置已保存',
  'config_updated': '配置已更新',
  'config_added': '配置已添加',
  'config_deleted': '配置已删除',
  'default_language_updated': '默认语言已更新',
  'configs_exported': '配置已导出到剪贴板',
  'configs_imported': '配置导入成功',
  'invalid_config_data': '无效的配置数据',
  'no_configs_to_export': '没有配置可导出',
  'testing_api': '测试中...',
  'test_success': 'API测试成功',
  'test_failed': 'API测试失败',
  
  // popup界面 - 错误消息
  'enter_config_name': '请输入配置名称',
  'enter_api_url': '请输入API URL',
  'enter_api_key': '请输入API Key',
  'enter_model_name': '请输入模型名称',
  'load_config_failed': '加载配置失败',
  'save_config_failed': '保存配置失败',
  'form_elements_not_found': '表单元素未找到，请重新打开设置页面',
  
  // popup界面 - 模态框
  'delete_config_title': '删除配置',
  'delete_config_message': '确定要删除这个配置吗？此操作无法撤销。',
  'import_config_title': '导入配置',
  'import_config_message': '请粘贴配置数据（JSON格式）：',
  'import_config_placeholder': '在此粘贴配置数据...',
  
  // 侧边栏界面
  'page_preview': '页面预览',
  'analyze_selection': '分析选中范围',
  'analyze_page': '分析整个页面',
  'analysis_result': '分析结果',
  'zoom_in': '放大 (滚轮向上)',
  'zoom_out': '缩小 (滚轮向下)',  
  'zoom_reset': '重置缩放 (Ctrl+0)',
  'getting_screenshot': '正在获取页面截图...',
  'analysis_in_progress': '分析进行中...',
  'back_to_bottom': '回到底部',
  'stop_analysis': '停止分析',
  'analysis_interrupted': '分析已中断',
  'analysis_interrupted_note': '上述内容为中断前的分析结果',
  'analysis_cancelled': '分析已取消',
  
  // 侧边栏 - 错误消息
  'cannot_get_tab_info': '无法获取当前标签页信息。',
  'screenshot_failed': '截图失败，请刷新页面重试',
  'analysis_failed': '分析失败，请重试',
  'no_selection': '请先选择要分析的区域',
  'selection_too_small': '选择的区域太小，请重新选择',
  
  // 侧边栏 - 选择操作
  'clear_selection': '清除选择',
  'analyze_this_area': '分析此区域',
  'new_selection': '新建选择',
  'selection_cleared': '选择已清除',
  'selection_finalized': '选择已确定',
  
  // 语言切换
  'switch_to_english': 'Switch to English',
  'switch_to_chinese': '切换到中文',
  'language_switched': '语言已切换',
  
  // 主题相关
  'light_theme': '亮色主题',
  'dark_theme': '暗色主题', 
  'auto_theme': '自动主题',
  
  // 模态框按钮
  'ok': '确定',
  'yes': '是',
  'no': '否',
  
  // 其他常用文本
  'loading': '加载中...',
  'error': '错误',
  'success': '成功',
  'warning': '警告',
  'info': '信息',

  // 提示词管理
  'prompts': '提示词',
  'prompt_management': '提示词管理',
  'prompt_name': '提示词名称',
  'prompt_content': '提示词内容',
  'prompt_category': '分类',
  'prompt_temperature': '温度值',
  'add_prompt': '添加提示词',
  'edit_prompt': '编辑提示词',
  'delete_prompt': '删除提示词',
  'save_prompt': '保存提示词',
  'cancel_edit': '取消编辑',
  'set_as_default': '设为默认',
  'default_prompt': '默认提示词',
  'custom_prompt': '自定义提示词',
  'prompt_preview': '预览',
  'test_prompt': '测试提示词',
  'export_prompts': '导出提示词',
  'import_prompts': '导入提示词',
  'reset_prompts': '重置为默认',

  // 提示词分类
  'category_analysis': '分析类',
  'category_summary': '总结类',
  'category_translation': '翻译类',
  'category_qa': '问答类',
  'category_creative': '创意类',
  'category_custom': '自定义',
  'all_categories': '全部分类',

  // 提示词变量
  'available_variables': '可用变量',
  'variable_content': '内容',
  'variable_analysis_type': '分析类型',
  'variable_language': '目标语言',
  'variable_timestamp': '时间戳',
  'variable_url': '页面URL',
  'variable_title': '页面标题',
  'variable_help': '点击变量名插入到提示词中',

  // 提示词状态消息
  'prompt_saved': '提示词已保存',
  'prompt_deleted': '提示词已删除',
  'prompt_updated': '提示词已更新',
  'default_prompt_set': '默认提示词已设置',
  'prompts_exported': '提示词已导出',
  'prompts_imported': '提示词已导入',
  'prompts_reset': '提示词已重置为默认',
  'invalid_prompt_data': '无效的提示词数据',
  'prompt_name_required': '请输入提示词名称',
  'prompt_content_required': '请输入提示词内容',
  'temperature_range_error': '温度值必须在0.0-2.0之间',

  // 提示词模态框
  'delete_prompt_title': '删除提示词',
  'delete_prompt_message': '确定要删除这个提示词吗？此操作无法撤销。',
  'import_prompts_title': '导入提示词',
  'import_prompts_message': '请粘贴提示词数据（JSON格式）：',
  'reset_prompts_title': '重置提示词',
  'reset_prompts_message': '确定要重置为默认提示词吗？这将删除所有自定义提示词。',

  // 温度值说明
  'temperature_help': '温度值控制AI回复的创造性：0.0-0.3保守准确，0.4-0.7平衡，0.8-2.0创意发散'
};

// 导出语言包
if (typeof module !== 'undefined' && module.exports) {
  module.exports = zh;
} else if (typeof window !== 'undefined') {
  window.zh = zh;
} 