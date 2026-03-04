#!/bin/bash
# Wrapper script for launchd to run fetch_ema.py + generate AI summary
cd /Users/davemac/Projects/DaveyBitcoins-Website
export PYTHONPATH="/Users/davemac/Library/Python/3.9/lib/python/site-packages"

# Load API key from env file if it exists
if [ -f scripts/.env ]; then
    export $(grep -v '^#' scripts/.env | xargs)
fi

/usr/bin/python3 scripts/fetch_ema.py --process
/usr/bin/python3 scripts/generate_summary.py
