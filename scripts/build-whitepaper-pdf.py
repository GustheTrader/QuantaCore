"""Build the branded PDF from the canonical whitepaper text."""
from pathlib import Path
import re
import shutil
from html import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, NextPageTemplate, Flowable
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/whitepapers/QuantaOS_Sovereign_Intelligence_Whitepaper_v1.4.pdf'
ART = ROOT / 'public/images/quanta-sovereign-whitepaper-cover.png'
SOURCE = ROOT / 'services/whitepaperContent.ts'
NAVY = colors.HexColor('#07162c')
INK = colors.HexColor('#17283e')
MUTED = colors.HexColor('#52647a')
CYAN = colors.HexColor('#0089a5')
ORANGE = colors.HexColor('#ef852d')
PAGE_W, PAGE_H = 612, 792
pdfmetrics.registerFont(TTFont('Quanta', 'C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('QuantaBold', 'C:/Windows/Fonts/arialbd.ttf'))
pdfmetrics.registerFontFamily('Quanta', normal='Quanta', bold='QuantaBold', italic='Quanta', boldItalic='QuantaBold')

body = ParagraphStyle('Body', fontName='Quanta', fontSize=10, leading=14.5, textColor=INK, spaceAfter=8, allowWidows=0, allowOrphans=0)
heading = ParagraphStyle('Chapter', fontName='QuantaBold', fontSize=16, leading=20, textColor=NAVY, spaceBefore=20, spaceAfter=10, keepWithNext=True)
subheading = ParagraphStyle('Subchapter', parent=heading, fontSize=12, leading=17, spaceBefore=14)
bullets = ParagraphStyle('List', parent=body, leftIndent=14, firstLineIndent=-10, spaceAfter=5)
small = ParagraphStyle('Small', parent=body, fontSize=9, leading=14, textColor=MUTED)

class Whitepaper(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name in ('Chapter', 'Subchapter'):
            level = 0 if flowable.style.name == 'Chapter' else 1
            text = flowable.getPlainText()
            key = f'heading-{self.page}-{text}'
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(text, key, level=level, closed=False)
            self.notify('TOCEntry', (level, text, self.page, key))

def cover(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor('#ee9a4f'))
    c.setLineWidth(.8)
    c.roundRect(28, 28, PAGE_W-56, PAGE_H-56, 18, stroke=1, fill=0)
    c.setFillColor(colors.HexColor('#79dcec'))
    c.setFont('QuantaBold', 10)
    c.drawString(50, 725, 'QUANTA / SOVEREIGN SI')
    c.setFillColor(colors.white)
    c.setFont('QuantaBold', 33)
    c.drawString(50, 665, 'Your intelligence.')
    c.setFillColor(colors.HexColor('#ffb258'))
    c.drawString(50, 624, 'Your rules.')
    c.setFont('Quanta', 14)
    c.setFillColor(colors.HexColor('#d1e0f2'))
    c.drawString(50, 586, 'Composable Sovereign AI')
    c.drawString(50, 565, 'and ownership of your agentic system')
    c.drawImage(str(ART), 38, 215, width=536, height=302, preserveAspectRatio=True, anchor='c', mask='auto')
    c.setFillColor(colors.HexColor('#87cbd9'))
    c.setFont('QuantaBold', 9)
    c.drawString(50, 178, 'DATA  /  MODELS  /  MEMORY  /  INFERENCE  /  AGENTS')
    c.setFont('Quanta', 11)
    c.setFillColor(colors.HexColor('#d1e0f2'))
    c.drawString(50, 150, 'Privacy. Business IP. Knowledge you can carry with you.')
    c.setStrokeColor(colors.HexColor('#334964'))
    c.line(50, 112, 562, 112)
    c.setFont('Quanta', 9)
    c.drawString(50, 88, 'Product whitepaper  |  Version 1.4  |  October 2026')
    c.drawString(50, 71, 'Quanta-OS Research Initiative')
    c.restoreState()

def page_chrome(c, doc):
    c.saveState()
    c.setFillColor(NAVY)
    c.rect(0, PAGE_H-12, PAGE_W, 12, stroke=0, fill=1)
    c.setFillColor(MUTED)
    c.setFont('QuantaBold', 8)
    c.drawString(54, PAGE_H-39, 'QUANTA / COMPOSABLE SOVEREIGN AI')
    c.setStrokeColor(colors.HexColor('#d6e1ec'))
    c.line(54, 48, PAGE_W-54, 48)
    c.setFont('Quanta', 8)
    c.drawString(54, 32, 'WHITEPAPER v1.4  •  OCTOBER 2026')
    c.drawRightString(PAGE_W-54, 32, str(doc.page))
    c.restoreState()

class Architecture(Flowable):
    def __init__(self):
        Flowable.__init__(self)
        self.width, self.height = 504, 140
    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.roundRect(0, 0, self.width, self.height, 12, fill=1, stroke=0)
        c.setFillColor(colors.HexColor('#81dceb'))
        c.setFont('QuantaBold', 9)
        c.drawString(18, 116, 'INDEPENDENT PIECES. CONNECTED INTELLIGENCE.')
        labels = ['Data', 'Models', 'Memory', 'Inference', 'Agents']
        for i, label in enumerate(labels):
            x = 18 + i*95
            c.setFillColor(colors.HexColor('#122b47'))
            c.roundRect(x, 63, 87, 34, 7, fill=1, stroke=0)
            c.setFillColor(colors.white)
            c.setFont('QuantaBold', 9)
            c.drawCentredString(x+43.5, 76, label)
        c.setFillColor(colors.HexColor('#ffb258'))
        c.setFont('QuantaBold', 9)
        c.drawString(18, 36, 'Brain   /   Hands   /   Nervous System   /   Governess')
        c.setFont('Quanta', 8)
        c.setFillColor(colors.HexColor('#c5d5e6'))
        c.drawString(18, 17, 'Choose components. Define boundaries. Preserve a practical exit path.')

text = SOURCE.read_text(encoding='utf-8')
text = text.split('export const WHITEPAPER_TEXT = `', 1)[1].rsplit('`;', 1)[0].strip()
content = text[text.index('ABSTRACT'):].split('\n---\nEnd of Document')[0].strip()
OUT.parent.mkdir(parents=True, exist_ok=True)
doc = Whitepaper(str(OUT), pagesize=(PAGE_W, PAGE_H), leftMargin=54, rightMargin=54, topMargin=64, bottomMargin=64,
    title='Quanta Composable Sovereign AI and Ownership of Your Agentic System', author='Quanta-OS Research Initiative',
    subject='Privacy, business IP, composability and voluntary data value')
frame = Frame(54, 64, 504, 664, id='body', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate(id='Cover', frames=[frame], onPage=cover), PageTemplate(id='Body', frames=[frame], onPage=page_chrome)])
story = [Spacer(1, 1), NextPageTemplate('Body'), PageBreak()]
story.append(Paragraph('Inside this whitepaper', ParagraphStyle('ContentsTitle', parent=heading, fontSize=25, leading=30, spaceBefore=0)))
story.append(Paragraph('The case for operator control, the architecture that supports it, and the boundaries between working components and the production roadmap.', body))
toc = TableOfContents()
toc.levelStyles = [ParagraphStyle('TOC0', fontName='Quanta', fontSize=9.5, leading=13, textColor=INK, spaceBefore=6), ParagraphStyle('TOC1', fontName='Quanta', fontSize=9, leading=12, leftIndent=14, textColor=MUTED, spaceBefore=3)]
story.extend([toc, PageBreak()])

pending = []
def flush():
    if pending:
        story.append(Paragraph(escape(' '.join(pending)), body))
        pending.clear()

for line in content.splitlines():
    line = line.strip()
    is_heading = line in ('ABSTRACT', 'CONCLUSION') or bool(re.match(r'^\d+(?:\.\d+)?[. ]', line)) and line == line.upper()
    if is_heading:
        flush()
        is_sub = bool(re.match(r'^\d+\.\d+', line))
        display = line.title().replace('Ai', 'AI').replace('Ip', 'IP').replace('Kb', 'KB').replace('Fpt-Omega', 'FPT-Omega').replace('Sme', 'SME')
        story.append(Paragraph(escape(display), subheading if is_sub else heading))
    elif not line:
        flush()
    elif line.startswith('• ') or re.match(r'^\d+\. ', line):
        flush()
        story.append(Paragraph(escape(line), bullets))
    else:
        pending.append(line)
flush()

doc.multiBuild(story)
for folder in ['docs', 'dist/whitepapers']:
    destination = ROOT / folder
    destination.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT, destination / OUT.name)
print(OUT)

# Render the actual PDF for visual inspection, separate from deliverables.
import pypdfium2 as pdfium
from PIL import Image, ImageDraw
pdf = pdfium.PdfDocument(str(OUT))
qa = ROOT / '.quanta/whitepaper-pdf-review'
qa.mkdir(parents=True, exist_ok=True)
thumbs = []
for i, page in enumerate(pdf):
    image = page.render(scale=1.4).to_pil()
    image.save(qa / f'page-{i+1:02}.png')
    image.thumbnail((306, 396))
    thumbs.append(image)
sheet = Image.new('RGB', (3*326, ((len(thumbs)+2)//3)*426), '#dbe3ed')
draw = ImageDraw.Draw(sheet)
for i, image in enumerate(thumbs):
    x, y = (i%3)*326+10, (i//3)*426+10
    sheet.paste(image, (x, y))
    draw.text((x, y+399), f'Page {i+1}', fill='#17283e')
sheet.save(qa / 'contact-sheet.jpg')
print(f'Rendered {len(pdf)} pages for review.')
