#!/usr/bin/env python3
"""Add or replace the Kinyarwanda (`rw`) value of message keys.

Usage: python3 scripts/i18n-set-rw.py lib/i18n/messages/common.ts translations.json
translations.json is a flat object: { "ui.save": "Bika", ... }

Each message entry must be on one line:  'key': { en: '...', fr: '...' },
The script writes rw as a double-quoted string (safe for Kinyarwanda apostrophes) and reports
keys it could not find and keys in the file that still have no rw value.
"""
import json
import re
import sys

path, src = sys.argv[1], sys.argv[2]
tr = json.load(open(src, encoding='utf-8'))
lines = open(path, encoding='utf-8').read().split('\n')
entry = re.compile(r"^(\s*'([^']+)':\s*\{\s*en:.*?)(,\s*rw:\s*(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'))?(\s*\},?\s*)$")
found = set()

for i, line in enumerate(lines):
    m = entry.match(line)
    if not m or m.group(2) not in tr:
        continue
    key = m.group(2)
    value = tr[key]
    if not isinstance(value, str) or not value.strip():
        sys.exit(f'empty translation for {key}')
    for ph in re.findall(r'\{(\w+)\}', line.split('en:', 1)[1].split(', fr:', 1)[0]):
        if '{' + ph + '}' not in value:
            sys.exit(f'{key}: placeholder {{{ph}}} missing from rw value')
    if re.search('[–—]', value):
        sys.exit(f'{key}: rw value contains a dash')
    lines[i] = f"{m.group(1)}, rw: {json.dumps(value, ensure_ascii=False)}{m.group(5)}"
    found.add(key)

open(path, 'w', encoding='utf-8').write('\n'.join(lines))
missing_in_file = sorted(set(tr) - found)
untranslated = [m.group(2) for m in map(entry.match, lines) if m and not m.group(3) and m.group(2) not in found]
print(f'{path}: set {len(found)} rw values')
if missing_in_file:
    print('  keys not found in file:', ', '.join(missing_in_file))
if untranslated:
    print(f'  {len(untranslated)} keys still without rw:', ', '.join(untranslated[:20]), '...' if len(untranslated) > 20 else '')
