from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "images" / "budget-quest-preview.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 960, 620
img = Image.new("RGB", (W, H), "#FFFBE6")
draw = ImageDraw.Draw(img)

try:
    title_font = ImageFont.truetype("arialbd.ttf", 58)
    label_font = ImageFont.truetype("arialbd.ttf", 26)
    body_font = ImageFont.truetype("arial.ttf", 22)
except OSError:
    title_font = ImageFont.load_default()
    label_font = ImageFont.load_default()
    body_font = ImageFont.load_default()

def rect(x1, y1, x2, y2, fill, shadow=8):
    draw.rectangle((x1 + shadow, y1 + shadow, x2 + shadow, y2 + shadow), fill="#000000")
    draw.rectangle((x1, y1, x2, y2), fill=fill, outline="#000000", width=5)

rect(55, 55, 905, 565, "#F0FFF4", 12)
draw.text((90, 90), "BUDGET TRACKER QUEST", fill="#000000", font=title_font)
draw.line((90, 165, 870, 165), fill="#000000", width=5)

levels = [
    ("01", "SETUP", "#FAFF00"),
    ("02", "LEARN", "#FFFFFF"),
    ("03", "BUILD", "#FFFFFF"),
    ("04", "CHECK", "#0033FF"),
    ("05", "MISSION", "#FF2D78"),
]

x = 90
for number, label, fill in levels:
    rect(x, 210, x + 130, 340, fill, 6)
    text_color = "#FFFFFF" if fill in {"#0033FF", "#FF2D78"} else "#000000"
    draw.text((x + 22, 235), number, fill=text_color, font=title_font)
    draw.text((x + 18, 300), label, fill=text_color, font=label_font)
    x += 155

rect(90, 400, 410, 500, "#0033FF", 8)
draw.text((118, 426), "GROUP FEATURE", fill="#FFFFFF", font=label_font)
draw.text((118, 462), "PDF UNLOCKED", fill="#FFFFFF", font=body_font)

rect(470, 400, 870, 500, "#FAFF00", 8)
draw.text((500, 426), "PROGRESS CODE: G7-4821", fill="#000000", font=label_font)
draw.text((500, 462), "Save it. Continue later.", fill="#000000", font=body_font)

img.save(OUT)
print(OUT)
