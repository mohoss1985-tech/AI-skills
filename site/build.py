import html, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "site/page.src.html").read_text()
def sub(m):
    return html.escape((root / "skills" / m.group(1) / "SKILL.md").read_text())
out = re.sub(r"\{\{([a-z-]+)\}\}", sub, src)
(root / "site/index.html").write_text(out)
print("built", len(out))
