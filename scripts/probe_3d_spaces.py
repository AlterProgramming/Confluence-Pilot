#!/usr/bin/env python3
"""Probe candidate image/text -> 3D HF Spaces: connect and dump their API.

Connecting + view_api does NOT run a generation (no ZeroGPU spend). It only tells
us which Space is up and what its endpoints expect, so we can wire generation
against a real, live API instead of guessing.
"""
import os
import sys
from pathlib import Path

from gradio_client import Client

TOKEN_FILE = Path.home() / "Private" / "hf-spaces-library" / ".hf_token"


def get_token():
    t = os.environ.get("HF_TOKEN")
    if t:
        return t.strip()
    try:
        from huggingface_hub import get_token as gt
        t = gt()
        if t:
            return t
    except Exception:
        pass
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip() or None
    return None


CANDIDATES = [
    "stabilityai/TripoSR",
    "JeffreyXiang/TRELLIS",
    "tencent/Hunyuan3D-2",
    "tencent/Hunyuan3D-2.1",
]


def main():
    token = get_token()
    print(f"token loaded: {'yes' if token else 'NO'}")
    targets = sys.argv[1:] or CANDIDATES
    for space in targets:
        print("\n" + "=" * 70)
        print(f"PROBE: {space}")
        try:
            client = Client(space, token=token, verbose=False)
            api = client.view_api(return_format="dict", print_info=False)
            named = api.get("named_endpoints", {})
            print(f"  UP. named endpoints: {list(named.keys())}")
            for name, spec in named.items():
                params = spec.get("parameters", [])
                returns = spec.get("returns", [])
                p = [(x.get("parameter_name") or x.get("label"), x.get("python_type", {}).get("type")) for x in params]
                r = [(x.get("label"), x.get("python_type", {}).get("type")) for x in returns]
                print(f"    {name}")
                print(f"       in : {p}")
                print(f"       out: {r}")
        except Exception as e:
            print(f"  DOWN/ERROR: {type(e).__name__}: {str(e)[:160]}")


if __name__ == "__main__":
    main()
