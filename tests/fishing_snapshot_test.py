"""Synthetic behavioral tests: never read installed assets or player saves."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
import xml.etree.ElementTree as ET

# Fishing does not use image rendering. Keep these tests runnable with stdlib
# Python on CI, independently of the application's optional image dependency.
sys.modules["PIL"] = types.SimpleNamespace(Image=None)
spec = importlib.util.spec_from_file_location("snapshot", Path(__file__).parents[1] / "scripts/generate_snapshot.py")
snapshot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snapshot)


class FishingTests(unittest.TestCase):
    def brief(self, locations, *, player="", fish_id="Example.Fish", level=3, season="spring", modded=True, extra_catalog=None):
        root = ET.fromstring('<Save><locations><GameLocation><name>Example.Locked</name></GameLocation></locations></Save>')
        farmer = ET.fromstring(f'<Farmer>{player}</Farmer>')
        entry = {"id": f"(O){fish_id}", "name": "Nombre localizado", "verified": True,
                 "modded": modded, "locations": locations}
        data = {"fish": {fish_id: "Synthetic/20/mixed/1/5/600 2600/spring/both/0"},
                "productionCatalog": {"fishing": [entry, *(extra_catalog or [])]}}
        with tempfile.TemporaryDirectory() as directory:
            snapshot.GAME_DATA = Path(directory) / "game-data.json"
            snapshot.GAME_DATA.write_text(json.dumps(data), encoding="utf-8")
            return snapshot.fishing_brief(root, farmer, season, 1, {"fishing": level})["fish"][0]

    def spawn(self, location, **kwargs):
        return {"id": location, "verified": True, "minFishingLevel": 0, **kwargs}

    def test_locked_and_unlocked_zones(self):
        locations = [self.spawn(name) for name in ("Woods", "Sewer", "Desert", "IslandSouth")]
        self.assertEqual(self.brief(locations)["accessibleLocations"], [])
        player = ('<hasRustyKey>true</hasRustyKey><mailReceived><string>ccVault</string>'
                  '<string>willyBoatFixed</string></mailReceived>'
                  '<items><Item xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Axe">'
                  '<upgradeLevel>2</upgradeLevel></Item></items>')
        self.assertEqual(self.brief(locations, player=player)["accessibleLocations"],
                         ["Secret Woods", "Sewers", "Desert", "Ginger Island Ocean"])

    def test_level_is_per_location(self):
        fish = self.brief([self.spawn("Beach", minFishingLevel=1), self.spawn("Town", minFishingLevel=10)])
        self.assertEqual(fish["accessibleLocations"], ["Ocean"])
        self.assertEqual(fish["minFishingLevel"], 1)

    def test_season_is_per_location(self):
        fish = self.brief([self.spawn("Beach", season="Summer"), self.spawn("Town", season="Spring")])
        self.assertEqual(fish["accessibleLocations"], ["Town River"])

    def test_unsupported_rules_never_confirm_routes(self):
        for rule in ({"unsupportedRules": ["bobberPosition"]}, {"condition": "UNKNOWN"},
                     {"requireMagicBait": True}, {"ignoreFishDataRequirements": True}, {"verified": False}):
            with self.subTest(rule=rule):
                fish = self.brief([self.spawn("Beach", **rule), self.spawn("Town")])
                self.assertEqual(fish["accessibleLocations"], ["Town River"])
                self.assertEqual(fish["uncertainLocations"], ["Ocean"])
                self.assertFalse(fish["verified"])

    def test_serialized_custom_location_does_not_prove_access(self):
        fish = self.brief([self.spawn("Example.Locked", displayName="Mapa localizado")])
        self.assertEqual(fish["accessibleLocations"], [])
        self.assertEqual(fish["uncertainLocations"], ["Mapa localizado"])
        self.assertFalse(fish["verified"])

    def test_vanilla_fallback_and_legendary_level_are_preserved(self):
        fish = self.brief([], fish_id="163", modded=False, level=9)
        self.assertEqual(fish["accessibleLocations"], [])
        self.assertEqual(fish["minFishingLevel"], 10)
        self.assertEqual(fish["weather"], "rainy")
        self.assertTrue(self.brief([], fish_id="163", modded=False, level=10)["accessibleLocations"])

    def test_modified_vanilla_uses_catalog_constraints(self):
        fish = self.brief([self.spawn("Desert")], fish_id="128")
        self.assertEqual(fish["locations"], ["Desert"])
        self.assertEqual(fish["accessibleLocations"], [])

    def test_other_namespaces_cannot_override_fish_identity(self):
        fish = self.brief([self.spawn("Beach")], extra_catalog=[{"id": "(BC)Example.Fish", "name": "Wrong"}])
        self.assertEqual(fish["name"], "Nombre localizado")


if __name__ == "__main__":
    unittest.main()
