// Service Worker for AI Grammar & Rephrase Chrome Extension

const DEFAULT_CONFIG = {
  provider: 'gemini', // 'gemini' | 'openai' | 'deepseek' | 'ollama'
  geminiKey: '',
  geminiModel: 'gemini-3.8-flash',
  openaiKey: '',
  openaiModel: 'gpt-4o-mini',
  deepseekKey: '',
  deepseekModel: 'deepseek-chat',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  disableThinking: true, // option to disable thinking (e.g. --think=false)
  rephraseTone: 'natural', // 'natural' | 'professional' | 'casual' | 'concise' | 'academic'
  autoApply: true
};

// Initialize default settings on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  const data = await chrome.storage.sync.get(null);
  const updated = { ...DEFAULT_CONFIG, ...data };
  if (updated.geminiModel === 'gemini-2.5-flash' || !updated.geminiModel) {
    updated.geminiModel = 'gemini-3.8-flash';
  }
  await chrome.storage.sync.set(updated);
  await setupOllamaRules();
});

// Setup dynamic rules to ensure Ollama headers are accepted
async function setupOllamaRules() {
  try {
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.updateDynamicRules) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [101, 102],
        addRules: [
          {
            id: 101,
            priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'origin', operation: 'set', value: 'http://localhost:11434' }
              ]
            },
            condition: {
              urlFilter: '*localhost:11434*',
              resourceTypes: ['xmlhttprequest', 'other', 'ping', 'csp_report']
            }
          },
          {
            id: 102,
            priority: 2,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [
                { header: 'origin', operation: 'set', value: 'http://127.0.0.1:11434' }
              ]
            },
            condition: {
              urlFilter: '*127.0.0.1:11434*',
              resourceTypes: ['xmlhttprequest', 'other', 'ping', 'csp_report']
            }
          }
        ]
      });
    }
  } catch (err) {
    console.warn('[AI Translate] Dynamic rule setup warning:', err);
  }
}

// Ensure rules are initialized when service worker wakes up
setupOllamaRules();

// Listener for content script and popup messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'process_text') {
        const result = await handleProcessText(message);
        sendResponse({ success: true, ...result });
      } else if (message.action === 'test_connection') {
        const result = await handleTestConnection(message);
        sendResponse(result);
      } else if (message.action === 'get_settings') {
        const settings = await getSettings();
        sendResponse({ success: true, settings });
      } else {
        sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message || 'An unexpected error occurred' });
    }
  })();
  return true; // Keep channel open for async response
});

async function getSettings() {
  const data = await chrome.storage.sync.get(null);
  const settings = { ...DEFAULT_CONFIG, ...data };
  if (settings.geminiModel === 'gemini-2.5-flash' || !settings.geminiModel) {
    settings.geminiModel = 'gemini-3.8-flash';
    await chrome.storage.sync.set({ geminiModel: 'gemini-3.8-flash' });
  }
  return settings;
}

async function handleProcessText({ task, text, tone }) {
  if (!text || !text.trim()) {
    throw new Error('Input text is empty.');
  }

  const settings = await getSettings();
  const provider = settings.provider || 'gemini';
  const selectedTone = tone || settings.rephraseTone || 'natural';

  const systemPrompts = {
    grammar: `You are an expert editor and linguist. Fix all grammatical mistakes, spelling typos, awkward punctuation, and syntax errors in the user's input text while strictly preserving the original meaning, intent, vocabulary level, and language.
Do NOT translate into another language.
Do NOT add any greetings, preamble, explanations, markdown formatting blocks, or surrounding quotes.
Answer in the same language as the input text!
Return ONLY the corrected raw text.`,

    rephrase: `You are an expert writing assistant. Rephrase and rewrite the user's input text to be fluent, engaging, and well-structured.
Tone/Style requested: ${selectedTone.toUpperCase()}.
Ensure the original meaning, facts, and intent are preserved.
Maintain the exact same language as the input text (do NOT translate).
Do NOT add any conversational filler, explanations, markdown formatting blocks, or surrounding quotes.
Answer in the same language as the input text!
Return ONLY the rephrased raw text.`
  };

  const systemPrompt = systemPrompts[task] || systemPrompts.grammar;

  let resultText = '';

  if (provider === 'gemini') {
    resultText = await callGemini(settings, systemPrompt, text, task);
  } else if (provider === 'openai') {
    resultText = await callOpenAI(settings, systemPrompt, text, task);
  } else if (provider === 'deepseek') {
    resultText = await callDeepSeek(settings, systemPrompt, text, task);
  } else if (provider === 'ollama') {
    resultText = await callOllama(settings, systemPrompt, text, task);
  } else {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  return {
    originalText: text,
    processedText: resultText.trim(),
    provider,
    task
  };
}

// Call Google Gemini API
async function callGemini(settings, systemPrompt, userText, task) {
  const apiKey = (settings.geminiKey || '').trim();
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please open the extension popup to add your key.');
  }

  let model = (settings.geminiModel || 'gemini-3.8-flash').trim();
  if (model === 'gemini-2.5-flash' || !model) {
    model = 'gemini-3.8-flash';
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const temperature = task === 'grammar' ? 0.1 : 0.7;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userText }]
      }
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: 2048,
      ...(settings.disableThinking !== false ? { thinkingConfig: { thinkingBudget: 0 } } : {})
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `Gemini API error (${response.status})`;
    throw new Error(msg);
  }

  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return cleanOutput(text);
}

// Call OpenAI API
async function callOpenAI(settings, systemPrompt, userText, task) {
  const apiKey = (settings.openaiKey || '').trim();
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please open the extension popup to add your key.');
  }

  const model = (settings.openaiModel || 'gpt-4o-mini').trim();
  const url = 'https://api.openai.com/v1/chat/completions';
  const temperature = task === 'grammar' ? 0.1 : 0.7;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      temperature: temperature
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `OpenAI API error (${response.status})`;
    throw new Error(msg);
  }

  const output = data.choices?.[0]?.message?.content;
  if (!output) {
    throw new Error('OpenAI returned an empty response.');
  }

  return cleanOutput(output);
}

// Call DeepSeek API
async function callDeepSeek(settings, systemPrompt, userText, task) {
  const apiKey = (settings.deepseekKey || '').trim();
  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Please open the extension popup to add your key.');
  }

  const model = (settings.deepseekModel || 'deepseek-chat').trim();
  const url = 'https://api.deepseek.com/chat/completions';
  const temperature = task === 'grammar' ? 0.1 : 0.7;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      temperature: temperature
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `DeepSeek API error (${response.status})`;
    throw new Error(msg);
  }

  const output = data.choices?.[0]?.message?.content;
  if (!output) {
    throw new Error('DeepSeek returned an empty response.');
  }

  return cleanOutput(output);
}

// Call Local Ollama API
async function callOllama(settings, systemPrompt, userText, task) {
  let baseUrl = (settings.ollamaUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
  const model = (settings.ollamaModel || 'llama3.2').trim();

  if (!model) {
    throw new Error('Ollama model name is required (e.g. llama3.2, mistral, qwen2.5).');
  }

  const url = `${baseUrl}/api/chat`;
  const temperature = task === 'grammar' ? 0.1 : 0.7;

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    stream: false,
    options: {
      temperature: temperature
    }
  };

  if (settings.disableThinking !== false) {
    payload.think = false;
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    throw new Error(`Failed to connect to Ollama at ${baseUrl}. Ensure Ollama is running ('ollama serve'). Error: ${netErr.message}`);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(`Ollama 403 Forbidden. Extension Origin was rejected by Ollama. Make sure to reload the extension in chrome://extensions/ so the new network rules take effect, or run 'launchctl setenv OLLAMA_ORIGINS "*"' in macOS terminal.`);
    }
    const msg = data?.error || `Ollama error (${response.status}): ${response.statusText}`;
    throw new Error(msg);
  }

  const output = data?.message?.content;
  if (!output) {
    throw new Error(`Ollama returned an empty response. Make sure model '${model}' is installed ('ollama run ${model}').`);
  }

  return cleanOutput(output);
}

// Test Connection validity
async function handleTestConnection({ provider, apiKey, model, url }) {
  const testPrompt = 'Say "OK"';
  const dummySettings = {
    [`${provider}Key`]: (apiKey || '').trim(),
    [`${provider}Model`]: (model || '').trim(),
    ollamaUrl: (url || 'http://localhost:11434').trim(),
    ollamaModel: (model || 'llama3.2').trim()
  };

  try {
    if (provider === 'gemini') {
      if (!apiKey || !apiKey.trim()) return { success: false, error: 'Gemini API key is required' };
      await callGemini(dummySettings, 'Answer concisely.', testPrompt, 'grammar');
      return { success: true, message: `✅ Gemini Connected! Model '${model || 'gemini-3.8-flash'}' ready.` };
    } else if (provider === 'openai') {
      if (!apiKey || !apiKey.trim()) return { success: false, error: 'OpenAI API key is required' };
      await callOpenAI(dummySettings, 'Answer concisely.', testPrompt, 'grammar');
      return { success: true, message: `✅ OpenAI Connected! Model '${model || 'gpt-4o-mini'}' ready.` };
    } else if (provider === 'deepseek') {
      if (!apiKey || !apiKey.trim()) return { success: false, error: 'DeepSeek API key is required' };
      await callDeepSeek(dummySettings, 'Answer concisely.', testPrompt, 'grammar');
      return { success: true, message: `✅ DeepSeek Connected! Model '${model || 'deepseek-chat'}' ready.` };
    } else if (provider === 'ollama') {
      const baseUrl = (url || 'http://localhost:11434').trim().replace(/\/+$/, '');
      const targetModel = (model || 'llama3.2').trim();

      let res;
      try {
        res = await fetch(`${baseUrl}/api/tags`);
      } catch (netErr) {
        throw new Error(`Cannot reach Ollama at ${baseUrl}. Ensure Ollama is running ('ollama serve' or Ollama app). Error: ${netErr.message}`);
      }

      if (!res.ok) {
        throw new Error(`Ollama server returned HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json().catch(() => ({}));
      const modelsList = (data.models || []).map(m => m.name);

      const exists = modelsList.some(m => m === targetModel || m.startsWith(targetModel + ':') || targetModel.startsWith(m + ':'));

      if (modelsList.length > 0 && !exists) {
        return {
          success: true,
          message: `✅ Ollama Connected! (Note: '${targetModel}' not in installed models: ${modelsList.slice(0, 3).join(', ')}. Run 'ollama run ${targetModel}' if needed)`
        };
      }

      return {
        success: true,
        message: `✅ Ollama Connected! Model '${targetModel}' is ready.`
      };
    } else {
      return { success: false, error: 'Unknown provider' };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Helper to remove any accidental markdown wrapping (like ```text or ```) and think tags
function cleanOutput(text) {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip <think>...</think> blocks if present from reasoning models
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip code fences if the model wrapped the response
  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\n?/, '').replace(/\n?```$/, '');
  }
  // Strip leading/trailing double quotes if model added them around entire response
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 1) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.trim();
}
