"""Build the illustrated moral-score operation tutorial PDF."""

from __future__ import annotations

import io
import os
from pathlib import Path

from PIL import Image as PILImage
from PIL import ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SCREEN_DIR = Path.home() / "Desktop" / "教程"
TMP_DIR = ROOT / "tmp" / "pdfs"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PDF = OUTPUT_DIR / "顿河学院德育分操作教程-看图操作版-v14.1.0.pdf"
COVER_IMAGE = TMP_DIR / "cover-illustration.png"
TEMPLATE_IMAGE = ROOT / "tmp" / "moral-template-previews" / "league_class_pdf.png"
BUTTON_ASSET_DIR = TMP_DIR / "tutorial-buttons"
ANNOTATED_DIR = BUTTON_ASSET_DIR / "annotated"

GREEN_950 = colors.HexColor("#18372F")
GREEN_800 = colors.HexColor("#245848")
GREEN_700 = colors.HexColor("#2F6F57")
GREEN_100 = colors.HexColor("#DCE9E2")
IVORY = colors.HexColor("#F5F1E8")
CERAMIC = colors.HexColor("#FFFDF8")
STONE = colors.HexColor("#DED8CC")
INK = colors.HexColor("#1C2623")
MUTED = colors.HexColor("#65706B")
BRICK = colors.HexColor("#963B3D")
BRICK_WASH = colors.HexColor("#F2E2DF")
WARNING = colors.HexColor("#A66A15")
WARNING_WASH = colors.HexColor("#FFF3D9")
ERROR = colors.HexColor("#C63F3F")
ERROR_WASH = colors.HexColor("#FCE7E7")
INFO = colors.HexColor("#6F9FA6")


def register_fonts():
    pdfmetrics.registerFont(TTFont("MSYH", r"C:\Windows\Fonts\msyh.ttc"))
    pdfmetrics.registerFont(TTFont("MSYH-Bold", r"C:\Windows\Fonts\msyhbd.ttc"))


register_fonts()
BASE = getSampleStyleSheet()
STYLES = {
    "cover_title": ParagraphStyle(
        "cover_title", fontName="MSYH-Bold", fontSize=28, leading=38,
        textColor=GREEN_950, alignment=TA_LEFT, spaceAfter=8,
    ),
    "cover_sub": ParagraphStyle(
        "cover_sub", fontName="MSYH", fontSize=11, leading=18,
        textColor=GREEN_800, alignment=TA_LEFT,
    ),
    "chapter": ParagraphStyle(
        "chapter", fontName="MSYH-Bold", fontSize=20, leading=28,
        textColor=GREEN_950, spaceAfter=5,
    ),
    "chapter_sub": ParagraphStyle(
        "chapter_sub", fontName="MSYH", fontSize=9.5, leading=15,
        textColor=MUTED, spaceAfter=10,
    ),
    "h2": ParagraphStyle(
        "h2", fontName="MSYH-Bold", fontSize=12.5, leading=18,
        textColor=GREEN_800, spaceBefore=5, spaceAfter=4,
    ),
    "body": ParagraphStyle(
        "body", fontName="MSYH", fontSize=9.2, leading=15,
        textColor=INK, spaceAfter=5,
    ),
    "body_center": ParagraphStyle(
        "body_center", fontName="MSYH", fontSize=9.2, leading=15,
        textColor=INK, alignment=TA_CENTER, spaceAfter=5,
    ),
    "small": ParagraphStyle(
        "small", fontName="MSYH", fontSize=7.5, leading=11,
        textColor=MUTED,
    ),
    "caption": ParagraphStyle(
        "caption", fontName="MSYH", fontSize=7.3, leading=11,
        textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=7,
    ),
    "click": ParagraphStyle(
        "click", fontName="MSYH", fontSize=8.1, leading=12,
        textColor=INK,
    ),
    "bullet": ParagraphStyle(
        "bullet", fontName="MSYH", fontSize=9, leading=14.5,
        textColor=INK, leftIndent=12, firstLineIndent=-8, bulletIndent=2,
        spaceAfter=3,
    ),
    "box_title": ParagraphStyle(
        "box_title", fontName="MSYH-Bold", fontSize=9, leading=13,
        textColor=GREEN_950, spaceAfter=2,
    ),
    "box_body": ParagraphStyle(
        "box_body", fontName="MSYH", fontSize=8.3, leading=13,
        textColor=INK,
    ),
    "table": ParagraphStyle(
        "table", fontName="MSYH", fontSize=7.7, leading=10,
        textColor=INK, alignment=TA_CENTER,
    ),
    "table_head": ParagraphStyle(
        "table_head", fontName="MSYH-Bold", fontSize=7.7, leading=10,
        textColor=colors.white, alignment=TA_CENTER,
    ),
}


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, STYLES[style])


def bullets(items: list[str]) -> list[Paragraph]:
    return [Paragraph(f"• {item}", STYLES["bullet"]) for item in items]


def note_box(title: str, text: str, kind: str = "info"):
    palette = {
        "info": (GREEN_100, GREEN_700),
        "warn": (WARNING_WASH, WARNING),
        "error": (ERROR_WASH, ERROR),
        "brick": (BRICK_WASH, BRICK),
    }
    bg, accent = palette[kind]
    content = [
        P(title, "box_title"),
        P(text, "box_body"),
    ]
    table = Table([[content]], colWidths=[176 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.8, accent),
        ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether(table)


def _mark(rect, bubble):
    return {"rect": rect, "bubble": bubble}


def prepare_annotated_images():
    """Create deterministic button callouts without changing the source screenshots."""
    specs = {
        "entry_identity": (
            BUTTON_ASSET_DIR / "00-identity.png",
            [_mark((455, 555, 846, 704), (438, 542))],
        ),
        "entry_welcome": (
            BUTTON_ASSET_DIR / "01-welcome.png",
            [_mark((723, 641, 984, 699), (708, 627))],
        ),
        "entry_task_center": (
            BUTTON_ASSET_DIR / "02-task-center.png",
            [_mark((525, 605, 845, 814), (511, 591))],
        ),
        "entry_route": (
            BUTTON_ASSET_DIR / "03-moral-route.png",
            [
                _mark((1436, 160, 1628, 219), (1424, 147)),
                _mark((136, 274, 635, 351), (124, 262)),
                _mark((644, 274, 1146, 351), (632, 262)),
            ],
        ),
        "a_import": (
            SCREEN_DIR / "德育首页面及半成品页面.png",
            [
                _mark((2110, 86, 2385, 146), (2088, 73)),
                _mark((205, 198, 954, 311), (190, 184)),
                _mark((959, 498, 1108, 564), (944, 484)),
            ],
        ),
        "a_rules": (
            SCREEN_DIR / "德育首页面及半成品页面.png",
            [
                _mark((2335, 472, 2433, 526), (2318, 457)),
                _mark((1250, 585, 2430, 658), (1235, 570)),
                _mark((1251, 672, 1838, 764), (1235, 658)),
                _mark((1845, 672, 2428, 764), (1830, 658)),
            ],
        ),
        "a_add_project": (
            SCREEN_DIR / "德育首页面及半成品页面.png",
            [
                _mark((485, 1010, 1295, 1075), (468, 994)),
                _mark((245, 1100, 2440, 1350), (228, 1084)),
                _mark((2271, 1247, 2407, 1315), (2254, 1231)),
                _mark((2200, 1414, 2324, 1482), (2183, 1398)),
            ],
        ),
        "mapping": (
            SCREEN_DIR / "德育映射页面.png",
            [
                _mark((76, 744, 108, 779), (63, 730)),
                _mark((677, 816, 1270, 891), (662, 801)),
                _mark((1277, 816, 1873, 891), (1262, 801)),
                _mark((1878, 816, 2472, 891), (1863, 801)),
                _mark((78, 935, 2472, 1122), (63, 920)),
                _mark((2374, 1418, 2502, 1484), (2358, 1402)),
            ],
        ),
        "batch": (
            SCREEN_DIR / "批量加分页面.png",
            [
                _mark((860, 382, 1380, 451), (844, 366)),
                _mark((1393, 382, 1673, 451), (1377, 366)),
                _mark((855, 480, 884, 512), (840, 465)),
                _mark((885, 573, 914, 605), (869, 558)),
                _mark((1510, 1325, 1700, 1397), (1494, 1309)),
            ],
        ),
        "b_home": (
            SCREEN_DIR / "板块B首页.png",
            [
                _mark((2074, 405, 2170, 471), (2058, 389)),
                _mark((2180, 405, 2278, 471), (2164, 389)),
                _mark((2080, 740, 2213, 804), (2064, 724)),
                _mark((2224, 740, 2424, 804), (2208, 724)),
                _mark((280, 950, 540, 1013), (264, 934)),
            ],
        ),
        "b_other": (
            SCREEN_DIR / "板块B其他项目页面.png",
            [
                _mark((2382, 380, 2433, 430), (2365, 364)),
                _mark((282, 286, 1169, 356), (266, 270)),
                _mark((1180, 286, 1658, 356), (1164, 270)),
                _mark((1668, 286, 2262, 356), (1652, 270)),
                _mark((2270, 291, 2406, 358), (2254, 275)),
                _mark((2070, 686, 2328, 750), (2054, 670)),
            ],
        ),
        "export": (
            SCREEN_DIR / "导出页面.png",
            [
                _mark((345, 500, 675, 556), (328, 484)),
                _mark((2068, 502, 2327, 566), (2052, 486)),
                _mark((346, 613, 571, 663), (330, 597)),
                _mark((2344, 1220, 2447, 1284), (2328, 1204)),
                _mark((2295, 1325, 2446, 1392), (2279, 1309)),
            ],
        ),
        "review": (
            SCREEN_DIR / "导出时审查页面.png",
            [
                _mark((1628, 806, 1686, 840), (1612, 790)),
                _mark((1628, 895, 1686, 929), (1612, 879)),
                _mark((1490, 1025, 1705, 1090), (1474, 1009)),
            ],
        ),
        "cloud_login": (
            SCREEN_DIR / "云协作登录页面.png",
            [
                _mark((34, 678, 145, 759), (20, 664)),
                _mark((2070, 370, 2244, 435), (2054, 354)),
                _mark((2136, 216, 2268, 278), (2120, 200)),
            ],
        ),
        "cloud_binding": (
            SCREEN_DIR / "表格匹配页面.png",
            [
                _mark((2140, 405, 2245, 454), (2124, 389)),
                _mark((447, 538, 1168, 606), (431, 522)),
                _mark((1187, 511, 2058, 606), (1171, 495)),
                _mark((447, 908, 1318, 978), (431, 892)),
                _mark((1203, 909, 1320, 978), (1187, 893)),
            ],
        ),
        "cloud_sync": (
            SCREEN_DIR / "选择目标并同步页面.png",
            [
                _mark((2036, 720, 2216, 781), (2020, 704)),
                _mark((2028, 896, 2218, 960), (2012, 880)),
                _mark((1195, 720, 1328, 781), (1179, 704)),
            ],
        ),
        "cloud_target": (
            SCREEN_DIR / "选择目标并同步点开之后的页面.png",
            [
                _mark((858, 691, 1746, 781), (842, 675)),
                _mark((858, 790, 1746, 876), (842, 774)),
                _mark((858, 887, 1746, 975), (842, 871)),
                _mark((1514, 1110, 1705, 1172), (1498, 1094)),
            ],
        ),
    }

    ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)
    font_path = r"C:\Windows\Fonts\msyhbd.ttc"
    for key, (source, marks) in specs.items():
        if not source.is_file():
            raise FileNotFoundError(f"缺少按钮标注源截图：{source}")
        with PILImage.open(source).convert("RGBA") as base:
            overlay = PILImage.new("RGBA", base.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(overlay)
            radius = max(24, round(base.width * 0.017))
            line_width = max(5, round(base.width * 0.003))
            font = ImageFont.truetype(font_path, max(28, round(radius * 1.05)))
            for number, mark in enumerate(marks, start=1):
                x1, y1, x2, y2 = mark["rect"]
                bx, by = mark["bubble"]
                draw.rounded_rectangle(
                    (x1, y1, x2, y2),
                    radius=max(10, radius // 2),
                    fill=(150, 59, 61, 30),
                    outline=(150, 59, 61, 255),
                    width=line_width,
                )
                target_x = min(max(bx, x1), x2)
                target_y = min(max(by, y1), y2)
                draw.line((bx, by, target_x, target_y), fill=(150, 59, 61, 255), width=line_width)
                draw.ellipse(
                    (bx - radius, by - radius, bx + radius, by + radius),
                    fill=(150, 59, 61, 255),
                    outline=(255, 253, 248, 255),
                    width=max(3, line_width // 2),
                )
                label = str(number)
                bbox = draw.textbbox((0, 0), label, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                draw.text(
                    (bx - tw / 2, by - th / 2 - bbox[1]),
                    label,
                    font=font,
                    fill=(255, 255, 255, 255),
                )
            PILImage.alpha_composite(base, overlay).convert("RGB").save(
                ANNOTATED_DIR / f"{key}.jpg",
                quality=94,
                subsampling=0,
            )
    return specs


def screenshot(filename: str, caption: str, max_height_mm: float = 109):
    path = SCREEN_DIR / filename
    if not path.is_file():
        return note_box("截图缺失", f"未找到：{filename}", "error")
    with PILImage.open(path) as im:
        width, height = im.size
    max_width = 178 * mm
    max_height = max_height_mm * mm
    scale = min(max_width / width, max_height / height)
    image = Image(str(path), width=width * scale, height=height * scale)
    image.hAlign = "CENTER"
    return KeepTogether([image, P(caption, "caption")])


def button_screenshot(key: str, caption: str, max_height_mm: float = 102):
    path = ANNOTATED_DIR / f"{key}.jpg"
    if not path.is_file():
        return note_box("标注截图缺失", f"未找到：{path.name}", "error")
    return local_image(path, caption, max_height_mm)


def click_legend(rows):
    prepared = []
    for number, text in rows:
        prepared.append([P(str(number), "body_center"), P(text, "click")])
    table = Table(prepared, colWidths=[12 * mm, 164 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), BRICK),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("ROWBACKGROUNDS", (1, 0), (1, -1), [CERAMIC, BRICK_WASH]),
        ("BOX", (0, 0), (-1, -1), 0.6, STONE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, STONE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def local_image(path: Path, caption: str, max_height_mm: float = 112):
    with PILImage.open(path) as im:
        width, height = im.size
    max_width = 178 * mm
    max_height = max_height_mm * mm
    scale = min(max_width / width, max_height / height)
    image = Image(str(path), width=width * scale, height=height * scale)
    image.hAlign = "CENTER"
    return KeepTogether([image, P(caption, "caption")])


def step_table(rows):
    prepared = []
    for number, title, detail in rows:
        prepared.append([
            P(str(number), "body_center"),
            P(title, "box_title"),
            P(detail, "box_body"),
        ])
    table = Table(prepared, colWidths=[12 * mm, 46 * mm, 118 * mm], repeatRows=0)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), GREEN_950),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, STONE),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [CERAMIC, IVORY]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def data_table(rows, widths=None, bad_rows=None):
    prepared = []
    for row_index, row in enumerate(rows):
        style = "table_head" if row_index == 0 else "table"
        prepared.append([P(str(value) if value is not None else "", style) for value in row])
    if widths is None:
        widths = [32 * mm] * len(rows[0])
    table = Table(prepared, colWidths=widths, repeatRows=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), GREEN_700),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.55, STONE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [CERAMIC, IVORY]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    for row_index in bad_rows or []:
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), ERROR_WASH))
        commands.append(("TEXTCOLOR", (0, row_index), (-1, row_index), ERROR))
    table.setStyle(TableStyle(commands))
    return table


def route_cards():
    left = [
        P("板块 A｜已有半成品德育表", "box_title"),
        P("适合：本年级已经有部分德育分，只需要继续补团课、评议或其他项目。2025级通常使用此流程。", "box_body"),
        Spacer(1, 3),
        P("关键词：原表、上下限、继续补分、保留公式", "small"),
    ]
    right = [
        P("板块 B｜从花名册开始建立", "box_title"),
        P("适合：本年级还没有德育表，需要导入学分绩点花名册，再通过标准模板和批量录入建立。", "box_body"),
        Spacer(1, 3),
        P("关键词：花名册、项目模板、批量导入、自动汇总", "small"),
    ]
    table = Table([[left, right]], colWidths=[86 * mm, 86 * mm], hAlign="CENTER")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), GREEN_100),
        ("BACKGROUND", (1, 0), (1, 0), BRICK_WASH),
        ("BOX", (0, 0), (0, 0), 1, GREEN_700),
        ("BOX", (1, 0), (1, 0), 1, BRICK),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return table


def draw_header_footer(canvas, page_number: int):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(GREEN_950)
    canvas.rect(0, height - 10 * mm, width, 10 * mm, fill=1, stroke=0)
    canvas.setFont("MSYH", 7.5)
    canvas.setFillColor(colors.white)
    canvas.drawString(16 * mm, height - 6.4 * mm, "顿河学院德育分操作教程 · 看图操作版 v14.1.0")
    canvas.setStrokeColor(STONE)
    canvas.line(16 * mm, 13 * mm, width - 16 * mm, 13 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("MSYH", 7)
    canvas.drawString(16 * mm, 8 * mm, "依据原《德育教程》整理增强 · 操作界面以实际软件为准")
    canvas.drawRightString(width - 16 * mm, 8 * mm, f"第 {page_number} 页")
    canvas.restoreState()


def page_header_footer(canvas, doc):
    draw_header_footer(canvas, doc.page)


def stamp_header_footer_on_top(pdf_path: Path):
    """Redraw page furniture after all flowables so screenshots cannot cover it."""
    reader = PdfReader(str(pdf_path))
    writer = PdfWriter()
    for page_number, page in enumerate(reader.pages, start=1):
        if page_number > 1:
            overlay_stream = io.BytesIO()
            overlay = pdfcanvas.Canvas(overlay_stream, pagesize=A4)
            draw_header_footer(overlay, page_number)
            overlay.save()
            overlay_stream.seek(0)
            page.merge_page(PdfReader(overlay_stream).pages[0], over=True)
        writer.add_page(page)
    if reader.metadata:
        writer.add_metadata(reader.metadata)
    stamped_path = TMP_DIR / "moral-tutorial-stamped.pdf"
    with stamped_path.open("wb") as handle:
        writer.write(handle)
    os.replace(stamped_path, pdf_path)


def cover_page(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(IVORY)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(GREEN_950)
    canvas.rect(0, height - 9 * mm, width, 9 * mm, fill=1, stroke=0)
    canvas.setFillColor(BRICK)
    canvas.rect(0, height - 11 * mm, width, 2 * mm, fill=1, stroke=0)
    canvas.restoreState()


def build_story():
    story = []

    story += [
        Spacer(1, 7 * mm),
        P("顿河学院", "cover_sub"),
        P("德育分操作教程", "cover_title"),
        P("从选择流程、导入材料、映射审查，到生成表格与云同步", "cover_sub"),
        Spacer(1, 6 * mm),
        local_image(COVER_IMAGE, "教程插图：德育数据整理、表格审查与云协作", 158),
        note_box("适用对象", "负责德育分整理、复核和上传云表的秘书处干事。建议第一次操作时边看教程边完成；熟悉后可直接查看最后一页的“一页速查”。", "brick"),
        PageBreak(),
    ]

    story += [
        P("开始前，先准备好这些材料", "chapter"),
        P("提前整理文件能减少映射错误，也能避免在生成时反复返回修改。", "chapter_sub"),
        step_table([
            ("1", "学分绩点花名册", "板块B必须使用。应包含学号、姓名和行政班级，并覆盖当前负责专业。"),
            ("2", "已有半成品德育表", "板块A使用。确认表内有姓名、班级、已有项目和德育总分。"),
            ("3", "新增项目材料", "如团课、卫生、评议、通报批评等。尽量整理成“班级、姓名、分数”清楚相邻的结构。"),
            ("4", "软件提供的项目模板", "板块B优先使用。每个项目单独一份模板，可一次导入多个。"),
            ("5", "学院德育云表链接", "最后云同步时使用，由群内或负责人提供。"),
        ]),
        Spacer(1, 7 * mm),
        note_box("文件使用提醒", "用于同步的本地表格如果正在 WPS 或 Excel 中打开，请先保存并关闭；否则同步时可能读取不到最新内容。", "warn"),
        Spacer(1, 6 * mm),
        P("建议建立一个学期文件夹", "h2"),
        P("例如：<b>2025-2026-1德育分</b>，内部再分为“原始材料、项目模板、生成结果、已上传”四个文件夹。不要直接覆盖原始材料。", "body"),
        PageBreak(),
    ]

    story += [
        P("步骤1-2｜选择身份并进入工作台", "chapter"),
        P("下面使用当前软件真实界面。截图中的红色编号就是需要点击的位置。", "chapter_sub"),
        button_screenshot("entry_identity", "图1：启动后选择“秘书处”身份", 69),
        click_legend([
            ("1", "点击“秘书处”。德育计算、材料处理和结果导出都在秘书处端完成。"),
        ]),
        Spacer(1, 5 * mm),
        button_screenshot("entry_welcome", "图2：欢迎页点击“开始工作”", 63),
        click_legend([
            ("1", "点击“开始工作 · Начать работу · Start”，进入测评任务中心。"),
        ]),
        PageBreak(),
    ]

    story += [
        P("步骤3-5｜进入德育、确认专业并选择流程", "chapter"),
        P("先进入德育模块，再确认当前专业，最后根据手上的材料选择流程。", "chapter_sub"),
        button_screenshot("entry_task_center", "图3：测评任务中心的模块入口", 71),
        click_legend([
            ("1", "点击“德育测评”卡片。也可以进入工作台后点击左侧栏“德育”。"),
        ]),
        Spacer(1, 5 * mm),
        button_screenshot("entry_route", "图4：德育工作台顶部的专业与流程选择", 70),
        click_legend([
            ("1", "核对“当前专业”；不正确就点击这里修改。"),
            ("2", "已经有半成品德育表时，选择“我有部分德育表”（板块A）。"),
            ("3", "完全没有德育表、需要从花名册开始时，选择“我还没有德育表”（板块B）。"),
        ]),
        PageBreak(),
    ]

    story += [
        P("先判断：板块A还是板块B？", "chapter"),
        P("不要按年级名称死记。判断标准只有一个：这个年级是否已经有可继续计算的德育表。", "chapter_sub"),
        route_cards(),
        Spacer(1, 8 * mm),
        P("板块A的典型情况", "h2"),
        *bullets([
            "已有德育表里有基础分、评议、卫生或其他部分项目，但缺少团课等内容。",
            "部分学生已有总分达到115或低于0，需要选择从“原始未截断分”还是“当前显示分”继续。",
            "希望保留原表里的加减分项目、样式和总分公式，只把新增项目插到原有项目后面。",
        ]),
        P("板块B的典型情况", "h2"),
        *bullets([
            "只有学分绩点花名册，没有德育总表。",
            "希望秘书处各项目负责人先填写统一模板，再由软件统一识别、累计和审查。",
            "需要为模板以外的项目增加自定义项目或批量加减分。",
        ]),
        note_box("同一专业可以同时存在A和B", "例如25级使用板块A、24级使用板块B。分别生成后，再在云同步前一并选择本地结果，软件会按班级整理到学院云表。", "brick"),
        PageBreak(),
    ]

    story += [
        P("板块A｜导入半成品德育表", "chapter"),
        P("今年25级通常属于半成品流程。先选择已有表，再检查计分规则。", "chapter_sub"),
        button_screenshot("a_import", "图5：板块A入口、专业设置与半成品文件选择", 91),
        click_legend([
            ("1", "再次确认当前专业。"),
            ("2", "点击“我有部分德育表”，进入板块A。"),
            ("3", "点击“选择并映射”，选择半成品德育表。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "点击“选择并映射”，选择本年级已经完成一部分的德育表。",
            "查看软件识别到的工作表、姓名列、班级列和已有总分列。",
            "不要修改原文件；软件生成时会另存新的结果表。",
        ]),
        note_box("半成品不等于最终表", "如果文件只是当前阶段的115分显示值，而原始计算可能高于115，请在下一步认真选择继续计算口径。", "warn"),
        PageBreak(),
    ]

    story += [
        P("板块A｜检查上下限与继续计算口径", "chapter"),
        P("默认范围是0-115。最关键的是决定“超过115的历史缓冲分是否保留”。", "chapter_sub"),
        button_screenshot("a_rules", "图6：板块A的上下限与继续计算口径", 83),
        click_legend([
            ("1", "点击“高级设置”展开规则。"),
            ("2", "依次核对基础分、最低分和最高分。"),
            ("3", "要保留历史超上限缓冲分时，选择“保留未截断原始分”。"),
            ("4", "通知要求从当前显示值继续时，选择“从当前显示分重新起算”。"),
        ]),
        Spacer(1, 4 * mm),
        data_table([
            ["选择方式", "举例", "最终结果", "适用情况"],
            ["保留未截断原始分", "原始125，当前显示115，再扣5", "仍为115", "历史超上限部分仍应参与后续计算"],
            ["从当前显示分重新起算", "当前显示115，再扣5", "变为110", "通知明确要求从显示分继续"],
        ], [43 * mm, 49 * mm, 32 * mm, 52 * mm]),
        Spacer(1, 5 * mm),
        note_box("上下限怎么生效？", "最终公式统一采用“先计算所有项目，再限制到最低分和最高分”。例如最低0、最高115，计算出-12会显示0，计算出123会显示115。", "info"),
        PageBreak(),
    ]

    story += [
        P("板块A｜添加加分或扣分项目", "chapter"),
        P("添加项目时只需要回答两个问题：这个项目是加分还是扣分？表格里的分数是怎样填写的？", "chapter_sub"),
        button_screenshot("a_add_project", "图7：板块A新增项目与批量录入入口", 79),
        click_legend([
            ("1", "常用项目可直接点击添加。"),
            ("2", "没有预留项目时，展开“添加自定义项目”。"),
            ("3", "填写名称、加分或扣分、表格分数写法后，点击“添加项目”。"),
            ("4", "项目建立后，可点击右侧“批量录入”。"),
        ]),
        Spacer(1, 4 * mm),
        data_table([
            ["界面问题", "如何选择", "例子"],
            ["加分还是扣分", "选择最终要让德育总分增加还是减少", "团课缺勤通常选“扣分”；评议奖励选“加分”"],
            ["表格里的分数是", "不确定时选“让系统自动判断”；格式明确时再选其他选项", "带符号：-2、+3；只填正数：2、3"],
        ], [42 * mm, 75 * mm, 59 * mm]),
        Spacer(1, 5 * mm),
        note_box("重要：最终作用由“加分还是扣分”决定", "如果选择“扣分”，表格里填写-2，最终仍然是扣2分，不会负负得正。系统会取数值大小2，再按“扣分”处理。", "warn"),
        PageBreak(),
    ]

    story += [
        P("板块A｜上传材料并完成映射", "chapter"),
        P("每个项目可以选择多个来源文件。映射的目的，是告诉软件每张工作表里的姓名、班级和分数分别在哪一列。", "chapter_sub"),
        button_screenshot("mapping", "图8：项目材料的工作表与列映射页面", 91),
        click_legend([
            ("1", "勾选本次要使用的班级或工作表。"),
            ("2", "选择姓名列。"),
            ("3", "选择班级列。"),
            ("4", "选择真正需要加减的分数列。"),
            ("5", "展开预览，核对真实姓名、班级和分数。"),
            ("6", "确认无误后点击“确认映射”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "展开“查看文件与高级设置”，点击“立即映射”或“重新映射”。",
            "只勾选自己负责的班级工作表；不要勾选其他专业或无关汇总页。",
            "依次核对姓名列、班级列、分数列。预览中三项应对得上。",
            "如果一个文件内有多个班级，可分别启用各班级工作表。",
            "确认无误后点击“确认映射”。后期仍可重新进入映射，不是只能设置一次。",
        ]),
        PageBreak(),
    ]

    story += [
        P("映射时这样检查，最不容易出错", "chapter"),
        P("不要只看表头名称，要结合下面几行真实数据核对。", "chapter_sub"),
        button_screenshot("mapping", "图9：映射时重点检查下方真实数据预览", 79),
        click_legend([
            ("1", "只勾选当前专业的班级。"),
            ("2-4", "姓名、班级、分数三列必须分别对应正确。"),
            ("5", "至少抽查三名学生，确认行没有错位。"),
            ("6", "完成抽查后再确认映射。"),
        ]),
        Spacer(1, 4 * mm),
        step_table([
            ("1", "先看姓名", "预览中的姓名应是学生姓名，而不是负责人、宿舍号或备注。"),
            ("2", "再看班级", "班级应类似“顿河信251”，若工作表名就是班级，也可由系统读取。"),
            ("3", "最后看分数", "分数列应是真正要加或扣的数值，不是次数、日期或文字说明。"),
            ("4", "检查专业", "只启用当前专业的班级；其他专业会自动隔离，但仍建议不要勾选。"),
        ]),
        Spacer(1, 5 * mm),
        note_box("不规则表格怎么办？", "如果姓名、班级和分数散落在多行合并表头中，先另存一份整理文件，把它们调整成清楚的相邻列，再进行映射。原始文件保留不动。", "warn"),
        PageBreak(),
    ]

    story += [
        P("板块A｜批量给部分学生加分或扣分", "chapter"),
        P("当项目没有现成表格，或只涉及部分学生时，使用“批量录入”最快。", "chapter_sub"),
        button_screenshot("batch", "图10：批量选择学生并统一录入分值", 84),
        click_legend([
            ("1", "可输入姓名、学号或班级筛选学生。"),
            ("2", "填写每名已选学生统一增加或扣除的分值。"),
            ("3", "需要整批处理时，可点击“选择当前筛选结果”。"),
            ("4", "也可以逐个勾选学生。"),
            ("5", "最后点击“应用到所选学生”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "新增项目，例如“评议分”，选择“加分”或“扣分”。",
            "点击项目右侧的“批量录入”。",
            "可按姓名、学号或班级搜索学生，再勾选需要处理的学生。",
            "输入每人的统一分值，点击“应用”。",
            "如果不同学生分值不同，可分多次筛选和应用；后一次会继续累计。",
        ]),
        note_box("批量录入不会覆盖上传材料", "同一个项目既有上传表格又有批量录入时，两部分会共同累计。请避免把同一笔分数录入两次。", "info"),
        PageBreak(),
    ]

    story += [
        P("板块B｜导入花名册，从零建立德育表", "chapter"),
        P("板块B首先读取学分绩点材料中的学生名单，并只保留当前专业。", "chapter_sub"),
        button_screenshot("b_home", "图11：板块B的花名册导入与标准模板中心", 86),
        click_legend([
            ("1", "点击“浏览”选择学分绩点花名册。"),
            ("2", "点击“导入”，等待学生人数显示出来。"),
            ("3", "需要全套模板时点击“下载全部模板”。"),
            ("4", "模板填写完成后点击“批量导入已填模板”。"),
            ("5", "单个项目也可下载模板或直接批量加分、批量扣分。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "选择“我还没有德育表”。",
            "在“导入花名册”中选择学分绩点材料，然后点击“导入”。",
            "状态栏应显示当前专业、学生人数和班级数量。",
            "若显示“当前专业没有学生”，优先检查专业设置和花名册中的行政班级列。",
        ]),
        note_box("花名册只负责确定学生身份", "德育项目分数仍来自项目模板、上传材料或批量录入。不要把学分绩点数值当成德育分数列。", "warn"),
        PageBreak(),
    ]

    story += [
        P("板块B｜下载并填写项目模板", "chapter"),
        P("每个项目一份模板。负责人只需粘贴班级、姓名，再在加分或扣分列填写正数。", "chapter_sub"),
        local_image(TEMPLATE_IMAGE, "图12：软件提供的“团课出勤”标准模板", 102),
        data_table([
            ["班级", "姓名", "团课出勤加分", "团课出勤扣分", "备注"],
            ["顿河信251", "张同学", "", "2", "团课缺勤1次"],
            ["顿河信251", "李同学", "3", "", "工作奖励"],
            ["顿河信251", "张同学", "", "1", "补充扣分，系统自动累计"],
        ], [31 * mm, 29 * mm, 38 * mm, 38 * mm, 40 * mm]),
        Spacer(1, 4 * mm),
        *bullets([
            "加分和扣分都填写正数，不要输入负号。",
            "同一行只能填写加分或扣分其中一项。",
            "同一学生可以出现多行，系统会按“班级+姓名”自动累计。",
            "不要修改模板编号、项目名称、工作表名和固定表头。",
        ]),
        PageBreak(),
    ]

    story += [
        P("模板填写错误示例与处理办法", "chapter"),
        P("软件会在导入前检查模板结构和数值。以下情况不会直接进入计算。", "chapter_sub"),
        data_table([
            ["班级", "姓名", "项目加分", "项目扣分", "问题"],
            ["", "张同学", "", "2", "缺少班级"],
            ["顿河信251", "李同学", "3", "2", "同一行同时加分和扣分"],
            ["顿河信251", "王同学", "", "-2", "输入了负号"],
            ["顿河信251", "", "1", "", "缺少姓名"],
        ], [31 * mm, 29 * mm, 32 * mm, 32 * mm, 52 * mm], bad_rows=[1, 2, 3, 4]),
        Spacer(1, 7 * mm),
        step_table([
            ("1", "缺班级或姓名", "返回模板补齐。不能只靠同名学生猜测身份。"),
            ("2", "同一行有加分又有扣分", "拆成两行填写，便于审查来源。"),
            ("3", "填写负数", "改为正数。最终加还是扣由列名决定。"),
            ("4", "姓名有错字", "导入可以继续到审查页，由操作者指定正确学生或排除该行。"),
        ]),
        Spacer(1, 6 * mm),
        note_box("为什么模板不要求学号？", "日常材料通常只有班级和姓名。软件优先按班级+姓名匹配花名册；姓名疑似错一个字时只给建议，不会自动替换。", "info"),
        PageBreak(),
    ]

    story += [
        P("板块B｜批量导入模板与手动加减分", "chapter"),
        P("多个项目模板可以一次选择。软件会根据模板编号自动归类，无需逐个设置工作表和分数列。", "chapter_sub"),
        button_screenshot("b_home", "图13：模板下载、批量导入和手动加减分按钮", 78),
        click_legend([
            ("1-2", "已有花名册时不用重复导入；重点检查上方导入状态。"),
            ("3", "点击“下载全部模板”，一次取得全部预留项目模板。"),
            ("4", "填好后点击“批量导入已填模板”，可一次选择多份文件。"),
            ("5", "项目卡片上的按钮用于单独下载或手动批量加减分。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "点击“下载模板”或“下载全部模板”，选择保存文件夹。",
            "填写完成后点击“批量导入已填模板”，可同时选择多份.xlsx文件。",
            "每张项目卡会显示已识别文件数和有效记录数。",
            "需要手动处理时，可直接点击项目卡上的“批量加分”或“批量扣分”。",
            "模板为空可以导入，但不会产生分数；建议删除无内容的文件，避免误以为已经处理。",
        ]),
        note_box("标准模板不需要再次映射", "模板的工作表和列位置是固定的。若软件提示模板编号或表头被修改，请恢复原模板结构，不要手动映射到别的列。", "info"),
        PageBreak(),
    ]

    story += [
        P("板块B｜模板以外的项目或不规则材料", "chapter"),
        P("标准模板覆盖评议、晚寝、自习、课堂、宿舍、教室、团课、青年大学习、通报批评和违纪情况。其他项目放在下方高级区域。", "chapter_sub"),
        button_screenshot("b_other", "图14：板块B“其他项目与不规则材料”区域", 86),
        click_legend([
            ("1", "点击“展开”，显示自定义项目区域。"),
            ("2", "填写项目名称。"),
            ("3", "选择最终是加分还是扣分。"),
            ("4", "选择表格分数写法；不确定时使用自动判断。"),
            ("5", "点击“添加项目”。"),
            ("6", "建立后选择文件，或直接使用批量录入。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "展开“其他项目与不规则材料”。",
            "填写项目名称，选择“加分还是扣分”。",
            "“表格里的分数是”不确定时选择“让系统自动判断（推荐）”。",
            "上传材料后进入映射，确认姓名、班级和分数列。",
            "如果原表结构非常不规则，先整理副本：保证姓名旁边有班级，并让分数成为独立列。",
        ]),
        note_box("不要把次数列误当成扣分列", "例如“旷课次数=2”不一定等于“扣2分”。如果通知规定每次扣5分，应先换算为10分，或使用明确的扣分列。", "warn"),
        PageBreak(),
    ]

    story += [
        P("生成前｜选择输出目录并做最后检查", "chapter"),
        P("A/B流程最终都会进入同一个“审查并生成”步骤。", "chapter_sub"),
        button_screenshot("export", "图15：计分项目、输出目录与审查生成入口", 86),
        click_legend([
            ("1", "再次核对项目的“加分还是扣分”。"),
            ("2", "需要时选择文件或进入批量录入。"),
            ("3", "点击“查看文件与高级设置”复查映射。"),
            ("4", "点击“浏览”选择输出目录。"),
            ("5", "最后点击“审查并生成”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "确认当前专业正确。",
            "确认计分项目数量与实际材料一致。",
            "确认所有上传文件都已映射；标准模板应显示已识别。",
            "确认最低分、最高分和基础分符合当学期通知。",
            "选择输出目录，然后点击“审查并生成”。",
        ]),
        note_box("建议A/B都生成完再进行云同步", "例如先生成25级的板块A结果，再生成其他年级的板块B结果。全部检查无误后，再到云协作中一次选择这些本地结果。", "brick"),
        PageBreak(),
    ]

    story += [
        P("生成时出现审查页面怎么办？", "chapter"),
        P("审查不是报错终止，而是系统在阻止不确定数据直接写入结果。", "chapter_sub"),
        button_screenshot("review", "图16：生成前的姓名、班级和材料审查页面", 87),
        click_legend([
            ("1-2", "确定该学生不应参与本次计算时，勾选“排除”。"),
            ("3", "处理完全部问题后点击“应用处理并重新审查”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "常见原因是退学、休学、转专业学生仍出现在项目材料中，但不在当前花名册。",
            "姓名疑似错一个字时，系统会给出候选学生；必须人工确认后点击“指定对应”。",
            "确定不应计入本次结果的，点击“排除该行”。",
            "大量无关记录可使用“一键排除全部未匹配”，但操作前要确认它们确实不属于当前名单。",
            "处理后点击“应用处理并重新审查”。",
        ]),
        PageBreak(),
    ]

    story += [
        P("生成成功后，先检查表格再同步", "chapter"),
        P("成功界面出现后，点击“收下这份成就感”关闭。随后打开生成表，重点抽查总分与公式。", "chapter_sub"),
        button_screenshot("export", "图17：生成前后的结果区域与操作入口", 78),
        step_table([
            ("1", "抽查高分学生", "确认超过最高分的结果被限制到最高分，例如115。"),
            ("2", "抽查低分学生", "确认低于最低分的结果被限制到最低分，例如0。"),
            ("3", "抽查新增项目", "确认团课、评议等分数写在原有项目后或对应预留列中。"),
            ("4", "检查总分公式", "德育分列应保留Excel公式，而不是只写死数值。"),
            ("5", "关闭本地表格", "保存检查结果并关闭WPS/Excel，再进入云同步。"),
        ]),
        note_box("发现问题怎么办？", "先回到软件修正映射、方向、批量录入或审查处理，再重新生成。不要只在最终表里大量手改，否则下次重新生成会丢失这些修改。", "warn"),
        PageBreak(),
    ]

    story += [
        P("云协作｜登录WPS账号", "chapter"),
        P("在软件左侧栏点击“云协作”。等待页面加载后点击登录，使用微信扫描二维码登录WPS账号。", "chapter_sub"),
        button_screenshot("cloud_login", "图18：云协作中心与WPS登录入口", 87),
        click_legend([
            ("1", "先点击左侧栏“云协作”。"),
            ("2", "点击“登录金山文档”，在浏览器中完成扫码登录。"),
            ("3", "回到软件后可点击“刷新状态”检查是否连接成功。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "登录会打开系统浏览器或WPS授权页面。",
            "扫码完成后回到软件，等待连接状态更新。",
            "软件不会要求你把账号密码填写到德育表中。",
            "若一直显示未登录，关闭授权页面后重新点击登录。",
        ]),
        note_box("账号权限", "使用能够访问学院德育云表的WPS账号。如果绑定后提示无权限，请先在WPS中打开群内链接，确认账号已获得编辑权限。", "info"),
        PageBreak(),
    ]

    story += [
        P("云协作｜确认负责人并绑定学院总表", "chapter"),
        P("登录成功后，下滑找到“连接与负责人设置”，展开后确认姓名、专业和德育学院总表链接。", "chapter_sub"),
        button_screenshot("cloud_binding", "图19：连接与负责人设置、学院总表绑定位置", 86),
        click_legend([
            ("1", "点击“展开设置”。"),
            ("2", "确认负责人姓名。"),
            ("3", "确认负责专业，并点击“保存本机信息”。"),
            ("4", "在“德育学院总表”输入框粘贴群内WPS链接。"),
            ("5", "点击“绑定链接”或“重新绑定”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "负责人姓名应填写实际操作人，便于后续追踪。",
            "专业必须与本次生成结果一致。",
            "在“德育学院总表”处粘贴群里发送的WPS云表链接，然后点击绑定。",
            "同一个学院总表只需绑定一次；链接变更时再重新绑定。",
        ]),
        note_box("不要新建错误的云表", "已有学院总表时应选择“更新当前云表”。只有负责人明确要求建立新表时，才使用创建新云表的选项。", "warn"),
        PageBreak(),
    ]

    story += [
        P("云协作｜选择本地结果与同步目标", "chapter"),
        P("上滑找到“德育表”，点击“选择目标并同步”。如果A/B分别生成了多个结果，可以一起选择。", "chapter_sub"),
        button_screenshot("cloud_sync", "图20：德育表对应的“选择目标并同步”入口", 81),
        click_legend([
            ("1", "在德育学院总表这一行点击“选择目标并同步”。"),
            ("2", "其他业务表不要误点；它们有各自独立的同步入口。"),
            ("3", "班级顺序混乱时，可点击“整理顺序”。"),
        ]),
        Spacer(1, 4 * mm),
        *bullets([
            "选择本次需要上传的本地德育结果。",
            "确认当前专业与文件中的班级一致。",
            "选择“更新当前云表”。",
            "若同时选择板块A和板块B结果，软件会按班级整理到同一学院总表。",
            "点击开始同步后不要立即关闭软件。",
        ]),
        PageBreak(),
    ]

    story += [
        P("云协作｜等待同步完成并核对结果", "chapter"),
        P("同步会依次读取本地表、整理班级工作表并更新云端。等进度条完成后再打开WPS检查。", "chapter_sub"),
        button_screenshot("cloud_target", "图21：同步目标选择窗口", 83),
        click_legend([
            ("1", "一般选择“更新当前云表”（推荐）。"),
            ("2", "只有需要绑定另一份已有学院表时，才选择“使用已有表格链接”。"),
            ("3", "仅负责人明确要求新建时，才选择“新建一份云表”。"),
            ("4", "确认选择后点击底部绿色确认按钮并等待完成。"),
        ]),
        Spacer(1, 4 * mm),
        step_table([
            ("1", "同步前", "本地表已保存并关闭；网络稳定；WPS账号有编辑权限。"),
            ("2", "同步中", "等待进度条走完，不要重复点击同步按钮。"),
            ("3", "同步后", "在WPS中抽查班级名称、学生数量、德育总分和工作表顺序。"),
            ("4", "顺序混乱", "回到云协作页面，使用“整理顺序”按专业、年级、班级重新排列。"),
        ]),
        note_box("同步失败优先检查三件事", "①本地表是否仍在WPS中打开；②云表链接是否绑定正确；③当前WPS账号是否有编辑权限。修正后可重新同步。", "error"),
        PageBreak(),
    ]

    story += [
        P("常见问题快速处理", "chapter"),
        P("以下问题覆盖日常操作中最容易卡住的地方。", "chapter_sub"),
        step_table([
            ("1", "花名册导入失败", "确认选择的是学分绩点文件；检查专业设置；确认文件包含姓名和行政班级。"),
            ("2", "姓名对应不上", "先看班级是否正确，再使用错字建议指定学生；退学休学人员可排除。"),
            ("3", "映射后仍然报错", "进入“重新映射”，检查启用的工作表和分数列，尤其不要把次数列当扣分列。"),
            ("4", "扣分变成加分？", "最终作用由“加分还是扣分”决定。选择扣分后，无论表格填-2还是2，都会按扣2处理；符号仅用于检查。"),
            ("5", "同一学生出现多次", "标准模板允许多行，系统自动累计；确认不是同一笔分数重复录入。"),
            ("6", "结果超过115或低于0", "检查上下限设置；最终公式会限制范围。旧文件若仍异常，请用最新版重新生成。"),
            ("7", "云同步看不到最新分数", "保存并关闭本地WPS/Excel文件后重新同步。"),
            ("8", "班级顺序混乱", "登录云协作后点击“整理顺序”。"),
        ]),
        Spacer(1, 7 * mm),
        note_box("遇到无法判断的问题", "不要为了通过审查随意指定学生。保留原始材料和问题截图，联系负责人确认后再继续。", "brick"),
        PageBreak(),
    ]

    story += [
        P("一页速查｜完整操作顺序", "chapter"),
        P("熟悉软件后，按下面顺序操作即可。", "chapter_sub"),
        step_table([
            ("1", "进入德育模块", "选择身份 → 进入主页 → 德育 → 设置负责专业。"),
            ("2", "选择A/B", "有半成品选A；没有德育表、从花名册开始选B。"),
            ("3A", "板块A", "导入半成品 → 检查上下限和继续口径 → 添加项目 → 上传并映射或批量录入。"),
            ("3B", "板块B", "导入花名册 → 下载并填写项目模板 → 批量导入 → 必要时批量加减分或新增项目。"),
            ("4", "审查并生成", "选择输出目录 → 检查规则 → 生成 → 指定姓名或排除无关行。"),
            ("5", "检查结果", "抽查学生、项目列、0-115上下限和德育分公式，然后保存并关闭表格。"),
            ("6", "云协作登录", "左侧栏云协作 → 登录WPS → 确认负责人和专业 → 绑定学院总表链接。"),
            ("7", "同步", "选择本地结果 → 更新当前云表 → 等待进度完成 → 打开WPS核对。"),
            ("8", "整理顺序", "云表班级顺序混乱时，点击“整理顺序”。"),
        ]),
        Spacer(1, 7 * mm),
        note_box("最后确认", "原始材料已保留｜当前专业正确｜A/B结果都已生成｜本地表已关闭｜云表抽查无误。", "info"),
        Spacer(1, 12 * mm),
        P("操作完成", "chapter"),
        P("建议将本教程与本学期通知、德育项目模板一起放在工作群文件中，后续人员可直接沿用。", "body"),
    ]
    return story


def main():
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    required = [COVER_IMAGE, TEMPLATE_IMAGE]
    required += [SCREEN_DIR / name for name in [
        "云协作登录页面.png", "导出时审查页面.png", "导出页面.png", "德育映射页面.png",
        "德育首页面及半成品页面.png", "批量加分页面.png", "板块B其他项目页面.png",
        "板块B首页.png", "表格匹配页面.png", "选择目标并同步点开之后的页面.png",
        "选择目标并同步页面.png",
    ]]
    required += [BUTTON_ASSET_DIR / name for name in [
        "00-identity.png", "01-welcome.png", "02-task-center.png", "03-moral-route.png",
    ]]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise FileNotFoundError("缺少教程素材：\n" + "\n".join(missing))
    prepare_annotated_images()

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        rightMargin=16 * mm,
        leftMargin=16 * mm,
        # Keep the content frame safely clear of the branded header/footer.
        # Large screenshots and KeepTogether blocks can otherwise paint over
        # on-page decorations when they sit exactly on the frame boundary.
        topMargin=21 * mm,
        bottomMargin=21 * mm,
        title="顿河学院德育分操作教程（看图操作版）",
        author="顿河学院",
        subject="德育分计算、审查、导出与云协作操作教程",
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=page_header_footer)
    stamp_header_footer_on_top(OUTPUT_PDF)
    print(OUTPUT_PDF)


if __name__ == "__main__":
    main()
