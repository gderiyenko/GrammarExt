// Content Script for Google Translate AI Grammar & Rephraser

(function () {
  'use strict';

  let currentTextarea = null;
  let lastOriginalText = '';
  let lastProcessedText = '';
  let toolbarElement = null;
  let isProcessing = false;
  let activeTone = 'natural';

  // Detect whether the page is currently in Dark or Light mode
  function isPageDarkTheme() {
    try {
      const parseRgb = (colorStr) => {
        if (!colorStr || colorStr === 'transparent' || colorStr === 'rgba(0, 0, 0, 0)') return null;
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return null;
        return { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
      };

      // 1. Check computed background color of document.body or document.documentElement
      const bodyBg = window.getComputedStyle(document.body).backgroundColor;
      const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
      const targetRgb = parseRgb(bodyBg) || parseRgb(htmlBg);

      if (targetRgb) {
        // Standard perceived luminance formula
        const luminance = (targetRgb.r * 299 + targetRgb.g * 587 + targetRgb.b * 114) / 1000;
        return luminance < 130;
      }

      // 2. Check for dark mode classes/attributes on root elements
      if (document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark') ||
          document.documentElement.getAttribute('data-theme') === 'dark' ||
          document.body.getAttribute('data-theme') === 'dark') {
        return true;
      }

      // 3. Fallback to system preference
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_) {
      return false;
    }
  }

  function updateTheme() {
    const isDark = isPageDarkTheme();
    if (toolbarElement) {
      toolbarElement.classList.toggle('gt-ai-dark', isDark);
    }
    const modal = document.getElementById('gt-ai-diff-modal');
    if (modal) {
      modal.classList.toggle('gt-ai-dark', isDark);
    }
  }

  // Observe DOM changes to ensure toolbar is attached and theme is synced
  function initObserver() {
    attachToolbarIfReady();
    updateTheme();

    const observer = new MutationObserver(() => {
      attachToolbarIfReady();
      updateTheme();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme']
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme']
    });

    // Listen to system color scheme changes as fallback
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateTheme);
    }
  }

  function findSourceTextarea() {
    // Selectors commonly used by Google Translate for the source text box
    const selectors = [
      'textarea[aria-label="Source text"]',
      'textarea.er8xn',
      'c-wiz textarea',
      'div[jsname="g9kOnd"] textarea',
      'textarea'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  }

  function attachToolbarIfReady() {
    const textarea = findSourceTextarea();
    if (!textarea) return;

    if (currentTextarea === textarea && toolbarElement && document.body.contains(toolbarElement)) {
      return; // Already attached
    }

    currentTextarea = textarea;

    // Find a good parent container to mount our toolbar
    // Google translate wraps textarea inside .ITyLte or parent div
    const container = textarea.closest('.ITyLte') ||
                      textarea.closest('.a9Qide') ||
                      textarea.closest('.W50UYd') ||
                      textarea.parentElement;

    if (!container) return;

    // Remove existing toolbar if any orphaned
    const existing = document.getElementById('gt-ai-toolbar');
    if (existing) existing.remove();

    createToolbar(container, textarea);
  }

  function createToolbar(container, textarea) {
    toolbarElement = document.createElement('div');
    toolbarElement.id = 'gt-ai-toolbar';
    toolbarElement.className = 'gt-ai-toolbar';

    toolbarElement.innerHTML = `
      <div class="gt-ai-toolbar-inner">
        <div class="gt-ai-brand">
          <span class="gt-ai-logo-icon">✨</span>
          <span class="gt-ai-title">AI Assist</span>
        </div>

        <div class="gt-ai-btn-group">
          <button type="button" class="gt-ai-btn gt-ai-btn-grammar" id="gt-ai-btn-grammar" title="Correct grammar, typos, and syntax">
            <span class="gt-ai-btn-icon">🪄</span>
            <span class="gt-ai-btn-text">Improve grammar</span>
          </button>

          <div class="gt-ai-dropdown-wrapper">
            <button type="button" class="gt-ai-btn gt-ai-btn-rephrase" id="gt-ai-btn-rephrase" title="Rephrase for clarity and flow">
              <span class="gt-ai-btn-icon">🔄</span>
              <span class="gt-ai-btn-text">Rephrase</span>
              <span class="gt-ai-dropdown-arrow">▾</span>
            </button>
            <div class="gt-ai-tone-menu" id="gt-ai-tone-menu">
              <div class="gt-ai-tone-header">Tone & Style</div>
              <button type="button" class="gt-ai-tone-item active" data-tone="natural">🌿 Natural / Fluent</button>
              <button type="button" class="gt-ai-tone-item" data-tone="professional">💼 Professional</button>
              <button type="button" class="gt-ai-tone-item" data-tone="casual">💬 Casual / Friendly</button>
              <button type="button" class="gt-ai-tone-item" data-tone="concise">⚡ Concise / Direct</button>
              <button type="button" class="gt-ai-tone-item" data-tone="academic">🎓 Academic / Formal</button>
            </div>
          </div>

          <button type="button" class="gt-ai-btn gt-ai-btn-undo" id="gt-ai-btn-undo" style="display:none;" title="Restore previous text">
            <span class="gt-ai-btn-icon">↩️</span>
            <span class="gt-ai-btn-text">Undo</span>
          </button>
        </div>

        <div class="gt-ai-provider-badge" id="gt-ai-provider-badge" title="Active AI provider. Click to change.">
          <span class="gt-ai-provider-dot"></span>
          <span class="gt-ai-provider-name">AI</span>
        </div>
      </div>
    `;

    // Append to body for clean fixed positioning
    document.body.appendChild(toolbarElement);
    bindEvents(toolbarElement, textarea);
    updateProviderBadge();
  }

  function bindEvents(toolbar, textarea) {
    const grammarBtn = toolbar.querySelector('#gt-ai-btn-grammar');
    const rephraseBtn = toolbar.querySelector('#gt-ai-btn-rephrase');
    const undoBtn = toolbar.querySelector('#gt-ai-btn-undo');
    const providerBadge = toolbar.querySelector('#gt-ai-provider-badge');
    const toneMenu = toolbar.querySelector('#gt-ai-tone-menu');
    const toneItems = toolbar.querySelectorAll('.gt-ai-tone-item');

    // Grammar action
    grammarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeAiTask('grammar', textarea, grammarBtn);
    });

    // Rephrase action
    rephraseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // If clicking right side (arrow area), toggle dropdown
      const rect = rephraseBtn.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX > rect.width - 28) {
        toneMenu.classList.toggle('open');
      } else {
        toneMenu.classList.remove('open');
        executeAiTask('rephrase', textarea, rephraseBtn);
      }
    });

    // Tone selections
    toneItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toneItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        activeTone = item.dataset.tone;
        toneMenu.classList.remove('open');
        executeAiTask('rephrase', textarea, rephraseBtn);
      });
    });

    // Close tone menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.gt-ai-dropdown-wrapper')) {
        toneMenu?.classList.remove('open');
      }
    });

    // Undo action
    undoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (lastOriginalText !== '') {
        setTextareaValue(textarea, lastOriginalText);
        showToast('Restored original text.', 'info');
        undoBtn.style.display = 'none';
      }
    });

    // Provider badge click opens extension popup prompt info
    providerBadge.addEventListener('click', () => {
      showToast('Click the extension icon in your Chrome toolbar to configure API keys.', 'info', 4000);
    });
  }

  async function executeAiTask(task, textarea, triggerBtn) {
    if (isProcessing) return;

    const text = textarea.value;
    if (!text || !text.trim()) {
      showToast('Please type or paste some text first.', 'warning');
      textarea.focus();
      return;
    }

    setLoadingState(triggerBtn, true, task === 'grammar' ? 'Checking...' : 'Rephrasing...');
    isProcessing = true;

    try {
      if (!chrome.runtime?.id) {
        throw new Error('Extension was updated. Please reload this tab (⌘R / F5) to reconnect.');
      }

      const response = await chrome.runtime.sendMessage({
        action: 'process_text',
        task: task,
        text: text,
        tone: activeTone
      });

      if (!response) {
        throw new Error('No response from AI background worker.');
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to process text.');
      }

      const newText = response.processedText;

      if (!newText || newText === text) {
        showToast('No changes needed — text is already optimal! ✨', 'success');
      } else {
        lastOriginalText = text;
        lastProcessedText = newText;

        // Apply updated text to Google Translate textarea
        setTextareaValue(textarea, newText);

        // Show undo button
        const undoBtn = document.getElementById('gt-ai-btn-undo');
        if (undoBtn) undoBtn.style.display = 'inline-flex';

        showToast(
          task === 'grammar' ? '✨ Grammar improved!' : `🔄 Rephrased (${activeTone})!`,
          'success',
          3500,
          true
        );
      }
    } catch (err) {
      console.error('[AI Translate Extension]', err);
      let errMsg = err.message || 'Failed to process text.';
      if (errMsg.includes('Extension context invalidated')) {
        errMsg = 'Extension was reloaded. Please refresh this page (⌘R / F5) to reconnect.';
      }
      showToast(errMsg, 'error', 6000);
    } finally {
      setLoadingState(triggerBtn, false);
      isProcessing = false;
      updateProviderBadge();
    }
  }

  // Set textarea value and trigger Google Translate internal listeners
  function setTextareaValue(textarea, value) {
    textarea.focus();
    textarea.value = value;

    // Dispatch events so Google Translate reactive framework updates translation
    textarea.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    // Try execCommand as fallback for rich frameworks if needed
    try {
      textarea.setSelectionRange(value.length, value.length);
    } catch (_) {}
  }

  function setLoadingState(button, isLoading, text = '') {
    if (!button) return;
    const textEl = button.querySelector('.gt-ai-btn-text');
    const iconEl = button.querySelector('.gt-ai-btn-icon');

    if (isLoading) {
      button.classList.add('loading');
      if (textEl) {
        button.dataset.origText = textEl.textContent;
        textEl.textContent = text;
      }
      if (iconEl) {
        iconEl.innerHTML = '<span class="gt-ai-spinner"></span>';
      }
    } else {
      button.classList.remove('loading');
      if (textEl && button.dataset.origText) {
        textEl.textContent = button.dataset.origText;
      }
      if (iconEl) {
        iconEl.textContent = button.id.includes('grammar') ? '🪄' : '🔄';
      }
    }
  }

  async function updateProviderBadge() {
    const badge = document.getElementById('gt-ai-provider-badge');
    if (!badge) return;

    try {
      if (!chrome.runtime?.id) return;
      const response = await chrome.runtime.sendMessage({ action: 'get_settings' });
      if (response && response.success && response.settings) {
        const s = response.settings;
        const p = s.provider || 'gemini';
        const hasKey = (p === 'gemini' && !!s.geminiKey) ||
                        (p === 'openai' && !!s.openaiKey) ||
                        (p === 'deepseek' && !!s.deepseekKey) ||
                        (p === 'ollama' && !!s.ollamaModel);

        const nameMap = { gemini: 'Gemini', openai: 'OpenAI', deepseek: 'DeepSeek', ollama: 'Ollama' };
        const activeModel = s[`${p}Model`] || '';
        const nameEl = badge.querySelector('.gt-ai-provider-name');
        const dotEl = badge.querySelector('.gt-ai-provider-dot');

        if (nameEl) nameEl.textContent = nameMap[p] || p;
        if (dotEl) {
          dotEl.className = 'gt-ai-provider-dot ' + (hasKey ? 'active' : 'warning');
        }
        badge.title = hasKey
          ? `Provider: ${nameMap[p]} (${activeModel})`
          : `Provider: ${nameMap[p]} (Setup needed - click to configure)`;
      }
    } catch (_) {}
  }

  // Toast Notification System
  function showToast(message, type = 'info', duration = 3000, showDiffBtn = false) {
    let toastContainer = document.getElementById('gt-ai-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'gt-ai-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `gt-ai-toast gt-ai-toast-${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    let html = `
      <span class="gt-ai-toast-icon">${icon}</span>
      <span class="gt-ai-toast-msg">${escapeHtml(message)}</span>
    `;

    if (showDiffBtn && lastOriginalText && lastProcessedText) {
      html += `<button type="button" class="gt-ai-toast-action" id="gt-ai-diff-btn">Compare</button>`;
    }

    toast.innerHTML = html;
    toastContainer.appendChild(toast);

    if (showDiffBtn) {
      const diffBtn = toast.querySelector('#gt-ai-diff-btn');
      if (diffBtn) {
        diffBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showDiffModal(lastOriginalText, lastProcessedText);
        });
      }
    }

    // Auto remove
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function showDiffModal(original, updated) {
    let modal = document.getElementById('gt-ai-diff-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'gt-ai-diff-modal';
    modal.className = 'gt-ai-modal-backdrop';

    modal.innerHTML = `
      <div class="gt-ai-modal-dialog">
        <div class="gt-ai-modal-header">
          <h3>AI Improvement Comparison</h3>
          <button type="button" class="gt-ai-modal-close" id="gt-ai-modal-close">×</button>
        </div>
        <div class="gt-ai-modal-body">
          <div class="gt-ai-diff-column">
            <h4>Original Text</h4>
            <div class="gt-ai-diff-box original">${escapeHtml(original)}</div>
          </div>
          <div class="gt-ai-diff-column">
            <h4>Improved / Rephrased</h4>
            <div class="gt-ai-diff-box updated">${escapeHtml(updated)}</div>
          </div>
        </div>
        <div class="gt-ai-modal-footer">
          <button type="button" class="gt-ai-btn gt-ai-btn-copy" id="gt-ai-diff-copy">Copy Result</button>
          <button type="button" class="gt-ai-btn gt-ai-btn-primary" id="gt-ai-diff-done">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#gt-ai-modal-close').addEventListener('click', closeModal);
    modal.querySelector('#gt-ai-diff-done').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#gt-ai-diff-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(updated);
        showToast('Copied to clipboard!', 'success');
      } catch (_) {
        showToast('Failed to copy text', 'error');
      }
    });
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }
})();
