"""API routers. Every module in this package that defines ``router`` is included by main."""

import importlib
import pkgutil

from fastapi import APIRouter


def discover_routers() -> list[APIRouter]:
    routers = []
    for info in sorted(pkgutil.iter_modules(__path__), key=lambda m: m.name):
        module = importlib.import_module(f"{__name__}.{info.name}")
        if isinstance(getattr(module, "router", None), APIRouter):
            routers.append(module.router)
    return routers
