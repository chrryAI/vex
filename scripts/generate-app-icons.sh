#!/bin/bash

# Array of app names
apps=("atlas" "bloom" "blossom" "chrry" "focus" "peach" "popcorn" "sushi" "vault" "vex", 'zarathustra')

# Icon sizes
sizes=(16 32 48 128)

# Base directories
input_dir="apps/web/public/images/apps"
output_dir="apps/extension/public/icons"

# Create output directory if it doesn't exist
mkdir -p "$output_dir"

echo "🎨 Generating extension icons for all apps..."
echo ""

# Loop through each app
for app in "${apps[@]}"; do
  echo "📦 Processing $app..."
  
  input_file="$input_dir/${app}.png"
  
  if [ ! -f "$input_file" ]; then
    echo "  ❌ File not found: $input_file"
    continue
  fi
  
  # Generate each size
  for size in "${sizes[@]}"; do
    output_file="$output_dir/${app}-icon-${size}.png"
    
    # Use sips (built-in macOS tool) instead of ImageMagick
    sips -z $size $size "$input_file" --out "$output_file" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
      echo "  ✅ Created ${app}-icon-${size}.png"
    else
      echo "  ❌ Failed to create ${app}-icon-${size}.png"
    fi
  done
  echo ""
done

echo "🎉 All icons generated in $output_dir!"
