from PIL import Image
import os

def find_white_clusters(image_path):
    img = Image.open(image_path).convert('RGB')
    width, height = img.size
    
    white_per_row = [0] * height
    pixels = img.load()
    
    for y in range(height):
        for x in range(0, width, 4):
            r, g, b = pixels[x, y]
            if r > 220 and g > 220 and b > 220:
                white_per_row[y] += 1
                
    clusters = []
    current_cluster = None
    min_white = (width / 4) * 0.04
    
    for y in range(height):
        if white_per_row[y] > min_white:
            if not current_cluster:
                current_cluster = {'start': y, 'end': y}
            else:
                current_cluster['end'] = y
        else:
            if current_cluster:
                clusters.append(current_cluster)
                current_cluster = None
    if current_cluster:
        clusters.append(current_cluster)
        
    min_height = height * 0.015
    valid_clusters = [c for c in clusters if (c['end'] - c['start']) > min_height]
    
    return valid_clusters

folder = r"C:\Users\Yoosuf\Documents\Open-FPL-Insights\screenshot-import\test screenshots"
for file in os.listdir(folder):
    if file.endswith(".py"): continue
    path = os.path.join(folder, file)
    try:
        clusters = find_white_clusters(path)
        print(f"{file}: Found {len(clusters)} clusters")
        for i, c in enumerate(clusters):
            print(f"  Row {i}: Y={c['start']} to {c['end']} (Height={c['end']-c['start']})")
    except Exception as e:
        print(f"{file}: Error {e}")
