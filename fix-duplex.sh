#!/bin/bash

# Fix all Next.js redirect routes to include duplex: "half" when sending a body

# Find all route files with body: request.body
FILES=$(find apps/api/app/api -name "route.ts" -o -name "route.tsx" | xargs grep -l "body: request.body,")

for file in $FILES; do
  echo "Fixing: $file"
  
  # Use sed to add duplex: "half" after body: request.body,
  # and add the RequestInit type cast
  sed -i '' 's/body: request\.body,$/body: request.body,\
    duplex: "half", \/\/ Required when sending a body/' "$file"
  
  # Add RequestInit type cast to the closing brace
  sed -i '' 's/  })$/  } as RequestInit)/' "$file"
done

echo "Done! Fixed $(echo "$FILES" | wc -l) files"
