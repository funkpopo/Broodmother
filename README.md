Broodmother - AI Translation Extension

[中文](README_zh.md)

A Chrome browser extension that uses AI technology to translate selected text with a right-click.

Screenshot Example
<img src="https://img.picgo.net/2025/06/08/1b9d92f3d6e91bcd3.gif" alt="1" border="0">

### Core Features

Right-click context menu to translate selected text

Support for multiple API configurations (add multiple translation services)

Theme switching (Light/Dark/Auto)

Configuration import/export function

Default language setting

Sidebar Analysis: Provides page screenshot and selected area analysis, supporting intelligent recognition and text extraction.

### Installation Steps

Clone this repository

Open Chrome browser and go to chrome://extensions/

Enable "Developer mode"

Click "Load unpacked"

Select this repository's directory

### Configuration Instructions

Click the extension icon to open the configuration panel.

In "Configuration Management", add a new API configuration:

API URL: Your AI service API address (e.g., https://api.openai.com/v1/chat/completions or your self-hosted LLM service address)

API Key: Your AI service API key

Model Name: The name of the AI model you are using (e.g., gpt-4o or glm-4)

#### Example:

Name: OpenAI API

API URL: https://api.openai.com/v1/chat/completions

API Key: sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Model Name: gpt-4o

Set the default target language (e.g., Chinese, English, Japanese).

In "Settings", choose a theme (Light/Dark/Follow browser).

How to Use Right-Click Translation

Select text on a webpage.

Right-click and select "Translate selected text with AI".

The translation result will be displayed in a floating window in the upper right corner.

### How to Use the Sidebar

The Broodmother extension provides a powerful sidebar analysis feature to help you gain a deeper understanding and analysis of the current page's content.

#### Enable the Sidebar:

Right-click the Broodmother extension icon in the browser's toolbar.

In the pop-up menu, select the option that allows the extension to show the sidebar.

Then, in the browser toolbar, click the sidebar button (usually an icon resembling a note or sidebar). If it doesn't appear immediately, you may need to reload the extension or the current page.

#### Sidebar Interface:

After opening the sidebar, you will see a real-time thumbnail of the current page.

Above the thumbnail is the "Page Preview" area. You can adjust the preview size by dragging with the mouse or using the zoom control buttons.

Below the preview, there are two core buttons: "Analyze Selected Area" and "Analyze Entire Page".

#### Analyze Page Content:

Analyze Selected Area:

Click the "Analyze Selected Area" button.

A draggable selection box will appear on the page thumbnail. Drag the box to select the specific area of the page you want the AI to analyze.

After confirming the selected area, click the "Analyze Selected Area" button again. The extension will capture the text from that area and send it to the AI for analysis.

Analyze Entire Page:

Simply click the "Analyze Entire Page" button, and the extension will capture all visible text content from the current page and send it to the AI for analysis.

View Analysis Results:

The AI's analysis results will be displayed in real-time as a streaming output in the "Analysis Results" area at the bottom of the sidebar.

You can scroll to view the full results or click the "Cancel Analysis" button to stop an ongoing analysis.

### Frequently Asked Questions (FAQ)

#### Why is there no response when translating or analyzing?

Ensure you have correctly set the API URL, API Key, and Model Name in the extension's "Configuration Management".

Check that your API key is valid and your AI service account has a sufficient balance.

Make sure your internet connection is working properly.

Sometimes you may need to reload the extension (disable and re-enable it on the chrome://extensions/ page) or refresh the current webpage.

#### Can I use my own local AI model?

Yes, as long as your local model provides an OpenAI-compatible API service and you can provide the corresponding API URL and API Key (if required).

#### How do I import/export configurations?

In the extension's configuration panel, click the "Settings" tab, where you will find "Import Configuration" and "Export Configuration" buttons. Exporting will generate a JSON file, and importing allows you to read the configuration from that file.

#### The sidebar doesn't show up or won't open?

Make sure you have followed the steps in "How to Use the Sidebar" to enable it.

Certain types of pages (such as Chrome's internal pages starting with chrome://) may not support the sidebar.

License

Apache License 2.0
