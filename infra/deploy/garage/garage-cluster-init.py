#!/usr/bin/env python3
"""Idempotent bootstrap of the three-node Garage cluster.

Connects the three members, assigns one zone per logical node, applies the
layout, then creates the media bucket and imports the development S3 key.
"""

import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

GARAGE = "/usr/local/bin/garage"
ADMIN_PORT = 3903
RPC_PORT = 3901
NODES = [("node1", "garage1"), ("node2", "garage2"), ("node3", "garage3")]
BUCKET = os.environ.get("GARAGE_BUCKET", "media")
ADMIN_TOKEN = os.environ["GARAGE_ADMIN_TOKEN"]
RPC_SECRET = os.environ["GARAGE_RPC_SECRET"]
ACCESS_KEY = os.environ["GARAGE_ACCESS_KEY"]
SECRET_KEY = os.environ["GARAGE_SECRET_KEY"]


def status(host: str) -> dict:
    request = urllib.request.Request(
        f"http://{host}:{ADMIN_PORT}/v2/GetClusterStatus",
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.load(response)


def wait_for_nodes() -> list[dict]:
    deadline = time.time() + 240
    while time.time() < deadline:
        try:
            return [status(host) for _, host in NODES]
        except (OSError, urllib.error.URLError, ValueError):
            time.sleep(2)
    raise SystemExit("Garage admin API did not become reachable")


def node_id(cluster_status: dict, host: str) -> str:
    for node in cluster_status["nodes"]:
        address = (node.get("addr") or "").rsplit(":", 1)[0]
        if address == host or node.get("hostname") == host:
            return node["id"]
    raise SystemExit(f"{host} is missing from its own cluster status")


def garage(host: str, node: str, *arguments: str, check: bool = True) -> subprocess.CompletedProcess:
    command = [GARAGE, "-s", RPC_SECRET, "-h", f"{node}@{host}:{RPC_PORT}", *arguments]
    return subprocess.run(command, check=check, capture_output=True, text=True)


def connect_members(ids: dict[str, str]) -> None:
    pending = [(host, other) for host in ids for other in ids if host != other]
    deadline = time.time() + 180
    while pending and time.time() < deadline:
        failed = []
        for host, other in pending:
            result = garage(
                host,
                ids[host],
                "node",
                "connect",
                f"{ids[other]}@{other}:{RPC_PORT}",
                check=False,
            )
            if result.returncode != 0:
                failed.append((host, other, result.stderr.strip()))
        pending = [(host, other) for host, other, _ in failed]
        if pending:
            print(f"waiting for Garage members to connect: {pending}", file=sys.stderr)
            time.sleep(2)
    if pending:
        raise SystemExit(f"could not connect Garage members: {pending}")

    while time.time() < deadline:
        cluster_status = status("garage1")
        up = {node["id"] for node in cluster_status["nodes"] if node.get("isUp")}
        if len(up) == len(ids):
            return
        time.sleep(2)
    raise SystemExit("Garage members did not all become reachable")


def ensure_layout(ids: dict[str, str]) -> None:
    cluster_status = status("garage1")
    assigned = {node["id"] for node in cluster_status["nodes"] if node.get("role")}
    missing = [(zone, host) for zone, host in NODES if ids[host] not in assigned]
    if not missing:
        return

    for zone, host in missing:
        garage(
            "garage1",
            ids["garage1"],
            "layout",
            "assign",
            "-z",
            zone,
            "-c",
            "1G",
            ids[host],
        )
    garage(
        "garage1",
        ids["garage1"],
        "layout",
        "apply",
        "--version",
        str(cluster_status["layoutVersion"] + 1),
    )


def ensure_bucket(ids: dict[str, str]) -> None:
    node = ids["garage1"]
    deadline = time.time() + 120
    while time.time() < deadline:
        if garage("garage1", node, "bucket", "info", BUCKET, check=False).returncode == 0:
            return
        if garage("garage1", node, "bucket", "create", BUCKET, check=False).returncode == 0:
            return
        time.sleep(2)
    raise SystemExit(f"could not create Garage bucket {BUCKET}")


def ensure_key(ids: dict[str, str]) -> None:
    node = ids["garage1"]
    deadline = time.time() + 120
    while time.time() < deadline:
        if garage("garage1", node, "key", "info", ACCESS_KEY, check=False).returncode == 0:
            return
        if garage(
            "garage1",
            node,
            "key",
            "import",
            "--yes",
            "-n",
            "dev",
            ACCESS_KEY,
            SECRET_KEY,
            check=False,
        ).returncode == 0:
            return
        time.sleep(2)
    raise SystemExit(f"could not import Garage key {ACCESS_KEY}")


def main() -> None:
    statuses = wait_for_nodes()
    ids = {
        host: node_id(cluster_status, host)
        for cluster_status, (_, host) in zip(statuses, NODES, strict=True)
    }
    print(f"Garage node IDs: {ids}")

    connect_members(ids)
    ensure_layout(ids)
    ensure_bucket(ids)
    ensure_key(ids)

    result = garage(
        "garage1",
        ids["garage1"],
        "bucket",
        "allow",
        "--read",
        "--write",
        BUCKET,
        "--key",
        ACCESS_KEY,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"could not grant access to {BUCKET}: {result.stderr}")
    print(f"Garage cluster ready: bucket {BUCKET}, zones node1/node2/node3")


if __name__ == "__main__":
    main()
