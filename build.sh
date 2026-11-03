#!/bin/sh
# Baut index.html aus den Teilen in src/.
set -e
cd "$(dirname "$0")/src"
{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>body{margin:0;font-size:14px}[hidden]{display:none!important}img{max-width:100%}</style>'
  cat 01-head.html
  echo '</head><body>'
  cat 02-body.html
  echo '<script>'
  cat 03-data.js 04-sim-ground.js 05-sim-air.js 10-sim-base.js 13-campaign.js 06-scene-world.js 07-scene-actors.js 12-scene-base.js 14-pixel.js 08-ui-panels.js 11-audio.js 09-ui-main.js
  echo '</script></body></html>'
} > ../index.html
echo "gebaut: index.html"
