/**
 * AI Assistant Panel — DeepSeek-powered chat for complex data tasks.
 *
 * Toggle with the AI button in the header or Ctrl+Space.
 */

let aiOpen = false;
let aiMessages = [];
let aiBusy = false;

function initAIPanel() {
    // Add AI toggle button to header (only once)
    const header = document.getElementById('header');
    if (!header) return;

    // Check if button already exists — avoid duplication on module re-entry
    if (!document.getElementById('ai-toggle-btn')) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-teal';
        btn.onclick = toggleAIPanel;
        btn.id = 'ai-toggle-btn';
        btn.title = 'AI 助手 (Ctrl+Space)';
        btn.textContent = 'AI 助手';

        const versionTag = document.getElementById('app-version');
        if (versionTag) {
            versionTag.parentNode.insertBefore(btn, versionTag);
        } else {
            header.appendChild(btn);
        }
    }

    // Create AI panel (only once)
    if (document.getElementById('ai-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.className = 'ai-panel hidden';
    panel.innerHTML = `
        <div class="ai-panel-header">
            <span>AI 助手</span>
            <div style="display:flex;gap:4px;">
                <button class="btn btn-ghost btn-sm" onclick="aiClearChat()" title="清空对话">清空</button>
                <button class="btn btn-ghost btn-sm" onclick="toggleAIPanel()" title="关闭">&times;</button>
            </div>
        </div>
        <div class="ai-panel-body" id="ai-chat-messages">
            <div class="ai-msg ai-msg-system">
                你好！我是 DeepSeek AI 助手。我可以帮你：<br>
                • 分析 Excel 文件的列结构<br>
                • 智能匹配学生姓名<br>
                • 检查公式逻辑<br>
                • 解答数据处理问题<br>
                <br>
                <em>请先在设置中配置 API Key。</em>
            </div>
        </div>
        <div class="ai-panel-input">
            <textarea id="ai-input" rows="1" placeholder="输入问题，或拖入Excel文件进行分析..."
                      onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();aiSendMessage();}"></textarea>
            <button class="btn btn-primary btn-sm" onclick="aiSendMessage()" id="ai-send-btn">发送</button>
        </div>
        <div class="ai-panel-actions">
            <button class="btn btn-ghost btn-sm" onclick="aiAnalyzeCurrentFile()">分析当前文件</button>
            <button class="btn btn-ghost btn-sm" onclick="aiSettings()">API 设置</button>
        </div>
    `;
    document.body.appendChild(panel);

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === ' ') {
            e.preventDefault();
            toggleAIPanel();
        }
    });
}

function toggleAIPanel() {
    aiOpen = !aiOpen;
    const panel = document.getElementById('ai-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !aiOpen);
    if (aiOpen) {
        document.getElementById('ai-input')?.focus();
    }
}

async function aiSendMessage() {
    const input = document.getElementById('ai-input');
    const btn = document.getElementById('ai-send-btn');
    if (!input || aiBusy) return;

    const text = input.value.trim();
    if (!text) return;

    // Check API key
    const hasKey = await eel.ai_has_key()();
    if (!hasKey) {
        aiAddMessage('system', '请先配置 DeepSeek API Key。<br>点击下方「API 设置」按钮，输入你的 API Key。');
        return;
    }

    aiAddMessage('user', text);
    input.value = '';
    aiBusy = true;
    btn.disabled = true;
    btn.textContent = '...';

    // Add loading placeholder
    const loadId = aiAddMessage('ai', '<span class="ai-loading">思考中...</span>');

    try {
        const response = await eel.ai_chat(text)();
        // Replace loading message
        aiUpdateMessage(loadId, response);
    } catch (e) {
        aiUpdateMessage(loadId, '错误: ' + e);
    } finally {
        aiBusy = false;
        btn.disabled = false;
        btn.textContent = '发送';
    }
}

function aiAddMessage(role, content) {
    aiMessages.push({ role, content });
    const container = document.getElementById('ai-chat-messages');
    if (!container) return aiMessages.length - 1;

    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role}`;
    div.innerHTML = content.replace(/\n/g, '<br>');
    div.id = `ai-msg-${aiMessages.length - 1}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    return aiMessages.length - 1;
}

function aiUpdateMessage(id, content) {
    const div = document.getElementById(`ai-msg-${id}`);
    if (div) {
        div.innerHTML = content.replace(/\n/g, '<br>');
        const container = document.getElementById('ai-chat-messages');
        if (container) container.scrollTop = container.scrollHeight;
    }
}

function aiClearChat() {
    aiMessages = [];
    const container = document.getElementById('ai-chat-messages');
    if (container) {
        container.innerHTML = `
            <div class="ai-msg ai-msg-system">对话已清空。有什么可以帮你的？</div>`;
    }
}

async function aiAnalyzeCurrentFile() {
    const hasKey = await eel.ai_has_key()();
    if (!hasKey) {
        aiAddMessage('system', '请先配置 API Key。');
        return;
    }

    // Try to find the currently loaded file path
    const fileInputs = document.querySelectorAll('.file-path');
    let filePath = '';
    for (const el of fileInputs) {
        if (el.value && (el.value.includes('.xls') || el.value.includes('.xlsx'))) {
            filePath = el.value;
            break;
        }
    }

    if (!filePath) {
        aiAddMessage('system', '请先在模块中选择一个 Excel 文件，然后再点击分析。');
        return;
    }

    aiAddMessage('user', `请分析这个文件的结构: ${filePath.split(/[\\/]/).pop()}`);
    aiBusy = true;
    const loadId = aiAddMessage('ai', '<span class="ai-loading">正在分析文件结构...</span>');

    try {
        const result = await eel.ai_analyze_file(filePath)();
        aiUpdateMessage(loadId, result);
    } catch (e) {
        aiUpdateMessage(loadId, '分析失败: ' + e);
    } finally {
        aiBusy = false;
    }
}

function aiSettings() {
    const keyPrompt = prompt(
        '请输入 DeepSeek API Key:\n\n' +
        '获取方式: 访问 https://platform.deepseek.com 注册并获取 API Key\n\n' +
        'Key 将保存在本地，不会上传。',
        ''
    );
    if (keyPrompt !== null) {
        const key = keyPrompt.trim();
        if (key) {
            eel.ai_set_key(key)((ok) => {
                if (ok) {
                    aiAddMessage('system', 'API Key 已保存。现在可以使用 AI 功能了！');
                    showToast('API Key 已保存', 'success');
                } else {
                    showToast('保存失败', 'error');
                }
            });
        }
    }
}

/**
 * Open AI panel from a module with context.
 * Called by modules: aiPanelOpen(contextText)
 */
function aiPanelOpen(context) {
    if (!aiOpen) {
        toggleAIPanel();
    }
    if (context) {
        // Add context as a system message
        setTimeout(() => {
            const input = document.getElementById('ai-input');
            if (input) {
                input.value = context;
                input.focus();
            }
        }, 300);
    }
}
