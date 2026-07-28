"""Award-candidate roster preparation and multi-period eligibility review."""
from __future__ import annotations

import re
from collections import defaultdict

from backend.toolbox_audit import (_read_applicants, _read_scores, _read_simple_metric,
                                   _read_work, _lookup, _norm)
from backend.utils.class_utils import parse_class_name


PRESETS = {
    'excellent_student': {'moral_min':85, 'semester_gpa_min':80, 'gpa_major_pct_max':30,
                          'course_min':75, 'quality_required':True, 'no_fail':True},
    'excellent_cadre': {'moral_min':85, 'semester_gpa_min':75, 'pe_min':75,
                        'quality_required':True, 'no_fail':True, 'work_excellent':True},
    'excellent_league': {'comp_major_pct_max':25, 'moral_min':85, 'gpa_average_min':75,
                         'course_min':70},
    'excellent_league_cadre': {'comp_major_pct_max':25, 'gpa_average_min':75,
                               'moral_min':85, 'work_excellent':True},
}


def prepare_roster(path: str) -> dict:
    rows = _read_applicants(path)
    unique = {}
    for row in rows:
        key = row.get('id') or f"{row.get('class_name')}|{row.get('name')}"
        unique[key] = {'id':row.get('id',''), 'name':row.get('name',''),
                       'class_name':row.get('class_name','')}
    students = sorted(unique.values(), key=lambda x:(x['class_name'], x['id'], x['name']))
    return {'success':bool(students), 'students':students,
            'classes':sorted({s['class_name'] for s in students if s['class_name']}),
            'error':'' if students else '基础学分绩点表中未识别到学生'}


def _datasets(paths, reader, words=None):
    result=[]
    for path in paths or []:
        result.append(reader(path) if words is None else reader(path, words))
    return result


def _metric_values(datasets, student, field='value'):
    values=[]
    for dataset in datasets:
        record=_lookup(dataset, student)
        value=(record or {}).get(field)
        if value is not None: values.append(float(value))
    return values


def _rank(rows, value_key, group_key, rank_key, pct_key):
    groups=defaultdict(list)
    for row in rows:
        if row.get(value_key) is not None: groups[row.get(group_key,'')].append(row)
    for members in groups.values():
        ordered=sorted(members,key=lambda x:x[value_key],reverse=True); total=len(ordered)
        previous=None; rank=0
        for index,row in enumerate(ordered,1):
            if previous is None or row[value_key] != previous: rank=index
            row[rank_key]=rank; row[pct_key]=round(rank/total*100,2); row[rank_key+'_total']=total
            previous=row[value_key]


def _program_grade(class_name):
    parsed=parse_class_name(class_name or '')
    return parsed.get('program_grade_key') or re.sub(r'\d+$','',class_name or '')


def audit_candidates(config: dict) -> dict:
    roster=config.get('roster_students') or prepare_roster(config.get('roster_file','')).get('students',[])
    if not roster: return {'success':False,'error':'请先从基础学分绩点表生成学生名单'}
    selected=set(config.get('selected_ids') or [s.get('id') or f"{s.get('class_name')}|{s.get('name')}" for s in roster])
    gpa_paths=[]
    for path in [config.get('roster_file')] + list(config.get('gpa_files') or []):
        if path and path not in gpa_paths: gpa_paths.append(path)
    score_sets=_datasets(gpa_paths,_read_scores)
    comp_sets=_datasets(config.get('comp_files'),_read_simple_metric,['综合测评','综测'])
    moral_sets=_datasets(config.get('moral_files'),_read_simple_metric,['德育分','德育总分','最终得分'])
    quality_sets=_datasets(config.get('quality_files'),_read_simple_metric,['素拓分','素质拓展分','拓展分','最终得分'])
    work=_read_work(config.get('work_files') or [])
    rows=[]
    for student in roster:
        gpas=[]; all_courses=[]
        for dataset in score_sets:
            rec=_lookup(dataset,student)
            if rec:
                if rec.get('gpa') is not None: gpas.append(float(rec['gpa']))
                all_courses.extend(rec.get('courses') or [])
        comps=_metric_values(comp_sets,student); morals=_metric_values(moral_sets,student)
        qualities=_metric_values(quality_sets,student); work_rows=work.get(_norm(student['name']),[])
        non_pe=[c['score'] for c in all_courses if not c.get('is_pe')]
        pe=[c['score'] for c in all_courses if c.get('is_pe')]
        work_grade = ('优秀' if any(item.get('grade') == '优秀' for item in work_rows)
                      else ('良好' if any(item.get('grade') == '良好' for item in work_rows) else None))
        row={**student,'class_group':student.get('class_name',''),'major_group':_program_grade(student.get('class_name','')),
             'semester_gpas':gpas,'gpa_average':round(sum(gpas)/len(gpas),2) if gpas else None,
             'comp_values':comps,'comp_average':round(sum(comps)/len(comps),2) if comps else None,
             'moral':morals[-1] if morals else None,'quality':sum(qualities) if qualities else None,
             'work_grade':work_grade,'work_records':work_rows,
             'failed_count':sum(1 for c in all_courses if c['score']<60),
             'course_min':min(non_pe) if non_pe else None,'pe_min':min(pe) if pe else None,
             'course_count':len(all_courses)}
        rows.append(row)
    for value,prefix in [('gpa_average','gpa'),('comp_average','comp')]:
        _rank(rows,value,'class_group',prefix+'_class_rank',prefix+'_class_pct')
        _rank(rows,value,'major_group',prefix+'_major_rank',prefix+'_major_pct')
    preset_key=config.get('preset','excellent_student'); rules={**PRESETS.get(preset_key,PRESETS['excellent_student']),**(config.get('rules') or {})}
    labels={'moral_min':'德育分','semester_gpa_min':'每学期学分绩点','gpa_average_min':'两学年平均学分绩点','gpa_major_pct_max':'两学年绩点专业占比','comp_major_pct_max':'两学年综测专业占比','course_min':'非体育单科','pe_min':'体育成绩','quality_required':'素拓加分','no_fail':'无挂科','work_excellent':'学生干部测评'}
    output=[]
    for row in rows:
        identity=row.get('id') or f"{row.get('class_name')}|{row.get('name')}"
        if identity not in selected: continue
        checks=[]
        def add(key,actual,passed,expected): checks.append({'key':key,'label':labels[key],'actual':actual,'expected':expected,'passed':passed})
        if 'moral_min' in rules: add('moral_min',row['moral'],None if row['moral'] is None else row['moral']>=rules['moral_min'],f"≥{rules['moral_min']}")
        if 'semester_gpa_min' in rules: add('semester_gpa_min',row['semester_gpas'],None if not row['semester_gpas'] else min(row['semester_gpas'])>=rules['semester_gpa_min'],f"每学期≥{rules['semester_gpa_min']}")
        if 'gpa_average_min' in rules: add('gpa_average_min',row['gpa_average'],None if row['gpa_average'] is None else row['gpa_average']>=rules['gpa_average_min'],f"≥{rules['gpa_average_min']}")
        if 'gpa_major_pct_max' in rules: add('gpa_major_pct_max',row.get('gpa_major_pct'),None if row.get('gpa_major_pct') is None else row['gpa_major_pct']<=rules['gpa_major_pct_max'],f"前{rules['gpa_major_pct_max']}%")
        if 'comp_major_pct_max' in rules: add('comp_major_pct_max',row.get('comp_major_pct'),None if row.get('comp_major_pct') is None else row['comp_major_pct']<=rules['comp_major_pct_max'],f"前{rules['comp_major_pct_max']}%")
        if 'course_min' in rules: add('course_min',row['course_min'],None if row['course_min'] is None else row['course_min']>=rules['course_min'],f"≥{rules['course_min']}")
        if 'pe_min' in rules: add('pe_min',row['pe_min'],None if row['pe_min'] is None else row['pe_min']>=rules['pe_min'],f"≥{rules['pe_min']}")
        if rules.get('quality_required'): add('quality_required',row['quality'],None if row['quality'] is None else row['quality']>0,'必须有')
        if rules.get('no_fail'): add('no_fail',row['failed_count'],None if not score_sets else row['failed_count']==0,'0门')
        if rules.get('work_excellent'): add('work_excellent',row['work_grade'],None if row['work_grade'] is None else row['work_grade']=='优秀','优秀')
        status='待补数据' if any(c['passed'] is None for c in checks) else ('符合' if all(c['passed'] for c in checks) else '不符合')
        output.append({**row,'checks':checks,'status':status,'preset':preset_key})
    counts={key:sum(1 for row in output if row['status']==key) for key in ('符合','不符合','待补数据')}
    return {'success':True,'students':output,'counts':counts,'roster_count':len(roster)}
