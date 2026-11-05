#!/usr/bin/env python3
"""Gera a apresentação PowerPoint do Smart Campus Core."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "capturas"
OUT = ROOT / "Apresentacao_Smart_Campus.pptx"

NAVY = RGBColor(0x10, 0x23, 0x3D)
TEAL = RGBColor(0x1A, 0x6B, 0x5C)
INK = RGBColor(0x1E, 0x2A, 0x3A)
MUTED = RGBColor(0x5A, 0x6B, 0x7C)
MIST = RGBColor(0xEE, 0xF3, 0xF1)
PAPER = RGBColor(0xF7, 0xF4, 0xEE)
LINE = RGBColor(0xD5, 0xDD, 0xD8)
GOLD = RGBColor(0xC4, 0x8A, 0x3A)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
SOFT = RGBColor(0xF3, 0xF7, 0xF6)
NAVY_HEX = "10233D"
TEAL_HEX = "1A6B5C"

W = Inches(13.333)
H = Inches(7.5)


def rgb(color: RGBColor) -> str:
    return f"{color[0]:02X}{color[1]:02X}{color[2]:02X}"


def fill(shape, color: RGBColor):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def line(shape, color: RGBColor, pt=1):
    shape.line.color.rgb = color
    shape.line.width = Pt(pt)


def set_font(run, *, size=18, bold=False, italic=False, color=INK, name="Calibri"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    rFonts = rPr.find(qn("a:latin"))
    if rFonts is None:
        rFonts = rPr.makeelement(qn("a:latin"), {})
        rPr.append(rFonts)
    rFonts.set("typeface", name)


def box(slide, l, t, w, h, color=None, *, rounded=False, radius=0.08):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if rounded else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, l, t, w, h)
    if rounded:
        try:
            shape.adjustments[0] = radius
        except Exception:
            pass
    if color is None:
        shape.fill.background()
        shape.line.fill.background()
    else:
        fill(shape, color)
    return shape


def text(
    slide,
    l,
    t,
    w,
    h,
    content,
    *,
    size=18,
    bold=False,
    italic=False,
    color=INK,
    align=PP_ALIGN.LEFT,
    anchor=MSO_ANCHOR.TOP,
    name="Calibri",
):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    tf.paragraphs[0].alignment = align
    try:
        tf._txBody.bodyPr.set("anchor", {MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}.get(anchor, "t"))
    except Exception:
        pass
    p = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = content
    set_font(run, size=size, bold=bold, italic=italic, color=color, name=name)
    return tb


def bullets(slide, l, t, w, h, items, *, size=16, color=INK, spacing=10):
    tb = slide.shapes.add_textbox(l, t, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = PP_ALIGN.LEFT
        p.level = 0
        p.space_after = Pt(spacing)
        run = p.add_run()
        run.text = f"•  {item}"
        set_font(run, size=size, color=color)
    return tb


def chip(slide, l, t, w, h, label, *, fill_color=SOFT, text_color=NAVY):
    box(slide, l, t, w, h, fill_color, rounded=True, radius=0.35)
    text(slide, l, t, w, h, label, size=11, bold=True, color=text_color, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)


def footer(slide, section: str, index: int, total: int, agenda=None):
    box(slide, Inches(0), Inches(7.22), W, Inches(0.28), NAVY)
    text(slide, Inches(0.4), Inches(7.22), Inches(8.5), Inches(0.28), f"Smart Campus  ·  {section}", size=10, color=WHITE, anchor=MSO_ANCHOR.MIDDLE)
    text(slide, Inches(10.6), Inches(7.22), Inches(2.3), Inches(0.28), f"{index}  /  {total}", size=10, color=WHITE, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
    if agenda is not None:
        hit = box(slide, Inches(0.4), Inches(7.22), Inches(2.4), Inches(0.28), None)
        hit.click_action.target_slide = agenda


def notes(slide, body: str):
    slide.notes_slide.notes_text_frame.text = body


def shot_bytes(name: str, *, max_w=1600) -> BytesIO | None:
    path = SHOTS / name
    if not path.exists():
        return None
    with Image.open(path) as im:
        image = im.convert("RGB")
        target_h = min(image.height, int(round(image.width * 900 / 1440)))
        image = image.crop((0, 0, image.width, target_h))
        if image.width > max_w:
            nh = int(image.height * max_w / image.width)
            image = image.resize((max_w, nh), Image.Resampling.LANCZOS)
        buf = BytesIO()
        image.save(buf, format="JPEG", quality=80, optimize=True)
        buf.seek(0)
    return buf


def add_shot(slide, name: str, l, t, w, h, *, radius=True):
    data = shot_bytes(name)
    frame = box(slide, l, t, w, h, WHITE, rounded=radius, radius=0.04)
    line(frame, LINE, 1)
    if data is None:
        text(slide, l, t, w, h, f"Captura em falta: {name}", size=12, italic=True, color=MUTED, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        return
    with Image.open(data) as image:
        iw, ih = image.size
    data.seek(0)
    inset = Inches(0.07)
    box_w = w - inset * 2
    box_h = h - inset * 2
    scale = min(box_w / iw, box_h / ih)
    pw = int(iw * scale)
    ph = int(ih * scale)
    px = l + inset + (box_w - pw) // 2
    py = t + inset + (box_h - ph) // 2
    slide.shapes.add_picture(data, px, py, pw, ph)


class Deck:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width = W
        self.prs.slide_height = H
        self.blank = self.prs.slide_layouts[6]
        self.slides: list = []
        self.by_key: dict[str, object] = {}
        self.agenda_items: list[tuple[str, str, str]] = []

    def add(self, key: str | None = None):
        slide = self.prs.slides.add_slide(self.blank)
        self.slides.append(slide)
        if key:
            self.by_key[key] = slide
        return slide

    def paper(self, slide):
        box(slide, 0, 0, W, H, PAPER)

    def accent_bar(self, slide):
        box(slide, 0, 0, Inches(0.12), H, TEAL)

    def section(self, key: str, kicker: str, title: str, subtitle: str, items: list[str]):
        slide = self.add(key)
        box(slide, 0, 0, W, H, NAVY)
        box(slide, 0, 0, Inches(0.16), H, TEAL)
        text(slide, Inches(0.7), Inches(1.55), Inches(12), Inches(0.35), kicker.upper(), size=13, bold=True, color=TEAL)
        text(slide, Inches(0.7), Inches(2.0), Inches(12), Inches(1.1), title, size=40, bold=True, color=WHITE)
        text(slide, Inches(0.7), Inches(3.2), Inches(11), Inches(0.7), subtitle, size=18, color=RGBColor(0xC9, 0xD6, 0xE3))
        y = Inches(4.2)
        for item in items:
            chip(slide, Inches(0.7), y, Inches(3.4), Inches(0.42), item, fill_color=RGBColor(0x1A, 0x3A, 0x52), text_color=WHITE)
            y += Inches(0.52)
        return slide

    def content(
        self,
        *,
        key: str | None,
        section: str,
        kicker: str,
        title: str,
        path: str,
        who: str,
        points: list[str],
        shot: str | None = None,
        shots: list[tuple[str, str]] | None = None,
        note: str = "",
    ):
        slide = self.add(key)
        self.paper(slide)
        self.accent_bar(slide)
        text(slide, Inches(0.45), Inches(0.22), Inches(8), Inches(0.28), kicker.upper(), size=11, bold=True, color=TEAL)
        text(slide, Inches(0.45), Inches(0.48), Inches(8.2), Inches(0.55), title, size=28, bold=True, color=NAVY)
        chip(slide, Inches(0.45), Inches(1.12), Inches(2.55), Inches(0.34), path, fill_color=MIST, text_color=TEAL)
        chip(slide, Inches(3.12), Inches(1.12), Inches(5.3), Inches(0.34), who, fill_color=SOFT, text_color=NAVY)

        if shots:
            bullets(slide, Inches(0.45), Inches(1.6), Inches(12.4), Inches(1.15), points, size=15, spacing=6)
            gap = Inches(0.18)
            n = len(shots)
            usable = Inches(12.4)
            card_w = int((usable - gap * (n - 1)) / n)
            x = Inches(0.45)
            y = Inches(2.85)
            card_h = Inches(4.15)
            for filename, caption in shots:
                add_shot(slide, filename, x, y, card_w, card_h - Inches(0.38))
                text(slide, x, y + card_h - Inches(0.34), card_w, Inches(0.32), caption, size=11, color=MUTED, align=PP_ALIGN.CENTER)
                x += card_w + gap
        else:
            bullets(slide, Inches(0.45), Inches(1.62), Inches(4.55), Inches(5.2), points, size=16, spacing=10)
            if shot:
                add_shot(slide, shot, Inches(5.2), Inches(1.12), Inches(7.7), Inches(5.85))

        if note:
            notes(slide, note)
        return slide

    def finish_chrome(self):
        total = len(self.slides)
        agenda = self.by_key.get("agenda")
        section_of = {}
        current = "Abertura"
        mapping = [
            ("cover", "Abertura"),
            ("agenda", "Percurso"),
            ("visao", "O sistema"),
            ("papeis", "O sistema"),
            ("login", "Entrar"),
            ("nav", "Entrar"),
            ("hoje", "Hoje"),
            ("pessoas", "Pessoas e aulas"),
            ("campus", "Campus"),
            ("ops", "Operações"),
            ("fin", "Gestão financeira"),
            ("admin", "Administração"),
            ("aluno", "O dia do estudante"),
            ("matriz", "Acesso"),
            ("fecho", "Encerramento"),
        ]
        keys = [(i, s) for i, s in enumerate(self.slides)]
        key_by_slide = {id(v): k for k, v in self.by_key.items()}
        order = [key_by_slide.get(id(s), "") for s in self.slides]
        current = "Abertura"
        labels = []
        known = dict(mapping)
        for key in order:
            if key in known:
                current = known[key]
            labels.append(current)
        for i, slide in enumerate(self.slides, start=1):
            key = key_by_slide.get(id(slide), "")
            if key in {"cover", "hoje", "pessoas", "campus", "ops", "fin", "admin", "aluno", "fecho"}:
                continue
            footer(slide, labels[i - 1], i, total, agenda)

        # Agenda jump targets
        if agenda is not None:
            for shape, dest_key in getattr(self, "_agenda_links", []):
                dest = self.by_key.get(dest_key)
                if dest is not None:
                    shape.click_action.target_slide = dest


def cover(deck: Deck):
    slide = deck.add("cover")
    box(slide, 0, 0, W, H, NAVY)
    box(slide, 0, 0, Inches(0.18), H, TEAL)
    text(slide, Inches(0.8), Inches(1.35), Inches(11), Inches(0.35), "UNIVERSIDADE JOAQUIM ALBERTO CHISSANO  ·  PTP III", size=13, bold=True, color=RGBColor(0x9F, 0xD5, 0xC8))
    text(slide, Inches(0.8), Inches(2.05), Inches(11.5), Inches(1.2), "Smart Campus", size=48, bold=True, color=WHITE)
    text(slide, Inches(0.8), Inches(3.15), Inches(11), Inches(0.7), "O campus que pensa consigo.", size=26, color=RGBColor(0xD7, 0xE4, 0xEE))
    text(
        slide,
        Inches(0.8),
        Inches(4.05),
        Inches(10.5),
        Inches(0.9),
        "Apresentação do sistema: aulas, campus físico, IoT e tesouraria\nnum só sítio — para quem usa, não para quem constrói.",
        size=16,
        color=RGBColor(0xA9, 0xBC, 0xCB),
    )
    y = Inches(5.35)
    labels = ["Hoje", "Pessoas e aulas", "Campus", "Operações", "Gestão"]
    x = Inches(0.8)
    for label in labels:
        chip(slide, x, y, Inches(2.15), Inches(0.4), label, fill_color=RGBColor(0x1A, 0x3A, 0x52), text_color=WHITE)
        x += Inches(2.28)
    text(slide, Inches(0.8), Inches(6.55), Inches(8), Inches(0.3), "Novembro 2026  ·  Versão 1.0  ·  Maputo", size=13, color=RGBColor(0x9F, 0xD5, 0xC8))


def agenda(deck: Deck):
    slide = deck.add("agenda")
    deck.paper(slide)
    deck.accent_bar(slide)
    text(slide, Inches(0.5), Inches(0.35), Inches(12), Inches(0.35), "PERCURSO", size=12, bold=True, color=TEAL)
    text(slide, Inches(0.5), Inches(0.7), Inches(12), Inches(0.6), "O sistema, ecrã a ecrã", size=32, bold=True, color=NAVY)
    text(slide, Inches(0.5), Inches(1.35), Inches(12), Inches(0.4), "Toque num cartão para saltar. A ordem é a da barra lateral.", size=14, color=MUTED)

    items = [
        ("01", "O sistema", "O que é e quem entra", "visao"),
        ("02", "Entrar", "Login, menu e papéis", "login"),
        ("03", "Hoje", "Mapa, dia e avisos", "hoje"),
        ("04", "Pessoas e aulas", "Cursos, horários e notas", "pessoas"),
        ("05", "Campus", "D2, gémeo 3D e parque", "campus"),
        ("06", "Operações", "IoT, ocorrências, relatórios", "ops"),
        ("07", "Finanças", "Propinas, salários, bloqueios", "fin"),
        ("08", "Governação", "Admin, auditoria, aluno", "admin"),
    ]
    deck._agenda_links = []
    cols = 4
    card_w, card_h = Inches(2.9), Inches(2.15)
    gap_x, gap_y = Inches(0.22), Inches(0.22)
    origin_x, origin_y = Inches(0.5), Inches(1.95)
    for i, (num, title, blurb, dest) in enumerate(items):
        c, r = i % cols, i // cols
        x = origin_x + c * (card_w + gap_x)
        y = origin_y + r * (card_h + gap_y)
        card = box(slide, x, y, card_w, card_h, WHITE, rounded=True, radius=0.08)
        line(card, LINE, 1)
        box(slide, x, y, Inches(0.1), card_h, TEAL)
        text(slide, x + Inches(0.28), y + Inches(0.28), Inches(2.4), Inches(0.35), num, size=14, bold=True, color=TEAL)
        text(slide, x + Inches(0.28), y + Inches(0.68), Inches(2.4), Inches(0.5), title, size=18, bold=True, color=NAVY)
        text(slide, x + Inches(0.28), y + Inches(1.25), Inches(2.4), Inches(0.6), blurb, size=13, color=MUTED)
        deck._agenda_links.append((card, dest))


def visao(deck: Deck):
    slide = deck.add("visao")
    deck.paper(slide)
    deck.accent_bar(slide)
    text(slide, Inches(0.5), Inches(0.35), Inches(12), Inches(0.3), "O SISTEMA", size=12, bold=True, color=TEAL)
    text(slide, Inches(0.5), Inches(0.7), Inches(12), Inches(0.7), "Um campus, quatro trabalhos", size=32, bold=True, color=NAVY)
    text(
        slide,
        Inches(0.5),
        Inches(1.45),
        Inches(12.3),
        Inches(0.55),
        "A plataforma académica da UJAC junta a vida lectiva, o edifício D2, a rede IoT e a tesouraria.",
        size=16,
        color=MUTED,
    )
    cards = [
        ("Aulas", "Cursos, inscrições, horários,\npresenças e pauta."),
        ("Campus", "Mapa do D2, gémeo 3D,\nsalas e parque de viaturas."),
        ("Operações", "Sensores, alertas,\nocorrências e manutenção."),
        ("Tesouraria", "Propinas, recibos,\nsalários e bloqueios."),
    ]
    x = Inches(0.5)
    for title, body in cards:
        box(slide, x, Inches(2.3), Inches(2.95), Inches(4.4), WHITE, rounded=True, radius=0.07)
        box(slide, x, Inches(2.3), Inches(2.95), Inches(0.12), TEAL)
        text(slide, x + Inches(0.25), Inches(2.7), Inches(2.45), Inches(0.8), title, size=22, bold=True, color=NAVY)
        text(slide, x + Inches(0.25), Inches(3.6), Inches(2.45), Inches(2.4), body, size=16, color=INK)
        x += Inches(3.15)
    notes(slide, "Abrir com a ideia de um só sítio. Evitar detalhe técnico. O Core é o coração comum; os módulos são o trabalho do dia.")


def papeis(deck: Deck):
    slide = deck.add("papeis")
    deck.paper(slide)
    deck.accent_bar(slide)
    text(slide, Inches(0.5), Inches(0.3), Inches(12), Inches(0.28), "O SISTEMA", size=12, bold=True, color=TEAL)
    text(slide, Inches(0.5), Inches(0.6), Inches(12), Inches(0.55), "Seis papéis, seis dias diferentes", size=30, bold=True, color=NAVY)
    roles = [
        ("Administrador", "Vê tudo. Contas, políticas financeiras e limiares IoT."),
        ("Coordenador", "Vida académica, horários, utilizadores e auditoria."),
        ("Docente", "As suas sessões, presenças e o lançamento de notas."),
        ("Estudante", "O próprio perfil, a pauta, as presenças e a pasta financeira."),
        ("Financeiro", "Dívidas, propinas, salários e relatórios em MZN."),
        ("Técnico", "Campus, sensores, ocorrências, manutenção e parque."),
    ]
    for i, (title, body) in enumerate(roles):
        c, r = i % 3, i // 3
        x = Inches(0.45) + c * Inches(4.2)
        y = Inches(1.45) + r * Inches(2.65)
        box(slide, x, y, Inches(4.0), Inches(2.4), WHITE, rounded=True, radius=0.08)
        box(slide, x, y, Inches(0.1), Inches(2.4), TEAL if r == 0 else GOLD)
        text(slide, x + Inches(0.3), y + Inches(0.28), Inches(3.5), Inches(0.5), title, size=18, bold=True, color=NAVY)
        text(slide, x + Inches(0.3), y + Inches(0.9), Inches(3.5), Inches(1.2), body, size=15, color=INK)
    notes(slide, "O menu esconde o que o papel não pode ver. Financeiro e Administrador partilham tesouraria; só o Admin altera políticas.")


def build(deck: Deck):
    cover(deck)
    agenda(deck)
    visao(deck)
    papeis(deck)

    deck.content(
        key="login",
        section="Entrar",
        kicker="Entrar",
        title="A porta do campus",
        path="/login",
        who="Ainda sem sessão",
        points=[
            "Cartão Bem-vindo com email institucional e password.",
            "Entrar no campus abre o Centro de operações.",
            "Contas demo só em laboratório; em produção usa-se a conta real.",
            "Se a API estiver fria, o ecrã pede para esperar e tentar de novo.",
        ],
        shot="00-login.png",
        note="Mostrar a frase «Um campus que pensa consigo». Não insistir em credenciais na sala, excepto se for demo controlada.",
    )

    deck.content(
        key="nav",
        section="Entrar",
        kicker="Entrar",
        title="O mapa está sempre à esquerda",
        path="Barra lateral",
        who="Todos os autenticados",
        points=[
            "Cinco grupos: Hoje, Pessoas e aulas, Campus, Operações, Gestão.",
            "O cabeçalho diz a área actual e o sino leva às notificações.",
            "Em baixo: o seu nome, o papel e Terminar sessão.",
            "No telemóvel, o botão Menu abre a mesma lista.",
        ],
        shot="01-operacoes.png",
        note="Nas capturas seguintes o menu é o mesmo. Use-o como fio condutor da apresentação.",
    )

    deck.section(
        "hoje",
        "Capítulo 03",
        "Hoje",
        "O pulso do campus no primeiro minuto da sessão.",
        ["Centro de operações", "Dashboard", "Notificações"],
    )

    deck.content(
        key=None,
        section="Hoje",
        kicker="Hoje",
        title="Centro de operações",
        path="/ops",
        who="Todos os autenticados",
        points=[
            "Mapa do D2 pintado por ocupação, temperatura, CO₂ ou humidade.",
            "Painel do edifício com cartões ambientais e salas.",
            "Padrão semanal, alertas ao vivo e actividade recente.",
            "Atalhos para salas, ocorrências, dispositivos e gémeo 3D.",
        ],
        shot="01-operacoes.png",
        note="É a home pós-login. O pulso circular resume as pessoas em sessão.",
    )

    deck.content(
        key=None,
        section="Hoje",
        kicker="Hoje",
        title="O seu dia no campus",
        path="/dashboard",
        who="Todos os autenticados",
        points=[
            "Saudação com o primeiro nome e o papel com que entrou.",
            "Cartões de salas, ocorrências e estado do Core.",
            "Atalhos só para os módulos que o papel permite.",
            "O botão Ver mapa ao vivo volta ao Centro de operações.",
        ],
        shot="02-dashboard.png",
        note="Bom slide para contrastar a vista Admin com a do estudante, mais à frente.",
    )

    deck.content(
        key=None,
        section="Hoje",
        kicker="Hoje",
        title="Notificações em tempo real",
        path="/notifications",
        who="Todos os autenticados",
        points=[
            "Caixa da mais recente para a mais antiga.",
            "As não lidas ficam em destaque; o sino traz o contador.",
            "Avisos financeiros, académicos e operacionais no mesmo sítio.",
            "Marcar como lida quando o assunto já foi tratado.",
        ],
        shot="03-notificacoes.png",
    )

    deck.section(
        "pessoas",
        "Capítulo 04",
        "Pessoas e aulas",
        "Tudo o que faz a universidade funcionar no papel.",
        ["Estrutura académica", "Contas e perfis", "Horários, presenças, notas"],
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="Gestão académica — o hub",
        path="/academic",
        who="Todos os autenticados",
        points=[
            "Contadores de estudantes, cursos e sessões.",
            "Três passos do dia: horários, presenças, notas.",
            "Directório para departamentos, cursos, disciplinas e pessoas.",
            "Departamentos, cursos e disciplinas não estão no menu — entram daqui.",
        ],
        shot="04-gestao-academica.png",
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="A estrutura: departamento → curso → disciplina",
        path="/departments  ·  /courses  ·  /subjects",
        who="Consulta: todos  ·  Criar: coordenação e admin",
        points=[
            "Primeiro o departamento, depois o curso, depois a disciplina.",
            "O curso alimenta inscrições, horários e a emissão de propina.",
            "Quem gere vê o formulário no topo e a coluna de acções.",
        ],
        shots=[
            ("05-departamentos.png", "Departamentos"),
            ("06-cursos.png", "Cursos"),
            ("07-disciplinas.png", "Disciplinas"),
        ],
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="Contas, estudantes e docentes",
        path="/users  ·  /students  ·  /teachers",
        who="Gestão académica  ·  Admin cria contas",
        points=[
            "A conta nasce em Utilizadores (email, papel, password).",
            "O perfil académico liga-se depois — sem repetir credenciais.",
            "Sem perfil de estudante não há inscrição possível.",
        ],
        shots=[
            ("08-utilizadores.png", "Utilizadores"),
            ("09-estudantes.png", "Estudantes"),
            ("10-docentes.png", "Docentes"),
        ],
        note="Dois passos: identidade (Users) e perfil (Students/Teachers).",
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="Inscrições no ano lectivo",
        path="/enrolments",
        who="Estudante, docente, coordenação, admin",
        points=[
            "Estudante + disciplina + ano lectivo.",
            "O aluno só se inscreve a si e só no seu curso.",
            "Coordenação activa ou altera o estado.",
            "Bloqueio financeiro impede activar a inscrição.",
        ],
        shot="11-inscricoes.png",
        note="Ponte natural para o módulo financeiro: regularizar antes de insistir.",
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="Horários e assiduidade",
        path="/schedules  ·  /attendance",
        who="Estudante consulta  ·  Docente marca  ·  Coord. gere",
        points=[
            "Sessões de aula, laboratório ou avaliação, com sala e docente.",
            "A lista de presenças vem só dos inscritos activos.",
            "Presença, falta, atraso ou justificação por sessão.",
            "O estudante vê o histórico; não edita o dos colegas.",
        ],
        shots=[
            ("12-horarios.png", "Horários"),
            ("13-assiduidade.png", "Assiduidade"),
        ],
    )

    deck.content(
        key=None,
        section="Pessoas e aulas",
        kicker="Pessoas e aulas",
        title="Avaliações e notas",
        path="/assessments",
        who="Docente lança  ·  Estudante lê a pauta",
        points=[
            "Criar teste, exame ou trabalho numa disciplina.",
            "Lançar notas e publicar quando a turma puder ver.",
            "O estudante vê admissão, exames e situação.",
            "Bloqueio financeiro pode condicionar o lançamento.",
        ],
        shot="14-avaliacoes.png",
    )

    deck.section(
        "campus",
        "Capítulo 05",
        "Campus",
        "O D2 em mapa, em 3D e no cadastro do dia-a-dia.",
        ["Campus físico", "Gémeo digital", "Parque e inventário"],
    )

    deck.content(
        key=None,
        section="Campus",
        kicker="Campus",
        title="Campus físico",
        path="/campus",
        who="Todos os autenticados",
        points=[
            "Edifícios, salas ocupadas agora e pessoas no D2.",
            "Atalhos para o mapa operacional e para o gémeo 3D.",
            "Directório: edifícios, salas, parque, labs e equipamentos.",
        ],
        shot="15-campus-fisico.png",
    )

    deck.content(
        key=None,
        section="Campus",
        kicker="Campus",
        title="Gémeo digital do D2",
        path="/campus/twin",
        who="Todos os autenticados",
        points=[
            "Volume 3D gerado a partir do cadastro de salas.",
            "Cores de ocupação, temperatura ou CO₂.",
            "Clique numa sala: pessoas, ambiente e atalhos.",
            "É o mesmo pulso do Centro de operações, em profundidade.",
        ],
        shot="16-gemeo-digital.png",
    )

    deck.content(
        key=None,
        section="Campus",
        kicker="Campus",
        title="Edifícios e salas",
        path="/buildings  ·  /rooms",
        who="Consulta: todos  ·  Cadastro: gestão do campus",
        points=[
            "O D2 é um edifício como os outros — com posição no mapa.",
            "Cada sala tem piso, capacidade e fica disponível para horários, IoT e ocorrências.",
        ],
        shots=[
            ("17-edificios.png", "Edifícios"),
            ("18-salas.png", "Salas"),
        ],
    )

    deck.content(
        key=None,
        section="Campus",
        kicker="Campus",
        title="Parque, laboratórios e equipamentos",
        path="/parking  ·  /laboratories  ·  /equipment",
        who="Técnico, coordenação e admin gerem o parque",
        points=[
            "Vagas livres, ocupadas, reservadas ou indisponíveis.",
            "Leituras de matrícula (LPR); em laboratório o Admin simula.",
            "Labs e equipamentos fecham o inventário físico.",
        ],
        shots=[
            ("19-estacionamento.png", "Parque de viaturas"),
            ("20-laboratorios.png", "Laboratórios"),
            ("21-equipamentos.png", "Equipamentos"),
        ],
    )

    deck.section(
        "ops",
        "Capítulo 06",
        "Operações",
        "A rede inteligente: do sensor ao relatório.",
        ["IoT", "Ocorrências", "Alertas e relatórios"],
    )

    deck.content(
        key=None,
        section="Operações",
        kicker="Operações",
        title="Rede IoT",
        path="/iot",
        who="Todos os autenticados",
        points=[
            "Nós online, última leitura e o pulso da rede.",
            "Pipeline: Sensor → ESP32 → Wi-Fi → MQTT → API → ecrã.",
            "Ao escolher um dispositivo, vê os alertas associados.",
        ],
        shot="22-iot.png",
        note="Não aprofundar hardware. O slide mostra o que o utilizador vê, não o esquema eléctrico.",
    )

    deck.content(
        key=None,
        section="Operações",
        kicker="Operações",
        title="Dispositivos, sensores e leituras",
        path="/devices  ·  /sensors  ·  /readings",
        who="Técnico e gestão registam  ·  Todos consultam",
        points=[
            "O dispositivo vive numa sala; o sensor mede uma métrica.",
            "Limiares de aviso e crítico disparam alertas.",
            "Leituras MQTT são reais; as de semente vêm marcadas DEMO.",
        ],
        shots=[
            ("23-dispositivos.png", "Dispositivos"),
            ("24-sensores.png", "Sensores"),
            ("25-leituras.png", "Leituras"),
        ],
    )

    deck.content(
        key=None,
        section="Operações",
        kicker="Operações",
        title="Ocorrências e manutenção",
        path="/incidents  ·  /maintenance",
        who="Todos registam  ·  Técnico trata",
        points=[
            "Pedido por sala, com prioridade e descrição.",
            "Estados: aberta, em curso, resolvida, fechada.",
            "A manutenção é a acção em cima da ocorrência — o rasto do trabalho feito.",
        ],
        shots=[
            ("26-ocorrencias.png", "Ocorrências"),
            ("27-manutencao.png", "Manutenção"),
        ],
    )

    deck.content(
        key=None,
        section="Operações",
        kicker="Operações",
        title="Alertas e relatórios",
        path="/alerts  ·  /reports",
        who="Todos lêem  ·  Técnico confirma alertas",
        points=[
            "Alertas de dispositivo offline ou limiar ambiental.",
            "Dados DEMO ficam identificados.",
            "Relatórios agregam salas, IoT e ocorrências — exportáveis em CSV ou PDF.",
        ],
        shots=[
            ("28-alertas.png", "Alertas"),
            ("29-relatorios.png", "Relatórios"),
        ],
    )

    deck.section(
        "fin",
        "Capítulo 07",
        "Gestão financeira",
        "Propinas, recibos, salários e bloqueios — em meticais.",
        ["Dívidas e pagamentos", "Contestações", "Políticas e salários"],
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="A tesouraria do campus",
        path="/financial",
        who="Estudante, Financeiro e Administrador",
        points=[
            "Fila de dívidas de todo o campus, ou a pasta de um estudante.",
            "Origens: propina, taxa, multa ou outra.",
            "Registar pagamento, cancelar dívida, imprimir recibo.",
            "Docentes, técnicos e coordenadores não entram aqui.",
        ],
        shot="30-financeiro.png",
        note="Conta demo da tesouraria: financas@smartcampus.demo. O estudante só vê a sua pasta.",
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="Pasta do estudante e histórico",
        path="Dívidas  ·  Histórico",
        who="Gestão selecciona  ·  Estudante vê o próprio",
        points=[
            "Pesquisa por nome ou matrícula.",
            "Faixa Regular ou Bloqueada no topo.",
            "Histórico: total pago, em aberto e recibos.",
            "Dívida regularizada por contestação não conta como pagamento.",
        ],
        shots=[
            ("30i-financeiro-estudante.png", "Pasta individual"),
            ("30j-financeiro-historico.png", "Histórico e recibos"),
        ],
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="Contestações e avisos",
        path="Contestações  ·  Avisos",
        who="Estudante pede  ·  Tesouraria decide",
        points=[
            "Cada contestação tem prazo de análise (SLA).",
            "Aceitar ou rejeitar, com notas — o aluno vê a decisão.",
            "Avisos de cobrança, vencimento e bloqueio, com estado de entrega.",
            "A gestão reenvia os avisos falhados.",
        ],
        shots=[
            ("30b-financeiro-contestacoes.png", "Contestações e SLA"),
            ("30c-financeiro-avisos.png", "Fila de avisos"),
        ],
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="Propina em lote e resumo do campus",
        path="Emissão de propina  ·  Resumo",
        who="Administrador e Financeiro",
        points=[
            "Uma emissão cria dívidas de propina para as inscrições activas do curso.",
            "O Core diz quantas criou e quantas já existiam.",
            "O resumo mostra totais em MZN e a lista de bloqueados.",
        ],
        shots=[
            ("30d-financeiro-propina.png", "Emissão de propina"),
            ("30e-financeiro-resumo.png", "Resumo e bloqueados"),
        ],
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="Salários, relatórios e regras",
        path="Salários  ·  Mensais  ·  Políticas",
        who="Financeiro paga  ·  Só o Admin muda a política",
        points=[
            "Folha salarial mensal dos docentes, com recibo após pagamento.",
            "Relatório mensal de pagamentos ou salários, hora de Maputo.",
            "Política: carência, tecto de dívida e bloqueio automático.",
            "Estudante bloqueado não activa inscrição e pode ficar sem avaliações.",
        ],
        shots=[
            ("30f-financeiro-salarios.png", "Salários"),
            ("30g-financeiro-mensal.png", "Relatório mensal"),
            ("30h-financeiro-politicas.png", "Políticas"),
        ],
    )

    deck.content(
        key=None,
        section="Gestão financeira",
        kicker="Finanças",
        title="O que o estudante vê",
        path="/financial",
        who="Estudante — só a sua pasta",
        points=[
            "Os mesmos separadores, sem pesquisa de colegas nem emissão.",
            "Dívidas, histórico, contestações e avisos próprios.",
            "Pedido de análise sobre uma dívida com que discorda.",
            "Recibos para imprimir quando o pagamento está confirmado.",
        ],
        shot="33-financeiro-estudante.png",
    )

    deck.section(
        "admin",
        "Capítulo 08",
        "Governação",
        "Quem configura o Core e quem deixa rasto.",
        ["Administração", "Auditoria", "Área do estudante"],
    )

    deck.content(
        key=None,
        section="Administração",
        kicker="Governação",
        title="Administração e auditoria",
        path="/admin  ·  /audit",
        who="Admin no Core  ·  Admin e coordenador na auditoria",
        points=[
            "Estado MQTT, dispositivos, ocorrências e alertas vivos.",
            "Limiares de temperatura e CO₂, retenção de leituras, modo LPR.",
            "Auditoria: acção, recurso, correlationId e hora.",
            "O mesmo identificador cruza o pedido HTTP e o evento.",
        ],
        shots=[
            ("31-administracao.png", "Administração"),
            ("32-auditoria.png", "Auditoria"),
        ],
    )

    deck.section(
        "aluno",
        "O outro lado",
        "O dia do estudante",
        "O menu encolhe. Sobram o campus, as aulas e a pasta financeira.",
        ["Perfil", "Pauta", "Inscrições e assiduidade"],
    )

    deck.content(
        key=None,
        section="O dia do estudante",
        kicker="Estudante",
        title="Perfil, pauta e o próprio dia",
        path="/students  ·  /assessments  ·  /dashboard",
        who="Conta estudante@smartcampus.demo",
        points=[
            "O meu perfil: número, curso, ano e telefone.",
            "A pauta por disciplina, sem formulário de lançar notas.",
            "O dashboard mostra só os atalhos do papel Estudante.",
        ],
        shots=[
            ("34-perfil-estudante.png", "O meu perfil"),
            ("35-avaliacoes-estudante.png", "Pauta"),
            ("36-dashboard-estudante.png", "Dashboard"),
        ],
    )

    deck.content(
        key=None,
        section="O dia do estudante",
        kicker="Estudante",
        title="Inscrever-se e ver presenças",
        path="/enrolments  ·  /attendance",
        who="Estudante",
        points=[
            "Inscrição só nas disciplinas do seu curso.",
            "Assiduidade: o histórico, sem marcar a turma.",
            "Se a pasta estiver bloqueada, a tesouraria desbloqueia primeiro.",
        ],
        shots=[
            ("37-inscricoes-estudante.png", "As minhas inscrições"),
            ("38-assiduidade-estudante.png", "As minhas presenças"),
        ],
    )

    matriz(deck)
    fecho(deck)


def matriz(deck: Deck):
    slide = deck.add("matriz")
    deck.paper(slide)
    deck.accent_bar(slide)
    text(slide, Inches(0.4), Inches(0.22), Inches(12), Inches(0.25), "ACESSO", size=12, bold=True, color=TEAL)
    text(slide, Inches(0.4), Inches(0.48), Inches(12), Inches(0.45), "Quem entra onde", size=28, bold=True, color=NAVY)
    text(slide, Inches(0.4), Inches(0.95), Inches(12), Inches(0.3), "● usa     ◐ só o próprio     — não entra", size=13, color=MUTED)

    headers = ["Módulo", "Est.", "Doc.", "Téc.", "Coord.", "Admin", "Fin."]
    rows = [
        ["Operações, dashboard, avisos", "●", "●", "●", "●", "●", "●"],
        ["Campus, IoT, relatórios", "●", "●", "●", "●", "●", "●"],
        ["Utilizadores", "—", "—", "—", "●", "●", "—"],
        ["Aulas (horários, notas, presenças)", "◐", "●", "—", "●", "●", "—"],
        ["Gestão financeira", "◐", "—", "—", "—", "●", "●"],
        ["Políticas financeiras", "—", "—", "—", "—", "●", "—"],
        ["Administração do Core", "—", "—", "—", "—", "●", "—"],
        ["Auditoria", "—", "—", "—", "●", "●", "—"],
    ]
    cols = 7
    widths = [Inches(4.55), Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2), Inches(1.2)]
    x0, y0 = Inches(0.4), Inches(1.4)
    row_h = Inches(0.58)

    x = x0
    for i, h in enumerate(headers):
        box(slide, x, y0, widths[i], row_h, NAVY)
        text(slide, x, y0, widths[i], row_h, h, size=12, bold=True, color=WHITE, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        x += widths[i]
    for r, row in enumerate(rows):
        x = x0
        bg = SOFT if r % 2 == 0 else WHITE
        for c, val in enumerate(row):
            box(slide, x, y0 + row_h * (r + 1), widths[c], row_h, bg)
            color = NAVY if c == 0 else (TEAL if val == "●" else MUTED)
            align = PP_ALIGN.LEFT if c == 0 else PP_ALIGN.CENTER
            text(
                slide,
                x + (Inches(0.12) if c == 0 else 0),
                y0 + row_h * (r + 1),
                widths[c],
                row_h,
                val,
                size=13,
                bold=c == 0 or val == "●",
                color=color,
                align=align,
                anchor=MSO_ANCHOR.MIDDLE,
            )
            x += widths[c]
    notes(slide, "A coluna do estudante é sempre a pasta própria: perfil, pauta, presenças e dívidas.")


def fecho(deck: Deck):
    slide = deck.add("fecho")
    box(slide, 0, 0, W, H, NAVY)
    box(slide, 0, 0, Inches(0.16), H, TEAL)
    text(slide, Inches(0.8), Inches(1.8), Inches(11.5), Inches(0.4), "PARA LEVAR", size=13, bold=True, color=TEAL)
    text(slide, Inches(0.8), Inches(2.3), Inches(11.5), Inches(1.3), "Um campus. Um menu.\nO trabalho de cada papel.", size=36, bold=True, color=WHITE)
    text(
        slide,
        Inches(0.8),
        Inches(4.0),
        Inches(11),
        Inches(1.1),
        "O detalhe ecrã a ecrã está no Manual do Utilizador.\nEm caso de bloqueio de acesso ou de pasta financeira,\nfale com a coordenação ou com a tesouraria.",
        size=16,
        color=RGBColor(0xC9, 0xD6, 0xE3),
    )
    text(slide, Inches(0.8), Inches(6.3), Inches(11), Inches(0.35), "UJAC  ·  Smart Campus Core  ·  PTP III  ·  Novembro 2026", size=14, color=RGBColor(0x9F, 0xD5, 0xC8))


def main():
    deck = Deck()
    build(deck)
    deck.finish_chrome()
    deck.prs.core_properties.title = "Smart Campus — Apresentação do sistema"
    deck.prs.core_properties.author = "Universidade Joaquim Alberto Chissano"
    deck.prs.core_properties.subject = "Apresentação de utilizador do Smart Campus Core"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    deck.prs.save(OUT)
    print(f"escrito {OUT}  ({len(deck.slides)} slides)")


if __name__ == "__main__":
    main()
