import os
from PIL import Image, ImageDraw

def create_icon(size, path):
    # Create a green background
    img = Image.new('RGB', (size, size), color='#16a34a')
    d = ImageDraw.Draw(img)
    
    # Draw a simple white square (representing a bin/QR)
    margin = size * 0.25
    d.rectangle([margin, margin, size-margin, size-margin], fill='white')
    
    # Save the image
    img.save(path)

if __name__ == "__main__":
    os.makedirs('frontend/vendor/images', exist_ok=True)
    
    # Create PNG icons for PWA
    create_icon(192, 'frontend/vendor/images/icon-192.png')
    create_icon(512, 'frontend/vendor/images/icon-512.png')
    
    # Create favicon
    create_icon(32, 'frontend/favicon.ico')
    print("Icons generated successfully.")
