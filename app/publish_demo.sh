#!/bin/sh
# Rebuild the read-only demo and publish it to the gh-pages branch (served by GitHub Pages).
# Run from the repository root after pushing main:  sh app/publish_demo.sh
set -e
tmp=$(mktemp -d)
python3 app/export_static.py "$tmp/site"
git worktree add --force "$tmp/pages" gh-pages 2>/dev/null || git worktree add --force --orphan -b gh-pages "$tmp/pages"
find "$tmp/pages" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R "$tmp/site/." "$tmp/pages/"
git -C "$tmp/pages" add -A
git -C "$tmp/pages" commit -q -m "Publish demo from $(git rev-parse --short HEAD)" || echo "Demo unchanged"
git -C "$tmp/pages" push -q origin gh-pages
git worktree remove --force "$tmp/pages"
echo "Published: https://mohoss1985-tech.github.io/AI-skills/"
