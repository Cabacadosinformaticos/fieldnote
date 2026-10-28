#!/usr/bin/env python3
"""Keep this Garage node connected to the other members of the cluster.

Garage keeps cluster metadata but not the addresses of its peers, so a node
that restarts alone comes back isolated until something runs
`garage node connect` again. This process runs beside `garage server` on every
start: it reads each peer's own node id from that peer's admin API and issues
the connect command whenever the peer is missing from this node's status.

It never exits while the server runs, so a peer that restarts later is picked
up again without restarting this node. A peer that is down is skipped until it
answers, which is what a deliberate node loss looks like.
"""

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

GARAGE = "/usr/local/bin/garage"
CONFIG = "/tmp/garage.toml"
ADMIN_PORT = 3903
RPC_PORT = 3901
INTERVAL_SECONDS = 5
REQUEST_TIMEOUT_SECONDS = 4

SELF = os.environ.get("GARAGE_RPC_PUBLIC_ADDR", "").rsplit(":", 1)[0]
PEERS = [
    peer.strip()
    for peer in os.environ.get("GARAGE_PEERS", "").split(",")
    if peer.strip() and peer.strip() != SELF
]
ADMIN_TOKEN = os.environ.get("GARAGE_ADMIN_TOKEN", "")
RPC_SECRET = os.environ.get("GARAGE_RPC_SECRET", "")


def log(message: str) -> None:
    print(f"garage-bootstrap: {message}", file=sys.stderr, flush=True)


def status(host: str) -> dict:
    request = urllib.request.Request(
        f"http://{host}:{ADMIN_PORT}/v2/GetClusterStatus",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return json.load(response)


def local_id() -> str:
    while True:
        result = subprocess.run(
            [GARAGE, "-c", CONFIG, "node", "id", "-q"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0 and "@" in result.stdout:
            return result.stdout.strip().split("@", 1)[0]
        time.sleep(INTERVAL_SECONDS)


def peer_id(host: str) -> str | None:
    """Return the peer's own node id, or None while the peer is unreachable."""
    try:
        cluster_status = status(host)
    except (OSError, urllib.error.URLError, ValueError):
        return None

    nodes = cluster_status.get("nodes") or []
    try:
        address = socket.gethostbyname(host)
    except OSError:
        address = None

    for node in nodes:
        if node.get("hostname") == host:
            return node["id"]
    for node in nodes:
        if address and (node.get("addr") or "").rsplit(":", 1)[0] == address:
            return node["id"]
    # A node that has never connected reports only itself.
    if len(nodes) == 1:
        return nodes[0]["id"]
    return None


def connected(host: str) -> set[str]:
    try:
        return {node["id"] for node in status(host).get("nodes", []) if node.get("isUp")}
    except (OSError, urllib.error.URLError, ValueError):
        return set()


def connect(self_id: str, peer: str, peer_id: str) -> None:
    subprocess.run(
        [
            GARAGE,
            "-s",
            RPC_SECRET,
            "-h",
            f"{self_id}@{SELF}:{RPC_PORT}",
            "node",
            "connect",
            f"{peer_id}@{peer}:{RPC_PORT}",
        ],
        capture_output=True,
        text=True,
        check=False,
    )


def main() -> None:
    if not PEERS:
        log("no peers configured, nothing to do")
        return

    self_id = local_id()
    log(f"watching {', '.join(PEERS)} from {SELF} ({self_id[:16]})")
    previous: set[str] = set()
    while True:
        up = connected(SELF or "127.0.0.1")
        if up != previous:
            log(f"healthy peers: {len(up)}/{len(PEERS) + 1}")
            previous = up

        for peer in PEERS:
            identifier = peer_id(peer)
            if identifier is None or identifier in up:
                continue
            connect(self_id, peer, identifier)

        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
