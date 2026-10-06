// Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.provider-panel');
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');
  const statusIndicator = document.getElementById('status-indicator');

  // Input elements
  const geminiKey = document.getElementById('gemini-key');
  const geminiModel = document.getElementById('gemini-model');
  const openaiKey = document.getElementById('openai-key');
  const openaiModel = document.getElementById('openai-model');
  const deepseekKey = document.getElementById('deepseek-key');
  const deepseekModel = document.getElementById('deepseek-model');
  const ollamaUrl = document.getElementById('ollama-url');
  const ollamaModel = document.getElementById('ollama-model');
  const defaultTone = document.getElementById('default-tone');
  const disableThinking = document.getElementById('disable-thinking');

  let activeProvider = 'gemini';

  // Load existing settings
  const settings = await chrome.storage.sync.get({
    provider: 'gemini',
    geminiKey: '',
    geminiModel: 'gemini-3.8-flash',
    openaiKey: '',
    openaiModel: 'gpt-4o-mini',
    deepseekKey: '',
    deepseekModel: 'deepseek-chat',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    disableThinking: true,
    rephraseTone: 'natural'
  });

  // Populate UI
  activeProvider = settings.provider || 'gemini';
  setActiveTab(activeProvider);

  geminiKey.value = settings.geminiKey || '';
  geminiModel.value = (settings.geminiModel === 'gemini-2.5-flash' || !settings.geminiModel) ? 'gemini-3.8-flash' : settings.geminiModel;
  openaiKey.value = settings.openaiKey || '';
  openaiModel.value = settings.openaiModel || 'gpt-4o-mini';
  deepseekKey.value = settings.deepseekKey || '';
  deepseekModel.value = settings.deepseekModel || 'deepseek-chat';
  ollamaUrl.value = settings.ollamaUrl || 'http://localhost:11434';
  ollamaModel.value = settings.ollamaModel || 'llama3.2';
  defaultTone.value = settings.rephraseTone || 'natural';
  if (disableThinking) {
    disableThinking.checked = settings.disableThinking !== false;
    disableThinking.addEventListener('change', () => saveSettings(false));
  }

  updateStatusIndicator();

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      setActiveTab(provider);
      saveSettings(false); // Auto-save provider switch
    });
  });

  function setActiveTab(provider) {
    activeProvider = provider;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.provider === provider));
    panels.forEach(p => p.classList.toggle('active', p.id === `panel-${provider}`));
    updateStatusIndicator();
  }

  // Toggle key visibility
  document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🔒';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      }
    });
  });

  // Test Connection Buttons
  document.querySelectorAll('.test-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const provider = btn.dataset.provider;
      const resultDiv = document.getElementById(`test-result-${provider}`);
      const modelInput = document.getElementById(`${provider}-model`);
      const keyInput = document.getElementById(`${provider}-key`);
      const urlInput = document.getElementById(`${provider}-url`);

      const model = (modelInput ? modelInput.value : '').trim();
      const apiKey = keyInput ? keyInput.value.trim() : '';
      const url = urlInput ? urlInput.value.trim() : '';

      if (provider !== 'ollama' && !apiKey) {
        showTestResult(resultDiv, 'Please enter an API key first.', false);
        return;
      }

      if (!model) {
        showTestResult(resultDiv, 'Please enter a model name first.', false);
        return;
      }

      btn.classList.add('testing');
      const origText = btn.querySelector('.test-btn-text').textContent;
      btn.querySelector('.test-btn-text').textContent = 'Testing...';
      resultDiv.style.display = 'none';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'test_connection',
          provider: provider,
          apiKey: apiKey,
          model: model,
          url: url
        });

        if (response && response.success) {
          showTestResult(resultDiv, response.message || '✅ Connected successfully!', true);
          await saveSettings(false);
        } else {
          showTestResult(resultDiv, `❌ Error: ${response?.error || 'Validation failed'}`, false);
        }
      } catch (err) {
        showTestResult(resultDiv, `❌ Error: ${err.message}`, false);
      } finally {
        btn.classList.remove('testing');
        btn.querySelector('.test-btn-text').textContent = origText;
        updateStatusIndicator();
      }
    });
  });

  function showTestResult(el, msg, isSuccess) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.className = `test-result ${isSuccess ? 'success' : 'error'}`;
  }

  // Save Settings
  saveBtn.addEventListener('click', async () => {
    await saveSettings(true);
  });

  async function saveSettings(showVisualFeedback = true) {
    const payload = {
      provider: activeProvider,
      geminiKey: geminiKey.value.trim(),
      geminiModel: geminiModel.value.trim() || 'gemini-3.8-flash',
      openaiKey: openaiKey.value.trim(),
      openaiModel: openaiModel.value.trim() || 'gpt-4o-mini',
      deepseekKey: deepseekKey.value.trim(),
      deepseekModel: deepseekModel.value.trim() || 'deepseek-chat',
      ollamaUrl: (ollamaUrl.value.trim() || 'http://localhost:11434').replace(/\/+$/, ''),
      ollamaModel: ollamaModel.value.trim() || 'llama3.2',
      disableThinking: disableThinking ? disableThinking.checked : true,
      rephraseTone: defaultTone.value
    };

    await chrome.storage.sync.set(payload);
    updateStatusIndicator();

    if (showVisualFeedback) {
      saveStatus.textContent = 'Settings saved!';
      saveStatus.classList.add('show');
      setTimeout(() => {
        saveStatus.classList.remove('show');
      }, 2500);
    }
  }

  function updateStatusIndicator() {
    let isConfigured = false;
    if (activeProvider === 'gemini') isConfigured = !!geminiKey.value.trim();
    if (activeProvider === 'openai') isConfigured = !!openaiKey.value.trim();
    if (activeProvider === 'deepseek') isConfigured = !!deepseekKey.value.trim();
    if (activeProvider === 'ollama') isConfigured = !!ollamaModel.value.trim();

    const dot = statusIndicator.querySelector('.status-dot');
    const text = statusIndicator.querySelector('.status-text');

    if (isConfigured) {
      dot.className = 'status-dot active';
      text.textContent = `${capitalize(activeProvider)} Ready`;
    } else {
      dot.className = 'status-dot';
      text.textContent = 'Setup Needed';
    }
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
});
