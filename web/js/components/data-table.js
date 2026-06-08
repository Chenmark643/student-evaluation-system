/**
 * Data table component — renders an array of objects as an HTML table.
 *
 * Usage:
 *   renderTable('table-container', columns, data, maxRows)
 */

function renderTable(containerId, columns, data, maxRows = 100) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>暂无数据</p>
            </div>`;
        return;
    }

    const displayData = data.slice(0, maxRows);
    const cols = columns || Object.keys(displayData[0]);

    let html = '<table class="data-table"><thead><tr>';
    for (const col of cols) {
        const label = typeof col === 'object' ? col.label : col;
        html += `<th>${escapeHtml(label)}</th>`;
    }
    html += '</tr></thead><tbody>';

    for (const row of displayData) {
        html += '<tr>';
        for (const col of cols) {
            const key = typeof col === 'object' ? col.key : col;
            const value = row[key] !== undefined ? row[key] : '';
            const isNum = typeof value === 'number';
            const isFormula = typeof value === 'string' && value.startsWith('=');
            const cls = isFormula ? 'cell-formula' : (isNum ? 'cell-num' : '');
            const display = isNum ? value.toFixed(2) : String(value);
            html += `<td class="${cls}">${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';

    if (data.length > maxRows) {
        html += `<p style="text-align:center;color:var(--text-muted);padding:8px;">
            显示前 ${maxRows} 行，共 ${data.length} 行
        </p>`;
    }

    container.innerHTML = html;
}
