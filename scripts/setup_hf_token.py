#!/usr/bin/env python3
"""
Set up HuggingFace token from stored location.

Looks for token at ~/.hf_token or Private/hf-spaces-library/.hf_token
and configures huggingface_hub to use it.

Usage:
  python scripts/setup_hf_token.py
"""

import os
import sys
from pathlib import Path

try:
    from huggingface_hub import login, get_token
except ImportError:
    print("Error: huggingface_hub not installed. Install with:")
    print("  pip install huggingface-hub")
    sys.exit(1)


def find_token() -> str:
    """Find HF token from standard locations."""

    # Check environment first
    if os.environ.get("HF_TOKEN"):
        return os.environ["HF_TOKEN"]

    # Standard locations
    token_paths = [
        Path.home() / "Private" / "hf-spaces-library" / ".hf_token",
        Path.home() / ".hf_token",
        Path.home() / ".huggingface" / "token",
    ]

    for token_path in token_paths:
        if token_path.exists():
            token = token_path.read_text().strip()
            if token:
                return token

    return None


def validate_token(token: str) -> bool:
    """Validate token with HuggingFace API."""
    try:
        from huggingface_hub import HfApi
        api = HfApi(token=token)
        info = api.whoami()
        username = info.get("name") or info.get("username") or "unknown"
        print(f"✓ Token valid for user: {username}")
        return True
    except Exception as e:
        print(f"✗ Token validation failed: {e}")
        return False


def main():
    print("HuggingFace Token Setup")
    print("=" * 60)

    token = find_token()

    if not token:
        print("\nError: Could not find HF token in:")
        print("  - Environment variable HF_TOKEN")
        print("  - ~/.hf_token")
        print("  - Private/hf-spaces-library/.hf_token")
        print("\nSet up token with:")
        print("  python -m huggingface_hub.cli login")
        sys.exit(1)

    print(f"\nFound token (len={len(token)}, starts={token[:10]}...)")

    # Validate
    if not validate_token(token):
        sys.exit(1)

    # Configure huggingface_hub
    print("\nConfiguring huggingface_hub...")
    try:
        login(token=token, add_to_git_credential=False)
        print("✓ huggingface_hub configured")
    except Exception as e:
        print(f"✗ Configuration failed: {e}")
        sys.exit(1)

    # Verify
    current = get_token()
    if current:
        print("✓ Token is ready for use")
        print("\nYou can now run asset generation scripts:")
        print("  python scripts/sample_glb_particles.py --help")
        print("  python scripts/batch_sample_particles.py --help")
    else:
        print("✗ Token not accessible to huggingface_hub")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
