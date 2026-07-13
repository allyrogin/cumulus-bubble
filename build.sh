#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "Building Cumulus Bubble..."
swiftc -O main.swift -o CumulusBubble
chmod +x CumulusBubble
echo "Done. Run it with ./run.sh"
