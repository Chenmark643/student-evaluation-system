"""
DeepSeek AI Assistant — smart file analysis and data processing help.

Uses DeepSeek API (OpenAI-compatible) for:
- Auto-detecting column mappings in irregular Excel files
- Smart student name matching suggestions
- Formula verification and debugging
- Natural language querying of data
"""

import json
import os
import urllib.request
import urllib.error

DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

# Store API key in a local config file
_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                         'data', '.deepseek_key')


def set_api_key(key: str):
    """Save DeepSeek API key."""
    os.makedirs(os.path.dirname(_KEY_FILE), exist_ok=True)
    with open(_KEY_FILE, 'w') as f:
        f.write(key.strip())


def get_api_key() -> str:
    """Get saved DeepSeek API key. Falls back to built-in default."""
    try:
        with open(_KEY_FILE, 'r') as f:
            key = f.read().strip()
            if key:
                return key
    except FileNotFoundError:
        pass
    # Built-in default key
    return 'sk-63e05727f830424eac564dcdc767cb2c'


def has_api_key() -> bool:
    return bool(get_api_key())


def chat(prompt: str, system: str = None, model: str = 'deepseek-chat') -> str:
    """Send a chat request to DeepSeek.

    Args:
        prompt: User message
        system: Optional system prompt
        model: Model name (deepseek-chat or deepseek-reasoner)

    Returns:
        AI response text
    """
    api_key = get_api_key()
    if not api_key:
        return '错误：未设置 DeepSeek API Key，请在设置中配置。'

    if system is None:
        system = (
            '你是一个学生综合测评系统的AI助手。你帮助用户分析Excel成绩数据、'
            '识别列映射关系、检查公式正确性、以及解答数据处理问题。'
            '请用中文回答，回答要简洁、准确、专业。'
        )

    body = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.3,
        'max_tokens': 2000,
    }

    req = urllib.request.Request(
        DEEPSEEK_API_URL,
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {api_key}',
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            err_json = json.loads(err_body)
            msg = err_json.get('error', {}).get('message', str(e))
        except json.JSONDecodeError:
            msg = str(e)
        return f'API 错误 ({e.code}): {msg}'
    except Exception as e:
        return f'请求失败: {str(e)}'


def analyze_file_structure(headers: list, sample_rows: list) -> str:
    """Ask AI to analyze an Excel file's column structure.

    Args:
        headers: Column header names
        sample_rows: First few data rows (as list of dicts)

    Returns:
        AI analysis of the file structure
    """
    headers_text = '\n'.join(f'{i}: {h}' for i, h in enumerate(headers))
    samples_text = json.dumps(sample_rows[:3], ensure_ascii=False, indent=2)

    prompt = f"""请分析以下Excel文件的列结构：

列名:
{headers_text}

前3行数据样例:
{samples_text}

请判断：
1. 哪些列是学生信息列（学号、姓名、班级等）
2. 哪些列是课程列（包含成绩/分数的列）
3. 哪些列是计算/汇总列（如平均分、总分、排名等）
4. 每门课程的学分是多少（从列名中提取）
5. 是否存在体育课列
6. 建议的数据处理方式

请用JSON格式回答，便于程序解析。"""

    response = chat(prompt, system=(
        '你是一个Excel数据分析专家。请严格用JSON格式回答，'
        '不要添加额外说明。JSON应包含info_cols、course_cols、computed_cols、'
        'course_details、pe_cols、suggestions等字段。'
    ))
    return response


def suggest_student_matching(unmatched_names: list, candidate_names: list) -> str:
    """Ask AI to suggest fuzzy name matches.

    Args:
        unmatched_names: Names that couldn't be matched
        candidate_names: All possible candidate names

    Returns:
        AI matching suggestions
    """
    prompt = f"""以下是无法自动匹配的学生姓名:
{json.dumps(unmatched_names, ensure_ascii=False)}

候选学生姓名列表:
{json.dumps(candidate_names, ensure_ascii=False)}

请为每个未匹配的姓名找到最可能的匹配（考虑形近字、简繁体、可能的手误），
用JSON格式返回匹配建议。"""

    return chat(prompt)


def verify_formula_logic(formula_desc: str, expected_rules: str) -> str:
    """Ask AI to verify formula logic against expected rules.

    Args:
        formula_desc: Description of the formula being used
        expected_rules: Expected calculation rules

    Returns:
        AI verification result
    """
    prompt = f"""当前使用的计算公式:
{formula_desc}

期望的计算规则:
{expected_rules}

请验证公式是否与规则一致。如有问题请指出具体差异。"""

    return chat(prompt)
