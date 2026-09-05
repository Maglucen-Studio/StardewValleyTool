import importlib.util
from pathlib import Path
import sys
import types
import xml.etree.ElementTree as ET

sys.modules["PIL"] = types.SimpleNamespace(Image=None)
spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).parents[1] / "scripts/generate_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)

farm = ET.fromstring('''<GameLocation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><terrainFeatures>
<item><key><Vector2><X>1</X><Y>2</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt"><state>1</state>
<crop><netSeedIndex>Example.Seed</netSeedIndex><indexOfHarvest>(O)Example.Crop</indexOfHarvest><currentPhase>0</currentPhase></crop>
</TerrainFeature></value></item>
<item><key><Vector2><X>2</X><Y>2</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt"><crop xsi:nil="true"/></TerrainFeature></value></item>
<item><key><Vector2><X>3</X><Y>2</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt"/></value></item>
</terrainFeatures></GameLocation>''')
planted, cleared, empty = snapshot.saved_terrain(farm)
assert planted["cropSeedId"] == "(O)Example.Seed"
assert planted["cropHarvestId"] == "(O)Example.Crop"
assert planted["hasCrop"] and planted["phase"] == 0 and planted["watered"]
assert "crop" not in cleared and "crop" not in empty
