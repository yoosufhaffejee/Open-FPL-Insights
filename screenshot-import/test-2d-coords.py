from PIL import Image
import os

def find_name_plates(image_path):
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    pixels = img.load()
    
    white_rows = [0] * height
    for y in range(0, height, 2):
        for x in range(0, width, 4):
            r, g, b = pixels[x, y]
            if r > 230 and g > 230 and b > 230:
                white_rows[y] += 1
                
    y_clusters = []
    current = None
    min_white_y = (width / 4) * 0.02
    
    for y in range(0, height, 2):
        if white_rows[y] > min_white_y:
            if not current: current = {'start': y, 'end': y}
            else: current['end'] = y
        else:
            if current:
                y_clusters.append(current)
                current = None
    if current: y_clusters.append(current)
    
    min_height = height * 0.015
    y_clusters = [c for c in y_clusters if (c['end'] - c['start']) > min_height]
    
    plates = []
    for y_c in y_clusters:
        white_cols = [0] * width
        for y in range(y_c['start'], y_c['end'] + 1, 2):
            for x in range(0, width, 2):
                r, g, b = pixels[x, y]
                if r > 230 and g > 230 and b > 230:
                    white_cols[x] += 1
                    
        x_clusters = []
        curr_x = None
        min_white_x = ((y_c['end'] - y_c['start']) / 2) * 0.3
        
        for x in range(0, width, 2):
            if white_cols[x] > min_white_x:
                if not curr_x: curr_x = {'start': x, 'end': x}
                else: curr_x['end'] = x
            else:
                if curr_x:
                    x_clusters.append(curr_x)
                    curr_x = None
        if curr_x: x_clusters.append(curr_x)
        
        min_width = width * 0.05
        for x_c in x_clusters:
            if (x_c['end'] - x_c['start']) > min_width:
                plates.append({
                    'x': x_c['start'],
                    'y': y_c['start'],
                    'width': x_c['end'] - x_c['start'],
                    'height': y_c['end'] - y_c['start']
                })
    return plates

res = find_name_plates(r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots\Dekstop-Cropped.png")
for p in res:
    print(p)
