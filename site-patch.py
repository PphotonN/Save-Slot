from pathlib import Path

index_path = Path("index.html")
text = index_path.read_text(encoding="utf-8")

style_tag = '  <link rel="stylesheet" href="ux-fixes.css" />\n'
if 'href="ux-fixes.css"' not in text:
    text = text.replace('  <link rel="stylesheet" href="styles.css" />\n', '  <link rel="stylesheet" href="styles.css" />\n' + style_tag)

script_tag = '  <script src="ux-fixes.js"></script>\n'
if 'src="ux-fixes.js"' not in text:
    text = text.replace('  <script type="module" src="app.js"></script>\n', script_tag + '  <script type="module" src="app.js"></script>\n')

index_path.write_text(text, encoding="utf-8")
