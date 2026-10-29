class BackupError(RuntimeError):
    """A backup or restore step failed; the message is safe to log."""


class ArchiveError(BackupError):
    """The archive cannot be read: wrong key, tampered bytes or a truncated file."""
