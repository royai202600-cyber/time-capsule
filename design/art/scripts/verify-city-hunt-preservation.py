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
    rest_report=REPORT.with_name('city-hunt-rest-preservation.json')
    if rest_report.exists():
        rest=json.loads(rest_report.read_text())
        after={p:hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in rest['before']}
        changed=[p for p in after if after[p]!=rest['before'][p]]
        assert not changed,changed
        raw_after={p:hashlib.sha256((REPO/p).read_bytes()).hexdigest() for p in rest.get('approved_source_before',{})}
        assert raw_after==rest.get('approved_source_before',{})
        approved=[p for p in after if p.startswith(('design/art/characters/','public/art/characters/'))
                  or p.endswith(('portrait-keeper.png','portrait-keeper.webp','waypost-gem-blue.png',
                                 'waypost-gem-blue.webp','landmark-gem-blue.png','landmark-gem-blue.webp'))]
        assert len(approved)==14
        stamps=[p for p in after if p.startswith('design/art/stamps/') and p.endswith('.png')]
        assert len(stamps)==11
        rest.update(after=after,approved_source_after=raw_after,changed_existing_paths=changed,
                    existing_art_count=len(after),approved_test_master_export_count=len(approved),
                    approved_test_paths=approved,existing_stamp_count=len(stamps),
                    all_existing_art_byte_identical=True,all_approved_test_art_byte_identical=True,
                    all_eleven_existing_stamps_byte_identical=True)
        rest_report.write_text(json.dumps(rest,indent=2)+'\n')
        print(f"{len(after)} pre-existing masters/references/exports (including 14 approved test files and 11 stamps), plus {len(raw_after)} approved source files: byte-identical PASS")

if __name__=='__main__':
    main()
