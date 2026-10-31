"""Uploaded sources: the documents a deliverable is built from (the privileged source of information).

Two scopes: one deliverable ("req-12"), or a whole skill ("skill-running-uat": knowledge reused by
every deliverable of that type). Word and Excel files get a .txt next to them so Claude can read the
text; PDFs and images are read as they are.
"""

import base64
import csv
import io
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent / "data" / "uploads"
ALLOWED = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv", ".txt", ".md", ".png", ".jpg", ".jpeg", ".pptx"}
MAX_BYTES = 25 * 1024 * 1024
KIND = {".pdf": "pdf", ".docx": "word", ".doc": "word", ".xlsx": "excel", ".xls": "excel", ".csv": "table",
        ".txt": "text", ".md": "text", ".png": "image", ".jpg": "image", ".jpeg": "image", ".pptx": "slides"}
SCOPE = re.compile(r"(req-\d+|skill-[a-z-]+)")
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


def folder(scope):
    if not SCOPE.fullmatch(scope or ""):
        raise ValueError("bad scope")
    return ROOT / scope


def safe_name(name):
    name = Path(name or "file").name
    stem, ext = Path(name).stem, Path(name).suffix.lower()
    stem = re.sub(r"[^\w .()-]+", "_", stem).strip() or "file"
    return stem[:80] + ext


def save(scope, name, data_b64):
    name = safe_name(name)
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED:
        raise ValueError(f"{name}: file type not supported (PDF, Word, Excel, PowerPoint, CSV, text, PNG or JPEG)")
    data = base64.b64decode(data_b64.split(",", 1)[-1])
    if len(data) > MAX_BYTES:
        raise ValueError(f"{name}: larger than 25 MB")
    d = folder(scope)
    d.mkdir(parents=True, exist_ok=True)
    path = d / name
    n = 2
    while path.exists():
        path = d / f"{Path(name).stem} ({n}){ext}"
        n += 1
    path.write_bytes(data)
    text = extract(path)
    if text is not None:
        path.with_name(path.name + ".txt").write_text(text, encoding="utf-8")
    return path.name


def remove(scope, name):
    d = folder(scope)
    for p in (d / safe_name(name), d / (safe_name(name) + ".txt")):
        if p.is_file() and p.parent == d:
            p.unlink()


def listing(scope):
    d = folder(scope)
    if not d.is_dir():
        return []
    out = []
    for p in sorted(d.iterdir(), key=lambda p: p.stat().st_mtime):
        if p.name.endswith(".txt") and (d / p.name[:-4]).exists():
            continue
        ext = p.suffix.lower()
        sidecar = p.with_name(p.name + ".txt")
        out.append({"name": p.name, "size": p.stat().st_size, "kind": KIND.get(ext, "file"),
                    "path": str(p), "text_path": str(sidecar) if sidecar.exists() else None})
    return out


# ---------- text extraction (stdlib only) ----------

def extract(path):
    ext = path.suffix.lower()
    try:
        if ext == ".docx":
            return _docx(path)
        if ext == ".xlsx":
            return _xlsx(path)
        if ext == ".pptx":
            return _pptx(path)
        if ext in (".doc", ".xls"):
            return f"[{path.name}: old binary Office format, text not extracted. Save it as .docx / .xlsx for best results.]"
    except (zipfile.BadZipFile, ET.ParseError, KeyError) as e:
        return f"[{path.name}: text could not be extracted ({e})]"
    return None  # PDF, images, CSV and text are read directly


def _docx(path):
    with zipfile.ZipFile(path) as z:
        body = ET.fromstring(z.read("word/document.xml")).find(W + "body")
    text = lambda el: "".join(x.text or "" for x in el.iter(W + "t")).strip()
    lines = []
    for block in body:
        if block.tag == W + "p" and text(block):
            lines.append(text(block))
        elif block.tag == W + "tbl":
            lines += [" | ".join(text(c) for c in row.iter(W + "tc")) for row in block.iter(W + "tr")] + [""]
    return "\n".join(lines)


def _xlsx(path):
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(S + "si"):
                shared.append("".join(t.text or "" for t in si.iter(S + "t")))
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        names = [s.get("name") for s in wb.iter(S + "sheet")]
        sheets = sorted((n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)),
                        key=lambda n: int(re.search(r"(\d+)", n).group(1)))
        out = []
        for i, sh in enumerate(sheets):
            out.append(f"## Sheet: {names[i] if i < len(names) else sh}")
            buf = io.StringIO()
            w = csv.writer(buf)
            for row in ET.fromstring(z.read(sh)).iter(S + "row"):
                vals = {}
                for c in row.iter(S + "c"):
                    col = re.match(r"[A-Z]+", c.get("r", "A")).group(0)
                    v = c.find(S + "v")
                    t = c.get("t")
                    if t == "s" and v is not None:
                        val = shared[int(v.text)]
                    elif t == "inlineStr":
                        val = "".join(x.text or "" for x in c.iter(S + "t"))
                    else:
                        val = v.text if v is not None else ""
                    vals[_col(col)] = val
                if vals:
                    w.writerow([vals.get(i, "") for i in range(max(vals) + 1)])
            out.append(buf.getvalue())
        return "\n".join(out)


def _col(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def _pptx(path):
    with zipfile.ZipFile(path) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
                        key=lambda n: int(re.search(r"(\d+)", n).group(1)))
        out = []
        for i, s in enumerate(slides, 1):
            texts = [t.text for t in ET.fromstring(z.read(s)).iter(A + "t") if t.text]
            out.append(f"## Slide {i}\n" + "\n".join(texts))
        return "\n\n".join(out)
