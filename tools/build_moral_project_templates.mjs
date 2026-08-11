import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.resolve("outputs", "moral-project-templates");
const projects = [
  ["evaluation", "DY-PY-01", "评议分"],
  ["night_manager", "DY-WQ-01", "晚寝负责人"],
  ["self_study", "DY-ZX-01", "早晚自习出勤"],
  ["class_attendance", "DY-KT-01", "课堂出勤"],
  ["dorm_hygiene", "DY-SS-01", "宿舍卫生"],
  ["classroom_hygiene", "DY-JS-01", "教室卫生"],
  ["league_class", "DY-TK-01", "团课出勤"],
  ["youth_study", "DY-QN-01", "青年大学习"],
  ["criticism", "DY-TB-01", "通报批评"],
  ["discipline", "DY-WJ-01", "违纪情况"],
];

await fs.mkdir(outputDir, { recursive: true });

for (const [key, code, name] of projects) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("数据录入");
  sheet.showGridLines = false;
  sheet.getRange("A1:E1").merge();
  sheet.getRange("A1").values = [[`${name} · 德育项目录入模板`]];
  sheet.getRange("A2:E2").values = [["模板编号", code, "项目名称", name, "版本 1.0"]];
  sheet.getRange("A3:E3").merge();
  sheet.getRange("A3").values = [["填写说明：班级、姓名必填；加分和扣分均填正数，同一行只填一项；同一学生可分多行填写，系统会自动累计。"]];
  sheet.getRange("A4:E4").values = [[
    "班级", "姓名", `${name}加分`, `${name}扣分`, "备注",
  ]];
  sheet.getRange("A5:E104").values = Array.from({ length: 100 }, () => [null, null, null, null, null]);

  sheet.getRange("A1:E1").format = {
    fill: "#18372F",
    font: { bold: true, color: "#FFFFFF", size: 16 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.getRange("A2:E2").format = {
    fill: "#F5F1E8",
    font: { color: "#1C2623", bold: true, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: "#DED8CC" },
  };
  sheet.getRange("A3:E3").format = {
    fill: "#DCE9E2",
    font: { color: "#245848", size: 9 },
    horizontalAlignment: "left",
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange("A4:E4").format = {
    fill: "#2F6F57",
    font: { bold: true, color: "#FFFFFF", size: 11 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#18372F" },
  };
  sheet.getRange("A5:E104").format = {
    fill: "#FFFDF8",
    font: { color: "#1C2623", size: 10 },
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: "#DED8CC" },
  };
  sheet.getRange("A5:B104").format.horizontalAlignment = "center";
  sheet.getRange("C5:D104").format.horizontalAlignment = "center";
  sheet.getRange("C5:D104").format.numberFormat = "0.00";
  sheet.getRange("C5:D104").dataValidation = {
    rule: { type: "decimal", operator: "greaterThanOrEqualTo", formula1: 0 },
  };
  sheet.getRange("A1:E1").format.rowHeight = 34;
  sheet.getRange("A2:E2").format.rowHeight = 24;
  sheet.getRange("A3:E3").format.rowHeight = 36;
  sheet.getRange("A4:E4").format.rowHeight = 30;
  sheet.getRange("A5:E104").format.rowHeight = 24;
  sheet.getRange("A:A").format.columnWidth = 18;
  sheet.getRange("B:B").format.columnWidth = 14;
  sheet.getRange("C:D").format.columnWidth = 16;
  sheet.getRange("E:E").format.columnWidth = 28;
  sheet.freezePanes.freezeRows(4);

  const output = await SpreadsheetFile.exportXlsx(workbook);
  const filePath = path.join(outputDir, `德育项目模板-${name}.xlsx`);
  await output.save(filePath);

  const check = await workbook.inspect({
    kind: "sheet,region",
    sheetId: "数据录入",
    range: "A1:E12",
    include: "name,values,formulas",
    maxChars: 2400,
  });
  console.log(JSON.stringify({ key, filePath, inspect: check.ndjson }));

}
