import importlib.util
from pathlib import Path
import sys
import types
import xml.etree.ElementTree as ET

sys.modules["PIL"] = types.SimpleNamespace(Image=None)
spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).parents[1] / "scripts/generate_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)
root = ET.fromstring("<SaveGame><player/><locations><GameLocation><name>Farm</name></GameLocation></locations></SaveGame>")
objects = [
    {"id": "12", "name": "Keg", "big": True},
    {"id": "Example.Keg", "name": "Keg", "big": True},
    {"id": "12", "name": "Crab Pot", "big": False},
    {"id": "(BC)12", "name": "Keg", "big": True},
]
plan = snapshot.planning_brief(root, root.find("player"), root.find("locations"), "spring", 1, 0, objects, {})
machines = {item["id"]: item for item in plan["machines"]}
assert set(machines) == {"(BC)12", "(BC)Example.Keg", "(O)12"}
assert machines["(BC)12"]["count"] == 2
assert machines["(O)12"]["count"] == 1
