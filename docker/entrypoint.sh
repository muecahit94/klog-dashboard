#!/bin/sh

DATA_DIR="/usr/share/nginx/html/data"
OUTPUT_FILE="/usr/share/nginx/html/files.json"

generate_json() {
  # Use a temporary file to avoid partial reads
  TMP_FILE="$OUTPUT_FILE.tmp"
  echo "[" > "$TMP_FILE"
  FIRST=1
  
  # Check if directory exists and has files
  if [ -d "$DATA_DIR" ]; then
      for file in "$DATA_DIR"/*.klg "$DATA_DIR"/*.txt "$DATA_DIR"/*.klog; do
          if [ -f "$file" ]; then
              FILENAME=$(basename "$file")
              # Get mtime in seconds (compatible with busybox stat)
              MTIME=$(stat -c %Y "$file" 2>/dev/null || echo 0)
              
              if [ $FIRST -eq 0 ]; then
                  echo "," >> "$TMP_FILE"
              fi
              
              # Append JSON object manually
              echo "{\"path\": \"data/$FILENAME\", \"name\": \"$FILENAME\", \"mtime\": $MTIME}" >> "$TMP_FILE"
              FIRST=0
          fi
      done
  fi
  echo "]" >> "$TMP_FILE"
  
  # Atomically update the file
  mv "$TMP_FILE" "$OUTPUT_FILE"
}

echo "Starting klog file watcher..."

# Initial generation
generate_json

# Run watcher loop in background
(
  while true; do
    sleep 2
    generate_json
  done
) &

# Execute the passed command (usually "nginx -g 'daemon off;'")
exec "$@"
