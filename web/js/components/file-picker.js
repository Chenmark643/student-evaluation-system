/**
 * File picker — triggers native OS dialogs via Eel bridge.
 *
 * Usage:
 *   <button onclick="pickFile('gpa-input', '选择成绩文件')">浏览</button>
 *   <input id="gpa-input" class="file-path" readonly placeholder="未选择文件...">
 */

async function pickFile(targetId, title, fileTypes) {
    const path = await eel.select_file(fileTypes || null, title || '选择文件')();
    if (path) {
        const el = document.getElementById(targetId);
        if (el) {
            el.value = path;
            el.classList.add('has-file');
        }
    }
}

async function pickDirectory(targetId, title) {
    const path = await eel.select_directory(title || '选择目录')();
    if (path) {
        const el = document.getElementById(targetId);
        if (el) {
            el.value = path;
            el.classList.add('has-file');
        }
    }
}

async function pickFiles(targetId, title, fileTypes) {
    const paths = await eel.select_files(fileTypes || null, title || '选择文件')();
    if (paths && paths.length > 0) {
        const el = document.getElementById(targetId);
        if (el) {
            el.value = paths.join('; ');
            el.classList.add('has-file');
        }
        return paths;
    }
    return [];
}

// Register Eel progress callback
eel.expose(updateProgress, 'updateProgress');
function updateProgress(percent, message) {
    // Global progress callback — used by all modules
    const event = new CustomEvent('progress-update', {
        detail: { percent, message }
    });
    window.dispatchEvent(event);
}

// Register Eel error callback
eel.expose(onModuleError, 'onModuleError');
function onModuleError(module, error) {
    showToast(`模块 ${module} 错误: ${error}`, 'error');
}
