"""Command line: ``python -m backup run``, ``restore``, ``stats`` and ``download``."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from backup.config import Settings, load_key
from backup.errors import BackupError
from backup.job import restore_backup, run_backup, source_stats
from backup.storage import ObjectStorage

logger = logging.getLogger("backup")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m backup")
    subcommands = parser.add_subparsers(dest="command", required=True)

    subcommands.add_parser("run", help="write one encrypted archive and prune old ones")

    restore = subcommands.add_parser("restore", help="restore an archive into this stack")
    restore.add_argument("archive", help="local archive path or key in the backups bucket")

    subcommands.add_parser("stats", help="print the source counts and pending participants")

    download = subcommands.add_parser("download", help="copy an archive out of the bucket")
    download.add_argument("archive", help="key in the backups bucket")
    download.add_argument("destination", help="local path to write")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    arguments = _parser().parse_args(argv)
    settings = Settings()
    storage = ObjectStorage(settings)

    try:
        key = load_key(settings.backup_key_file)
        if arguments.command == "stats":
            print(json.dumps(source_stats(settings, storage), sort_keys=True))
        elif arguments.command == "run":
            result = run_backup(settings, storage, key)
            manifest = result.manifest
            print(
                "backup: "
                f"archive={result.archive} "
                f"entries={manifest['entries']} "
                f"media_objects={manifest['media_objects']} "
                f"bucket_objects={manifest['bucket_objects']} "
                f"pending_participants={manifest['pending_participants']} "
                f"pruned={result.pruned}"
            )
        elif arguments.command == "restore":
            result = restore_backup(settings, storage, key, arguments.archive)
            print(
                "restore: "
                f"entries={result.entries} "
                f"media_objects={result.media_objects} "
                f"bucket_objects={result.bucket_objects}"
            )
        else:
            destination = Path(arguments.destination)
            destination.parent.mkdir(parents=True, exist_ok=True)
            storage.download_archive(arguments.archive, destination)
            print(f"downloaded: {destination}")
    except (BackupError, ValueError, OSError) as exc:
        logger.error("%s", exc)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
