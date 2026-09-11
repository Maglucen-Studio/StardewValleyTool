"""Regression coverage for #93–95 using synthetic XML, never player saves."""
import importlib.util
from pathlib import Path
import sys
import types
import unittest
import xml.etree.ElementTree as ET

sys.modules["PIL"] = types.SimpleNamespace(Image=None)
spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).parents[1] / "scripts/generate_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


def dictionary(tag, entries, key_type="string"):
    return f'<{tag}>' + ''.join(f'<item><key><{key_type}>{key}</{key_type}></key><value><int>{count}</int></value></item>' for key, count in entries.items()) + f'</{tag}>'


class FarmCollectionTests(unittest.TestCase):
    def test_learned_recipes_are_not_cooked_and_namespaces_stay_distinct(self):
        player = ET.fromstring('<player>' + dictionary('cookingRecipes', {'Soup': 0, 'Salad': 5, 'Stew': 0})
            + dictionary('recipesCooked', {'(O)Example.Soup': 3, '(BC)Example.Salad': 5, 'Example.Stew': 2}) + '</player>')
        data = {'cookingRecipes': {'Soup': 'x/x/Example.Soup 1', 'Salad': 'x/x/Example.Salad 1', 'Stew': 'x/x/(O)Example.Stew 1'}}
        recipes = {item['name']: item for item in snapshot.long_term_collection_brief(player, data)['cooking']}
        self.assertEqual(recipes['Soup']['count'], 3)
        self.assertTrue(recipes['Soup']['learned'])
        self.assertFalse(recipes['Salad']['complete'])
        self.assertEqual(recipes['Stew']['count'], 2)
        progress = dict.fromkeys(['farming', 'mining', 'foraging', 'fishing', 'combat', 'fishCaught', 'deepestMineLevel', 'houseUpgradeLevel'], 0)
        achievements = snapshot.achievement_tracking(ET.fromstring('<Save/>'), player, 0, progress, data)
        self.assertEqual(next(item for item in achievements['items'] if item['id'] == 'gourmet')['current'], 2)

    def test_fish_collection_includes_entries_without_fishing_routes(self):
        player = ET.fromstring('<player>' + dictionary('fishCaught', {'(O)Example.Pot': 1, '(BC)Example.Rod': 1}) + '</player>')
        data = {'productionCatalog': {'fishCollection': [{'id': '(O)Example.Pot', 'name': 'Pot catch'}, {'id': '(O)Example.Rod', 'name': 'Rod catch'}]}}
        fish = snapshot.long_term_collection_brief(player, data)['fish']
        self.assertEqual([item['complete'] for item in fish], [True, False])
        legacy = ET.fromstring('<player>' + dictionary('fishCaught', {'123': 1}, 'int') + '</player>')
        self.assertEqual(snapshot.caught_fish_ids(legacy), {'(O)123'})

    def test_animals_inside_buildings_and_missing_produce(self):
        animal = '<animals><item><key><long>1</long></key><value><FarmAnimal><myID>1</myID><name>Example</name><type>Chicken</type><currentProduce /></FarmAnimal></value></item></animals>'
        locations = ET.fromstring('<locations><GameLocation><name>Farm</name><buildings><Building><indoors><name>Coop</name>' + animal + '</indoors></Building></buildings></GameLocation></locations>')
        animals = snapshot.farm_animals(locations)
        self.assertEqual(len(animals), 1)
        self.assertEqual(animals[0]['location'], 'Coop')
        self.assertEqual(animals[0]['currentProduce'], '-1')

    def test_greenhouse_crops_and_fruit_are_separate_from_outdoor_crops(self):
        terrain = '''<terrainFeatures><item><value><TerrainFeature xsi:type="HoeDirt"><state>1</state><crop><indexOfHarvest>Example.Crop</indexOfHarvest><phaseDays><int>2</int><int>99999</int></phaseDays><currentPhase>0</currentPhase><dayOfCurrentPhase>0</dayOfCurrentPhase></crop></TerrainFeature></value></item></terrainFeatures>'''
        fruit = '<terrainFeatures><item><value><TerrainFeature xsi:type="FruitTree"><fruit><Item><itemId>Example.Fruit</itemId><stack>2</stack></Item></fruit></TerrainFeature></value></item></terrainFeatures>'
        locations = ET.fromstring('<locations xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><GameLocation><name>Farm</name><isOutdoors>true</isOutdoors>' + terrain + '<buildings><Building><indoors><name>Greenhouse</name>' + terrain + fruit + '</indoors></Building></buildings></GameLocation></locations>')
        crops = snapshot.crop_forecast(locations, 'spring', 28, 1)
        self.assertEqual(len(crops), 3)
        outdoor = next(crop for crop in crops if crop['location'] == 'Farm')
        indoor = next(crop for crop in crops if crop['location'] == 'Greenhouse' and crop['kind'] == 'crop')
        self.assertTrue(outdoor['willWither'])
        self.assertFalse(indoor['willWither'])
        self.assertEqual(indoor['count'], 1)
        self.assertEqual(indoor['watered'], 1)
        self.assertEqual(next(crop for crop in crops if crop['kind'] == 'fruit')['count'], 2)

    def test_outdoor_animals_keep_their_specific_home(self):
        animal = '<animals><item><value><FarmAnimal><myID>42</myID><name>Example</name><type>Chicken</type></FarmAnimal></value></item></animals>'
        buildings = ''.join(f'<Building><buildingType>Coop</buildingType><tileX>{x}</tileX><tileY>2</tileY><indoors><name>Coop</name><animalsThatLiveHere><long>{resident}</long></animalsThatLiveHere></indoors></Building>' for x, resident in [(1, 42), (8, 43)])
        locations = ET.fromstring('<locations><GameLocation><name>Farm</name>' + animal + '<buildings>' + buildings + '</buildings></GameLocation></locations>')
        result = snapshot.farm_animals(locations)[0]
        self.assertEqual(result['homeId'], 'Coop-1-2')
        self.assertEqual(result['locationId'], 'Farm')
        self.assertEqual(result['currentProduce'], '-1')

    def test_legacy_stats_and_modern_override(self):
        player = ET.fromstring('<player><stats><fishCaught>12</fishCaught><Values><item><key><string>fishCaught</string></key><value><unsignedInt>24</unsignedInt></value></item></Values></stats></player>')
        self.assertEqual(snapshot.stats_values(player)['fishCaught'], 24)

    def test_greenhouse_map_exports_terrain_and_local_tree_artwork(self):
        locations = ET.fromstring('''<locations xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><GameLocation><name>Farm</name><buildings/></GameLocation><GameLocation><name>Greenhouse</name><terrainFeatures>
        <item><key><Vector2><X>4</X><Y>5</Y></Vector2></key><value><TerrainFeature xsi:type="HoeDirt"><state>1</state><crop><netSeedIndex>Example.Seed</netSeedIndex><indexOfHarvest>Example.Crop</indexOfHarvest><currentPhase>3</currentPhase><rowInSpriteSheet>2</rowInSpriteSheet></crop></TerrainFeature></value></item>
        <item><key><Vector2><X>2</X><Y>3</Y></Vector2></key><value><TerrainFeature xsi:type="FruitTree"><treeId>Example.Tree</treeId><growthStage>4</growthStage></TerrainFeature></value></item>
        </terrainFeatures></GameLocation></locations>''')
        player = ET.fromstring('<player><mailReceived><string>ccPantry</string></mailReceived></player>')
        data = {'productionCatalog': {'fruitTrees': [{'id': '(O)Example.Tree', 'treeSpriteRow': 7, 'treeTexture': 'TileSheets/fruitTrees'}]}}
        view = snapshot.interior_views(locations, player, locations[0], data)[0]
        self.assertEqual(view['mapName'], 'Greenhouse')
        crop, tree = view['terrain']
        self.assertEqual((crop['x'], crop['y'], crop['phase'], crop['cropRow'], crop['watered']), (4, 5, 3, 2, True))
        self.assertEqual((tree['treeSpriteRow'], tree['stage']), (7, 4))


if __name__ == '__main__':
    unittest.main()
