// English language pack
const en = {
  // Common
  'save': 'Save',
  'cancel': 'Cancel',
  'delete': 'Delete',
  'edit': 'Edit',
  'add': 'Add',
  'export': 'Export',
  'import': 'Import',
  'confirm': 'Confirm',
  'close': 'Close',
  'settings': 'Settings',
  'language': 'Language',
  
  // Popup interface - titles and labels
  'extension_title': 'Broodmother Settings',
  'config_name': 'Configuration Name',
  'api_url': 'API URL',
  'api_key': 'API Key',
  'model_name': 'Model Name',
  'default_lang': 'Default Translation Language',
  'current_config': 'Current Configuration',
  'config_management': 'Configuration Management',
  'theme_settings': 'Theme Settings',
  
  // Popup interface - buttons
  'save_config': 'Save Configuration',
  'add_config': 'Add Configuration',
  'export_configs': 'Export Configurations',
  'import_configs': 'Import Configurations',
  'test_config': 'Test',
  'use_config': 'Use',
  'edit_config': 'Edit',
  'delete_config': 'Delete',
  
  // Popup interface - status messages
  'config_saved': 'Configuration saved',
  'config_updated': 'Configuration updated',
  'config_added': 'Configuration added',
  'config_deleted': 'Configuration deleted',
  'default_language_updated': 'Default language updated',
  'configs_exported': 'Configurations exported to clipboard',
  'configs_imported': 'Configurations imported successfully',
  'invalid_config_data': 'Invalid configuration data',
  'no_configs_to_export': 'No configurations to export',
  'testing_api': 'Testing...',
  'test_success': 'API test successful',
  'test_failed': 'API test failed',
  
  // Popup interface - error messages
  'enter_config_name': 'Please enter configuration name',
  'enter_api_url': 'Please enter API URL',
  'enter_api_key': 'Please enter API Key',
  'enter_model_name': 'Please enter model name',
  'load_config_failed': 'Failed to load configuration',
  'save_config_failed': 'Failed to save configuration',
  'form_elements_not_found': 'Form elements not found, please reopen settings page',
  
  // Popup interface - modals
  'delete_config_title': 'Delete Configuration',
  'delete_config_message': 'Are you sure you want to delete this configuration? This action cannot be undone.',
  'import_config_title': 'Import Configuration',
  'import_config_message': 'Please paste configuration data (JSON format):',
  'import_config_placeholder': 'Paste configuration data here...',
  
  // Sidepanel interface
  'page_preview': 'Page Preview',
  'analyze_selection': 'Analyze Selection',
  'analyze_page': 'Analyze Entire Page',
  'analysis_result': 'Analysis Result',
  'zoom_in': 'Zoom In (Scroll Up)',
  'zoom_out': 'Zoom Out (Scroll Down)',
  'zoom_reset': 'Reset Zoom (Ctrl+0)',
  'getting_screenshot': 'Getting page screenshot...',
  'analysis_in_progress': 'Analysis in progress...',
  'back_to_bottom': 'Back to Bottom',
  'stop_analysis': 'Stop Analysis',
  'analysis_interrupted': 'Analysis Interrupted',
  'analysis_interrupted_note': 'Above content shows analysis results before interruption',
  'analysis_cancelled': 'Analysis Cancelled',
  
  // Sidepanel - error messages
  'cannot_get_tab_info': 'Cannot get current tab information.',
  'screenshot_failed': 'Screenshot failed, please refresh page and try again',
  'analysis_failed': 'Analysis failed, please try again',
  'no_selection': 'Please select an area to analyze first',
  'selection_too_small': 'Selection area is too small, please reselect',
  
  // Sidepanel - selection operations
  'clear_selection': 'Clear Selection',
  'analyze_this_area': 'Analyze This Area',
  'new_selection': 'New Selection',
  'selection_cleared': 'Selection cleared',
  'selection_finalized': 'Selection finalized',
  
  // Language switching
  'switch_to_english': 'Switch to English',
  'switch_to_chinese': '切换到中文',
  'language_switched': 'Language switched',
  
  // Theme related
  'light_theme': 'Light Theme',
  'dark_theme': 'Dark Theme',
  'auto_theme': 'Auto Theme',
  
  // Modal buttons
  'ok': 'OK',
  'yes': 'Yes',
  'no': 'No',
  
  // Other common texts
  'loading': 'Loading...',
  'error': 'Error',
  'success': 'Success',
  'warning': 'Warning',
  'info': 'Information',

  // Prompt management
  'prompts': 'Prompts',
  'prompt_management': 'Prompt Management',
  'prompt_name': 'Prompt Name',
  'prompt_content': 'Prompt Content',
  'prompt_category': 'Category',
  'prompt_temperature': 'Temperature',
  'add_prompt': 'Add Prompt',
  'edit_prompt': 'Edit Prompt',
  'delete_prompt': 'Delete Prompt',
  'save_prompt': 'Save Prompt',
  'cancel_edit': 'Cancel Edit',
  'set_as_default': 'Set as Default',
  'default_prompt': 'Default Prompt',
  'custom_prompt': 'Custom Prompt',
  'prompt_preview': 'Preview',
  'test_prompt': 'Test Prompt',
  'export_prompts': 'Export Prompts',
  'import_prompts': 'Import Prompts',
  'reset_prompts': 'Reset to Default',

  // Prompt categories
  'category_analysis': 'Analysis',
  'category_summary': 'Summary',
  'category_translation': 'Translation',
  'category_qa': 'Q&A',
  'category_creative': 'Creative',
  'category_custom': 'Custom',
  'all_categories': 'All Categories',

  // Prompt variables
  'available_variables': 'Available Variables',
  'variable_content': 'Content',
  'variable_analysis_type': 'Analysis Type',
  'variable_language': 'Target Language',
  'variable_timestamp': 'Timestamp',
  'variable_url': 'Page URL',
  'variable_title': 'Page Title',
  'variable_help': 'Click variable name to insert into prompt',

  // Prompt status messages
  'prompt_saved': 'Prompt saved',
  'prompt_deleted': 'Prompt deleted',
  'prompt_updated': 'Prompt updated',
  'default_prompt_set': 'Default prompt set',
  'prompts_exported': 'Prompts exported',
  'prompts_imported': 'Prompts imported',
  'prompts_reset': 'Prompts reset to default',
  'invalid_prompt_data': 'Invalid prompt data',
  'prompt_name_required': 'Please enter prompt name',
  'prompt_content_required': 'Please enter prompt content',
  'temperature_range_error': 'Temperature must be between 0.0-2.0',

  // Prompt modals
  'delete_prompt_title': 'Delete Prompt',
  'delete_prompt_message': 'Are you sure you want to delete this prompt? This action cannot be undone.',
  'import_prompts_title': 'Import Prompts',
  'import_prompts_message': 'Please paste prompt data (JSON format):',
  'reset_prompts_title': 'Reset Prompts',
  'reset_prompts_message': 'Are you sure you want to reset to default prompts? This will delete all custom prompts.',

  // Temperature help
  'temperature_help': 'Temperature controls AI creativity: 0.0-0.3 conservative, 0.4-0.7 balanced, 0.8-2.0 creative'
};

// Export language pack
if (typeof module !== 'undefined' && module.exports) {
  module.exports = en;
} else if (typeof window !== 'undefined') {
  window.en = en;
} 