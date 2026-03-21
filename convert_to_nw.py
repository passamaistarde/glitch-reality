# -*- coding: utf-8 -*-
"""Convert GATE BREAK chapter HTML files to a novelWriter project."""

import os
import re
import uuid
import hashlib
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import indent as xmlIndent
from pathlib import Path
from html.parser import HTMLParser
from datetime import datetime, timezone


# ── Configuration ──────────────────────────────────────────────
PROJECT_NAME = "GATE BREAK — เลกันต์"
AUTHOR_NAME = ""
LANGUAGE = "th"
CHAPTERS_DIR = Path(__file__).parent / "chapters"
OUTPUT_DIR = Path(__file__).parent / "GATE_BREAK_NW"

# ── Helper to generate 13-char hex handles like novelWriter ───
def make_handle():
    return uuid.uuid4().hex[:13]


# ── HTML to novelWriter markup converter ──────────────────────
class HTMLToNWD(HTMLParser):
    """Convert chapter HTML to novelWriter .nwd markup."""

    def __init__(self):
        super().__init__()
        self._text_parts: list[str] = []
        self._current_line: list[str] = []
        self._in_tag: str = ""
        self._tag_class: str = ""
        self._bold = False
        self._italic = False
        self._in_status_box = False
        self._in_status_title = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get("class", "")

        if tag in ("h1", "h2", "h3"):
            self._in_tag = tag
            self._current_line = []
        elif tag == "p":
            self._in_tag = "p"
            self._tag_class = cls
            self._current_line = []
            if cls == "status-title":
                self._in_status_title = True
        elif tag == "hr":
            self._text_parts.append("")
            self._text_parts.append("%~")
            self._text_parts.append("")
        elif tag == "div" and "status-box" in cls:
            self._in_status_box = True
            self._text_parts.append("")
            self._text_parts.append("%~")
            self._text_parts.append("")
        elif tag == "strong":
            self._bold = True
        elif tag == "em":
            self._italic = True

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3") and self._in_tag == tag:
            text = "".join(self._current_line).strip()
            level = int(tag[1])
            prefix = "#" * level
            self._text_parts.append(f"{prefix} {text}")
            self._text_parts.append("")
            self._in_tag = ""
            self._current_line = []
        elif tag == "p" and self._in_tag == "p":
            text = "".join(self._current_line).strip()
            if self._tag_class == "system-message":
                # System messages: format as bold gold comment
                self._text_parts.append(f"**{text}**")
            elif self._in_status_title:
                self._text_parts.append(f"**{text}**")
                self._in_status_title = False
            elif self._in_status_box:
                self._text_parts.append(text)
            else:
                self._text_parts.append(text)
            self._text_parts.append("")
            self._in_tag = ""
            self._tag_class = ""
            self._current_line = []
        elif tag == "div" and self._in_status_box:
            self._in_status_box = False
            self._text_parts.append("%~")
            self._text_parts.append("")
        elif tag == "strong":
            self._bold = False
        elif tag == "em":
            self._italic = False

    def handle_data(self, data):
        if self._in_tag in ("h1", "h2", "h3", "p"):
            text = data
            if self._bold and self._italic:
                text = f"**_{text}_**"
            elif self._bold:
                text = f"**{text}**"
            elif self._italic:
                text = f"_{text}_"
            self._current_line.append(text)

    def get_nwd_text(self) -> str:
        # Clean up excessive blank lines
        lines = self._text_parts
        result = []
        prev_blank = False
        for line in lines:
            if line == "":
                if not prev_blank:
                    result.append("")
                prev_blank = True
            else:
                result.append(line)
                prev_blank = False
        return "\n".join(result).strip() + "\n"


def html_to_nwd(html_content: str) -> tuple[str, str]:
    """Convert HTML to .nwd content. Returns (title, nwd_text)."""
    parser = HTMLToNWD()
    parser.feed(html_content)
    nwd_text = parser.get_nwd_text()

    # Extract title from first ## heading
    title_match = re.search(r"^## (.+)$", nwd_text, re.MULTILINE)
    if not title_match:
        title_match = re.search(r"^# (.+)$", nwd_text, re.MULTILINE)
    title = title_match.group(1).strip() if title_match else "Untitled"

    return title, nwd_text


def compute_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:16]


def create_nw_project():
    """Create a complete novelWriter project from HTML chapters."""

    # Collect chapter files
    chapter_files = sorted(CHAPTERS_DIR.glob("chapter-*.html"))
    if not chapter_files:
        print("No chapter files found!")
        return

    print(f"Found {len(chapter_files)} chapters")

    # Create output directories
    OUTPUT_DIR.mkdir(exist_ok=True)
    content_dir = OUTPUT_DIR / "content"
    content_dir.mkdir(exist_ok=True)
    meta_dir = OUTPUT_DIR / "meta"
    meta_dir.mkdir(exist_ok=True)

    # Generate handles
    project_uuid = str(uuid.uuid4())
    novel_root_handle = make_handle()
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    items = []  # For XML content section

    # Create Novel root item
    items.append({
        "name": PROJECT_NAME,
        "itemAttr": {
            "handle": novel_root_handle,
            "parent": "None",
            "root": novel_root_handle,
            "order": "0",
            "type": "ROOT",
            "class": "NOVEL",
        },
        "metaAttr": {
            "expanded": "yes",
        },
        "nameAttr": {
            "status": "s000000",
            "import": "i000000",
        },
    })

    # Process each chapter
    total_words = 0
    total_chars = 0
    total_paras = 0

    for idx, chapter_file in enumerate(chapter_files):
        print(f"Processing: {chapter_file.name}")
        html_content = chapter_file.read_text(encoding="utf-8")
        title, nwd_text = html_to_nwd(html_content)

        # Stats
        words = len(nwd_text.split())
        chars = len(nwd_text)
        paras = len([l for l in nwd_text.split("\n") if l.strip() and not l.startswith("#") and l.strip() != "%~"])
        total_words += words
        total_chars += chars
        total_paras += paras

        # Create handle for this chapter file
        ch_handle = make_handle()
        write_hash = compute_hash(nwd_text)

        # Write .nwd file
        nwd_header = (
            f"%%~name: {title}\n"
            f"%%~path: {novel_root_handle}/{ch_handle}\n"
            f"%%~kind: NOVEL/DOCUMENT\n"
            f"%%~hash: {write_hash}\n"
            f"%%~date: {now_str}/{now_str}\n"
        )

        nwd_path = content_dir / f"{ch_handle}.nwd"
        nwd_path.write_text(nwd_header + nwd_text, encoding="utf-8")

        # Add to items list
        items.append({
            "name": title,
            "itemAttr": {
                "handle": ch_handle,
                "parent": novel_root_handle,
                "root": novel_root_handle,
                "order": str(idx),
                "type": "FILE",
                "class": "NOVEL",
                "layout": "DOCUMENT",
            },
            "metaAttr": {
                "expanded": "no",
                "heading": "T0001",
                "charCount": str(chars),
                "wordCount": str(words),
                "paraCount": str(paras),
                "cursorPos": "0",
            },
            "nameAttr": {
                "status": "s000000",
                "import": "i000000",
                "active": "yes",
            },
        })

    # ── Build nwProject.nwx XML ──
    xRoot = ET.Element("novelWriterXML", attrib={
        "appVersion": "2.8.2",
        "hexVersion": "0x020802f0",
        "fileVersion": "1.5",
        "fileRevision": "6",
        "timeStamp": now_str,
    })

    # Project section
    xProject = ET.SubElement(xRoot, "project", attrib={
        "id": project_uuid,
        "saveCount": "1",
        "autoCount": "0",
        "editTime": "0",
    })
    xName = ET.SubElement(xProject, "name")
    xName.text = PROJECT_NAME
    xAuthor = ET.SubElement(xProject, "author")
    xAuthor.text = AUTHOR_NAME

    # Settings section
    xSettings = ET.SubElement(xRoot, "settings")
    xBackup = ET.SubElement(xSettings, "doBackup")
    xBackup.text = "yes"
    xLang = ET.SubElement(xSettings, "language")
    xLang.text = LANGUAGE
    xSpell = ET.SubElement(xSettings, "spellChecking", attrib={"auto": "no"})
    xSpell.text = ""
    xLast = ET.SubElement(xSettings, "lastHandle")

    # Status entries
    xStatus = ET.SubElement(xSettings, "status")
    for sid, sname, scolor in [
        ("s000000", "New", "100,100,100"),
        ("s000001", "Note", "200,50,0"),
        ("s000002", "Draft", "0,80,220"),
        ("s000003", "Finished", "0,180,0"),
    ]:
        xEntry = ET.SubElement(xStatus, "entry", attrib={"key": sid, "count": "0", "red": scolor.split(",")[0], "green": scolor.split(",")[1], "blue": scolor.split(",")[2]})
        xEntry.text = sname

    # Importance entries
    xImport = ET.SubElement(xSettings, "importance")
    for iid, iname, icolor in [
        ("i000000", "New", "100,100,100"),
        ("i000001", "Minor", "0,80,220"),
        ("i000002", "Major", "0,180,0"),
    ]:
        xEntry = ET.SubElement(xImport, "entry", attrib={"key": iid, "count": "0", "red": icolor.split(",")[0], "green": icolor.split(",")[1], "blue": icolor.split(",")[2]})
        xEntry.text = iname

    # Auto-replace (empty)
    xReplace = ET.SubElement(xSettings, "autoReplace")

    # Content section
    xContent = ET.SubElement(xRoot, "content", attrib={
        "items": str(len(items)),
        "novelWords": str(total_words),
        "notesWords": "0",
        "novelChars": str(total_chars),
        "notesChars": "0",
    })

    for item_data in items:
        xItem = ET.SubElement(xContent, "item", attrib=item_data["itemAttr"])
        ET.SubElement(xItem, "meta", attrib=item_data["metaAttr"])
        xItemName = ET.SubElement(xItem, "name", attrib=item_data["nameAttr"])
        xItemName.text = item_data["name"]

    # Write XML
    tree = ET.ElementTree(xRoot)
    xmlIndent(tree)
    nwx_path = OUTPUT_DIR / "nwProject.nwx"
    tree.write(str(nwx_path), encoding="utf-8", xml_declaration=True)

    print(f"\nProject created at: {OUTPUT_DIR}")
    print(f"  Chapters: {len(chapter_files)}")
    print(f"  Total words: {total_words}")
    print(f"  Total chars: {total_chars}")
    print(f"\nOpen novelWriter → Project → Open → Browse to:")
    print(f"  {OUTPUT_DIR}")


if __name__ == "__main__":
    create_nw_project()
