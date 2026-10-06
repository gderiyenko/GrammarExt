# AI Grammar & Rephrase for Google Translate

A Chrome Extension (Manifest V3) that integrates AI capabilities directly into **[Google Translate](https://translate.google.com)**.

Enhance your writing before or during translation with one-click **Grammar Improvement** and smart **Rephrasing** powered by your choice of **Google Gemini**, **OpenAI**, or **DeepSeek**.

---

## ✨ Features

- 🎯 **Native Google Translate Integration**: Automatically detects the input `<textarea>` on `translate.google.com` and embeds a sleek AI toolbar.
- 🪄 **"Improve Grammar"**: Fixes typos, spelling, punctuation, and syntax errors while preserving your original language, vocabulary, and meaning.
- 🔄 **"Rephrase"**: Rewrites sentences for enhanced flow, clarity, and tone (Natural, Professional, Casual, Concise, Academic).
- ↩️ **Instant Undo & Comparison**: One-click undo and a side-by-side diff viewer to preview changes before keeping them.
- 🤖 **Multi-Provider AI Support & Custom Models**:
  - **Google Gemini** (e.g., `gemini-3.8-flash`, `gemini-2.5-pro`, or any custom Gemini model)
  - **OpenAI** (e.g., `gpt-4o-mini`, `gpt-4o`, `o1-mini`, `o3-mini`, or any custom model)
  - **DeepSeek** (e.g., `deepseek-chat`, `deepseek-reasoner`, or any custom model)
  - **Local Ollama** (e.g., `llama3.2`, `mistral`, `qwen2.5`, `deepseek-r1` running locally at `http://localhost:11434`)
- ✏️ **Freeform Model Name Entry**: Enter *any* custom model name for every provider with auto-suggest placeholder .
- 🔒 **Privacy & Direct API**: Keys and endpoints are stored locally; requests are made directly without middleman proxies.
- ⚡ **Built-in Connection Tester**: Test API keys or local Ollama connectivity directly from the extension popup.

---

## 🚀 Installation Guide

### 1. Load the Extension into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select this project folder (`googletranslate+grammar`).

### 2. Configure Your AI Provider & Model

1. Click the **AI Translator Assistant** icon in your Chrome extensions toolbar.
2. Choose your provider:
   - **Gemini**: Get a key at [Google AI Studio](https://aistudio.google.com/app/apikey)
   - **OpenAI**: Get a key at [OpenAI Platform](https://platform.openai.com/api-keys)
   - **DeepSeek**: Get a key at [DeepSeek Platform](https://platform.deepseek.com/api_keys)
   - **Local Ollama**: Make sure Ollama is running (`ollama serve`) at `http://localhost:11434` (no API key needed).
3. Type or choose any model name you want (e.g. `gemini-3.8-flash`, `gpt-4o-mini`, `deepseek-chat`, `llama3.2`).
4. Click **Test Connection** to verify.
5. Click **Save Settings**.

---

## 💡 How to Use

1. Go to **[https://translate.google.com](https://translate.google.com)**.
2. Type or paste your text into the source text box.
3. Use the floating AI toolbar:
   - Click **🪄 Improve grammar** to fix all errors instantly.
   - Click **🔄 Rephrase** (or open the dropdown to pick a tone like *Professional* or *Concise*).
4. If needed, click **Compare** in the notification banner to see what changed, or click **↩️ Undo** to revert.

---

## 📁 Project Structure

```
googletranslate+grammar/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── service-worker.js      # Background worker handling Gemini, OpenAI, & DeepSeek API requests
├── content/
│   ├── content.js             # Content script injecting toolbar & handling Google Translate DOM
│   └── content.css            # Styles for toolbar, tone dropdown, diff modal, and toasts
├── popup/
│   ├── popup.html             # Extension settings popup UI
│   ├── popup.js               # Settings controller & API key validator
│   └── popup.css              # Modern popup styling
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```
