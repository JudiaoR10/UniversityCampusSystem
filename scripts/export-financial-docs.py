#!/usr/bin/env python3
"""Export the financial Markdown documents to editable Word files.

Requires python-docx. Run from any directory: python3 scripts/export-financial-docs.py
The supported Markdown subset is headings, paragraphs, emphasis, links, lists,
pipe tables and fenced code blocks. Sources remain the authoritative documents.
"""
from pathlib import Path
import argparse
import re

from docx import Document
from docx.shared import Inches, Pt

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    (ROOT / "docs/relatorio-tecnico-financeiro.md", ROOT / "docs/relatorio-tecnico-financeiro.docx"),
    (ROOT / "docs/manual-utilizador/manual-financeiro.md", ROOT / "docs/manual-utilizador/manual-financeiro.docx"),
)
INLINE = re.compile(r"(\*\*.+?\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")
HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
LIST = re.compile(r"^\s*(?:([-*])\s+|(\d+)\.\s+)(.*)$")
SEPARATOR = re.compile(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$")
IMAGE = re.compile(r"^!\[([^\]]*)\]\(([^)]+)\)\s*$")


def inline(paragraph, value):
    """Preserve readable link labels and targets, bold and inline code."""
    for part in INLINE.split(value):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            paragraph.add_run(part[2:-2]).bold = True
        elif part.startswith("`") and part.endswith("`"):
            paragraph.add_run(part[1:-1]).font.name = "Consolas"
        elif part.startswith("["):
            label, target = part[1:-1].split("](", 1)
            paragraph.add_run(label)
            paragraph.add_run(f" ({target})")
        else:
            paragraph.add_run(part)


def cells(line):
    return [item.strip() for item in line.strip().strip("|").split("|")]


def convert(source, destination):
    lines = source.read_text(encoding="utf-8").splitlines()
    document = Document()
    document.styles["Normal"].font.name = "Calibri"
    document.styles["Normal"].font.size = Pt(11)
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        image = IMAGE.match(line)
        if image:
            image_path = (source.parent / image.group(2)).resolve()
            if not image_path.is_file():
                raise FileNotFoundError(f"Imagem não encontrada: {image_path}")
            document.add_picture(str(image_path), width=Inches(6))
            document.add_paragraph(image.group(1), style="Caption")
            i += 1
            continue
        if line.startswith("```"):
            i += 1
            code = []
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            paragraph = document.add_paragraph()
            paragraph.add_run("\n".join(code)).font.name = "Consolas"
            i += 1
            continue
        heading = HEADING.match(line)
        if heading:
            paragraph = document.add_heading(level=min(len(heading.group(1)), 6))
            inline(paragraph, heading.group(2))
            i += 1
            continue
        if i + 1 < len(lines) and line.lstrip().startswith("|") and SEPARATOR.match(lines[i + 1]):
            rows = [cells(line)]
            i += 2
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                rows.append(cells(lines[i]))
                i += 1
            table = document.add_table(rows=0, cols=len(rows[0]))
            table.style = "Table Grid"
            for row_index, values in enumerate(rows):
                if len(values) != len(rows[0]):
                    raise ValueError(f"Número de colunas inconsistente em {source}: {values}")
                for cell, value in zip(table.add_row().cells, values):
                    inline(cell.paragraphs[0], value)
                    if row_index == 0:
                        for run in cell.paragraphs[0].runs:
                            run.bold = True
            continue
        item = LIST.match(line)
        if item:
            paragraph = document.add_paragraph() if item.group(2) else document.add_paragraph(style="List Bullet")
            if item.group(2):
                paragraph.add_run(f"{item.group(2)}. ")
            inline(paragraph, item.group(3))
            i += 1
            continue
        paragraph_lines = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not HEADING.match(lines[i]) and not LIST.match(lines[i]) and not lines[i].startswith("```") and not lines[i].lstrip().startswith("|"):
            paragraph_lines.append(lines[i].strip())
            i += 1
        paragraph = document.add_paragraph()
        inline(paragraph, " ".join(paragraph_lines))
    document.save(destination)
    print(f"{source.relative_to(ROOT)} -> {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Exportar os documentos financeiros editáveis.")
    parser.add_argument("--only", choices=("relatorio", "manual"), help="Actualiza apenas o documento indicado.")
    choice = parser.parse_args().only
    selected = FILES if choice is None else (FILES[0] if choice == "relatorio" else FILES[1],)
    for source_path, destination_path in selected:
        convert(source_path, destination_path)
