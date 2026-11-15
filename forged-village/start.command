#!/bin/bash
# Double-click this file to open the FORGED village in your browser.
# Close the Terminal window it opens when you're done.
cd "$(dirname "$0")"
PORT=8137
(sleep 1 && open "http://localhost:$PORT") &
python3 serve.py "$PORT"
