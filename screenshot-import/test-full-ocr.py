import pytesseract
from PIL import Image
import os

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

folder = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots"
file = "Desktop-Full.png"
path = os.path.join(folder, file)

try:
    img = Image.open(path)
    text = pytesseract.image_to_string(img)
    print("----- Desktop-Full.png -----")
    print(text)
except Exception as e:
    print(e)
