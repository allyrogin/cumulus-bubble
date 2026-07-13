#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

if [ ! -f "./CumulusBubble" ]; then
  echo "CumulusBubble hasn't been built yet. Running build.sh first..."
  ./build.sh
fi

./CumulusBubble
