"""Summarise the fault scenario logs kept in infra/chaos/results.

Usage: python infra/chaos/summarize.py [results_dir] [--csv out.csv] [--md]

Each run is a folder with one log per scenario, as written by the fs*.sh scripts. The script
reads the measured times from the logs, prints one row per metric with every run, the mean,
the minimum and the maximum, and the PASS or FAIL count per scenario. Only the standard
library is used.
"""
import csv
import re
import statistics
import sys
from pathlib import Path

# (scenario log, metric label, regex whose first group is the value in ms)
METRICS = [
    ("fs1-kill-api", "FS1 gateway 1 healthy again", r"gateway 1 healthy again: (\d+) ms"),
    ("fs1-kill-api", "FS1 gateway 2 healthy again", r"gateway 2 healthy again: (\d+) ms"),
    ("fs1-kill-api", "FS1 all 3 API replicas healthy", r"all 3 API replicas healthy: (\d+) ms"),
    ("fs2-stop-node", "FS2 node rejoined every cluster", r"full cluster again: (\d+) ms"),
    ("fs3-kill-primary", "FS3 new leader elected", r"new leader: \w+ after (\d+) ms"),
    ("fs3-kill-primary", "FS3 cluster complete again", r"one sync standby: (\d+) ms"),
    ("fs4-kill-sync-replica", "FS4 new sync standby", r"new sync standby: \w+ after (\d+) ms"),
    ("fs5-kill-storage-node", "FS5 Garage 3/3 again", r"Garage healthy nodes: 3/3 after (\d+) ms"),
    ("fs6-kill-broker", "FS6 broker left the running set", r"broker left the running set after: (\d+) ms"),
    ("fs6-kill-broker", "FS6 broker rejoined", r"3 running broker nodes with no partition: (\d+) ms"),
    ("fs7-partition-node", "FS7 node rejoined after reconnection", r"all 3 members again: (\d+) ms"),
    ("fs10-stop-gateway", "FS10 gateway 1 healthy again", r"gateway 1 healthy again after (\d+) ms"),
    ("fs11-kill-scheduler", "FS11 standby took the lease", r"took the live lease after (\d+) ms"),
]
COUNTS = [
    ("fs5-kill-storage-node", "FS5 entries sent / confirmed", r"entries sent: (\d+), confirmed: (\d+)"),
    ("fs10-stop-gateway", "FS10 entries sent / confirmed", r"entries sent: (\d+), confirmed: (\d+)"),
]


def runs(root):
    return sorted(p for p in root.iterdir() if p.is_dir() and any(p.glob("fs*.log")))


def read(run, scenario):
    f = run / f"{scenario}.log"
    return f.read_text(encoding="utf-8", errors="replace") if f.exists() else ""


def main():
    argv = sys.argv[1:]
    if "--csv" in argv:
        i = argv.index("--csv")
        argv = argv[:i] + argv[i + 2:]
    args = [a for a in argv if not a.startswith("--")]
    root = Path(args[0]) if args else Path(__file__).parent / "results"
    rs = runs(root)
    names = [r.name for r in rs]
    rows = []
    for scenario, label, rx in METRICS:
        vals = []
        for r in rs:
            m = re.search(rx, read(r, scenario))
            vals.append(int(m.group(1)) / 1000 if m else None)
        got = [v for v in vals if v is not None]
        rows.append([label, *vals,
                     statistics.mean(got) if got else None, min(got, default=None), max(got, default=None), len(got)])
    print("runs:", ", ".join(names))
    head = ["metric (s)", *names, "mean", "min", "max", "n"]
    fmt = lambda v: "" if v is None else (f"{v:.1f}" if isinstance(v, float) else str(v))
    if "--md" in sys.argv:
        print("| " + " | ".join(head) + " |")
        print("|" + "---|" * len(head))
        for row in rows:
            print("| " + " | ".join(fmt(v) for v in row) + " |")
    else:
        for row in rows:
            print(f"{row[0]:<40}", "  ".join(f"{fmt(v):>7}" for v in row[1:]))
    print()
    for scenario, label, rx in COUNTS:
        cells = []
        for r in rs:
            m = re.search(rx, read(r, scenario))
            cells.append(f"{m.group(1)}/{m.group(2)}" if m else "-")
        print(f"{label:<40}", "  ".join(cells))
    print()
    verdicts = {}
    for r in rs:
        for log in r.glob("fs*.log"):
            text = log.read_text(encoding="utf-8", errors="replace")
            v = "PASS" if re.search(r"^\[[^]]*\] PASS ", text, re.M) else "FAIL"
            verdicts.setdefault(log.stem, []).append(v)
    for s in sorted(verdicts, key=lambda k: int(re.search(r"\d+", k).group())):
        print(f"{s:<26} {verdicts[s].count('PASS')}/{len(verdicts[s])} PASS")
    if "--csv" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--csv") + 1])
        with out.open("w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(head)
            for row in rows:
                w.writerow([fmt(v) for v in row])


if __name__ == "__main__":
    main()
