import importlib.util
from pathlib import Path
import xml.etree.ElementTree as ET
import sys
import types
sys.modules["PIL"] = types.SimpleNamespace(Image=None)

spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).parents[1] / "scripts/generate_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)
root = ET.fromstring("<SaveGame><player><friendshipData><item><key><string>Example.Npc</string></key><value><Friendship><Points>500</Points></Friendship></value></item></friendshipData></player><locations><GameLocation><name>Farm</name><buildings /></GameLocation></locations></SaveGame>")
player = root.find("player")
data = {
    "moddedCharacters": {"Example.Npc": {"displayName": "Example Person", "birthSeason": "spring", "birthDay": 3}},
    "cookingRecipes": {"Example Meal": "Example.Ingredient 2/unused/(O)Example.Output 1"},
    "craftingRecipes": {"Example Machine": "Example.Ingredient 2/unused/(BC)Example.Output 1/true"},
    "productionCatalog": {"buildings": [
        {"id": "Example.Building", "name": "Example Building", "money": 100, "materials": [{"id": "(O)Example.Material", "count": 2}], "modded": True, "verified": True},
        {"id": "Example.Unknown", "name": "Example Unknown", "money": 0, "materials": [], "modded": True, "verified": False},
    ]},
}
plan = snapshot.planning_brief(root, player, root.find("locations"), "spring", 1, 1000, [], data)
assert plan["friendships"][0]["id"] == "Example.Npc"
assert plan["friendships"][0]["daysToBirthday"] == 2
assert plan["friendships"][0]["name"] == "Example Person"
added = [b for b in plan["buildings"] if b.get("modded")]
assert len(added) == 2
assert added[0]["materials"][0]["id"] == "(O)Example.Material"
assert added[0]["affordable"] is False
assert added[1]["verified"] is False and added[1]["affordable"] is False
collections = snapshot.long_term_collection_brief(player, data)
assert collections["cooking"][0]["id"] == "(O)Example.Output"
assert collections["crafting"][0]["id"] == "(BC)Example.Output"
assert collections["crafting"][0]["spriteKind"] == "craftable"
assert collections["cooking"][0]["learned"] is False
print("Mod consumer behavioral checks passed.")
