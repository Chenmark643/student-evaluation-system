"""Official quality-development rules and user-safe preset helpers."""
from __future__ import annotations

from copy import deepcopy


OFFICIAL_THRESHOLDS = [
    {'name': '比赛志愿服务每学期上限', 'max': 2.0, 'categories': ['比赛志愿服务类'], 'mode': 'sum'},
    {'name': '学院活动参与每学期上限', 'max': 1.0, 'categories': ['学院活动参与类'], 'mode': 'sum'},
    {'name': '寒暑假社会实践上限', 'max': 2.0, 'categories': ['寒暑假实践类'], 'mode': 'sum'},
    {'name': '技能培训与证书上限', 'max': 3.0, 'categories': ['技能证书类', '技能培训'], 'mode': 'sum'},
    {'name': '学生干部任职取最高', 'max': 3.0, 'categories': ['学生工作类', '学生工作', '班委测评', '组织测评'], 'mode': 'max_item'},
    {'name': '新生班主任助理取最高', 'max': 2.0, 'categories': ['班主任助理类'], 'mode': 'max_item'},
]

PRIMARY_CATEGORIES = {
    '文体艺术类': '文体艺术与身心发展',
    '学术竞赛类': '学术科技与创新创业',
    '学术成果类': '学术科技与创新创业',
    '学生工作类': '学生工作与社团活动',
    '班主任助理类': '学生工作与社团活动',
    '社会实践荣誉类': '社会实践与志愿服务',
    '比赛志愿服务类': '社会实践与志愿服务',
    '学院活动参与类': '社会实践与志愿服务',
    '寒暑假实践类': '社会实践与志愿服务',
    '技能证书类': '技能培训',
    '其他加分': '待学院认定',
}

def _slug(value: str) -> str:
    table = {
        '全国': 'national', '国家级': 'national', '省级': 'provincial', '省部级': 'provincial',
        '市级': 'city', '校级': 'school', '学院': 'college', '院级': 'college',
        '特等奖': 'special', '一等奖': 'first', '二等奖': 'second', '三等奖': 'third',
        '优秀（鼓励）奖': 'encouragement', '优秀奖': 'encouragement', '破纪录': 'record',
        '顶尖期刊': 'top', '顶级期刊': 'leading', '其他期刊': 'other',
    }
    return table.get(value, value.lower().replace(' ', '-'))


def preset(pid, name, category, grade, score, *, tags=(), note='', cap_group=None,
           score_range=None, contribution_options=False, contribution_policy='none'):
    return {
        'id': pid, 'name': name, 'category': category, 'grade': grade,
        'score': float(score), 'tags': list(tags), 'rule_note': note,
        'primary_category': PRIMARY_CATEGORIES.get(category, category),
        'cap_group': cap_group,
        'score_range': list(score_range) if score_range else None,
        'contribution_options': bool(contribution_options),
        'contribution_policy': contribution_policy if contribution_options else 'none',
        'source': 'official',
    }


def _matrix(rows, prefix, title, category, awards, *, contribution_policy='manual'):
    result = []
    for level, scores in rows.items():
        for award, score in zip(awards, scores):
            if score is None:
                continue
            result.append(preset(
                f'{prefix}-{_slug(level)}-{_slug(award)}', f'{title}·{level}·{award}',
                category, f'{level}·{award}', score,
                tags=(title, level, award), contribution_options=True,
                contribution_policy=contribution_policy,
                note='同一项目多次获奖取最高值，不重复计分。',
            ))
    return result


def build_official_presets():
    """Return a fresh, searchable catalog encoded from the supplied rules."""
    rows = []
    art = {
        '全国': [6, 4, 3, 2], '省级': [5, 3, 2, 1],
        '市级': [4, 2.5, 2, 1], '校级': [2, 1, .5, .2],
    }
    rows += _matrix(art, 'art', '文艺活动', '文体艺术类', ['一等奖', '二等奖', '三等奖', '优秀（鼓励）奖'])
    for level, scores in art.items():
        rows.append(preset(f'art-{_slug(level)}-special', f'文艺活动·{level}·特等奖', '文体艺术类', f'{level}·特等奖', scores[0] + 1, tags=('文艺', level, '特等奖'), contribution_options=True, contribution_policy='manual'))
        rows.append(preset(
            f'art-{_slug(level)}-committee', f'文艺活动·{level}·其他组委会奖',
            '文体艺术类', f'{level}·按二等奖', scores[1],
            tags=('文艺', level, '最佳台风奖', '最佳组合奖', '最佳剧本奖', '突出贡献奖'),
            note='组委会颁发的其他奖项按相应级别二等奖加分。',
            contribution_options=True, contribution_policy='manual',
        ))

    sport = {
        '全国': [10, 8, 7, 6, 5, 4.5, 4, 3.5, 3],
        '省级': [8, 6, 5, 4, 3.5, 3, 2.8, 2.5, 2],
        '市级': [6, 4, 3, 2, 1.8, 1.6, 1.4, 1.2, 1],
        '校级': [4, 3, 2, 1.5, 1, .8, .6, .5, .3],
    }
    ranks = ['破纪录', '第一名', '第二名', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名']
    for level, scores in sport.items():
        for rank, score in zip(ranks, scores):
            rid = 'record' if rank == '破纪录' else str(ranks.index(rank))
            rows.append(preset(
                f'sport-{_slug(level)}-{rid}', f'体育活动·{level}·{rank}',
                '文体艺术类', f'{level}·{rank}', score,
                tags=('体育', level, rank), contribution_options=True,
                contribution_policy='manual',
                note='团体项目主力按本级别加分；替补队员须改选降一等级后的规则。',
            ))
        rows.append(preset(
            f'sport-{_slug(level)}-committee', f'体育活动·{level}·其他组委会奖',
            '文体艺术类', f'{level}·按二等奖', scores[2],
            tags=('体育', level, 'MVP', '最佳射手'),
            note='MVP、最佳射手等其他组委会奖按相应级别二等奖加分。',
            contribution_options=True, contribution_policy='manual',
        ))
    rows.extend([
        preset('performance-training', '啦啦操/表演方队训练', '文体艺术类', '积极训练', 1),
        preset('performance-show', '节目演出/表演人员', '文体艺术类', '参加演出', .5),
    ])

    contests = {
        'a': ('A类竞赛', {'国家级': [17,14,12,10], '省级': [9,8,7,6], '校级': [None,5.5,5,4.5]}),
        'b': ('B类竞赛', {'国家级': [9,8.5,7.5,6.5], '省部级': [6.5,6,5.5,5], '校级': [None,3.5,3,2.5], '学院': [None,1,.8,.5]}),
        'c': ('C类竞赛', {'国家级': [4,3.5,3,2.5], '省部级': [2.5,2,1.5,1], '校级': [None,1,.8,.5]}),
        'd': ('D类竞赛', {'国家级': [2.5,2,1.8,1.5], '省部级': [1.5,1.2,1,.8], '校级': [None,.8,.6,.4]}),
    }
    for code, (title, matrix) in contests.items():
        rows += _matrix(
            matrix, f'contest-{code}', title, '学术竞赛类',
            ['特等奖','一等奖','二等奖','三等奖'],
            contribution_policy='academic_90',
        )
    rows.append(preset('contest-b-college-encouragement', 'B类竞赛·学院·优秀奖', '学术竞赛类', '学院·优秀奖', .2, tags=('B类竞赛','学院','优秀奖'), contribution_options=True, contribution_policy='academic_90'))
    for award, score in [('一等奖', .8), ('二等奖', .6), ('三等奖', .4)]:
        rows.append(preset(
            f'contest-other-school-{_slug(award)}', f'其他竞赛·校级·{award}',
            '学术竞赛类', f'校级·{award}', score, contribution_options=True,
            contribution_policy='academic_90',
        ))
    for level, score in [('国家级',5),('省级',3),('校级',1),('系级',.5)]:
        rows.append(preset(f'article-{_slug(level)}', f'非学术文章·{level}', '学术成果类', level, score))
    for pid, name, score in [('invention','发明专利',10),('utility','实用新型专利',4),('design','外观设计专利',2),('software','软件著作权',1)]:
        rows.append(preset(
            f'patent-{pid}', name, '学术成果类', '每项', score,
            contribution_options=True, contribution_policy='academic_90',
        ))
    rows.extend([
        preset('entrepreneurship', '创业活动获肯定性评价', '学术成果类', '学院认定', 3, score_range=(3,5)),
        preset('international-conference', '参加国际学术会议', '学术成果类', '学院认定', 2, score_range=(2,5)),
    ])

    for grade, score in [('优秀',3),('良好',2),('合格',1),('不合格',0)]:
        rows.append(preset(f'cadre-{_slug(grade)}', f'学生干部考核·{grade}', '学生工作类', grade, score, cap_group='学生干部任职取最高'))
    rows.append(preset('dorm-leader-excellent', '优秀宿舍宿舍长', '学生工作类', '优秀宿舍', .5, cap_group='学生干部任职取最高'))
    for grade, score in [('优秀',2),('良好',1),('合格',.5)]:
        rows.append(preset(f'class-assistant-{_slug(grade)}', f'新生班主任助理·{grade}', '班主任助理类', grade, score, cap_group='新生班主任助理取最高', note='可与学生干部考核叠加。'))
    for grade, score in [('优秀',2),('良好',1),('合格',0)]:
        rows.append(preset(f'club-{_slug(grade)}', f'社团等组织考核·{grade}', '学生工作类', grade, score, cap_group='学生干部任职取最高'))
    for grade, score in [('优秀',2),('良好',1)]:
        rows.append(preset(
            f'college-organization-{_slug(grade)}', f'院级组织考评·{grade}',
            '学生工作类', grade, score, cap_group='学生干部任职取最高',
        ))

    for grade, score in [('优秀',2),('良好',1),('合格及以下',0)]:
        rows.append(preset(f'practice-assessment-{_slug(grade)}', f'社会实践考核·{grade}', '社会实践荣誉类', grade, score))
    for level, score in [('校级',1),('省部级',2),('国家级',3.5)]:
        rows.append(preset(f'practice-honor-{_slug(level)}', f'社会实践/志愿服务荣誉·{level}', '社会实践荣誉类', level, score))
    rows.extend([
        preset('volunteer-competition', '比赛志愿服务', '比赛志愿服务类', '每次', .3, cap_group='比赛志愿服务每学期上限', note='每次0.3分，每学期上限2分。'),
        preset('college-activity-participation', '学院活动参与', '学院活动参与类', '每次', .2, cap_group='学院活动参与每学期上限', note='每次0.2分，每学期上限1分。'),
        preset('holiday-practice', '寒暑假社会实践', '寒暑假实践类', '有证明/报道/奖励', 1, cap_group='寒暑假社会实践上限', score_range=(1,2)),
        preset('recognized-certificate', '国家认可证书', '技能证书类', '每项', 1, cap_group='技能培训与证书上限'),
        preset('other-skill-certificate', '其他技能培训资格证书', '技能证书类', '每项', 1, cap_group='技能培训与证书上限'),
        preset('other-written-application', '其他书面申请项目', '其他加分', '教师认定', 0, score_range=(0, 100)),
    ])
    return deepcopy(rows)


def official_mappings():
    result = {}
    for row in build_official_presets():
        result[row['name']] = {
            'category': row['category'], 'default_grade': row['grade'],
            'default_score': row['score'], 'last_used': '',
            'official_preset_id': row['id'], 'source': 'official',
        }
    return result


def merge_official_with_user(user):
    merged = official_mappings()
    for name, row in (user or {}).items():
        clean = deepcopy(row)
        clean['source'] = 'user'
        merged[name] = clean
    return merged


def extract_user_mappings(mappings):
    """Strip unchanged official rows before persisting a full editor payload."""
    official = official_mappings()
    result = {}
    keys = ('category', 'default_grade', 'default_score')
    for name, row in (mappings or {}).items():
        if not isinstance(row, dict):
            continue
        base = official.get(name)
        unchanged = base and all(row.get(key) == base.get(key) for key in keys)
        if row.get('source') == 'official' or unchanged:
            continue
        clean = deepcopy(row)
        clean.pop('source', None)
        result[name] = clean
    return result


def calculate_activity_score(base_score, count=1, contribution=1.0, related=False):
    """Calculate a new activity score.

    ``related`` remains in the signature for older desktop clients, but the
    supplied official rules contain no major/Russian-language multiplier and
    therefore it no longer changes newly calculated scores.
    """
    count = max(1, int(count or 1))
    base_total = round(float(base_score or 0) * count, 4)
    contribution_total = round(base_total * float(contribution or 0), 4)
    return {
        'base_total': base_total,
        'contribution_total': contribution_total,
        'final': contribution_total,
    }


def validate_manual_score(value, score_range=None):
    value = float(value)
    outside = bool(score_range) and not (float(score_range[0]) <= value <= float(score_range[1]))
    return {'allowed': True, 'outside_official_range': outside}
