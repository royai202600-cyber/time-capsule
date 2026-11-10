#!/usr/bin/env python3
"""Verify existing artwork, portraits, purple gems and sketch references unchanged."""
import hashlib
import json
import subprocess
from pathlib import Path

REPO=Path(__file__).resolve().parents[3]
REPORT=REPO/'design/art/_checks/city-hunt-preservation.json'

def main():
    data=json.loads(REPORT.read_text())
    before=data['existing_art_before']
    after={path:hashlib.sha256((REPO/path).read_bytes()).hexdigest() for path in before}
    changed=[path for path in before if before[path]!=after[path]]
    assert not changed,changed
    commit=data['concept_reference_commit']
    concept_after={path:hashlib.sha256(subprocess.check_output(['git','show',commit+':'+path],cwd=REPO)).hexdigest() for path in data['concept_files_before']}
    assert concept_after==data['concept_files_before']
    data['existing_art_after']=after
    data['existing_art_count']=len(before)
    data['existing_portraits_count']=sum(p.startswith('design/art/portraits/') for p in before)
    data['concept_files_after']=concept_after
    data['concept_files_count']=len(concept_after)
    data['concept_branch_after']=subprocess.check_output(['git','rev-parse','origin/codex/character-profile-options'],cwd=REPO).decode().strip()
    assert data['concept_branch_after']==commit
    data['all_existing_art_byte_identical']=True
    data['all_concept_files_byte_identical']=True
    data['changed_existing_paths']=changed
    REPORT.write_text(json.dumps(data,indent=2)+'\n')
    print(f"{len(before)} existing art files and {len(concept_after)} sketch-branch files byte-identical; all existing portraits and purple gems PASS")

if __name__=='__main__':
    main()
