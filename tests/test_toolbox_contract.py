import unittest
from pathlib import Path
import tempfile
import openpyxl
from backend.toolbox_audit import audit_applicants, _read_work, _norm
from backend.award_eligibility import prepare_roster, audit_candidates

ROOT=Path(__file__).resolve().parents[1]

class ToolboxContractTests(unittest.TestCase):
    def test_toolbox_is_reachable(self):
        index=(ROOT/'web/index.html').read_text(encoding='utf-8')
        main=(ROOT/'web/js/main.js').read_text(encoding='utf-8')
        self.assertIn('js/modules/toolbox.js',index)
        self.assertIn("toolbox:renderModuleToolbox",main)

    def test_new_award_workflow_is_explicit(self):
        ui=(ROOT/'web/js/modules/toolbox.js').read_text(encoding='utf-8')
        for key in ('excellent_student','excellent_cadre','excellent_league','excellent_league_cadre','prepare_award_roster','audit_award_candidates'):
            self.assertIn(key,ui)
        self.assertNotIn('部长审核端',ui)

    def test_removed_major_is_not_suggested(self):
        scope=(ROOT/'web/js/components/major-scope.js').read_text(encoding='utf-8')
        self.assertNotIn('国商',scope)

    def test_only_uploaded_applicants_are_audited_with_course_details(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder)
            def book(name, rows):
                path=folder/name; wb=openpyxl.Workbook(); ws=wb.active
                for row in rows: ws.append(row)
                wb.save(path); return str(path)
            applicants=book('applicants.xlsx',[['学号','姓名','班级'],['250001','甲','测试251']])
            scores=book('scores.xlsx',[['学号','姓名','班级','课程门数','数学','体育（1）','学分绩点'],['总学分',None,None,None,3,1,None],['250001','甲','测试251',2,74,80,76]])
            ranking=book('ranking.xlsx',[['学号','姓名','班级','学分绩点','排名','百分比'],['250001','甲','测试251',76,1,20]])
            work=book('work.xlsx',[['姓名','部门',None,'优秀','良好'],['甲','秘书处',None,'优秀',None]])
            rules={'no_fail':{'enabled':True},'no_below75':{'enabled':True},'gpa':{'enabled':True,'threshold':75},'academic_major_rank':{'enabled':True,'threshold':25},'work':{'enabled':True,'allowed':['优秀']}}
            result=audit_applicants({'applicant_file':applicants,'score_file':scores,'major_ranking_file':ranking,'work_files':[work],'rules':rules})
            self.assertTrue(result['success'])
            self.assertEqual(len(result['students']),1)
            self.assertEqual(result['students'][0]['status'],'不通过')
            low=next(c for c in result['students'][0]['checks'] if c['key']=='no_below75')
            self.assertIn('数学',low['detail'])

    def test_award_roster_and_rankings_are_calculated_from_source_tables(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder)
            def book(name, rows):
                path=folder/name; wb=openpyxl.Workbook(); ws=wb.active
                for row in rows: ws.append(row)
                wb.save(path); return str(path)
            base=book('base.xlsx',[['学号','姓名','班级','课程门数','数学','体育（1）','学分绩点'],['学分','','','',3,1,''],['250001','甲','顿河信251',2,85,80,90],['250002','乙','顿河信251',2,75,78,80]])
            old=book('old.xlsx',[['学号','姓名','班级','课程门数','数学','体育（1）','学分绩点'],['学分','','','',3,1,''],['250001','甲','顿河信251',2,88,82,88],['250002','乙','顿河信251',2,76,79,78]])
            comp=book('comp.xlsx',[['学号','姓名','班级','综合测评'],['250001','甲','顿河信251',92],['250002','乙','顿河信251',80]])
            moral=book('moral.xlsx',[['学号','姓名','班级','德育分'],['250001','甲','顿河信251',90],['250002','乙','顿河信251',82]])
            quality=book('quality.xlsx',[['学号','姓名','班级','素拓分'],['250001','甲','顿河信251',2],['250002','乙','顿河信251',0]])
            roster=prepare_roster(base)
            self.assertEqual(len(roster['students']),2)
            result=audit_candidates({'roster_file':base,'roster_students':roster['students'],'selected_ids':['250001'],'preset':'excellent_student','gpa_files':[old],'comp_files':[comp],'moral_files':[moral],'quality_files':[quality]})
            self.assertTrue(result['success'])
            student=result['students'][0]
            self.assertEqual(student['gpa_average'],89)
            self.assertEqual(student['gpa_major_rank'],1)
            self.assertEqual(student['gpa_major_pct'],50)
            self.assertEqual(student['status'],'不符合')  # top 30% in a two-person cohort is not met

    def test_real_work_evaluations_are_read_from_fill_colors(self):
        roots=[Path(r'D:\Wechat\xwechat_files\wxid_rnn8vd8giljk22_1bb2\msg\file\2026-03'),Path(r'D:\Wechat\xwechat_files\wxid_rnn8vd8giljk22_1bb2\msg\file\2026-02')]
        files=[]
        for root,size in zip(roots,[15025,40524]):
            files.extend(p for p in root.glob('*.xlsx') if p.stat().st_size==size)
        if len(files)<2: self.skipTest('real evaluation samples are unavailable')
        records=_read_work([str(p) for p in files])
        self.assertEqual(records[_norm('陈雨昂')][0]['grade'],'优秀')
        self.assertEqual(records[_norm('于茗淇')][0]['grade'],'良好')
        self.assertEqual(records[_norm('王子豪')][0]['grade'],'优秀')
        self.assertEqual(records[_norm('张瑞佳')][0]['grade'],'良好')

if __name__ == '__main__': unittest.main()
