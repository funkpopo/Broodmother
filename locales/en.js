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
  'info': 'Information'
};

// Export language pack
if (typeof module !== 'undefined' && module.exports) {
  module.exports = en;
} else if (typeof window !== 'undefined') {
  window.en = en;
} 