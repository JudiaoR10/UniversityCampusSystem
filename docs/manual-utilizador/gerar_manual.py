#!/usr/bin/env python3
"""Gera o Manual do Utilizador do Smart Campus Core (Word)."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "capturas"
OUT = ROOT / "Manual_do_Utilizador_Smart_Campus.docx"

NAVY = "10233D"
TEAL = "1A6B5C"
INK = "1E2A3A"
MUTED = "5A6B7C"
MIST = "EEF3F1"
PAPER = "F7F4EE"
LINE = "D5DDD8"
GOLD = "C48A3A"
WHITE = "FFFFFF"
SOFT = "F3F7F6"

bookmark_seq = 0


def rgb(hex_color: str) -> RGBColor:
    h = hex_color.lstrip("#")
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def set_run(run, *, size=11, bold=False, italic=False, color=INK, font="Calibri"):
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = rgb(color)


def shade_cell(cell, color: str):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), color)
    shd.set(qn("w:val"), "clear")
    tcPr.append(shd)


def set_cell_borders(cell, **sides):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for edge, spec in sides.items():
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), spec.get("val", "single"))
        el.set(qn("w:sz"), str(spec.get("sz", 4)))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), spec.get("color", LINE))
        tcBorders.append(el)
    tcPr.append(tcBorders)


def set_cell_margins(cell, top=80, bottom=80, left=120, right=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for name, value in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        node = OxmlElement(f"w:{name}")
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def set_row_height(row, twips: int):
    tr = row._tr
    trPr = tr.get_or_add_trPr()
    trHeight = OxmlElement("w:trHeight")
    trHeight.set(qn("w:val"), str(twips))
    trHeight.set(qn("w:hRule"), "atLeast")
    trPr.append(trHeight)


def prevent_row_split(row):
    tr = row._tr
    trPr = tr.get_or_add_trPr()
    cant = OxmlElement("w:cantSplit")
    trPr.append(cant)


def clear_table_borders(table):
    tbl = table._tbl
    tblPr = tbl.tblPr if tbl.tblPr is not None else tbl.get_or_add_tblPr()
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement(f"w:{edge}")
        el.set(qn("w:val"), "nil")
        el.set(qn("w:sz"), "0")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "auto")
        borders.append(el)
    tblPr.append(borders)


def add_bookmark(paragraph, name: str):
    global bookmark_seq
    bookmark_seq += 1
    start = OxmlElement("w:bookmarkStart")
    start.set(qn("w:id"), str(bookmark_seq))
    start.set(qn("w:name"), name)
    end = OxmlElement("w:bookmarkEnd")
    end.set(qn("w:id"), str(bookmark_seq))
    paragraph._p.insert(0, start)
    paragraph._p.append(end)


def add_internal_link(paragraph, anchor: str, text: str, *, size=11, bold=False, color=TEAL):
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("w:anchor"), anchor)
    run = OxmlElement("w:r")
    rPr = OxmlElement("w:rPr")
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), "Calibri")
    rFonts.set(qn("w:hAnsi"), "Calibri")
    rPr.append(rFonts)
    sz = OxmlElement("w:sz")
    sz.set(qn("w:val"), str(size * 2))
    rPr.append(sz)
    color_el = OxmlElement("w:color")
    color_el.set(qn("w:val"), color)
    rPr.append(color_el)
    if bold:
        rPr.append(OxmlElement("w:b"))
    u = OxmlElement("w:u")
    u.set(qn("w:val"), "single")
    rPr.append(u)
    run.append(rPr)
    text_el = OxmlElement("w:t")
    text_el.set(qn("xml:space"), "preserve")
    text_el.text = text
    run.append(text_el)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def style_heading(paragraph, level: int, text: str, bookmark: str | None = None):
    paragraph.style = f"Heading {level}"
    for child in list(paragraph._p):
        tag = child.tag.split("}")[-1]
        if tag in {"r", "hyperlink", "bookmarkStart", "bookmarkEnd"}:
            paragraph._p.remove(child)
    run = paragraph.add_run(text)
    if level == 1:
        set_run(run, size=22, bold=True, color=NAVY, font="Calibri")
        paragraph.paragraph_format.space_before = Pt(6)
        paragraph.paragraph_format.space_after = Pt(10)
    elif level == 2:
        set_run(run, size=16, bold=True, color=TEAL, font="Calibri")
        paragraph.paragraph_format.space_before = Pt(16)
        paragraph.paragraph_format.space_after = Pt(6)
    else:
        set_run(run, size=13, bold=True, color=NAVY, font="Calibri")
        paragraph.paragraph_format.space_before = Pt(12)
        paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.keep_with_next = True
    if bookmark:
        add_bookmark(paragraph, bookmark)


def add_body(doc, text: str, *, size=11, color=INK, space_after=8):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    set_run(run, size=size, color=color)
    return p


def add_bullets(doc, items: list[str]):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.clear()
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.left_indent = Cm(0.75)
        run = p.add_run(item)
        set_run(run, size=11, color=INK)


def callout(doc, kicker: str, body: str, *, fill=SOFT, accent=TEAL):
    table = doc.add_table(rows=1, cols=1)
    table.autofit = True
    cell = table.cell(0, 0)
    shade_cell(cell, fill)
    set_cell_margins(cell, 120, 120, 160, 160)
    set_cell_borders(
        cell,
        top={"val": "nil"},
        right={"val": "nil"},
        bottom={"val": "nil"},
        left={"val": "single", "sz": 24, "color": accent},
    )
    cell.text = ""
    p1 = cell.paragraphs[0]
    p1.paragraph_format.space_after = Pt(2)
    r1 = p1.add_run(kicker.upper())
    set_run(r1, size=9, bold=True, color=accent)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    r2 = p2.add_run(body)
    set_run(r2, size=11, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)


def meta_row(doc, pairs: list[tuple[str, str]]):
    table = doc.add_table(rows=1, cols=len(pairs))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    clear_table_borders(table)
    for i, (label, value) in enumerate(pairs):
        cell = table.cell(0, i)
        shade_cell(cell, MIST)
        set_cell_margins(cell, 80, 80, 120, 120)
        set_cell_borders(
            cell,
            top={"color": LINE},
            left={"color": LINE},
            bottom={"color": LINE},
            right={"color": LINE},
        )
        cell.text = ""
        p1 = cell.paragraphs[0]
        p1.paragraph_format.space_after = Pt(1)
        r1 = p1.add_run(label.upper())
        set_run(r1, size=8, bold=True, color=MUTED)
        p2 = cell.add_paragraph()
        p2.paragraph_format.space_after = Pt(0)
        r2 = p2.add_run(value)
        set_run(r2, size=11, bold=True, color=NAVY)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(10)


def compressed_shot(path: Path) -> tuple[BytesIO, float]:
    with Image.open(path) as im:
        image = im.convert("RGB")
        max_px = 1280
        if image.width > max_px:
            height = int(image.height * max_px / image.width)
            image = image.resize((max_px, height), Image.Resampling.LANCZOS)
        aspect = image.height / max(image.width, 1)
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=78, optimize=True)
        buf.seek(0)
    return buf, aspect


def add_screenshot(doc, filename: str, caption: str):
    path = SHOTS / filename
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(2)
    if not path.exists():
        run = p.add_run(f"[Captura indisponível: {filename}]")
        set_run(run, size=10, italic=True, color=MUTED)
        return
    buf, aspect = compressed_shot(path)
    max_width = Cm(14.6) if aspect > 1.55 else Cm(16.4)
    run = p.add_run()
    run.add_picture(buf, width=max_width)
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(12)
    cap.paragraph_format.space_before = Pt(2)
    r = cap.add_run(caption)
    set_run(r, size=9, italic=True, color=MUTED)


def configure_styles(doc: Document):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = rgb(INK)
    normal.paragraph_format.space_after = Pt(8)
    normal.paragraph_format.line_spacing = 1.15

    for i, size in ((1, 22), (2, 16), (3, 13)):
        style = styles[f"Heading {i}"]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = rgb(NAVY if i != 2 else TEAL)
        style.paragraph_format.space_before = Pt(14 if i > 1 else 4)
        style.paragraph_format.space_after = Pt(8)


def add_header_footer(doc: Document):
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(1.8)
    section.right_margin = Cm(1.8)
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.8)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.6)
    section.different_first_page_header_footer = True

    header = section.header
    hp = header.paragraphs[0]
    hp.paragraph_format.space_after = Pt(2)
    r = hp.add_run("Smart Campus  ·  Manual do Utilizador")
    set_run(r, size=9, bold=True, color=NAVY)
    line = header.add_paragraph()
    line.paragraph_format.space_after = Pt(0)
    lr = line.add_run("Universidade Joaquim Alberto Chissano  ·  PTP III")
    set_run(lr, size=8, color=MUTED)

    footer = section.footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r1 = fp.add_run("UJAC  ·  Smart Campus Core  ·  ")
    set_run(r1, size=8, color=MUTED)
    # PAGE field
    run = fp.add_run()
    fld1 = OxmlElement("w:fldChar")
    fld1.set(qn("w:fldCharType"), "begin")
    run._r.append(fld1)
    run2 = fp.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    run2._r.append(instr)
    run3 = fp.add_run()
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run3._r.append(fld2)
    set_run(run, size=8, color=TEAL)
    set_run(run2, size=8, color=TEAL)
    set_run(run3, size=8, color=TEAL)
    r4 = fp.add_run("  /  ")
    set_run(r4, size=8, color=MUTED)
    run4 = fp.add_run()
    fld3 = OxmlElement("w:fldChar")
    fld3.set(qn("w:fldCharType"), "begin")
    run4._r.append(fld3)
    run5 = fp.add_run()
    instr2 = OxmlElement("w:instrText")
    instr2.set(qn("xml:space"), "preserve")
    instr2.text = " NUMPAGES "
    run5._r.append(instr2)
    run6 = fp.add_run()
    fld4 = OxmlElement("w:fldChar")
    fld4.set(qn("w:fldCharType"), "end")
    run6._r.append(fld4)
    set_run(run4, size=8, color=TEAL)
    set_run(run5, size=8, color=TEAL)
    set_run(run6, size=8, color=TEAL)

    # Empty first-page header/footer (cover)
    section.first_page_header.paragraphs[0].text = ""
    section.first_page_footer.paragraphs[0].text = ""


def cover_page(doc: Document):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0, 0)
    shade_cell(cell, NAVY)
    set_cell_margins(cell, 420, 360, 360, 360)
    set_cell_borders(
        cell,
        top={"val": "nil"},
        left={"val": "nil"},
        bottom={"val": "nil"},
        right={"val": "nil"},
    )
    set_row_height(table.rows[0], 14800)
    cell.text = ""

    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(8)
    r = p.add_run("UNIVERSIDADE JOAQUIM ALBERTO CHISSANO")
    set_run(r, size=10, bold=True, color="9FD5C8")

    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(18)
    r2 = p2.add_run("Prática Técnico-Profissional III  ·  Smart Campus Core")
    set_run(r2, size=11, color="C9D6E3")

    bar = cell.add_paragraph()
    bar.paragraph_format.space_after = Pt(22)
    rb = bar.add_run("━━━━━━━━━━━━━━━━━━━━")
    set_run(rb, size=12, color=TEAL)

    p3 = cell.add_paragraph()
    p3.paragraph_format.space_after = Pt(6)
    r3 = p3.add_run("Manual do Utilizador")
    set_run(r3, size=36, bold=True, color=WHITE, font="Calibri")

    p4 = cell.add_paragraph()
    p4.paragraph_format.space_after = Pt(18)
    r4 = p4.add_run("Tudo o que o sistema apresenta e faz,\nexplicado ecrã a ecrã.")
    set_run(r4, size=16, color="D7E4EE")

    p5 = cell.add_paragraph()
    p5.paragraph_format.space_after = Pt(6)
    r5 = p5.add_run("Guia prático para estudantes, docentes, tesouraria,\ncoordenação, técnicos e administração.")
    set_run(r5, size=12, color="A9BCCB")

    spacer = cell.add_paragraph()
    spacer.paragraph_format.space_before = Pt(48)
    rs = spacer.add_run(" ")
    set_run(rs, size=8, color=NAVY)

    meta = cell.add_paragraph()
    meta.paragraph_format.space_after = Pt(2)
    rm = meta.add_run("Novembro 2026  ·  Versão 1.0  ·  Maputo")
    set_run(rm, size=11, bold=True, color="9FD5C8")

    note = cell.add_paragraph()
    rn = note.add_run("Navegue pelo índice ou siga os grupos da barra lateral:\nHoje  ·  Pessoas e aulas  ·  Campus  ·  Operações  ·  Gestão")
    set_run(rn, size=10, color="C9D6E3")

    doc.add_page_break()


TOC_ENTRIES = [
    ("Como usar este manual", "como-usar", 1),
    ("1. Entrar e orientar-se", "cap-entrar", 1),
    ("    Ecrã de entrada", "scr-00-login", 2),
    ("    Barra lateral e cabeçalho", "nav-layout", 2),
    ("    Perfis de acesso", "perfis", 2),
    ("2. Hoje", "cap-hoje", 1),
    ("    Centro de operações", "scr-01-operacoes", 2),
    ("    Dashboard", "scr-02-dashboard", 2),
    ("    Notificações", "scr-03-notificacoes", 2),
    ("3. Pessoas e aulas", "cap-pessoas", 1),
    ("    Gestão académica", "scr-04-gestao-academica", 2),
    ("    Departamentos, cursos e disciplinas", "scr-05-departamentos", 2),
    ("    Utilizadores e perfis", "scr-08-utilizadores", 2),
    ("    Estudantes e docentes", "scr-09-estudantes", 2),
    ("    Inscrições", "scr-11-inscricoes", 2),
    ("    Horários", "scr-12-horarios", 2),
    ("    Assiduidade", "scr-13-assiduidade", 2),
    ("    Avaliações e notas", "scr-14-avaliacoes", 2),
    ("4. Campus", "cap-campus", 1),
    ("    Campus físico", "scr-15-campus-fisico", 2),
    ("    Gémeo digital", "scr-16-gemeo-digital", 2),
    ("    Edifícios, salas, laboratórios e equipamentos", "scr-17-edificios", 2),
    ("    Parque de viaturas", "scr-19-estacionamento", 2),
    ("5. Operações", "cap-ops", 1),
    ("    Rede IoT", "scr-22-iot", 2),
    ("    Dispositivos, sensores e leituras", "scr-23-dispositivos", 2),
    ("    Ocorrências e manutenção", "scr-26-ocorrencias", 2),
    ("    Alertas e relatórios", "scr-28-alertas", 2),
    ("6. Gestão financeira", "cap-fin", 1),
    ("    Dívidas e cobranças", "scr-30-financeiro", 2),
    ("    Contestações e avisos", "scr-30b-financeiro-contestacoes", 2),
    ("    Emissão de propina e resumo", "scr-30d-financeiro-propina", 2),
    ("    Salários e relatórios mensais", "scr-30f-financeiro-salarios", 2),
    ("    Políticas financeiras", "scr-30h-financeiro-politicas", 2),
    ("    Área financeira do estudante", "scr-33-financeiro-estudante", 2),
    ("7. Administração", "cap-admin", 1),
    ("    Administração do Core", "scr-31-administracao", 2),
    ("    Auditoria", "scr-32-auditoria", 2),
    ("8. O dia do estudante", "cap-estudante", 1),
    ("Anexo A · Matriz de acesso", "anexo-a", 1),
    ("Anexo B · Glossário rápido", "anexo-b", 1),
]


def toc_page(doc: Document):
    h = doc.add_heading("Índice", level=1)
    style_heading(h, 1, "Índice", "indice")
    add_body(
        doc,
        "Toque no título para saltar para o capítulo. A ordem segue a barra lateral do Smart Campus, para o manual se sentir como o próprio sistema.",
        color=MUTED,
        size=11,
    )

    table = doc.add_table(rows=0, cols=1)
    clear_table_borders(table)
    for label, anchor, level in TOC_ENTRIES:
        row = table.add_row()
        prevent_row_split(row)
        cell = row.cells[0]
        fill = WHITE if level == 1 else SOFT
        shade_cell(cell, fill)
        set_cell_margins(cell, 60, 60, 140 if level == 1 else 280, 120)
        left_color = TEAL if level == 1 else LINE
        set_cell_borders(
            cell,
            top={"val": "nil"},
            right={"val": "nil"},
            bottom={"val": "single", "sz": 4, "color": LINE},
            left={"val": "single", "sz": 16 if level == 1 else 6, "color": left_color},
        )
        cell.text = ""
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        add_internal_link(
            p,
            anchor,
            label.strip(),
            size=12 if level == 1 else 11,
            bold=level == 1,
            color=NAVY if level == 1 else TEAL,
        )
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(6)
    doc.add_page_break()


def how_to_use(doc: Document):
    h = doc.add_heading("Como usar este manual", level=1)
    style_heading(h, 1, "Como usar este manual", "como-usar")
    add_body(
        doc,
        "Este não é um documento técnico de construção. É o guia de quem abre o Smart Campus para trabalhar: ver o campus, marcar presenças, lançar notas, tratar uma ocorrência ou regularizar uma propina.",
    )
    add_body(doc, "Três formas rápidas de encontrar o que precisa:")
    add_bullets(
        doc,
        [
            "Pelo menu: os capítulos 2 a 7 copiam os grupos da barra esquerda (Hoje, Pessoas e aulas, Campus, Operações, Gestão).",
            "Pelo ecrã: cada painel tem captura, o que vê, o que pode fazer e quem acede.",
            "Pelo perfil: o anexo A diz o que cada papel vê. O capítulo 8 mostra o dia do estudante.",
        ],
    )

    groups = [
        ("Hoje", "O mapa ao vivo, o seu dia e as notificações."),
        ("Pessoas e aulas", "Cursos, inscrições, horários, presenças e notas."),
        ("Campus", "Edifícios, salas, gémeo 3D, parque e equipamentos."),
        ("Operações", "IoT, ocorrências, manutenção, alertas e relatórios."),
        ("Gestão", "Finanças, administração do Core e auditoria."),
    ]
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0].cells
    for i, title in enumerate(("Grupo no menu", "Para que serve")):
        shade_cell(hdr[i], NAVY)
        set_cell_margins(hdr[i], 80, 80, 120, 120)
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        r = p.add_run(title)
        set_run(r, size=10, bold=True, color=WHITE)
    for i, (name, desc) in enumerate(groups):
        row = table.add_row()
        prevent_row_split(row)
        a, b = row.cells
        fill = SOFT if i % 2 == 0 else WHITE
        for cell, text, bold in ((a, name, True), (b, desc, False)):
            shade_cell(cell, fill)
            set_cell_margins(cell, 70, 70, 120, 120)
            set_cell_borders(
                cell,
                top={"color": LINE},
                left={"color": LINE},
                bottom={"color": LINE},
                right={"color": LINE},
            )
            cell.text = ""
            p = cell.paragraphs[0]
            r = p.add_run(text)
            set_run(r, size=11, bold=bold, color=NAVY if bold else INK)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(8)
    callout(
        doc,
        "Dica de leitura",
        "Nas capturas, o menu esquerdo é o mesmo em quase todos os ecrãs. Use-o como mapa. No telemóvel, o botão Menu abre a mesma lista.",
    )


def screen(
    doc: Document,
    *,
    title: str,
    bookmark: str,
    shot: str,
    caption: str,
    path: str,
    who: str,
    sees: str,
    does: list[str],
    note: str | None = None,
    level: int = 2,
):
    h = doc.add_heading(title, level=level)
    style_heading(h, level, title, bookmark)
    meta_row(doc, [("Caminho", path), ("Quem acede", who)])
    add_screenshot(doc, shot, caption)
    add_body(doc, sees)
    if does:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run("O que pode fazer")
        set_run(r, size=12, bold=True, color=NAVY)
        add_bullets(doc, does)
    if note:
        callout(doc, "Atenção", note, fill="F8F1E8", accent=GOLD)


def build_content(doc: Document):
    how_to_use(doc)

    h = doc.add_heading("1. Entrar e orientar-se", level=1)
    style_heading(h, 1, "1. Entrar e orientar-se", "cap-entrar")
    add_body(
        doc,
        "O Smart Campus é a plataforma académica da UJAC: um espaço comum para aulas, operações do edifício D2 e tesouraria. Abre no browser em http://localhost:5173 (laboratório) ou no endereço institucional em produção.",
    )

    screen(
        doc,
        title="Ecrã de entrada",
        bookmark="scr-00-login",
        shot="00-login.png",
        caption="Figura 1. Página de entrada — «Um campus que pensa consigo.»",
        path="/login",
        who="Visitantes (ainda sem sessão)",
        sees="À esquerda, a marca Smart Campus e o convite à plataforma da UJAC. À direita, o cartão Bem-vindo com email institucional e password. O botão verde Entrar no campus inicia a sessão.",
        does=[
            "Introduzir o email e a password da conta institucional.",
            "Carregar em Entrar no campus — se a autenticação for válida, o sistema abre o Centro de operações (/ops).",
            "Se a API estiver indisponível, aparece um aviso para aguardar e tentar de novo.",
        ],
        note="As contas de demonstração (admin@smartcampus.demo, estudante@smartcampus.demo, etc.) existem só em desenvolvimento. Em produção usa-se a conta real atribuída pela universidade.",
    )

    h2 = doc.add_heading("Barra lateral e cabeçalho", level=2)
    style_heading(h2, 2, "Barra lateral e cabeçalho", "nav-layout")
    add_body(
        doc,
        "Depois de entrar, o ecrã divide-se em três zonas estáveis. São o «guião» de todo o resto do manual.",
    )
    add_bullets(
        doc,
        [
            "Menu esquerdo (azul-petróleo): grupos Hoje, Pessoas e aulas, Campus, Operações e Gestão. Só aparecem os módulos permitidos ao seu papel.",
            "Cabeçalho: mostra a área actual, o sino de notificações (com contador se houver por ler) e o estado Core activo.",
            "Rodapé do menu: o seu nome, o papel (Administrador, Estudante, …) e o botão Terminar sessão.",
        ],
    )
    callout(
        doc,
        "No telemóvel",
        "O menu fica escondido. O botão Menu no canto superior abre a mesma navegação; Fechar ou tocar fora devolve-o ao conteúdo.",
    )

    h2 = doc.add_heading("Perfis de acesso", level=2)
    style_heading(h2, 2, "Perfis de acesso", "perfis")
    add_body(
        doc,
        "O sistema não mostra o mesmo a toda a gente. O papel da conta decide o menu, os botões de criar/editar e, no financeiro, se vê o campus inteiro ou só a sua pasta.",
    )
    roles = [
        ("Administrador", "Vê tudo. Cria contas, define políticas financeiras e limiares IoT."),
        ("Coordenador", "Gere a vida académica, horários, utilizadores e auditoria."),
        ("Docente", "Horários, assiduidade e notas das suas disciplinas."),
        ("Estudante", "O seu perfil, inscrições, notas, presenças e a sua pasta financeira."),
        ("Financeiro", "Tesouraria: dívidas, propinas, salários e relatórios."),
        ("Técnico", "Campus, IoT, ocorrências, manutenção e parque."),
    ]
    table = doc.add_table(rows=1, cols=2)
    hdr = table.rows[0].cells
    for i, t in enumerate(("Papel", "O que faz no dia-a-dia")):
        shade_cell(hdr[i], TEAL)
        set_cell_margins(hdr[i], 80, 80, 120, 120)
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        r = p.add_run(t)
        set_run(r, size=10, bold=True, color=WHITE)
    for i, (role, desc) in enumerate(roles):
        row = table.add_row()
        prevent_row_split(row)
        fill = SOFT if i % 2 == 0 else WHITE
        for cell, text, bold in ((row.cells[0], role, True), (row.cells[1], desc, False)):
            shade_cell(cell, fill)
            set_cell_margins(cell, 70, 70, 120, 120)
            set_cell_borders(
                cell,
                top={"color": LINE},
                left={"color": LINE},
                bottom={"color": LINE},
                right={"color": LINE},
            )
            cell.text = ""
            p = cell.paragraphs[0]
            r = p.add_run(text)
            set_run(r, size=11, bold=bold, color=NAVY if bold else INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # HOJE
    h = doc.add_heading("2. Hoje", level=1)
    style_heading(h, 1, "2. Hoje", "cap-hoje")
    add_body(
        doc,
        "O grupo Hoje é o ponto de partida de qualquer sessão: o pulso do campus, o resumo do seu dia e a caixa de notificações.",
    )

    screen(
        doc,
        title="Centro de operações",
        bookmark="scr-01-operacoes",
        shot="01-operacoes.png",
        caption="Figura 2. Centro de operações — mapa do D2, ocupação e alertas ao vivo.",
        path="/ops",
        who="Todos os utilizadores autenticados",
        sees="Mapa do edifício D2 com salas coloridas pela métrica escolhida (ocupação, temperatura, CO₂ ou humidade). À direita, o edifício seleccionado com cartões ambientais. Em baixo, o padrão semanal de ocupação, a lista de alertas ao vivo e a actividade recente. O pulso circular resume quantas pessoas estão em sessão.",
        does=[
            "Trocar a métrica do mapa (Ocupação, Temperatura, CO₂, Humidade).",
            "Clicar num edifício ou sala para abrir o painel de detalhe.",
            "Seguir atalhos para Salas, Ocorrências, Dispositivos, Gémeo 3D ou Dashboard.",
            "Abrir um alerta da lista para ir ao módulo de Alertas.",
        ],
    )

    screen(
        doc,
        title="Dashboard",
        bookmark="scr-02-dashboard",
        shot="02-dashboard.png",
        caption="Figura 3. Dashboard — o seu dia no campus, com indicadores e atalhos.",
        path="/dashboard",
        who="Todos os utilizadores autenticados",
        sees="Saudação com o seu primeiro nome, o papel com que entrou e o estado do Core. Cartões de salas, ocorrências abertas e outros indicadores. Atalhos agrupados em Vida académica e Campus e operações. Só vê os módulos que o seu papel permite.",
        does=[
            "Ler o estado do Core (Tudo a funcionar / Atenção necessária).",
            "Abrir o mapa ao vivo.",
            "Saltar para horários, assiduidade, avaliações, campus ou IoT pelos atalhos.",
        ],
    )

    screen(
        doc,
        title="Notificações",
        bookmark="scr-03-notificacoes",
        shot="03-notificacoes.png",
        caption="Figura 4. Caixa de notificações em tempo real.",
        path="/notifications",
        who="Todos os utilizadores autenticados",
        sees="Lista das notificações mais recentes, da nova para a antiga. As não lidas têm destaque. O cabeçalho indica quantas estão por ler e se a ligação em tempo real está activa. O sino no topo da aplicação leva sempre aqui.",
        does=[
            "Ler o título e o corpo de cada aviso (financeiro, académico ou operacional).",
            "Marcar como lida as que já tratou.",
            "Confirmar o estado Ligado em tempo real — se estiver desligado, actualize a página.",
        ],
    )

    # PESSOAS
    h = doc.add_heading("3. Pessoas e aulas", level=1)
    style_heading(h, 1, "3. Pessoas e aulas", "cap-pessoas")
    add_body(
        doc,
        "Tudo o que faz a universidade funcionar no papel: estrutura académica, contas, estudantes, docentes, inscrições, horários, presenças e notas. O hub Gestão académica é a porta de entrada; departamentos, cursos e disciplinas também se abrem a partir daí.",
    )

    screen(
        doc,
        title="Gestão académica",
        bookmark="scr-04-gestao-academica",
        shot="04-gestao-academica.png",
        caption="Figura 5. Hub académico — atalhos para o dia lectivo e para o directório.",
        path="/academic",
        who="Todos os utilizadores autenticados",
        sees="Contadores de estudantes, cursos e sessões de horário. Cartões em destaque para avaliações, horários e assiduidade. Directório para departamentos, cursos, disciplinas, estudantes, docentes e inscrições. Um guião de três passos: confirmar horários, marcar presenças, lançar notas.",
        does=[
            "Abrir Horários de hoje ou Avaliações pelos botões do topo.",
            "Entrar num cartão do directório para cadastrar ou consultar.",
            "Usar este ecrã como mapa se ainda não souber onde está cada função.",
        ],
    )

    screen(
        doc,
        title="Departamentos",
        bookmark="scr-05-departamentos",
        shot="05-departamentos.png",
        caption="Figura 6. Cadastro de departamentos.",
        path="/departments",
        who="Consulta: todos · Criar/eliminar: coordenação e administração",
        sees="Tabela com código, nome e descrição de cada departamento. Quem gere vê o formulário Novo departamento no topo e a coluna Acções.",
        does=[
            "Consultar a estrutura da universidade.",
            "Criar um departamento (código, nome, descrição opcional).",
            "Eliminar um departamento que já não esteja em uso.",
        ],
        note="Departamentos, cursos e disciplinas não estão no menu esquerdo. Abrem-se pelo hub Gestão académica ou pelo URL directo.",
    )

    screen(
        doc,
        title="Cursos",
        bookmark="scr-06-cursos",
        shot="06-cursos.png",
        caption="Figura 7. Catálogo de cursos, organizado por departamento.",
        path="/courses",
        who="Consulta: todos · Criar: coordenação e administração",
        sees="Formulário de novo curso (quando autorizado) e tabela do catálogo, com ligação ao departamento de origem.",
        does=[
            "Ver os programas disponíveis para inscrição.",
            "Criar um curso e associá-lo a um departamento.",
            "Usar o curso depois em estudantes, disciplinas, horários e emissão de propina.",
        ],
    )

    screen(
        doc,
        title="Disciplinas",
        bookmark="scr-07-disciplinas",
        shot="07-disciplinas.png",
        caption="Figura 8. Disciplinas e planos curriculares.",
        path="/subjects",
        who="Consulta: todos · Criar: coordenação e administração",
        sees="Lista de disciplinas com código, nome e curso. O formulário pede o curso pai antes de criar a disciplina.",
        does=[
            "Consultar o plano curricular de um curso.",
            "Criar disciplinas que depois recebem inscrições, horários, presenças e avaliações.",
        ],
    )

    screen(
        doc,
        title="Utilizadores e perfis",
        bookmark="scr-08-utilizadores",
        shot="08-utilizadores.png",
        caption="Figura 9. Contas, papéis e estado de acesso.",
        path="/users",
        who="Administrador e coordenador",
        sees="Contadores de contas, contas activas e contas ainda sem perfil académico. Filtro por papel e pesquisa por nome ou email. Formulário de nova conta (só administrador). Tabela com activar/desactivar.",
        does=[
            "Criar a conta (email, password, nome completo e papel).",
            "Filtrar por Estudante, Docente, Técnico, Coordenador, Administrador ou Financeiro.",
            "Activar ou desactivar o acesso de uma conta.",
            "A seguir, ligar o perfil académico em Estudantes ou Docentes — sem repetir email e password.",
        ],
        note="Criar a conta aqui não chega para um estudante se inscrever. É preciso o perfil académico na página Estudantes.",
    )

    screen(
        doc,
        title="Estudantes",
        bookmark="scr-09-estudantes",
        shot="09-estudantes.png",
        caption="Figura 10. Lista de estudantes (visão de gestão).",
        path="/students",
        who="Docente, coordenador e administrador (lista) · Estudante (só o seu perfil)",
        sees="Na gestão: formulário Criar perfil de estudante (ligar uma conta já existente a número, curso e ano) e tabela de todos os perfis. No estudante: o ecrã muda para O meu perfil — ver capítulo 8.",
        does=[
            "Seleccionar uma conta de estudante ainda sem perfil.",
            "Atribuir número de estudante, curso e ano de estudo.",
            "Consultar o estado académico de cada estudante.",
        ],
    )

    screen(
        doc,
        title="Docentes",
        bookmark="scr-10-docentes",
        shot="10-docentes.png",
        caption="Figura 11. Perfis e afectação de docentes.",
        path="/teachers",
        who="Estudante (consulta limitada), docente, coordenador e administrador",
        sees="Formulário para ligar uma conta de docente a um perfil (código de colaborador, departamento) e tabela de docentes activos.",
        does=[
            "Criar o perfil de docente a partir de uma conta já existente.",
            "Consultar a afectação departamental.",
            "Usar estes perfis depois em horários e na folha de salários.",
        ],
    )

    screen(
        doc,
        title="Inscrições",
        bookmark="scr-11-inscricoes",
        shot="11-inscricoes.png",
        caption="Figura 12. Inscrições em disciplinas por ano lectivo.",
        path="/enrolments",
        who="Estudante, docente, coordenador e administrador",
        sees="Formulário Nova inscrição (estudante, disciplina, ano lectivo). O estudante só se inscreve a si próprio e só em disciplinas do seu curso. A tabela lista inscrições com estado (pendente, activa, etc.).",
        does=[
            "Inscrever um estudante numa disciplina do seu curso.",
            "Acompanhar o estado da inscrição.",
            "Coordenação: alterar o estado (por exemplo, activar).",
        ],
        note="Uma inscrição activa pode ser recusada se o estudante estiver bloqueado financeiramente. Regularize a pasta em Gestão financeira antes de insistir.",
    )

    screen(
        doc,
        title="Horários",
        bookmark="scr-12-horarios",
        shot="12-horarios.png",
        caption="Figura 13. Grelha de horários lectivos.",
        path="/schedules",
        who="Estudante, docente, coordenador e administrador",
        sees="Lista ou grelha de sessões (aula, laboratório, avaliação) com curso, disciplina, sala, docente e intervalo horário. Coordenador e administrador vêem o formulário de criar/editar/eliminar.",
        does=[
            "Consultar o que decorre hoje e ao longo da semana.",
            "Filtrar por curso, disciplina ou sala, consoante os controlos do ecrã.",
            "Criar, editar ou eliminar sessões (coordenação e administração).",
        ],
    )

    screen(
        doc,
        title="Assiduidade",
        bookmark="scr-13-assiduidade",
        shot="13-assiduidade.png",
        caption="Figura 14. Registo de presenças por sessão de horário.",
        path="/attendance",
        who="Estudante (consulta do próprio), docente, coordenador e administrador",
        sees="Selecção da sessão de horário e lista dos inscritos activos na disciplina, com presença, falta, atraso ou justificação. O estudante vê só o seu histórico.",
        does=[
            "Escolher a sessão de horário.",
            "Marcar presenças, faltas, atrasos e justificações (docente nas suas sessões; coordenação em todas).",
            "O estudante consulta o seu registo, sem editar o dos colegas.",
        ],
    )

    screen(
        doc,
        title="Avaliações e notas",
        bookmark="scr-14-avaliacoes",
        shot="14-avaliacoes.png",
        caption="Figura 15. Criação de avaliações e lançamento de notas.",
        path="/assessments",
        who="Estudante (pauta), docente, coordenador e administrador",
        sees="Do lado da gestão: criar avaliações por disciplina e lançar notas dos inscritos. Do lado do estudante: pauta por disciplina (admissão, exames e situação) e o detalhe das avaliações já publicadas.",
        does=[
            "Criar uma avaliação (teste, exame, trabalho) numa disciplina.",
            "Lançar notas e publicar a pauta quando a turma puder ver os resultados.",
            "O estudante consulta a situação por disciplina, sem editar.",
        ],
        note="Se o estudante estiver bloqueado financeiramente, o lançamento de notas pode ficar condicionado. A tesouraria trata o desbloqueio.",
    )

    # CAMPUS
    h = doc.add_heading("4. Campus", level=1)
    style_heading(h, 1, "4. Campus", "cap-campus")
    add_body(
        doc,
        "O espaço físico da UJAC: o D2 em mapa e em 3D, o cadastro de edifícios e salas, o parque de viaturas, laboratórios e equipamentos.",
    )

    screen(
        doc,
        title="Campus físico",
        bookmark="scr-15-campus-fisico",
        shot="15-campus-fisico.png",
        caption="Figura 16. Hub do campus — ocupação viva e atalhos para o D2.",
        path="/campus",
        who="Todos os utilizadores autenticados",
        sees="Cartões de edifícios, salas ocupadas neste momento e pessoas no D2. Atalhos para o mapa operacional e para o gémeo 3D. Directório de cadastro: edifícios, salas, parque, manutenção, laboratórios e equipamentos.",
        does=[
            "Abrir o mapa operacional ou o gémeo 3D.",
            "Ver quantas salas estão ocupadas agora.",
            "Saltar para o cadastro que precisa de actualizar.",
        ],
    )

    screen(
        doc,
        title="Gémeo digital",
        bookmark="scr-16-gemeo-digital",
        shot="16-gemeo-digital.png",
        caption="Figura 17. Modelo 3D esquemático do D2, com ocupação ao vivo.",
        path="/campus/twin",
        who="Todos os utilizadores autenticados",
        sees="Volume 3D do D2 gerado a partir do cadastro de salas. Cores segundo ocupação, temperatura ou CO₂. Painel da sala seleccionada com pessoas, ambiente e atalhos. O pulso resume a ocupação actual.",
        does=[
            "Rodar e explorar o modelo.",
            "Clicar numa sala para ver ocupação e ambiente.",
            "Trocar a métrica entre Ocupação, Temperatura e CO₂.",
        ],
    )

    screen(
        doc,
        title="Edifícios",
        bookmark="scr-17-edificios",
        shot="17-edificios.png",
        caption="Figura 18. Cadastro de edifícios, incluindo o D2.",
        path="/buildings",
        who="Consulta: todos · Criar/editar/eliminar: perfis de gestão do campus",
        sees="Formulário Novo edifício (código, nome, descrição, pisos, posição no mapa) e tabela com pisos e número de salas.",
        does=[
            "Registar um edifício novo e posicioná-lo no mapa (coordenadas 0–100).",
            "Editar nome, descrição ou pisos.",
            "Eliminar um edifício sem salas associadas.",
        ],
    )

    screen(
        doc,
        title="Salas",
        bookmark="scr-18-salas",
        shot="18-salas.png",
        caption="Figura 19. Salas e disponibilidade por edifício.",
        path="/rooms",
        who="Consulta: todos · Criar: gestão do campus",
        sees="Formulário de nova sala (edifício, código, nome, capacidade, piso) e tabela de salas do campus, usadas depois em horários, IoT e ocorrências.",
        does=[
            "Cadastrar uma sala dentro de um edifício.",
            "Consultar capacidade e piso.",
            "Usar a sala em horários, sensores e pedidos de manutenção.",
        ],
    )

    screen(
        doc,
        title="Parque de viaturas",
        bookmark="scr-19-estacionamento",
        shot="19-estacionamento.png",
        caption="Figura 20. Mapa de vagas e leituras de matrícula.",
        path="/parking",
        who="Todos consultam · Técnico, coordenador e administrador gerem",
        sees="Grelha de vagas (livre, ocupada, reservada, indisponível), detalhe da vaga seleccionada e histórico de leituras LPR. Em modo laboratório, o administrador tem um formulário DEMO para simular uma matrícula.",
        does=[
            "Ver que vagas estão livres agora.",
            "Seleccionar uma vaga para o detalhe.",
            "Consultar as últimas matrículas lidas.",
            "Administrador: activar o modo laboratório LPR em Administração e injectar uma leitura de teste.",
        ],
    )

    screen(
        doc,
        title="Laboratórios",
        bookmark="scr-20-laboratorios",
        shot="20-laboratorios.png",
        caption="Figura 21. Laboratórios e espaços técnicos.",
        path="/laboratories",
        who="Consulta: todos · Criar: gestão do campus",
        sees="Formulário associado a um edifício e lista de laboratórios — espaços técnicos distintos das salas lectivas.",
        does=[
            "Registar um laboratório e ligá-lo a um edifício.",
            "Consultar o inventário de espaços técnicos.",
        ],
    )

    screen(
        doc,
        title="Equipamentos",
        bookmark="scr-21-equipamentos",
        shot="21-equipamentos.png",
        caption="Figura 22. Inventário de equipamentos por sala ou laboratório.",
        path="/equipment",
        who="Consulta: todos · Criar: gestão do campus",
        sees="Cadastro de equipamentos (nome, tipo, localização) e tabela de inventário.",
        does=[
            "Registar um equipamento e associá-lo a uma sala ou laboratório.",
            "Consultar o que existe em cada espaço, útil para manutenção.",
        ],
    )

    # OPERAÇÕES
    h = doc.add_heading("5. Operações", level=1)
    style_heading(h, 1, "5. Operações", "cap-ops")
    add_body(
        doc,
        "A rede inteligente do campus: sensores, dispositivos ESP32, leituras MQTT, ocorrências, manutenção, alertas e relatórios agregados.",
    )

    screen(
        doc,
        title="Rede IoT",
        bookmark="scr-22-iot",
        shot="22-iot.png",
        caption="Figura 23. Hub IoT — nós visíveis, pulso e pipeline Sensor → Dashboard.",
        path="/iot",
        who="Todos os utilizadores autenticados",
        sees="Quantos nós estão online, cartões de dispositivos com última leitura, e o encadeamento Sensor → ESP32 → Wi-Fi → MQTT → API → Dashboard. Ao seleccionar um dispositivo, vê os alertas associados.",
        does=[
            "Escolher um dispositivo para ver sensores e alertas.",
            "Perceber se o broker MQTT está a alimentar o Core.",
            "Saltar para Dispositivos, Sensores ou Leituras para o detalhe.",
        ],
    )

    screen(
        doc,
        title="Dispositivos",
        bookmark="scr-23-dispositivos",
        shot="23-dispositivos.png",
        caption="Figura 24. Inventário de dispositivos ESP32, com sala associada.",
        path="/devices",
        who="Consulta: todos · Registo: técnico, coordenação, administração",
        sees="Lista de dispositivos com estado (online/offline), sala e sensores. Formulário para registar um novo nó no Core.",
        does=[
            "Registar um dispositivo e associá-lo a uma sala.",
            "Ver quais estão offline — o Centro de operações também o assinala.",
            "Abrir o dispositivo para ligar sensores.",
        ],
    )

    screen(
        doc,
        title="Sensores",
        bookmark="scr-24-sensores",
        shot="24-sensores.png",
        caption="Figura 25. Sensores e limiares de alerta ambiental.",
        path="/sensors",
        who="Consulta: todos · Criar: gestão técnica",
        sees="Sensores ligados a dispositivos, métrica (temperatura, CO₂, humidade, ocupação) e limiares que disparam alertas.",
        does=[
            "Associar um sensor a um dispositivo.",
            "Definir limiares de aviso e crítico.",
            "Acompanhar a métrica que depois aparece no mapa e no gémeo.",
        ],
    )

    screen(
        doc,
        title="Leituras",
        bookmark="scr-25-leituras",
        shot="25-leituras.png",
        caption="Figura 26. Histórico de valores persistidos pelos sensores.",
        path="/readings",
        who="Todos os utilizadores autenticados",
        sees="Tabela de leituras com valor, métrica e carimbo de tempo. As que vêm do MQTT são dados reais; as de demonstração aparecem marcadas como DEMO.",
        does=[
            "Confirmar se o sensor está a publicar.",
            "Distinguir dados reais de dados de seed/demonstração.",
            "Usar esta página quando um alerta ambiental precisa de contexto.",
        ],
    )

    screen(
        doc,
        title="Ocorrências",
        bookmark="scr-26-ocorrencias",
        shot="26-ocorrencias.png",
        caption="Figura 27. Pedidos de manutenção por sala, com prioridade e estado.",
        path="/incidents",
        who="Todos podem registar · Tratamento: técnico, coordenação, administração",
        sees="Formulário Registar ocorrência (título, prioridade, sala, descrição) e cartões de cada pedido com estado (aberta, em curso, resolvida, fechada) e prioridade.",
        does=[
            "Abrir uma ocorrência numa sala.",
            "Acompanhar o estado.",
            "Quem trata: passar a Em curso, Resolvida ou Fechada.",
        ],
    )

    screen(
        doc,
        title="Manutenção",
        bookmark="scr-27-manutencao",
        shot="27-manutencao.png",
        caption="Figura 28. Acções de manutenção ligadas a ocorrências.",
        path="/maintenance",
        who="Perfis operacionais e de gestão",
        sees="Lista de acções (abertura, execução, fecho) associadas a uma ocorrência já existente. Formulário para criar uma acção escolhendo a ocorrência.",
        does=[
            "Abrir uma acção de manutenção sobre uma ocorrência.",
            "Registar execução e fecho.",
            "Manter o rasto entre o pedido e o trabalho feito.",
        ],
    )

    screen(
        doc,
        title="Alertas",
        bookmark="scr-28-alertas",
        shot="28-alertas.png",
        caption="Figura 29. Alertas operacionais e de sensores.",
        path="/alerts",
        who="Consulta: todos · Confirmar: técnico, coordenação, administração",
        sees="Lista de eventos (dispositivo offline, limiar ambiental, etc.). Os dados fictícios estão identificados como demonstração. Filtro possível por dispositivo.",
        does=[
            "Ler a gravidade (aviso, crítico).",
            "Confirmar / marcar como tratado os alertas reais.",
            "Ignorar os marcados como DEMO em contexto de laboratório.",
        ],
    )

    screen(
        doc,
        title="Relatórios",
        bookmark="scr-29-relatorios",
        shot="29-relatorios.png",
        caption="Figura 30. Indicadores agregados do campus, com exportação CSV/PDF.",
        path="/reports",
        who="Todos os utilizadores autenticados",
        sees="Resumo em tempo real: salas ocupadas, ocupação %, ocorrências abertas, dispositivos online, leituras da última hora. Tabelas de salas, leituras recentes e ocorrências.",
        does=[
            "Ler o pulso operacional do dia.",
            "Exportar CSV para análise em folha de cálculo.",
            "Exportar PDF com o resumo para arquivo ou reunião.",
        ],
    )

    # FINANCEIRO
    h = doc.add_heading("6. Gestão financeira", level=1)
    style_heading(h, 1, "6. Gestão financeira", "cap-fin")
    add_body(
        doc,
        "A tesouraria do campus: dívidas (propina, taxa, multa ou outra), pagamentos, contestações, avisos, salários de funcionários e relatórios em meticais. O administrador e o perfil Financeiro consultam dados do campus; o estudante vê só a sua pasta. As operações disponíveis dependem do perfil.",
    )
    callout(
        doc,
        "Quem entra aqui",
        "Apenas Estudante, Financeiro e Administrador têm acesso à área financeira, com opções diferentes conforme o perfil. A tesouraria demo usa financas@smartcampus.demo.",
    )
    callout(
        doc,
        "Guia interactivo",
        "Na página financeira, escolha ? Guia e seleccione um caso disponível para o seu perfil. O guia destaca as áreas relacionadas e permite avançar, voltar ou fechar com Esc. Não realiza operações automaticamente; algumas etapas exigem seleccionar um estudante ou ter dados disponíveis.",
    )
    callout(
        doc,
        "Sobre as imagens",
        "As capturas desta secção são de uma versão anterior e podem mostrar nomes e opções diferentes dos actuais. Para os passos actualizados consulte o manual financeiro editável do projecto.",
    )

    screen(
        doc,
        title="Dívidas e cobranças",
        bookmark="scr-30-financeiro",
        shot="30-financeiro.png",
        caption="Figura 31. Gestão financeira — lista de dívidas de todo o campus.",
        path="/financial  →  separador Dívidas",
        who="Administrador e Financeiro (campus) · Estudante (as suas)",
        sees="O Financeiro escolhe um estudante para ver dívidas e efectuar operações. O Administrador usa Consultar estudante para consulta; o Estudante vê a sua pasta. A lista permite filtrar por estado, origem e data.",
        does=[
            "Filtrar as dívidas do estudante seleccionado por estado, origem ou data de vencimento.",
            "O Financeiro selecciona um estudante para emitir uma dívida individual.",
            "O Financeiro regista um pagamento já efectuado e pode imprimir o recibo.",
            "O Financeiro pode cancelar uma dívida indevida.",
            "O estudante consulta as suas dívidas e pede análise se discordar.",
        ],
    )

    screen(
        doc,
        title="Pasta de um estudante",
        bookmark="scr-30i-financeiro-estudante",
        shot="30i-financeiro-estudante.png",
        caption="Figura 32. Dívidas de um estudante seleccionado, com faixa de situação.",
        path="/financial  →  seleccionar estudante",
        who="Administrador e Financeiro",
        sees="Pesquisa por nome ou matrícula, botão Seleccionar e faixa de situação financeira (Regular ou Bloqueada). O formulário de nova cobrança está disponível ao Financeiro.",
        does=[
            "Pesquisar por nome ou número de estudante.",
            "Trocar ou limpar a selecção para consultar outra pessoa.",
            "O Financeiro pode emitir cobrança e registar pagamento; o estudante pode contestar uma dívida concreta.",
        ],
    )

    screen(
        doc,
        title="Histórico de pagamentos",
        bookmark="scr-30j-financeiro-historico",
        shot="30j-financeiro-historico.png",
        caption="Figura 33. Histórico de pagamentos confirmados do estudante.",
        path="/financial  →  Histórico de pagamentos",
        who="Gestão (com estudante seleccionado) · Estudante (o próprio)",
        sees="Situação financeira, total pago e valor em aberto. Tabela de pagamentos com data, código, valor, método, referência e botão de recibo.",
        does=[
            "Confirmar o que já foi pago e o que resta.",
            "Imprimir o recibo de um pagamento.",
            "Perceber que uma dívida regularizada por contestação não conta como pagamento.",
        ],
        note="Este separador pede um estudante. Sem selecção, a gestão vê o convite «Seleccione um estudante».",
    )

    screen(
        doc,
        title="Contestações",
        bookmark="scr-30b-financeiro-contestacoes",
        shot="30b-financeiro-contestacoes.png",
        caption="Figura 34. Fila de contestações, com prazo de análise (SLA).",
        path="/financial  →  Contestações",
        who="Gestão vê todas · Estudante vê as suas",
        sees="Pedidos de análise sobre dívidas. Cada cartão traz o título da dívida, o valor, o motivo, a data e o prazo de análise. Se o prazo passou, aparece o aviso SLA ultrapassado. A gestão filtra por pendente, aceite ou rejeitada.",
        does=[
            "O estudante submete uma contestação a partir da dívida.",
            "O Financeiro escolhe Analisar e decide: aceitar (PROCEDENTE) ou rejeitar (IMPROCEDENTE), com notas; o Administrador consulta.",
            "Filtrar as pendentes para trabalhar a fila do dia.",
        ],
    )

    screen(
        doc,
        title="Avisos financeiros",
        bookmark="scr-30c-financeiro-avisos",
        shot="30c-financeiro-avisos.png",
        caption="Figura 35. Fila de avisos de todo o campus, com estado de entrega.",
        path="/financial  →  Avisos",
        who="Gestão (fila do campus) · Estudante (os seus avisos)",
        sees="Mensagens associadas ao estudante seleccionado. A gestão pode consultar o estado de envio; o Financeiro pode tentar novamente avisos pendentes ou falhados.",
        does=[
            "Consultar o conteúdo e o estado de envio do aviso.",
            "O Financeiro pode reenviar um aviso pendente ou falhado.",
        ],
        note="O estado de envio não confirma que o estudante leu a mensagem.",
    )

    screen(
        doc,
        title="Emissão de propina",
        bookmark="scr-30d-financeiro-propina",
        shot="30d-financeiro-propina.png",
        caption="Figura 36. Emissão em lote a partir das inscrições activas de um curso.",
        path="/financial  →  Emissão de propina",
        who="Financeiro",
        sees="Formulário com curso, ano lectivo, valor, data de vencimento e título opcional. O Core cria uma dívida de origem Propina para cada inscrição activa que ainda não tenha esta cobrança em aberto.",
        does=[
            "Escolher o curso e o ano lectivo.",
            "Definir valor (MZN) e vencimento.",
            "Emitir — o sistema indica quantas foram criadas e quantas já existiam.",
        ],
    )

    screen(
        doc,
        title="Resumo do campus",
        bookmark="scr-30e-financeiro-resumo",
        shot="30e-financeiro-resumo.png",
        caption="Figura 37. Totais em meticais e lista de estudantes bloqueados.",
        path="/financial  →  Resumo do campus",
        who="Financeiro",
        sees="Contagens (total de dívidas, pendentes, vencidas, regularizadas, canceladas, pagamentos, bloqueados) e totais em MZN: em aberto, vencido e recebido este mês. Tabela de estudantes bloqueados com matrícula, dívidas vencidas e valor em atraso.",
        does=[
            "Ler o pulso da tesouraria no mês corrente (hora de Maputo).",
            "Identificar quem está bloqueado pela política actual.",
            "Usar estes números em reunião sem exportar nada extra.",
        ],
    )

    screen(
        doc,
        title="Funcionários e salários",
        bookmark="scr-30f-financeiro-salarios",
        shot="30f-financeiro-salarios.png",
        caption="Figura 38. Área salarial (captura de versão anterior).",
        path="/financial  →  Funcionários",
        who="Financeiro propõe e regista pagamentos · Administrador aprova ou rejeita",
        sees="Pesquisa de funcionários, propostas salariais e pagamentos mensais. O salário só muda após aprovação do Administrador. A área abrange docentes e outras categorias de funcionários.",
        does=[
            "O Financeiro selecciona um funcionário, propõe o salário e apresenta a justificação.",
            "O Administrador analisa a proposta e aprova ou rejeita com uma nota.",
            "Depois da aprovação, o Financeiro gera o salário mensal e regista o pagamento já efectuado; o comprovativo pode ser impresso.",
        ],
        note="O cadastro financeiro externo não substitui a gestão académica ou de recursos humanos. O registo não executa uma transferência bancária.",
    )

    screen(
        doc,
        title="Relatórios mensais",
        bookmark="scr-30g-financeiro-mensal",
        shot="30g-financeiro-mensal.png",
        caption="Figura 39. Relatório mensal de pagamentos ou de salários, para impressão.",
        path="/financial  →  Relatórios mensais",
        who="Administrador e Financeiro",
        sees="Escolha entre Pagamentos dos estudantes e Salários pagos aos funcionários, mais o mês. O relatório lista os movimentos efectivamente registados, pela hora de Moçambique, com totais em MZN e opção de imprimir.",
        does=[
            "Escolher o tipo de relatório e o mês.",
            "Rever totais e linhas.",
            "Imprimir para arquivo da tesouraria.",
        ],
    )

    screen(
        doc,
        title="Políticas financeiras",
        bookmark="scr-30h-financeiro-politicas",
        shot="30h-financeiro-politicas.png",
        caption="Figura 40. Regras globais: carência, tecto de dívida e bloqueio automático.",
        path="/financial  →  Políticas financeiras",
        who="Apenas administrador (o botão só aparece nesse perfil)",
        sees="Painel com período de carência em dias (SLA das contestações e graça antes do vencimento), valor máximo de dívida e interruptor de bloqueio automático. Ao gravar, o Core recalcula a situação dos estudantes.",
        does=[
            "Abrir o botão Políticas financeiras no topo da página.",
            "Ajustar carência, tecto e bloqueio automático.",
            "Guardar — os estudantes podem passar a Regular ou Bloqueado conforme a nova regra.",
        ],
        note="Um estudante bloqueado não activa inscrições novas e pode ficar impedido em avaliações até regularizar.",
    )

    screen(
        doc,
        title="Área financeira do estudante",
        bookmark="scr-33-financeiro-estudante",
        shot="33-financeiro-estudante.png",
        caption="Figura 41. A mesma página, vista pelo estudante — só a sua pasta.",
        path="/financial",
        who="Estudante",
        sees="Os separadores Dívidas, Histórico, Contestações e Avisos, sem pesquisa de colegas nem emissão de propina. A faixa de topo diz se a situação está Regular ou Bloqueada.",
        does=[
            "Ver o que deve, o vencimento e a origem (propina, taxa, multa).",
            "Acompanhar pagamentos e imprimir recibos.",
            "Contestar uma dívida e ler a decisão da tesouraria.",
            "Ler os avisos que a tesouraria enviou.",
        ],
    )

    # ADMIN
    h = doc.add_heading("7. Administração", level=1)
    style_heading(h, 1, "7. Administração", "cap-admin")
    add_body(
        doc,
        "O grupo Gestão fecha com o pulso técnico do Core e o rasto de auditoria. São ecrãs de governação, não do dia lectivo.",
    )

    screen(
        doc,
        title="Administração do Core",
        bookmark="scr-31-administracao",
        shot="31-administracao.png",
        caption="Figura 42. Estado MQTT, dispositivos e limiares operacionais.",
        path="/admin",
        who="Apenas administrador",
        sees="Cartões de MQTT (ligado/desligado), dispositivos online, ocorrências abertas e alertas vivos. Formulário de configuração: modo laboratório LPR, temperatura de aviso, CO₂ de aviso e crítico, retenção de leituras em dias. Atalhos para utilizadores, auditoria, sensores e relatórios.",
        does=[
            "Ver se o broker MQTT está ligado.",
            "Ligar ou desligar o modo laboratório do parque.",
            "Ajustar limiares ambientais usados pelos alertas.",
            "Definir quantos dias de leituras o Core guarda.",
        ],
    )

    screen(
        doc,
        title="Auditoria",
        bookmark="scr-32-auditoria",
        shot="32-auditoria.png",
        caption="Figura 43. Rasto de acções com correlationId.",
        path="/audit",
        who="Administrador e coordenador",
        sees="Tabela de eventos: acção, recurso, correlationId (o mesmo identificador do pedido HTTP) e data/hora. Serve para reconstruir o que aconteceu depois de um login, uma ocorrência ou uma alteração financeira.",
        does=[
            "Percorrer as acções recentes.",
            "Copiar o correlationId para cruzar com logs da API.",
            "Confirmar quem fez o quê, e quando.",
        ],
    )

    # ESTUDANTE
    h = doc.add_heading("8. O dia do estudante", level=1)
    style_heading(h, 1, "8. O dia do estudante", "cap-estudante")
    add_body(
        doc,
        "Com a conta de estudante, o menu encolhe: desaparecem administração, utilizadores e a tesouraria de gestão. Sobram o campus, as aulas e a pasta financeira pessoal. As capturas abaixo usam a conta demo estudante@smartcampus.demo.",
    )

    screen(
        doc,
        title="O meu perfil",
        bookmark="scr-34-perfil-estudante",
        shot="34-perfil-estudante.png",
        caption="Figura 44. Perfil académico do estudante — número, curso e contacto.",
        path="/students",
        who="Estudante (só o próprio)",
        sees="Número de estudante, estado, curso, ano de estudo e o formulário de contacto (telefone). Não há lista de colegas nem botão de criar perfil.",
        does=[
            "Confirmar o curso e o número de matrícula.",
            "Actualizar o telefone de contacto.",
        ],
    )

    screen(
        doc,
        title="Pauta do estudante",
        bookmark="scr-35-avaliacoes-estudante",
        shot="35-avaliacoes-estudante.png",
        caption="Figura 45. Avaliações e notas na perspectiva do estudante.",
        path="/assessments",
        who="Estudante",
        sees="Notas por disciplina — admissão, exames e situação — e o detalhe das avaliações que o docente já publicou. Não há formulário de criar avaliação.",
        does=[
            "Acompanhar a situação em cada disciplina.",
            "Abrir o detalhe das avaliações lançadas.",
        ],
    )

    screen(
        doc,
        title="Dashboard do estudante",
        bookmark="scr-36-dashboard-estudante",
        shot="36-dashboard-estudante.png",
        caption="Figura 46. O dia no campus com o papel Estudante — atalhos filtrados.",
        path="/dashboard",
        who="Estudante",
        sees="A mesma saudação e indicadores, mas os atalhos omitem administração, utilizadores e o que o papel não cobre. Gestão financeira continua visível porque o estudante tem pasta própria.",
        does=[
            "Começar o dia pelo resumo.",
            "Saltar para horários, assiduidade, notas ou finanças.",
        ],
    )

    screen(
        doc,
        title="Inscrições do estudante",
        bookmark="scr-37-inscricoes-estudante",
        shot="37-inscricoes-estudante.png",
        caption="Figura 47. O estudante inscreve-se a si próprio nas disciplinas do seu curso.",
        path="/enrolments",
        who="Estudante",
        sees="Formulário sem selector de colega: a disciplina tem de pertencer ao curso do perfil. A lista mostra só as inscrições do próprio.",
        does=[
            "Escolher a disciplina e o ano lectivo.",
            "Submeter a inscrição e acompanhar o estado.",
        ],
        note="Se aparecer bloqueio financeiro, abra Gestão financeira, regularize ou fale com a tesouraria.",
    )

    screen(
        doc,
        title="Assiduidade do estudante",
        bookmark="scr-38-assiduidade-estudante",
        shot="38-assiduidade-estudante.png",
        caption="Figura 48. Histórico de presenças, faltas, atrasos e justificações.",
        path="/attendance",
        who="Estudante",
        sees="O teu registo por sessão de horário — sem a lista da turma e sem botões de marcar presença.",
        does=[
            "Ver em que sessões esteve presente, em falta ou atrasado.",
            "Confirmar se uma justificação já foi registada pelo docente.",
        ],
    )

    # ANEXO A
    h = doc.add_heading("Anexo A · Matriz de acesso", level=1)
    style_heading(h, 1, "Anexo A · Matriz de acesso", "anexo-a")
    add_body(
        doc,
        "Leitura rápida: ● vê e usa  ·  ◐ consulta limitada / só o próprio  ·  — não entra no menu ou é redireccionado.",
    )

    matrix = [
        ("Módulo", "Est.", "Doc.", "Téc.", "Coord.", "Admin", "Fin."),
        ("Centro de operações / Dashboard / Notificações", "●", "●", "●", "●", "●", "●"),
        ("Gestão académica, campus, IoT, relatórios", "●", "●", "●", "●", "●", "●"),
        ("Utilizadores e perfis", "—", "—", "—", "●", "●", "—"),
        ("Estudantes / docentes / inscrições / aulas", "◐", "●", "—", "●", "●", "—"),
        ("Gestão financeira", "◐", "—", "—", "—", "●", "●"),
        ("Políticas financeiras", "—", "—", "—", "—", "●", "—"),
        ("Administração do Core", "—", "—", "—", "—", "●", "—"),
        ("Auditoria", "—", "—", "—", "●", "●", "—"),
    ]
    table = doc.add_table(rows=0, cols=7)
    for r, row_data in enumerate(matrix):
        row = table.add_row()
        prevent_row_split(row)
        for c, text in enumerate(row_data):
            cell = row.cells[c]
            if r == 0:
                shade_cell(cell, NAVY)
                color = WHITE
                bold = True
            else:
                shade_cell(cell, SOFT if r % 2 == 0 else WHITE)
                color = TEAL if c > 0 else NAVY
                bold = c == 0 or text == "●"
            set_cell_margins(cell, 60, 60, 80, 80)
            set_cell_borders(
                cell,
                top={"color": LINE},
                left={"color": LINE},
                bottom={"color": LINE},
                right={"color": LINE},
            )
            cell.text = ""
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c == 0 else WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(text)
            set_run(run, size=9, bold=bold, color=color)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)
    callout(
        doc,
        "Como ler a coluna do estudante",
        "O estudante entra nos módulos académicos, mas só na sua pasta: o próprio perfil, as próprias inscrições, a própria pauta, a própria assiduidade e as próprias dívidas.",
    )

    # ANEXO B
    h = doc.add_heading("Anexo B · Glossário rápido", level=1)
    style_heading(h, 1, "Anexo B · Glossário rápido", "anexo-b")
    glossary = [
        ("Core", "O coração do Smart Campus: autenticação, API, regras e os módulos que acabou de percorrer."),
        ("D2", "Edifício principal de demonstração da UJAC, com mapa 2D e gémeo 3D."),
        ("Gémeo digital", "Modelo 3D esquemático do D2, alimentado pelo cadastro de salas e pela telemetria ao vivo."),
        ("MQTT", "Canal por onde os sensores ESP32 enviam temperatura, CO₂, humidade e ocupação."),
        ("LPR", "Leitura automática de matrículas no parque. Em laboratório pode ser simulada."),
        ("SLA", "Prazo de análise de uma contestação financeira, derivado dos dias de carência da política."),
        ("Situação financeira", "Regular ou Bloqueada. O bloqueio impede activar inscrições e pode condicionar avaliações."),
        ("correlationId", "Identificador partilhado entre o pedido HTTP e o evento de auditoria, para rastrear uma acção."),
        ("DEMO", "Dado de semente ou de laboratório, visível mas marcado para não se confundir com operação real."),
        ("MZN", "Metical moçambicano — unidade de todos os totais financeiros do Core."),
    ]
    table = doc.add_table(rows=0, cols=2)
    hdr = table.add_row().cells
    for i, t in enumerate(("Termo", "Significado neste sistema")):
        shade_cell(hdr[i], TEAL)
        set_cell_margins(hdr[i], 80, 80, 120, 120)
        hdr[i].text = ""
        p = hdr[i].paragraphs[0]
        r = p.add_run(t)
        set_run(r, size=10, bold=True, color=WHITE)
    for i, (term, meaning) in enumerate(glossary):
        row = table.add_row()
        prevent_row_split(row)
        fill = SOFT if i % 2 == 0 else WHITE
        for cell, text, bold in ((row.cells[0], term, True), (row.cells[1], meaning, False)):
            shade_cell(cell, fill)
            set_cell_margins(cell, 70, 70, 120, 120)
            set_cell_borders(
                cell,
                top={"color": LINE},
                left={"color": LINE},
                bottom={"color": LINE},
                right={"color": LINE},
            )
            cell.text = ""
            p = cell.paragraphs[0]
            r = p.add_run(text)
            set_run(r, size=10, bold=bold, color=NAVY if bold else INK)

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_before = Pt(18)
    end = doc.add_paragraph()
    end.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = end.add_run("Fim do manual  ·  Smart Campus Core  ·  UJAC")
    set_run(r, size=10, italic=True, color=MUTED)
    end2 = doc.add_paragraph()
    end2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r2 = end2.add_run("Em caso de bloqueio de acesso ou de pasta financeira, fale com a coordenação ou com a tesouraria.")
    set_run(r2, size=10, color=MUTED)


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    doc = Document()
    doc.core_properties.title = "Manual do Utilizador — Smart Campus Core"
    doc.core_properties.author = "Universidade Joaquim Alberto Chissano"
    doc.core_properties.subject = "Guia prático de todos os ecrãs do Smart Campus"
    doc.core_properties.category = "Manual de utilizador"
    configure_styles(doc)
    add_header_footer(doc)
    cover_page(doc)
    toc_page(doc)
    build_content(doc)
    doc.save(OUT)
    print(f"escrito {OUT}")


if __name__ == "__main__":
    main()
