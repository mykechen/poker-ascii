# Compressed artifacts

Large artifacts are stored alongside their original paths with a .gz suffix. Original files remain on the local machine. Restore any original with `gzip -dk PATH.gz`. The SHA-256 and original byte counts are recorded in compressed-artifacts.json.
