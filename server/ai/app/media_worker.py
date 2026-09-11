"""Apply OS limits in a fresh interpreter, then exec a fixed media tool.

Never use preexec_fn in the threaded API process. This helper accepts only
server-generated arguments; neither its executable nor argv comes from HTTP.
"""
from __future__ import annotations

import os
import resource
import sys


def main() -> None:
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (6, 7))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    # Linux runtime: hard TOTAL virtual memory bound, not FFmpeg's per-allocation
    # max_alloc. Darwin's AS/DATA limits are not reliable/enforceable; native Mac
    # runs are development-only. The Linux container is a mandatory release gate.
    if sys.platform == "linux":
        resource.setrlimit(resource.RLIMIT_NPROC, (64, 64))
        # Debian amd64 codec shared-library mappings need >512 MiB even for
        # ffprobe -version. 768 MiB is verified in the Linux amd64 release gate.
        ceiling = 768 * 1024 * 1024
        _, hard = resource.getrlimit(resource.RLIMIT_AS)
        if hard != resource.RLIM_INFINITY:
            ceiling = min(ceiling, hard)
        resource.setrlimit(resource.RLIMIT_AS, (ceiling, ceiling))
    os.execv(sys.argv[1], sys.argv[1:])


if __name__ == "__main__":
    main()
