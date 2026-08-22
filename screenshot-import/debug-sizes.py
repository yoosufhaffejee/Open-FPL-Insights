from PIL import Image
import os

folder = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots"
for file in os.listdir(folder):
    if file.endswith(".py"): continue
    path = os.path.join(folder, file)
    img = Image.open(path)
    print(f"{file}: Size={img.size}")
