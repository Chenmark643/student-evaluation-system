"""
Global constants and configuration for the Student Evaluation System.
"""

import os
import sys

# Base directory resolution (works both dev and PyInstaller bundled)
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
    DATA_DIR = os.path.join(
        os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
        '顿河学院学生测评管理软件',
        'data',
    )
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = os.path.join(BASE_DIR, 'data')
WEB_DIR = os.path.join(BASE_DIR, 'web')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Activity memory file for Module C
ACTIVITY_MAPPINGS_FILE = os.path.join(DATA_DIR, 'activity_mappings.json')

# Default window size
WINDOW_WIDTH = 1400
WINDOW_HEIGHT = 900

# App metadata
APP_NAME = "顿河学院学生测评管理软件"
APP_VERSION = "7.0.0"

# Module A constants
PE_KEYWORDS = ['体育', '運動', 'PE']
SCORE_MAPPING = {
    '优': 95, '优秀': 95,
    '良': 85, '良好': 85,
    '中': 75, '中等': 75,
    '及格': 65, '合格': 65, '通过': 65,
    '不合格': 45, '不及格': 45,
}

# Module B constants
MORAL_BASE_SCORE = 80.0
ABSENCE_MULTIPLIER = -2.0  # Each absence hour = -2 points

# Module C constants — aligned with 素拓加分细则
# Module C constants — 简化版：6大类 + 3个上限
#
# 说明：
#   文体艺术类  = 文艺活动 + 体育活动 + 荣誉称号
#   学术竞赛类  = A/B/C/D类学科竞赛
#   学术成果类  = 论文 + 专利 + 软著 + 文章
#   学生工作类  = 班委/学生会/社团等任职（只取最高）
#   社会实践类  = 志愿服务 + 社会实践（上限3分）
#   技能证书类  = 四六级/计算机等国家级证书（上限3分）
#
QUALITY_CATEGORIES = [
    '文体艺术类',
    '学术竞赛类',
    '学术成果类',
    '学生工作类',
    '社会实践类',
    '技能证书类',
    '班主任助理类',
    '社会实践荣誉类',
    '比赛志愿服务类',
    '学院活动参与类',
    '寒暑假实践类',
    '其他加分',
]
QUALITY_GRADES = {
    '文体艺术类': [
        '国家级', '省级', '市级', '校级', '院级',
    ],
    '学术竞赛类': [
        '国家级', '省部级', '校级', '院级',
    ],
    '学术成果类': [
        '顶尖/顶级期刊', 'A类', 'B类', 'C类', 'D类', 'E类', '其他期刊',
        '发明专利', '实用新型专利', '外观设计专利', '软件著作权',
        '国家级文章', '省级文章', '校级文章', '系级文章',
    ],
    '学生工作类': [
        '优秀', '良好', '合格',
    ],
    '社会实践类': [
        '国家级荣誉', '省部级荣誉', '校级荣誉',
        '考核优秀', '考核良好',
        '志愿工作', '活动参与', '寒暑假实践',
    ],
    '技能证书类': [
        '国家级证书', '其他证书',
    ],
    '班主任助理类': ['优秀', '良好', '合格'],
    '社会实践荣誉类': ['国家级', '省部级', '校级', '考核优秀', '考核良好', '合格及以下'],
    '比赛志愿服务类': ['每次'],
    '学院活动参与类': ['每次'],
    '寒暑假实践类': ['有证明/报道/奖励'],
    # ---- 兼容旧版（已保存数据不丢失） ----
    'A类': ['国家级', '省级', '市级', '校级', '院级'],
    'B类': ['国家级', '省级', '市级', '校级', '院级'],
    'C类': ['国家级', '省级', '市级', '校级', '院级'],
    'D类': ['国家级', '省级', '市级', '校级', '院级'],
    '文艺活动类': ['国家级', '省级', '市级', '校级', '院级'],
    '体育类': ['国家级', '省级', '市级', '校级', '院级'],
    '学术类': ['国家级', '省级', '市级', '校级', '院级'],
    '志愿类': ['时长'],
    '组织测评': ['优秀', '良好', '合格'],
    'A类竞赛': ['国家级', '省部级', '校级', '院级'],
    'B类竞赛': ['国家级', '省部级', '校级', '院级'],
    'C类竞赛': ['国家级', '省部级', '校级', '院级'],
    'D类竞赛': ['国家级', '省部级', '校级', '院级'],
    '学术论文': ['顶尖/顶级期刊', 'A类', 'B类', 'C类', 'D类', 'E类', '其他期刊'],
    '非学术文章': ['国家级', '省级', '校级', '系级'],
    '专利软著': ['发明专利', '实用新型专利', '外观设计专利', '软件著作权'],
    '学生工作': ['优秀', '良好', '合格'],
    '荣誉称号': ['国家级', '省级', '市级', '校级', '院级'],
    '社会实践': ['国家级荣誉', '省部级荣誉', '校级荣誉', '考核优秀', '考核良好', '志愿工作', '活动参与', '寒暑假实践'],
    '技能培训': ['国家级证书', '其他证书'],
    '其他加分': ['待认定'],
}
# 上限配置：支持两种模式
#   float  → mode='sum'（求和后封顶，默认）
#   {max, mode} → mode='max_item'（取最高单项分作为上限）
# 注意：max_item 模式下 max 为绝对上限（最高分超出 max 时取 max）
DEFAULT_THRESHOLDS = {
    '学生工作类': {'max': 3.0, 'mode': 'max_item'},  # 取最高分
    '技能证书类': 3.0,                                # 求和封顶
}

# Module D constants
COMPREHENSIVE_FORMULA_WITH_SPORTS = {
    'gpa': 0.6,
    'moral': 0.3,
    'sports': 0.1,
    'quality': 1.0,
}
COMPREHENSIVE_FORMULA_WITHOUT_SPORTS = {
    'gpa': 0.7,
    'moral': 0.3,
    'quality': 1.0,
}

# Class name parsing pattern
# Matches: program prefix + 2-digit grade + 1-2 digit class number
# e.g., 顿河交241 -> program: 顿河交, grade: 24, class_num: 1
CLASS_NAME_PATTERN = r'^(?P<program>.+?)(?P<grade>\d{2})(?P<class_num>\d{1,2})$'
