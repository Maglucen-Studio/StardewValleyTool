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

products = [
    {"id": "12", "name": "Keg", "big": True, "ready": True, "output": name, "outputId": item_id}
    for item_id, name in [("(O)Example", "Product"), ("(O)Example", "Producto"), ("(BC)Example", "Product"), (None, "Product")]
]
plan = snapshot.planning_brief(root, root.find("player"), root.find("locations"), "spring", 1, 0, products, {})
outputs = plan["machines"][0]["readyOutputs"]
assert len(outputs) == 3
assert next(item for item in outputs if item.get("id") == "(O)Example")["count"] == 2
products += [{**products[0], "outputVariant": fruit} for fruit in ("FruitA", "FruitB")]
plan = snapshot.planning_brief(root, root.find("player"), root.find("locations"), "spring", 1, 0, products, {})
assert {item.get("variant") for item in plan["machines"][0]["readyOutputs"]} == {None, "(O)FruitA", "(O)FruitB"}
location = ET.fromstring("""<GameLocation><objects><item><key><Vector2><X>1</X><Y>2</Y></Vector2></key>
<value><Object><itemId>12</itemId><name>Keg</name><bigCraftable>true</bigCraftable>
<heldObject><Object><itemId>Example</itemId><name>Product</name></Object></heldObject>
<lastInputItem><Object><itemId>(BC)Example</itemId><name>Input</name></Object></lastInputItem>
</Object></value></item></objects></GameLocation>""")
obj = snapshot.saved_objects(location)[0]
assert obj["outputId"] == "(O)Example"
assert obj["inputId"] == "(BC)Example"
