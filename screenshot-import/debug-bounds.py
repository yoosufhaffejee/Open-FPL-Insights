from PIL import Image
import os

def find_pitch_bounds(image_path):
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    step = 5
    
    row_counts = [0] * height
    col_counts = [0] * width
    
    pixels = img.load()
    
    for y in range(0, height, step):
        for x in range(0, width, step):
            r, g, b = pixels[x, y]
            if g > 60 and g > r * 1.15 and g > b * 1.15:
                row_counts[y] += 1
                col_counts[x] += 1
                
    x_threshold = (height / step) * 0.05
    y_threshold = (width / step) * 0.05
    
    min_x, max_x = width, 0
    min_y, max_y = height, 0
    
    for x in range(0, width, step):
        if col_counts[x] > x_threshold:
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            
    for y in range(0, height, step):
        if row_counts[y] > y_threshold:
            if y < min_y: min_y = y
            if y > max_y: max_y = y
            
    if max_x <= min_x or max_y <= min_y:
        return (0, 0, width, height, False)
        
    return (min_x, min_y, max_x - min_x, max_y - min_y, True)

folder = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots"
for file in os.listdir(folder):
    path = os.path.join(folder, file)
    bounds = find_pitch_bounds(path)
    print(f"{file}: Bounds={bounds}")
