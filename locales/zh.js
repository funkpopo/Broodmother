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
  'info': '信息'
};

// 导出语言包
if (typeof module !== 'undefined' && module.exports) {
  module.exports = zh;
} else if (typeof window !== 'undefined') {
  window.zh = zh;
} 