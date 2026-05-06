from pathlib import Path
import re

SHELL = Path(
    r"c:\Users\EurisDiaz\OneDrive - Clara Fortuna\Documents\02. CLCPA\CLCPA-full-numeric-lookuptypes-noids-src\WebResources\cf_clcpa_dac_shell"
)
text = SHELL.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
main_m = re.search(r'(<main class="content">)(.*?)(</main>\s*</div>)', text, re.DOTALL)
main_body = main_m.group(2)
start = main_body.find('<div id="view-a"')
nxt = main_body.find("\n    <div id=\"view-", start + 1)
block = main_body[start:nxt]
lines = block.split("\n")
while lines and not lines[-1].strip():
    lines.pop()
print("last3", lines[-3:])
inner_lines = lines[1:]
inner = "\n".join(inner_lines[:-1])
print("vis", inner.find("<section class=\"shell-visuals-panel\""))
print("tail", repr(inner[-120:]))
