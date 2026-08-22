from PIL import Image
import os

def find_row_y_exact(image_path):
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    pixels = img.load()
    
    rough_ys = [0.15, 0.35, 0.55, 0.75, 0.95]
    x_center = int(width * 0.5)
    box_width = int(width * 0.18)
    
    results = []
    
    for expected_y_pct in rough_ys:
        expected_y = int(expected_y_pct * height)
        window_start = max(0, expected_y - int(height * 0.15))
        window_end = min(height - 1, expected_y + int(height * 0.15))
        
        best_y = None
        max_white = 0
        
        for y in range(window_start, window_end):
            white_count = 0
            start_x = x_center - int(box_width/2)
            end_x = x_center + int(box_width/2)
            for x in range(start_x, end_x):
                r, g, b = pixels[x, y]
                if r > 220 and g > 220 and b > 220:
                    white_count += 1
            
            if white_count > max_white:
                max_white = white_count
                best_y = y
                
        results.append({'expected': expected_y, 'best_y': best_y, 'max_white_pct': max_white / box_width})
        
    return results

folder = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots"
for file in os.listdir(folder):
    if file.endswith(".py"): continue
    path = os.path.join(folder, file)
    try:
        res = find_row_y_exact(path)
        print(f"\n{file}:")
        for i, r in enumerate(res):
            print(f"  Row {i}: Expected={r['expected']}, BestY={r['best_y']} (MaxWhite={r['max_white_pct']:.2f})")
    except Exception as e:
        pass
