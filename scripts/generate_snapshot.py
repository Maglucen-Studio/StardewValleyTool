from __future__ import annotations

import json
import math
import os
import re
import sys
from pathlib import Path
import shutil
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ROOT = Path(os.environ.get("STARDEW_TOOL_RUNTIME_ROOT", ROOT))
CONFIGURED_SAVE = os.environ.get("STARDEW_SAVE") or os.environ.get("AINCRAD_SAVE")
SAVE = Path(CONFIGURED_SAVE) if CONFIGURED_SAVE else None
TILES = RUNTIME_ROOT / "assetbuild" / "unpacked"
ASSETS = RUNTIME_ROOT / "public" / "assets"
DATA = RUNTIME_ROOT / "public" / "data"
PROFILE_ID = re.sub(r"[^a-zA-Z0-9._-]+", "-", os.environ.get("STARDEW_TOOL_PROFILE_ID", "default"))[:96] or "default"
PROFILE_DATA = RUNTIME_ROOT / ".local" / "farms" / PROFILE_ID
HISTORY_BACKUPS = PROFILE_DATA / "history-backups"
GAME_DATA = RUNTIME_ROOT / "assetbuild" / "game-data.json"
XSI_TYPE = "{http://www.w3.org/2001/XMLSchema-instance}type"

BIRTHDAYS = {
    ("spring", 4): "Kent", ("spring", 7): "Lewis", ("spring", 10): "Vincent", ("spring", 14): "Haley",
    ("spring", 18): "Pam", ("spring", 20): "Shane", ("spring", 26): "Pierre", ("spring", 27): "Emily",
    ("summer", 4): "Jas", ("summer", 8): "Gus", ("summer", 10): "Maru", ("summer", 13): "Alex",
    ("summer", 17): "Sam", ("summer", 19): "Demetrius", ("summer", 22): "Dwarf", ("summer", 24): "Willy",
    ("summer", 26): "Leo", ("fall", 2): "Penny", ("fall", 5): "Elliott", ("fall", 11): "Jodi",
    ("fall", 13): "Abigail", ("fall", 15): "Sandy", ("fall", 18): "Marnie", ("fall", 21): "Robin",
    ("fall", 24): "George", ("winter", 1): "Krobus", ("winter", 3): "Linus", ("winter", 7): "Caroline",
    ("winter", 10): "Sebastian", ("winter", 14): "Harvey", ("winter", 17): "Wizard", ("winter", 20): "Evelyn",
    ("winter", 23): "Leah", ("winter", 26): "Clint",
}
VANILLA_FRIENDSHIP_NPCS = frozenset(BIRTHDAYS.values())

COMMUNITY_ROOM_DETAILS = {
    "Crafts Room": {"name": "Bridge Repair", "description": "Repairs the bridge east of The Mines and opens the Quarry."},
    "Pantry": {"name": "Greenhouse", "description": "Restores the Greenhouse on the farm for year-round crops and fruit trees."},
    "Fish Tank": {"name": "Glittering Boulder Removed", "description": "Removes the boulder by The Mines and unlocks Copper Pan panning spots."},
    "Boiler Room": {"name": "Minecarts Repaired", "description": "Unlocks fast travel between the Bus Stop, Mines, Town, and Quarry."},
    "Bulletin Board": {"name": "Friendship", "description": "Adds two hearts with every non-datable villager you have met."},
    "Vault": {"name": "Bus Repair", "description": "Restores the bus so Pam can take you to Calico Desert."},
    "Abandoned Joja Mart": {"name": "Movie Theater", "description": "Transforms the abandoned JojaMart into the Movie Theater."},
}

CROP_NAMES = {
    "24": "Parsnip", "188": "Green Bean", "190": "Cauliflower", "192": "Potato", "248": "Garlic",
    "250": "Kale", "252": "Rhubarb", "254": "Melon", "256": "Tomato", "258": "Blueberry",
    "260": "Hot Pepper", "262": "Wheat", "264": "Radish", "266": "Red Cabbage", "268": "Starfruit",
    "270": "Corn", "272": "Eggplant", "274": "Artichoke", "276": "Pumpkin", "278": "Bok Choy",
    "280": "Yam", "282": "Cranberry", "284": "Beet", "300": "Amaranth", "304": "Hops",
    "376": "Poppy", "396": "Spice Berry", "398": "Grape", "400": "Strawberry", "417": "Sweet Gem Berry",
    "421": "Sunflower", "433": "Coffee Bean", "454": "Ancient Fruit", "591": "Tulip", "593": "Summer Spangle",
    "595": "Fairy Rose", "597": "Blue Jazz", "815": "Tea Leaves", "Carrot": "Carrot",
    "SummerSquash": "Summer Squash", "Broccoli": "Broccoli", "Powdermelon": "Powdermelon",
}
MULTI_SEASON_CROPS = {"262", "270", "398", "421", "433", "454"}

# The save's Object.type is usually "Crafting" for big craftables, including
# both actual machines and unrelated objects such as chests or scarecrows. Use
# the machine's internal English name instead; active/ready custom machines are
# still included by is_production_machine below.
PRODUCTION_MACHINE_NAMES = {
    "Bait Maker", "Bee House", "Bone Mill", "Cask", "Charcoal Kiln", "Cheese Press", "Crab Pot",
    "Coffee Maker", "Crystalarium", "Dehydrator", "Deluxe Worm Bin", "Fish Smoker",
    "Furnace", "Geode Crusher", "Heavy Furnace", "Heavy Tapper", "Incubator", "Keg",
    "Lightning Rod", "Loom", "Mayonnaise Machine", "Mushroom Log", "Oil Maker",
    "Ostrich Incubator", "Preserves Jar", "Recycling Machine", "Seed Maker",
    "Slime Egg-Press", "Slime Incubator", "Solar Panel", "Tapper", "Wood Chipper",
    "Worm Bin",
}

MUSEUM_ITEM_NAMES = {
    "60": "Emerald", "62": "Aquamarine", "64": "Ruby", "66": "Amethyst", "68": "Topaz", "70": "Jade",
    "72": "Diamond", "74": "Prismatic Shard", "80": "Quartz", "82": "Fire Quartz", "84": "Frozen Tear", "86": "Earth Crystal",
    "96": "Dwarf Scroll I", "97": "Dwarf Scroll II", "98": "Dwarf Scroll III", "99": "Dwarf Scroll IV",
    "100": "Chipped Amphora", "101": "Arrowhead", "103": "Ancient Doll", "104": "Elvish Jewelry",
    "105": "Chewing Stick", "106": "Ornamental Fan", "107": "Dinosaur Egg", "108": "Rare Disc",
    "109": "Ancient Sword", "110": "Rusty Spoon", "111": "Rusty Spur", "112": "Rusty Cog",
    "113": "Chicken Statue", "114": "Ancient Seed", "115": "Prehistoric Tool", "116": "Dried Starfish",
    "117": "Anchor", "118": "Glass Shards", "119": "Bone Flute", "120": "Prehistoric Handaxe",
    "121": "Dwarvish Helm", "122": "Dwarf Gadget", "123": "Ancient Drum", "124": "Golden Mask",
    "125": "Golden Relic", "126": "Strange Doll (green)", "127": "Strange Doll (yellow)",
    "538": "Alamite", "539": "Bixite", "540": "Baryte", "541": "Aerinite", "542": "Calcite",
    "543": "Dolomite", "544": "Esperite", "545": "Fluorapatite", "546": "Geminite", "547": "Helvite",
    "548": "Jamborite", "549": "Jagoite", "550": "Kyanite", "551": "Lunarite", "552": "Malachite",
    "553": "Neptunite", "554": "Lemon Stone", "555": "Nekoite", "556": "Orpiment", "557": "Petrified Slime",
    "558": "Thunder Egg", "559": "Pyrite", "560": "Ocean Stone", "561": "Ghost Crystal", "562": "Tigerseye",
    "563": "Jasper", "564": "Opal", "565": "Fire Opal", "566": "Celestine", "567": "Marble",
    "568": "Sandstone", "569": "Granite", "570": "Basalt", "571": "Limestone", "572": "Soapstone",
    "573": "Hematite", "574": "Mudstone", "575": "Obsidian", "576": "Slate", "577": "Fairy Stone", "578": "Star Shards",
    "579": "Prehistoric Scapula", "580": "Prehistoric Tibia", "581": "Prehistoric Skull", "582": "Skeletal Hand",
    "583": "Prehistoric Rib", "584": "Prehistoric Vertebra", "585": "Skeletal Tail", "586": "Nautilus Fossil",
    "587": "Amphibian Fossil", "588": "Palm Fossil", "589": "Trilobite",
}


def is_production_machine(obj: dict) -> bool:
    return (
        obj.get("name") in PRODUCTION_MACHINE_NAMES
        or str(obj.get("kind", "")).casefold() == "machine"
        or bool(obj.get("ready"))
        or bool(obj.get("processing"))
    )


def read_json(path: Path) -> dict | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else None
    except (OSError, json.JSONDecodeError):
        return None


def xml_color(node: ET.Element | None, fallback: tuple[int, int, int, int]) -> tuple[int, int, int, int]:
    if node is None:
        return fallback
    try:
        return (
            int(node.findtext("R", str(fallback[0]))),
            int(node.findtext("G", str(fallback[1]))),
            int(node.findtext("B", str(fallback[2]))),
            int(node.findtext("A", str(fallback[3]))),
        )
    except (TypeError, ValueError):
        return fallback


def tint_sprite(image: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    pixels = []
    red, green, blue, alpha = color
    for source_red, source_green, source_blue, source_alpha in image.convert("RGBA").getdata():
        pixels.append((
            source_red * red // 255,
            source_green * green // 255,
            source_blue * blue // 255,
            source_alpha * alpha // 255,
        ))
    tinted = Image.new("RGBA", image.size)
    tinted.putdata(pixels)
    return tinted


def change_brightness(color: tuple[int, int, int, int], brightness: int) -> tuple[int, int, int, int]:
    red, green, blue, alpha = color
    blue_delta = brightness * 5 // 6 if brightness > 0 else brightness * 8 // 7
    return (
        max(0, min(255, red + brightness)),
        max(0, min(255, green + brightness)),
        max(0, min(255, blue + blue_delta)),
        alpha,
    )


def render_farmer_avatar(
    player: ET.Element,
    game_data: dict,
    save_path: Path,
    profile_id: str = PROFILE_ID,
) -> str | None:
    """Compose the selected save's front-facing farmer from its local game sprites."""
    farmer_assets = TILES / "farmer"
    required = [
        farmer_assets / "farmer_base.png", farmer_assets / "hairstyles.png",
        farmer_assets / "shirts.png", farmer_assets / "pants.png",
        farmer_assets / "hats.png", farmer_assets / "skinColors.png",
        farmer_assets / "shoeColors.png",
    ]
    if any(not path.exists() for path in required):
        return None
    try:
        hair_index = int(player.findtext("hair", "0") or 0)
        gender = (player.findtext("Gender") or player.findtext("gender") or "Male").casefold()
        is_male = gender != "female"
        hair_record = str(game_data.get("hair", {}).get(str(hair_index), ""))
        hair_parts = hair_record.split("/") if hair_record else []
        is_bald = (49 <= hair_index <= 55) or (len(hair_parts) > 5 and hair_parts[5].casefold() == "true")
        base_name = "farmer_base" if is_male else "farmer_girl_base"
        if is_bald:
            base_name += "_bald"
        base_path = farmer_assets / f"{base_name}.png"
        if not base_path.exists():
            base_path = farmer_assets / "farmer_base.png"

        base_sheet = Image.open(base_path).convert("RGBA")
        base_pixels = list(base_sheet.getdata())
        reference_colors = {index: base_pixels[index] for index in (256, 257, 258, 260, 261, 262, 268, 269, 270, 271, 276, 277)}

        skin_sheet = Image.open(farmer_assets / "skinColors.png").convert("RGBA")
        skin_index = int(player.findtext("skin", "0") or 0)
        if skin_index < 0:
            skin_index = skin_sheet.height - 1
        if skin_index >= skin_sheet.height:
            skin_index = 0
        replacements = {
            260: skin_sheet.getpixel((0, skin_index)),
            261: skin_sheet.getpixel((1, skin_index)),
            262: skin_sheet.getpixel((2, skin_index)),
        }

        shoe_sheet = Image.open(farmer_assets / "shoeColors.png").convert("RGBA")
        shoe_value = player.findtext("shoes", "12") or "12"
        try:
            shoe_index = int(shoe_value.rsplit(":", 1)[-1])
        except ValueError:
            shoe_index = 12
        shoe_index = max(0, min(shoe_sheet.height - 1, shoe_index))
        for offset in range(4):
            replacements[268 + offset] = shoe_sheet.getpixel((offset, shoe_index))

        eye_color = xml_color(player.find("newEyeColor"), (80, 80, 80, 255))
        darker_eye = change_brightness(eye_color, -75)
        if darker_eye == eye_color:
            eye_color = (eye_color[0], eye_color[1], min(255, eye_color[2] + 10), eye_color[3])
        replacements[276] = eye_color
        replacements[277] = darker_eye

        shirt_sheet = Image.open(farmer_assets / "shirts.png").convert("RGBA")
        shirt_item = player.find("shirtItem")
        shirt_index = int(shirt_item.findtext("indexInTileSheet", "0") or 0) if shirt_item is not None else 0
        shirt_color = xml_color(shirt_item.find("clothesColor") if shirt_item is not None else None, (255, 255, 255, 255))
        shirt_x = shirt_index * 8 % 128
        shirt_y = (shirt_index * 8 // 128) * 32
        palette_x = shirt_x
        palette_y = shirt_y + 4
        sleeve_colors = []
        for row_offset in (0, -1, -2):
            dye = shirt_sheet.getpixel((palette_x + 128, palette_y + row_offset))
            source = dye if dye[3] == 255 else shirt_sheet.getpixel((palette_x, palette_y + row_offset))
            sleeve_colors.append(tint_sprite(Image.new("RGBA", (1, 1), source), shirt_color).getpixel((0, 0)))
        replacements.update({256: sleeve_colors[0], 257: sleeve_colors[1], 258: sleeve_colors[2]})

        # Replace every occurrence of each palette sentinel, matching FarmerRenderer's recoloring pass.
        color_replacements = {reference_colors[index]: replacement for index, replacement in replacements.items()}
        recolored = [color_replacements.get(pixel, pixel) for pixel in base_pixels]
        base_sheet.putdata(recolored)

        canvas = Image.new("RGBA", (20, 34), (0, 0, 0, 0))
        base_frame = base_sheet.crop((0, 0, 16, 32))
        canvas.alpha_composite(base_frame, (2, 2))

        pants_sheet = Image.open(farmer_assets / "pants.png").convert("RGBA")
        pants_item = player.find("pantsItem")
        pants_index = int(pants_item.findtext("indexInTileSheet", "0") or 0) if pants_item is not None else 0
        pants_color = xml_color(
            pants_item.find("clothesColor") if pants_item is not None else player.find("pantsColor"),
            (255, 255, 255, 255),
        )
        pants_x = (pants_index % 10) * 192 + (0 if is_male else 96)
        pants_y = (pants_index // 10) * 688
        pants_frame = pants_sheet.crop((pants_x, pants_y, pants_x + 16, pants_y + 32))
        canvas.alpha_composite(tint_sprite(pants_frame, (pants_color[0], pants_color[1], pants_color[2], 255)), (2, 2))

        shirt_base = shirt_sheet.crop((shirt_x, shirt_y, shirt_x + 8, shirt_y + 8))
        shirt_dye = shirt_sheet.crop((shirt_x + 128, shirt_y, shirt_x + 136, shirt_y + 8))
        canvas.alpha_composite(shirt_base, (6, 17))
        canvas.alpha_composite(tint_sprite(shirt_dye, (shirt_color[0], shirt_color[1], shirt_color[2], 255)), (6, 17))

        hat_item = player.find("hat")
        hat_id = hat_item.findtext("itemId", "") if hat_item is not None else ""
        hat_record = str(game_data.get("hats", {}).get(hat_id, ""))
        hat_parts = hat_record.split("/") if hat_record else []
        covered_hair_index = -1
        hair_draw_type = int(hat_item.findtext("hairDrawType", "0") or 0) if hat_item is not None else 0
        if hair_draw_type == 1 and len(hair_parts) > 4 and hair_parts[4]:
            try:
                covered_hair_index = int(hair_parts[4])
            except ValueError:
                covered_hair_index = -1
        if covered_hair_index >= 0:
            hair_index = covered_hair_index
            hair_record = str(game_data.get("hair", {}).get(str(hair_index), ""))
            hair_parts = hair_record.split("/") if hair_record else []

        if len(hair_parts) >= 3:
            hair_texture = hair_parts[0]
            hair_tile_x = int(hair_parts[1])
            hair_tile_y = int(hair_parts[2])
            hair_path = farmer_assets / f"{hair_texture}.png"
            hair_box = (hair_tile_x * 16, hair_tile_y * 16, hair_tile_x * 16 + 16, hair_tile_y * 16 + 32)
        else:
            hair_path = farmer_assets / "hairstyles.png"
            hair_box = (hair_index * 16 % 128, hair_index * 16 // 128 * 96, hair_index * 16 % 128 + 16, hair_index * 16 // 128 * 96 + 32)
        hair_frame = Image.open(hair_path).convert("RGBA").crop(hair_box)
        hair_color = xml_color(player.find("hairstyleColor"), (80, 50, 30, 255))
        hair_y = 3 + (-1 if is_male and hair_index >= 16 else (1 if not is_male and hair_index < 16 else 0))
        canvas.alpha_composite(tint_sprite(hair_frame, hair_color), (2, hair_y))

        if hat_item is not None and hat_record:
            try:
                hat_index = int(hat_parts[6]) if len(hat_parts) > 6 and hat_parts[6] else int(hat_id)
                hat_sheet = Image.open(farmer_assets / "hats.png").convert("RGBA")
                hat_x = hat_index * 20 % hat_sheet.width
                hat_y = (hat_index * 20 // hat_sheet.width) * 80
                hat_frame = hat_sheet.crop((hat_x, hat_y, hat_x + 20, hat_y + 20))
                ignore_hair_offset = (hat_item.findtext("ignoreHairstyleOffset", "false") or "false").casefold() == "true"
                hat_offsets = (0, 0, 0, 4, 0, 0, 3, 0, 4, 0, 0, 0, 0, 0, 0, 0)
                hat_offset = 0 if ignore_hair_offset else hat_offsets[hair_index % 16]
                canvas.alpha_composite(hat_frame, (0, hat_offset))
            except (ValueError, IndexError, OSError):
                pass

        # Stardew's idle frame draws the primary arm layer after clothing,
        # hair, accessories, and hats. Its armOffset is 6, i.e. x = 6 * 16.
        arm_frame = base_sheet.crop((96, 0, 112, 32))
        canvas.alpha_composite(arm_frame, (2, 2))

        destination = ASSETS / "farmers" / f"{profile_id}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        canvas.resize((60, 102), Image.Resampling.NEAREST).save(destination)
        try:
            cache_key = save_path.stat().st_mtime_ns
        except OSError:
            cache_key = 0
        return f"/assets/farmers/{profile_id}.png?v={cache_key}"
    except (OSError, ValueError, IndexError, TypeError):
        return None


def atomic_write_json(path: Path, payload: dict, *, backup: bool = False, keep: int = 12) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if path.exists():
        try:
            if path.read_text(encoding="utf-8") == serialized:
                return
        except OSError:
            pass
        if backup:
            HISTORY_BACKUPS.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
            shutil.copy2(path, HISTORY_BACKUPS / f"{path.stem}-{timestamp}.json")
            backups = sorted(HISTORY_BACKUPS.glob(f"{path.stem}-*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
            for obsolete in backups[keep:]:
                obsolete.unlink(missing_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(serialized, encoding="utf-8")
    os.replace(temporary, path)


def history_data_roots() -> list[Path]:
    candidates: list[Path] = []
    configured = os.environ.get("STARDEW_TOOL_LEGACY_DATA_DIRS", "")
    candidates.extend(Path(value) for value in configured.split(os.pathsep) if value.strip())
    project_data = ROOT / "public" / "data"
    if project_data.resolve() != DATA.resolve():
        candidates.append(project_data)
    candidates.append(DATA)
    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate.resolve()).casefold()
        if key not in seen:
            seen.add(key)
            unique.append(candidate)
    return unique

BUNDLE_ITEM_NAMES = {
    "16": "Wild Horseradish", "18": "Daffodil", "20": "Leek", "22": "Dandelion",
    "24": "Parsnip", "62": "Aquamarine", "78": "Cave Carrot", "80": "Quartz",
    "82": "Fire Quartz", "84": "Frozen Tear", "86": "Earth Crystal", "88": "Coconut",
    "90": "Cactus Fruit", "128": "Pufferfish", "129": "Anchovy", "130": "Tuna",
    "131": "Sardine", "132": "Bream", "136": "Largemouth Bass", "137": "Smallmouth Bass",
    "138": "Rainbow Trout", "139": "Salmon", "140": "Walleye", "141": "Perch",
    "142": "Carp", "143": "Catfish", "144": "Pike", "145": "Sunfish", "146": "Red Mullet",
    "147": "Herring", "148": "Eel", "149": "Octopus", "150": "Red Snapper", "151": "Squid",
    "154": "Sea Cucumber", "155": "Super Cucumber", "156": "Ghostfish", "164": "Sandfish",
    "174": "Large Egg (White)", "178": "Hay", "182": "Large Egg (Brown)", "186": "Large Milk",
    "188": "Green Bean", "190": "Cauliflower", "192": "Potato", "194": "Fried Egg",
    "228": "Maki Roll", "248": "Garlic", "254": "Melon", "256": "Tomato", "257": "Morel",
    "258": "Blueberry", "259": "Fiddlehead Fern", "260": "Hot Pepper", "262": "Wheat",
    "266": "Red Cabbage", "270": "Corn", "272": "Eggplant", "276": "Pumpkin", "280": "Yam",
    "334": "Copper Bar", "335": "Iron Bar", "336": "Gold Bar", "340": "Honey", "344": "Jelly",
    "348": "Wine", "376": "Poppy", "388": "Wood", "390": "Stone", "392": "Nautilus Shell",
    "396": "Spice Berry", "397": "Sea Urchin", "398": "Grape", "402": "Sweet Pea",
    "404": "Common Mushroom", "406": "Wild Plum", "408": "Hazelnut", "410": "Blackberry",
    "412": "Winter Root", "414": "Crystal Fruit", "416": "Snow Yam", "418": "Crocus",
    "420": "Red Mushroom", "421": "Sunflower", "422": "Purple Mushroom", "424": "Cheese",
    "426": "Goat Cheese", "428": "Cloth", "430": "Truffle", "432": "Truffle Oil",
    "438": "Large Goat Milk", "440": "Wool", "442": "Duck Egg", "444": "Duck Feather",
    "446": "Rabbit's Foot", "536": "Frozen Geode", "613": "Apple", "634": "Apricot",
    "635": "Orange", "636": "Peach", "637": "Pomegranate", "638": "Cherry", "698": "Sturgeon",
    "699": "Tiger Trout", "700": "Bullhead", "701": "Tilapia", "702": "Chub",
    "706": "Shad", "709": "Hardwood", "715": "Lobster", "716": "Crayfish", "717": "Crab",
    "718": "Cockle", "719": "Mussel", "720": "Shrimp", "721": "Snail", "722": "Periwinkle",
    "723": "Oyster", "724": "Maple Syrup", "725": "Oak Resin", "726": "Pine Tar",
    "734": "Woodskip", "766": "Slime", "767": "Bat Wing", "768": "Solar Essence", "769": "Void Essence",
}

BUILDING_PLANS = [
    {"name": "Silo", "category": "Robin", "projectType": "Farm building", "money": 100, "materials": {"Stone": 100, "Clay": 10, "Copper Bar": 5}, "footprint": "3×3", "why": "Stores hay cut with the Scythe; build it before clearing large areas of grass."},
    {"name": "Well", "category": "Robin", "projectType": "Farm building", "money": 1000, "materials": {"Stone": 75}, "footprint": "3×3", "why": "A nearby watering point for layouts far from existing ponds."},
    {"name": "Coop", "category": "Robin", "projectType": "Farm building", "money": 4000, "materials": {"Wood": 300, "Stone": 100}, "footprint": "6×3", "why": "Houses chickens and unlocks early egg and Mayonnaise production."},
    {"name": "Barn", "category": "Robin", "projectType": "Farm building", "money": 6000, "materials": {"Wood": 350, "Stone": 150}, "footprint": "7×4", "why": "Houses cows and starts Milk and Cheese production."},
    {"name": "Mill", "category": "Robin", "projectType": "Farm building", "money": 2500, "materials": {"Wood": 150, "Stone": 50, "Cloth": 4}, "footprint": "4×2", "why": "Processes Wheat, Beets, and Unmilled Rice into cooking ingredients."},
    {"name": "Shed", "category": "Robin", "projectType": "Farm building", "money": 15000, "materials": {"Wood": 300}, "footprint": "7×3", "why": "Centralizes Kegs, Preserves Jars, and other production machines."},
    {"name": "Fish Pond", "category": "Robin", "projectType": "Farm building", "money": 5000, "materials": {"Stone": 200, "Seaweed": 5, "Green Algae": 5}, "footprint": "5×5", "why": "Produces Roe and species-specific items after stocking a fish."},
    {"name": "Slime Hutch", "category": "Robin", "projectType": "Farm building", "money": 10000, "materials": {"Stone": 500, "Refined Quartz": 10, "Iridium Bar": 1}, "footprint": "7×4", "why": "Supports slime breeding and Slime Ball production; it is optional for most farms."},
    {"name": "Stable", "category": "Robin", "projectType": "Farm building", "money": 10000, "materials": {"Hardwood": 100, "Iron Bar": 5}, "footprint": "4×2", "why": "Includes a horse and greatly reduces travel time."},
    {"name": "Shipping Bin", "category": "Robin", "projectType": "Farm building", "money": 250, "materials": {"Wood": 150}, "footprint": "2×1", "why": "Adds another overnight shipping point wherever it is convenient."},
    {"name": "Pet Bowl", "category": "Robin", "projectType": "Farm building", "money": 5000, "materials": {"Hardwood": 25}, "footprint": "2×2", "unlock": "Available when adopting additional pets becomes possible.", "why": "Provides a home bowl for an additional pet."},
    {"name": "Cabin", "category": "Robin", "projectType": "Multiplayer cabin · 7 styles", "money": 100, "materials": {}, "footprint": "5×3", "why": "Adds a farmhand home and multiplayer slot; all seven styles have the same cost and footprint."},
    {"name": "Big Coop", "category": "Upgrades", "projectType": "Building upgrade", "money": 10000, "materials": {"Wood": 400, "Stone": 150}, "prerequisite": "Requires an existing Coop.", "why": "Expands a Coop to 8 animals and unlocks Ducks and an incubator."},
    {"name": "Deluxe Coop", "category": "Upgrades", "projectType": "Building upgrade", "money": 20000, "materials": {"Wood": 500, "Stone": 200}, "prerequisite": "Requires an existing Big Coop.", "why": "Expands a Big Coop to 12 animals, unlocks Rabbits, and adds an auto-feed system."},
    {"name": "Big Barn", "category": "Upgrades", "projectType": "Building upgrade", "money": 12000, "materials": {"Wood": 450, "Stone": 200}, "prerequisite": "Requires an existing Barn.", "why": "Expands a Barn to 8 animals and unlocks Goats."},
    {"name": "Deluxe Barn", "category": "Upgrades", "projectType": "Building upgrade", "money": 25000, "materials": {"Wood": 550, "Stone": 300}, "prerequisite": "Requires an existing Big Barn.", "why": "Expands a Big Barn to 12 animals, unlocks Sheep and Pigs, and adds auto-feed."},
    {"name": "Big Shed", "category": "Upgrades", "projectType": "Building upgrade", "money": 20000, "materials": {"Wood": 550, "Stone": 300}, "prerequisite": "Requires an existing Shed.", "why": "More than doubles the usable interior machine space without enlarging its footprint."},
    {"name": "Farmhouse Upgrade 1", "category": "Upgrades", "projectType": "Home upgrade", "money": 10000, "materials": {"Wood": 450}, "prerequisite": "Requires the starting Farmhouse.", "why": "Adds a kitchen and bedroom and enables cooking and marriage."},
    {"name": "Farmhouse Upgrade 2", "category": "Upgrades", "projectType": "Home upgrade", "money": 65000, "materials": {"Hardwood": 100}, "prerequisite": "Requires Farmhouse Upgrade 1.", "why": "Adds the nursery and an extra room."},
    {"name": "Farmhouse Upgrade 3", "category": "Upgrades", "projectType": "Home upgrade", "money": 100000, "materials": {}, "prerequisite": "Requires Farmhouse Upgrade 2.", "why": "Adds the cellar and Casks for aging artisan goods."},
    {"name": "Junimo Hut", "category": "Wizard", "projectType": "Magical building", "money": 20000, "materials": {"Stone": 200, "Starfruit": 9, "Fiber": 100}, "footprint": "3×2", "unlock": "Requires access to the Wizard's magic construction book.", "why": "Junimos automatically harvest nearby ripe crops when conditions allow."},
    {"name": "Earth Obelisk", "category": "Wizard", "projectType": "Magical building", "money": 500000, "materials": {"Iridium Bar": 10, "Earth Crystal": 10}, "footprint": "3×2", "unlock": "Requires access to the Wizard's magic construction book.", "why": "Provides unlimited teleportation from the farm to the Mountains."},
    {"name": "Water Obelisk", "category": "Wizard", "projectType": "Magical building", "money": 500000, "materials": {"Iridium Bar": 5, "Clam": 10, "Coral": 10}, "footprint": "3×2", "unlock": "Requires access to the Wizard's magic construction book.", "why": "Provides unlimited teleportation from the farm to the Beach."},
    {"name": "Desert Obelisk", "category": "Wizard", "projectType": "Magical building", "money": 1000000, "materials": {"Iridium Bar": 20, "Coconut": 10, "Cactus Fruit": 10}, "footprint": "3×2", "unlock": "Requires access to the Wizard's magic construction book.", "why": "Provides unlimited teleportation from the farm to Calico Desert."},
    {"name": "Island Obelisk", "category": "Wizard", "projectType": "Magical building", "money": 1000000, "materials": {"Iridium Bar": 10, "Dragon Tooth": 10, "Banana": 10}, "footprint": "3×2", "unlock": "Requires Ginger Island and the Wizard's magic construction book.", "why": "Provides unlimited teleportation from the farm to Ginger Island."},
    {"name": "Gold Clock", "category": "Wizard", "projectType": "Magical building", "money": 10000000, "materials": {}, "footprint": "3×2", "unlock": "Requires access to the Wizard's magic construction book.", "why": "Stops debris from appearing and prevents placed fences from decaying."},
    {"name": "Pam's House", "category": "Community", "projectType": "Community upgrade", "money": 500000, "materials": {"Wood": 950}, "unlock": "Available from Robin after completing the Farmhouse upgrades and the Community Center or Joja route.", "why": "Replaces Pam and Penny's trailer with a permanent house."},
    {"name": "Town Shortcuts", "category": "Community", "projectType": "Community upgrade", "money": 300000, "materials": {}, "unlock": "Available from Robin after completing the first Community Upgrade.", "why": "Adds several shortcuts around Pelican Town and nearby areas."},
]

# These stable vanilla IDs seed the shared artwork catalog even when an item is
# not currently present in the save. Every UI surface can then resolve a named
# material through the same catalog instead of maintaining per-view fallbacks.
KNOWN_ITEM_IDS = {
    **{name: item_id for item_id, name in BUNDLE_ITEM_NAMES.items()},
    "Iridium Bar": "337",
    "Dragon Tooth": "852",
    "Banana": "91",
    "Fiber": "771",
}

SEASON_CROP_PLANS = {
    "summer": [
        {"id": "258", "name": "Blueberry", "seed": 80, "growth": 13, "regrow": 4, "sell": 50, "units": 3, "note": "Best convenient multi-harvest crop."},
        {"id": "254", "name": "Melon", "seed": 80, "growth": 12, "regrow": 0, "sell": 250, "units": 1, "note": "Good profit, bundle value, and Giant Crop chance."},
        {"id": "304", "name": "Hops", "seed": 60, "growth": 11, "regrow": 1, "sell": 25, "units": 1, "note": "Excellent in a Keg as Pale Ale, but requires daily harvesting."},
        {"id": "256", "name": "Tomato", "seed": 50, "growth": 11, "regrow": 4, "sell": 60, "units": 1, "note": "Useful for a bundle; moderate profit."},
        {"id": "268", "name": "Starfruit", "seed": 400, "growth": 13, "regrow": 0, "sell": 750, "units": 1, "note": "High value and excellent wine; seeds are sold at the Oasis."},
    ],
    "fall": [
        {"id": "282", "name": "Cranberry", "seed": 240, "growth": 7, "regrow": 5, "sell": 75, "units": 2, "note": "Multiple harvests with little attention."},
        {"id": "276", "name": "Pumpkin", "seed": 100, "growth": 13, "regrow": 0, "sell": 320, "units": 1, "note": "Bundle item, good value, and Giant Crop chance."},
    ],
    "spring": [
        {"id": "400", "name": "Strawberry", "seed": 100, "growth": 8, "regrow": 4, "sell": 120, "units": 1, "note": "Very profitable if you save seeds for next year."},
        {"id": "190", "name": "Cauliflower", "seed": 80, "growth": 12, "regrow": 0, "sell": 175, "units": 1, "note": "Bundle item and possible Giant Crop."},
        {"id": "192", "name": "Potato", "seed": 50, "growth": 6, "regrow": 0, "sell": 80, "units": 1, "note": "Fast return early in the game."},
    ],
}

FISH_LOCATIONS = {
    "128": ["Ocean"], "129": ["Ocean"], "130": ["Ocean"], "131": ["Ocean"],
    "132": ["Town River", "Forest River"], "136": ["Mountain Lake"],
    "137": ["Town River", "Forest Pond"], "138": ["Town River", "Forest River", "Mountain Lake"],
    "139": ["Town River", "Forest River"], "140": ["Town River", "Forest River", "Mountain Lake", "Forest Pond"],
    "141": ["Town River", "Forest River", "Mountain Lake", "Forest Pond"],
    "142": ["Mountain Lake", "Secret Woods", "Sewers"], "143": ["Town River", "Forest River", "Secret Woods"],
    "144": ["Town River", "Forest River", "Forest Pond"], "145": ["Town River", "Forest River"],
    "146": ["Ocean"], "147": ["Ocean"], "148": ["Ocean"], "149": ["Ocean"],
    "150": ["Ocean"], "151": ["Ocean"], "154": ["Ocean"], "155": ["Ocean"],
    "156": ["The Mines · floor 20/60"], "158": ["The Mines · floor 20"],
    "159": ["Ocean · east pier"], "160": ["Town · north of JojaMart"],
    "161": ["The Mines · floor 60"], "162": ["The Mines · floor 100"],
    "163": ["Mountain Lake · log island"], "164": ["Desert"], "165": ["Desert"],
    "267": ["Ocean"], "269": ["Mountain Lake", "Forest Pond", "Ginger Island"],
    "698": ["Mountain Lake"], "699": ["Town River", "Forest River"],
    "700": ["Mountain Lake"], "701": ["Ocean", "Ginger Island Ocean"], "702": ["Mountain Lake", "Forest River"],
    "704": ["Forest River"], "705": ["Ocean"], "706": ["Town River", "Forest River"],
    "707": ["Town River", "Forest River", "Mountain Lake"], "708": ["Ocean"],
    "734": ["Secret Woods"], "775": ["Forest · Arrowhead Island"],
    "795": ["Witch's Swamp"], "796": ["Mutant Bug Lair"],
    "798": ["Night Market submarine"], "799": ["Night Market submarine"], "800": ["Night Market submarine"],
    "836": ["Ginger Island · Pirate Cove"], "837": ["Ginger Island Ocean"], "838": ["Ginger Island River/Pond"],
}

FISH_PRICES = {
    "128": 200, "129": 30, "130": 100, "131": 40, "132": 45, "136": 100, "137": 50,
    "138": 65, "139": 75, "140": 105, "141": 55, "142": 30, "143": 200, "144": 100,
    "145": 30, "146": 75, "147": 30, "148": 85, "149": 150, "150": 50, "151": 80,
    "154": 75, "155": 250, "156": 45, "158": 300, "159": 1500, "160": 900,
    "161": 500, "162": 700, "163": 5000, "164": 75, "165": 327, "267": 100, "269": 150,
    "698": 200, "699": 150, "700": 75, "701": 75, "702": 50, "704": 100, "705": 75,
    "706": 60, "707": 120, "708": 80, "734": 75, "775": 1000, "795": 150, "796": 100,
    "798": 100, "799": 220, "800": 500, "836": 180, "837": 100, "838": 120,
}

FISH_SEASONS = {
    "128": ["summer"], "129": ["spring", "fall"], "130": ["summer", "winter"],
    "131": ["spring", "summer", "fall", "winter"], "132": ["spring", "summer", "fall", "winter"],
    "136": ["spring", "summer", "fall", "winter"], "137": ["spring", "fall"], "138": ["summer"],
    "139": ["fall"], "140": ["fall", "winter"], "141": ["winter"], "142": ["spring", "summer", "fall"],
    "143": ["spring", "fall", "winter"], "144": ["summer", "winter"], "145": ["spring", "summer"],
    "146": ["summer", "winter"], "147": ["spring", "winter"], "148": ["spring", "fall"],
    "149": ["summer"], "150": ["summer", "fall"], "151": ["winter"],
    "154": ["spring", "summer", "fall", "winter"], "155": ["summer", "fall"],
    "156": ["spring", "summer", "fall", "winter"], "158": ["spring", "summer", "fall", "winter"],
    "159": ["summer"], "160": ["fall"], "161": ["spring", "summer", "fall", "winter"],
    "162": ["spring", "summer", "fall", "winter"], "163": ["spring"],
    "164": ["spring", "summer", "fall", "winter"], "165": ["spring", "summer", "fall", "winter"],
    "267": ["spring", "summer"], "269": ["fall", "winter"], "698": ["summer", "winter"],
    "699": ["fall", "winter"], "700": ["spring", "summer", "fall", "winter"],
    "701": ["summer", "fall"], "702": ["spring", "summer", "fall", "winter"], "704": ["summer"],
    "705": ["fall", "winter"], "706": ["spring", "summer", "fall"], "707": ["winter"],
    "708": ["spring", "summer", "winter"], "734": ["spring", "summer", "fall", "winter"],
    "775": ["winter"], "795": ["spring", "summer", "fall", "winter"],
    "796": ["spring", "summer", "fall", "winter"], "798": ["winter"], "799": ["winter"],
    "800": ["winter"], "836": ["spring", "summer", "fall", "winter"],
    "837": ["spring", "summer", "fall", "winter"], "838": ["spring", "summer", "fall", "winter"],
}


def number(node: ET.Element, tag: str, default: int = 0) -> int:
    try:
        return int(float(node.findtext(tag, str(default))))
    except (TypeError, ValueError):
        return default


def stats_values(player: ET.Element) -> dict[str, int]:
    values = {}
    for item in player.findall("stats/Values/item"):
        key = item.findtext("key/string")
        value_node = item.find("value")
        if key and value_node is not None and len(value_node):
            try:
                values[key] = int(value_node[0].text or 0)
            except ValueError:
                pass
    return values


def render_extracted_ui_sprites() -> None:
    """Crop small UI-only sprites without rebuilding any game location."""
    cursors_path = TILES / "Cursors.png"
    if not cursors_path.exists():
        return
    (ASSETS / "sprites").mkdir(parents=True, exist_ok=True)
    with Image.open(cursors_path) as cursors:
        cursors.crop((536, 1945, 592, 1953)).save(ASSETS / "sprites" / "Grandpa Candle Flames.png", optimize=True)
        cursors.crop((577, 1985, 579, 1990)).save(ASSETS / "sprites" / "Grandpa Candle Base.png", optimize=True)


def bool_value(node: ET.Element, tag: str) -> bool:
    value = node.find(tag)
    return value is not None and (value.text or "").lower() == "true"


ITEM_QUALIFIERS = {
    "object": "O",
    "object2": "O",
    "craftable": "BC",
    "furniture": "F",
    "weapon": "W",
    "tool": "T",
    "hat": "H",
    "shirt": "S",
}
ITEM_TYPE_QUALIFIERS = {
    "Axe": "T", "FishingRod": "T", "Hoe": "T", "Pan": "T",
    "Pickaxe": "T", "WateringCan": "T", "Tool": "T",
    "MeleeWeapon": "W", "Slingshot": "W", "Hat": "H",
    "Boots": "B", "Furniture": "F",
}


def unqualified_item_id(value: object) -> str:
    """Return the sprite/data key without discarding its identity elsewhere."""
    return re.sub(r"^\([A-Z]+\)", "", str(value or "").strip())


def qualified_item_id(
    value: object,
    sprite_kind: str = "object",
    qualifier: str | None = None,
) -> str:
    """Keep Stardew item namespaces so equal numeric indexes never collide."""
    item_id = str(value or "").strip()
    if not item_id or item_id.startswith("(") or item_id.startswith("-"):
        return item_id
    resolved = qualifier or ITEM_QUALIFIERS.get(sprite_kind)
    return f"({resolved}){item_id}" if resolved else item_id


def localized_message(key: str, **variables: object) -> dict:
    """Return semantic UI data; React owns wording, grammar, and interpolation."""
    return {"key": key, **({"variables": variables} if variables else {})}


def saved_item_qualifier(node: ET.Element, sprite_kind: str) -> str | None:
    item_type = node.attrib.get(XSI_TYPE, "Object")
    if item_type == "Clothing":
        return "S" if node.findtext("clothesType") == "SHIRT" else "P"
    return ITEM_TYPE_QUALIFIERS.get(item_type, ITEM_QUALIFIERS.get(sprite_kind))


def saved_objects(location: ET.Element) -> list[dict]:
    result = []
    object_nodes = location.find("objects")
    for item in object_nodes if object_nodes is not None else []:
        pos = item.find("key/Vector2")
        obj = item.find("value/Object")
        if pos is None or obj is None:
            continue
        held = obj.find("heldObject")
        held_object = held.find("Object") if held is not None and held.find("Object") is not None else held
        last_input_container = obj.find("lastInputItem")
        last_input = last_input_container.find("Object") if last_input_container is not None and last_input_container.find("Object") is not None else last_input_container
        minutes = number(obj, "minutesUntilReady")
        ready = bool_value(obj, "readyForHarvest")
        output = held_object.findtext("name") if held_object is not None else None
        color_node = obj.find("playerChoiceColor")
        red = number(color_node, "R") if color_node is not None else 0
        green = number(color_node, "G") if color_node is not None else 0
        blue = number(color_node, "B") if color_node is not None else 0
        color = None if red == green == blue == 0 else f"#{red:02x}{green:02x}{blue:02x}"
        result.append({
            "x": number(pos, "X"), "y": number(pos, "Y"),
            "name": obj.findtext("name", "Objeto"),
            "kind": obj.findtext("type", "Object"),
            "id": obj.findtext("itemId", obj.findtext("parentSheetIndex", "")),
            "big": obj.findtext("bigCraftable", "false") == "true",
            "ready": ready,
            "processing": bool(output and not ready and minutes > 0),
            "output": output,
            "input": last_input.findtext("name") if last_input is not None else None,
            "minutesUntilReady": minutes,
            "readyInDays": math.ceil(minutes / 1440) if output and not ready and minutes > 0 else 0,
            "color": color,
        })
    return result


def location_is_accessible(location: ET.Element, player: ET.Element) -> bool:
    """Ignore template locations Stardew serializes before the player can enter them."""
    name = location.findtext("name", "")
    if name.startswith("Cellar"):
        return number(player, "houseUpgradeLevel") >= 3
    if name == "Greenhouse":
        mail = {(value.text or "").lower() for value in player.findall("mailReceived/string")}
        return any("pantry" in flag for flag in mail)
    return True


def interior_views(locations: ET.Element, player: ET.Element, farm: ET.Element) -> list[dict]:
    views = []
    supported = {
        "FarmHouse": "Farmhouse",
        "FarmCave": "Farm Cave",
        "Greenhouse": "Greenhouse",
        "Cellar": "Cellar",
        "AnimalHouse": "Animal building",
        "Shed": "Shed",
        "Cabin": "Cabin",
    }
    building_backgrounds = {
        "Coop": "Coop", "Big Coop": "Coop2", "Deluxe Coop": "Coop3",
        "Barn": "Barn", "Big Barn": "Barn2", "Deluxe Barn": "Barn3",
        "Shed": "Shed", "Big Shed": "Shed2",
    }
    building_dimensions = {
        "Coop": (12, 10), "Big Coop": (16, 10), "Deluxe Coop": (23, 10),
        "Barn": (18, 15), "Big Barn": (22, 15), "Deluxe Barn": (25, 15),
        "Shed": (13, 14), "Big Shed": (19, 17),
    }

    def append_view(location: ET.Element, view_id: str | None = None, forced_label: str | None = None) -> None:
        location_type = location.attrib.get(XSI_TYPE, "")
        name = location.findtext("name", location_type or "Interior")
        objects = saved_objects(location)
        furniture = []
        furniture_nodes = location.find("furniture")
        for item in furniture_nodes if furniture_nodes is not None else []:
            pos = item.find("tileLocation")
            if pos is None:
                continue
            source = item.find("sourceRect")
            bounding = item.find("boundingBox")
            footprint_height = 1
            if bounding is not None:
                footprint_height = max(1, (number(bounding, "Height", 64) + 63) // 64)
            furniture.append({
                "x": number(pos, "X"), "y": number(pos, "Y"), "name": item.findtext("name", "Furniture"),
                "sourceX": number(source, "X"), "sourceY": number(source, "Y"),
                "sourceWidth": number(source, "Width"), "sourceHeight": number(source, "Height"),
                "footprintHeight": footprint_height,
            })
        max_x = max([item["x"] for item in objects + furniture] + [9])
        max_y = max([item["y"] for item in objects + furniture] + [9])
        if name == "FarmHouse":
            upgrade = number(player, "houseUpgradeLevel")
            width, height = ((12, 12), (30, 12), (70, 46))[min(2, upgrade)]
            label = "Farmhouse"
        elif name == "FarmCave":
            width, height = 12, 14
            label = "Farm Cave"
        else:
            label = forced_label or supported.get(location_type, name)
            width, height = building_dimensions.get(
                label,
                (max(12, max_x + 3), max(12, max_y + 3)),
            )
        if name == "FarmCave":
            map_name = "FarmCave"
        elif name == "FarmHouse":
            map_name = ("FarmHouse", "FarmHouse1", "FarmHouse2")[min(2, number(player, "houseUpgradeLevel"))]
        elif name == "Greenhouse" or label == "Greenhouse":
            map_name = "Greenhouse"
        elif name.startswith("Cellar") or label == "Cellar":
            map_name = "FarmHouse_Cellar"
        else:
            map_name = building_backgrounds.get(forced_label or label)
        views.append({
            "id": view_id or name, "name": name, "label": label,
            "width": width, "height": height, "mapName": map_name,
            "background": None, "objects": objects, "furniture": furniture,
        })

    building_nodes = farm.find("buildings")
    building_interior_names = set()
    for building in building_nodes if building_nodes is not None else []:
        indoors = building.find("indoors")
        if indoors is None:
            continue
        interior = indoors if indoors.find("objects") is not None else next((child for child in indoors if child.find("objects") is not None), None)
        if interior is not None:
            building_interior_names.add(interior.findtext("name", ""))

    for location in locations:
        location_type = location.attrib.get(XSI_TYPE, "")
        name = location.findtext("name", location_type or "Interior")
        if not location_is_accessible(location, player):
            continue
        if name not in building_interior_names and (name in supported or location_type in supported or any(word in name.lower() for word in ("coop", "barn", "shed", "cabin"))):
            append_view(location)

    for building in building_nodes if building_nodes is not None else []:
        indoors = building.find("indoors")
        if indoors is None:
            continue
        interior = indoors if indoors.find("objects") is not None else next((child for child in indoors if child.find("objects") is not None), None)
        if interior is None:
            continue
        building_type = building.findtext("buildingType", "Interior")
        view_id = f'{building_type}-{number(building, "tileX")}-{number(building, "tileY")}'
        if not any(view["id"] == view_id for view in views):
            append_view(interior, view_id, building_type)
    return views


def farm_animals(locations: ET.Element) -> list[dict]:
    animals = []
    seen = set()
    for location in locations:
        location_name = location.findtext("name", "Farm")
        for animal in location.findall(".//FarmAnimal"):
            animal_id = animal.findtext("myID", animal.findtext("name", "Animal"))
            if animal_id in seen:
                continue
            seen.add(animal_id)
            animals.append({
                "id": animal_id,
                "name": animal.findtext("name", "Animal"),
                "type": animal.findtext("type", "Animal"),
                "location": location_name,
                "friendship": number(animal, "friendshipTowardFarmer"),
                "happiness": number(animal, "happiness"),
                "fullness": number(animal, "fullness"),
                "petted": bool_value(animal, "wasPet"),
                "produceQuality": number(animal, "produceQuality"),
                "currentProduce": animal.findtext("currentProduce", "-1"),
            })
    return sorted(animals, key=lambda item: (item["type"], item["name"]))


def fish_ponds(farm: ET.Element) -> list[dict]:
    ponds = []
    buildings = farm.find("buildings")
    for building in buildings if buildings is not None else []:
        building_type = building.findtext("buildingType", "")
        if building_type != "Fish Pond" and building.attrib.get(XSI_TYPE, "") != "FishPond":
            continue
        fish_id = building.findtext("fishType", "")
        if fish_id and not fish_id.startswith("("):
            fish_id = f"(O){fish_id}"
        ponds.append({
            "id": f'{number(building, "tileX")}-{number(building, "tileY")}',
            "fishId": fish_id,
            "population": number(building, "currentOccupants"),
            "capacity": number(building, "maxOccupants", 10),
        })
    return ponds


def int_dictionary(node: ET.Element | None) -> dict[str, int]:
    values: dict[str, int] = {}
    if node is None:
        return values
    for item in node.findall("item"):
        key = item.findtext("key/string")
        value = item.find("value")
        if not key or value is None or not len(value):
            continue
        try:
            values[key] = int(value[0].text or 0)
        except (TypeError, ValueError):
            pass
    return values


def next_date(season: str, day: int, year: int) -> tuple[str, int, int]:
    if day < 28:
        return season, day + 1, year
    seasons = ["spring", "summer", "fall", "winter"]
    index = seasons.index(season)
    return (seasons[(index + 1) % 4], 1, year + 1 if season == "winter" else year)


def date_after(season: str, day: int, year: int, offset: int) -> tuple[str, int, int]:
    seasons = ["spring", "summer", "fall", "winter"]
    absolute = (year - 1) * 112 + seasons.index(season) * 28 + (day - 1) + offset
    target_year, within_year = absolute // 112 + 1, absolute % 112
    return seasons[within_year // 28], within_year % 28 + 1, target_year


def crop_forecast(locations: ET.Element, season: str, day: int, year: int) -> list[dict]:
    farm = next((location for location in locations if location.findtext("name") == "Farm"), None)
    if farm is None:
        return []
    grouped: dict[tuple[str, int], dict] = {}
    terrain = farm.find("terrainFeatures")
    for item in terrain if terrain is not None else []:
        crop = item.find("value/TerrainFeature/crop")
        if crop is None or bool_value(crop, "dead"):
            continue
        crop_id = crop.findtext("indexOfHarvest", crop.findtext("netSeedIndex", "Crop"))
        phase_days = [int(value.text or 0) for value in crop.findall("phaseDays/int")]
        current_phase = number(crop, "currentPhase")
        current_day = number(crop, "dayOfCurrentPhase")
        regrowing = bool_value(crop, "fullGrown")
        if not phase_days:
            remaining = 0
        elif current_phase >= len(phase_days) - 1:
            # Repeat crops retain their mature sprite after harvest.
            # In that state, dayOfCurrentPhase is the actual regrowth counter.
            remaining = max(0, current_day) if regrowing else 0
        else:
            remaining = max(0, phase_days[current_phase] - current_day) + sum(phase_days[current_phase + 1:-1])
        key = (crop_id, remaining, regrowing)
        entry = grouped.setdefault(key, {"id": crop_id, "name": CROP_NAMES.get(crop_id, crop_id), "count": 0, "daysRemaining": remaining, "watered": 0, "regrowing": regrowing})
        entry["count"] += 1
        if number(item.find("value/TerrainFeature"), "state") > 0:
            entry["watered"] += 1
    season_labels = {"spring": "Spring", "summer": "Summer", "fall": "Fall", "winter": "Winter"}
    result = []
    for entry in grouped.values():
        target_season, target_day, target_year = date_after(season, day, year, entry["daysRemaining"])
        entry["ready"] = entry["daysRemaining"] == 0
        entry["harvestDate"] = "Today" if entry["ready"] else (f'Year {target_year}, {season_labels[target_season]} {target_day}' if target_year != year else f'{season_labels[target_season]} {target_day}')
        entry["willWither"] = target_season != season and entry["id"] not in MULTI_SEASON_CROPS
        result.append(entry)
    return sorted(result, key=lambda entry: (entry["daysRemaining"], entry["name"]))


def item_sprite_details(node: ET.Element, item_id: str, game_data: dict | None = None) -> dict:
    """Resolve saved item artwork once so every UI surface shares the same metadata."""
    game_data = game_data or {}
    item_type = node.attrib.get(XSI_TYPE, "Object")
    parent_index = node.findtext("parentSheetIndex", item_id)
    if item_type in {"Object", "Torch"}:
        return {
            "spriteKind": "craftable" if bool_value(node, "bigCraftable") else ("object" if item_id.lstrip("-").isdigit() else "object2"),
            "spriteIndex": parent_index,
        }
    if item_type == "Furniture":
        record = str(game_data.get("furniture", {}).get(item_id, ""))
        fields = record.split("/") if record else []
        size = fields[2].split() if len(fields) > 2 else []
        furniture_type = fields[1] if len(fields) > 1 else ""
        sprite_width = int(size[0]) if len(size) > 0 and size[0].isdigit() else (2 if furniture_type == "painting" else 1)
        sprite_height = int(size[1]) if len(size) > 1 and size[1].isdigit() else (2 if furniture_type == "painting" else 1)
        return {
            "spriteKind": "furniture",
            "spriteIndex": parent_index,
            "spriteWidth": sprite_width,
            "spriteHeight": sprite_height,
        }
    if item_type in {"MeleeWeapon", "Slingshot"}:
        return {"spriteKind": "weapon", "spriteIndex": node.findtext("indexOfMenuItemView", node.findtext("currentParentTileIndex", item_id))}
    if item_type in {"Axe", "FishingRod", "Hoe", "Pan", "Pickaxe", "WateringCan"}:
        return {
            "spriteKind": "tool",
            "spriteIndex": node.findtext("indexOfMenuItemView", node.findtext("currentParentTileIndex", item_id)),
            "spriteHeight": 1 if item_type == "FishingRod" else 2,
        }
    if item_type == "Hat":
        return {"spriteKind": "hat", "spriteIndex": item_id}
    if item_type == "Clothing" and node.findtext("clothesType") == "SHIRT":
        return {"spriteKind": "shirt", "spriteIndex": node.findtext("indexInTileSheet", item_id)}
    if item_type in {"Boots", "Ring"}:
        return {"spriteKind": "object", "spriteIndex": node.findtext("indexInTileSheet", item_id)}
    return {"spriteKind": "fallback", "spriteIndex": item_id}


def item_artwork_catalog(root: ET.Element, game_data: dict | None = None) -> dict[str, dict]:
    """Index artwork for every concrete item found anywhere in the save by name."""
    catalog: dict[str, dict] = {
        " ".join(name.casefold().split()): {
            "id": qualified_item_id(item_id), "name": name,
            "spriteKind": "object", "spriteIndex": item_id,
        }
        for name, item_id in KNOWN_ITEM_IDS.items()
    }
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1] not in {"Item", "Object"}:
            continue
        name = (node.findtext("name") or "").strip()
        raw_item_id = node.findtext("itemId", node.findtext("parentSheetIndex", "")) or ""
        if not name or not raw_item_id:
            continue
        sprite_details = item_sprite_details(node, unqualified_item_id(raw_item_id), game_data)
        entry = {
            "id": qualified_item_id(
                raw_item_id,
                sprite_details.get("spriteKind", "fallback"),
                saved_item_qualifier(node, sprite_details.get("spriteKind", "fallback")),
            ),
            "name": name,
            "displayName": game_data.get("localizedObjectNamesByEnglish", {}).get(name, name),
            **sprite_details,
        }
        key = " ".join(name.casefold().split())
        current = catalog.get(key)
        if current is None or entry.get("spriteKind") != "fallback":
            catalog[key] = entry
    return catalog


def localized_names_by_qualified_id(catalog: dict[str, dict], game_data: dict) -> dict[str, str]:
    """Resolve vanilla names once by qualified identity; unknown/modded names pass through."""
    names_by_english = game_data.get("localizedObjectNamesByEnglish", {})
    result = dict(game_data.get("localizedNamesByQualifiedId", {}))
    result.update({
        item["id"]: names_by_english.get(item["name"], item.get("displayName", item["name"]))
        for item in catalog.values()
        if item.get("id") and item.get("name")
    })
    return result


def inventory_items(root: ET.Element, player: ET.Element, locations: ET.Element, game_data: dict | None = None) -> list[dict]:
    items = []
    game_data = game_data or {}

    def append_item(node: ET.Element, source: str, source_detail: dict | None = None) -> None:
        if node.attrib.get("{http://www.w3.org/2001/XMLSchema-instance}nil") == "true":
            return
        name = node.findtext("name")
        raw_item_id = node.findtext("itemId", node.findtext("parentSheetIndex", ""))
        if not name or not raw_item_id:
            return
        stack = number(node, "stack", 1)
        if stack <= 0:
            return
        sprite_details = item_sprite_details(node, unqualified_item_id(raw_item_id), game_data)
        items.append({
            "id": qualified_item_id(
                raw_item_id,
                sprite_details.get("spriteKind", "fallback"),
                saved_item_qualifier(node, sprite_details.get("spriteKind", "fallback")),
            ), "name": name,
            "displayName": game_data.get("localizedObjectNamesByEnglish", {}).get(name, name),
            "category": number(node, "category", -999), "quality": number(node, "quality"),
            "count": stack, "source": source,
            **({"sourceDetail": source_detail} if source_detail else {}),
            **sprite_details,
        })

    for item in player.findall("items/Item"):
        append_item(item, "Backpack", {"source": "Backpack", "kind": "backpack"})

    def player_chests(location: ET.Element):
        object_nodes = location.find("objects")
        for entry in object_nodes if object_nodes is not None else []:
            position = entry.find("key/Vector2")
            chest = entry.find("value/Object")
            if position is None or chest is None:
                continue
            if chest.attrib.get(XSI_TYPE) != "Chest" or not bool_value(chest, "playerChest"):
                continue
            yield chest, position.findtext("X", "?"), position.findtext("Y", "?")

    storage_locations = [
        (location.findtext("name", "Location"), location)
        for location in locations
        if location_is_accessible(location, player)
    ]
    farm = next((location for location in locations if location.findtext("name") == "Farm"), None)
    building_nodes = farm.find("buildings") if farm is not None else None
    for building in building_nodes if building_nodes is not None else []:
        indoors = building.find("indoors")
        if indoors is None:
            continue
        interior = indoors if indoors.find("objects") is not None else next(
            (child for child in indoors if child.find("objects") is not None),
            None,
        )
        if interior is None:
            continue
        building_type = building.findtext("buildingType", "Interior")
        view_id = f'{building_type}-{number(building, "tileX")}-{number(building, "tileY")}'
        storage_locations.append((view_id, interior))

    seen_chests = set()
    for location_name, location in storage_locations:
        for chest, x, y in player_chests(location):
            chest_key = (location_name, x, y)
            if chest_key in seen_chests:
                continue
            seen_chests.add(chest_key)
            source = f"Chest · {location_name} ({x}, {y})"
            color_node = chest.find("playerChoiceColor")
            red = number(color_node, "R") if color_node is not None else 0
            green = number(color_node, "G") if color_node is not None else 0
            blue = number(color_node, "B") if color_node is not None else 0
            color = None if red == green == blue == 0 else f"#{red:02x}{green:02x}{blue:02x}"
            source_detail = {
                "source": source,
                "kind": "chest",
                "name": chest.findtext("name", "Chest"),
                "itemId": chest.findtext("itemId", chest.findtext("parentSheetIndex", "130")),
                "color": color,
                "location": location_name,
                "x": int(x) if str(x).lstrip("-").isdigit() else None,
                "y": int(y) if str(y).lstrip("-").isdigit() else None,
            }
            for item in chest.findall("items/Item"):
                append_item(item, source, source_detail)

    merged: dict[tuple[str, int, str], dict] = {}
    for item in items:
        key = (item["id"], item["quality"], item["name"])
        if key not in merged:
            merged[key] = {
                **item,
                "sources": [item["source"]],
                "sourceCounts": [{"source": item["source"], "count": item["count"], "quality": item["quality"]}],
                "sourceDetails": [item["sourceDetail"]] if item.get("sourceDetail") else [],
            }
        else:
            merged[key]["count"] += item["count"]
            if item["source"] not in merged[key]["sources"]:
                merged[key]["sources"].append(item["source"])
            source_count = next(
                (entry for entry in merged[key]["sourceCounts"] if entry["source"] == item["source"]),
                None,
            )
            if source_count:
                source_count["count"] += item["count"]
            else:
                merged[key]["sourceCounts"].append({"source": item["source"], "count": item["count"], "quality": item["quality"]})
            if item.get("sourceDetail") and not any(
                detail.get("source") == item["source"] for detail in merged[key]["sourceDetails"]
            ):
                merged[key]["sourceDetails"].append(item["sourceDetail"])
    return list(merged.values())


def community_center_status(root: ET.Element, available: list[dict], money: int) -> dict:
    inventory_by_id: dict[str, list[dict]] = {}
    for item in available:
        inventory_by_id.setdefault(str(item["id"]), []).append(item)

    states = {}
    bundles_node = root.find(".//bundles")
    for item in bundles_node if bundles_node is not None else []:
        bundle_id = item.findtext("key/int")
        if bundle_id is not None:
            states[bundle_id] = [value.text == "true" for value in item.findall("value/ArrayOfBoolean/boolean")]

    rooms: dict[str, list[dict]] = {}
    data_node = root.find(".//bundleData")
    for item in data_node if data_node is not None else []:
        key = item.findtext("key/string", "")
        raw = item.findtext("value/string", "")
        if "/" not in key or not raw:
            continue
        room, bundle_id = key.split("/", 1)
        fields = raw.split("/")
        name = fields[0] if fields else f"Bundle {bundle_id}"
        requirement_tokens = fields[2].split() if len(fields) > 2 else []
        requirements = []
        donated_flags = states.get(bundle_id, [])
        for index in range(0, len(requirement_tokens) - 2, 3):
            item_id, count_raw, quality_raw = requirement_tokens[index:index + 3]
            try:
                needed, quality = int(count_raw), int(quality_raw)
            except ValueError:
                continue
            donated = index // 3 < len(donated_flags) and donated_flags[index // 3]
            if item_id == "-1":
                requirements.append({
                    "id": item_id, "name": "Gold", "count": needed, "quality": 0,
                    "donated": donated, "owned": money,
                    "ready": donated or money >= needed,
                })
                continue
            stock = inventory_by_id.get(qualified_item_id(item_id), [])
            owned = sum(entry["count"] for entry in stock if entry.get("quality", 0) >= quality)
            plain_item_id = unqualified_item_id(item_id)
            requirements.append({
                "id": qualified_item_id(item_id), "name": BUNDLE_ITEM_NAMES.get(plain_item_id, CROP_NAMES.get(plain_item_id, f"Item {item_id}")),
                "count": needed, "quality": quality, "donated": donated, "owned": owned,
                "ready": donated or owned >= needed,
            })
        required_count = len(requirements)
        if len(fields) > 4 and fields[4].isdigit():
            required_count = min(required_count, int(fields[4]))
        donated_count = sum(entry["donated"] for entry in requirements)
        ready_count = sum(entry["ready"] for entry in requirements)
        complete = bool(requirements) and donated_count >= required_count
        rooms.setdefault(room, []).append({
            "id": bundle_id, "name": name, "required": required_count, "donated": donated_count,
            "ready": ready_count, "complete": complete, "requirements": requirements,
        })

    room_labels = {"Pantry": "Pantry", "Crafts Room": "Crafts Room", "Fish Tank": "Fish Tank", "Boiler Room": "Boiler Room", "Bulletin Board": "Bulletin Board", "Vault": "Vault"}
    room_list = []
    for room, bundles in rooms.items():
        details = COMMUNITY_ROOM_DETAILS.get(room, {"name": "Room restoration", "description": "Completing every bundle restores this room."})
        room_list.append({
            "id": room, "name": room_labels.get(room, room), "bundles": bundles,
            "completed": sum(bundle["complete"] for bundle in bundles), "total": len(bundles),
            "reward": details,
        })
    total_bundles = sum(room["total"] for room in room_list)
    completed_bundles = sum(room["completed"] for room in room_list)
    ready_items = sum(1 for room in room_list for bundle in room["bundles"] for req in bundle["requirements"] if req["ready"] and not req["donated"])
    return {"rooms": room_list, "completed": completed_bundles, "total": total_bundles, "readyItems": ready_items}


def planning_brief(root: ET.Element, player: ET.Element, locations: ET.Element, season: str, day: int, money: int, objects: list[dict], game_data: dict) -> dict:
    available = inventory_items(root, player, locations, game_data)
    gift_tastes = game_data.get("giftTastes", {})
    modded_characters = game_data.get("moddedCharacters", {})
    counts: dict[str, int] = {}
    for item in available:
        counts[item["name"]] = counts.get(item["name"], 0) + item["count"]

    farm = next((location for location in locations if location.findtext("name") == "Farm"), None)
    placed_buildings: dict[str, int] = {}
    building_nodes = farm.find("buildings") if farm is not None else None
    for building in building_nodes if building_nodes is not None else []:
        building_type = building.findtext("buildingType", "Building")
        placed_buildings[building_type] = placed_buildings.get(building_type, 0) + 1
    house_level = number(player, "houseUpgradeLevel")
    received_mail = {value.text for value in player.findall("mailReceived/string") if value.text}
    has_magic_construction = bool_value(player, "hasMagicInk")
    island_unlocked = any(
        (location.findtext("name") or "").startswith("Island")
        for location in locations
    ) or "willyBoatFixed" in received_mail
    community_route_complete = "ccIsComplete" in received_mail
    first_community_upgrade_complete = "pamHouseUpgrade" in received_mail

    def building_progress(name: str, save_name: str) -> tuple[int, bool, bool]:
        family_types = {
            "Coop": ("Coop", "Big Coop", "Deluxe Coop"),
            "Big Coop": ("Big Coop", "Deluxe Coop"),
            "Deluxe Coop": ("Deluxe Coop",),
            "Barn": ("Barn", "Big Barn", "Deluxe Barn"),
            "Big Barn": ("Big Barn", "Deluxe Barn"),
            "Deluxe Barn": ("Deluxe Barn",),
            "Shed": ("Shed", "Big Shed"),
            "Big Shed": ("Big Shed",),
        }
        if name.startswith("Farmhouse Upgrade "):
            level = int(name.rsplit(" ", 1)[1])
            return (1 if house_level >= level else 0, house_level >= level, house_level >= level - 1)
        family = family_types.get(name, (save_name,))
        owned = sum(placed_buildings.get(building_type, 0) for building_type in family)
        prerequisite = {
            "Big Coop": sum(placed_buildings.get(building_type, 0) for building_type in ("Coop", "Big Coop", "Deluxe Coop")) > 0,
            "Deluxe Coop": sum(placed_buildings.get(building_type, 0) for building_type in ("Big Coop", "Deluxe Coop")) > 0,
            "Big Barn": sum(placed_buildings.get(building_type, 0) for building_type in ("Barn", "Big Barn", "Deluxe Barn")) > 0,
            "Deluxe Barn": sum(placed_buildings.get(building_type, 0) for building_type in ("Big Barn", "Deluxe Barn")) > 0,
            "Big Shed": sum(placed_buildings.get(building_type, 0) for building_type in ("Shed", "Big Shed")) > 0,
        }.get(name, True)
        completed = name in family_types and owned > 0 and name in ("Big Coop", "Deluxe Coop", "Big Barn", "Deluxe Barn", "Big Shed")
        return owned, completed, prerequisite

    buildings = []
    for plan in BUILDING_PLANS:
        materials = [{"name": name, "owned": counts.get(name, 0), "needed": needed} for name, needed in plan["materials"].items()]
        save_name = plan.get("saveName", plan["name"])
        owned, completed, prerequisite_met = building_progress(plan["name"], save_name)
        if plan["name"] == "Pam's House":
            owned = int(first_community_upgrade_complete)
            completed = first_community_upgrade_complete
        elif plan["name"] == "Town Shortcuts":
            owned = int("communityUpgradeShortcuts" in received_mail)
            completed = owned > 0
        category = plan["category"]
        building_available = prerequisite_met
        if plan["name"] == "Pet Bowl":
            building_available = "Marnie_gotPet" in received_mail or plan["name"] in placed_buildings
        elif category == "Wizard":
            building_available = has_magic_construction and (plan["name"] != "Island Obelisk" or island_unlocked)
        elif plan["name"] == "Pam's House":
            building_available = community_route_complete and house_level >= 3
        elif plan["name"] == "Town Shortcuts":
            building_available = first_community_upgrade_complete
        buildings.append({
            **plan, "materials": materials, "owned": owned, "completed": completed,
            "prerequisiteMet": prerequisite_met, "available": building_available,
            "affordable": money >= plan["money"] and all(item["owned"] >= item["needed"] for item in materials),
        })

    crops = []
    days_left = 28 - day
    for plan in SEASON_CROP_PLANS.get(season, []):
        if days_left < plan["growth"]:
            harvests = 0
        elif plan["regrow"]:
            harvests = 1 + (days_left - plan["growth"]) // plan["regrow"]
        else:
            harvests = 1
        revenue = harvests * plan["units"] * plan["sell"]
        crops.append({**plan, "harvests": harvests, "profitPerTile": revenue - plan["seed"], "latestPlantDay": max(0, 28 - plan["growth"])})
    crops.sort(key=lambda crop: crop["profitPerTile"], reverse=True)

    friendships = []
    for item in player.findall("friendshipData/item"):
        name = item.findtext("key/string")
        value = item.find("value/Friendship")
        if not name or name not in VANILLA_FRIENDSHIP_NPCS or value is None:
            continue
        points = number(value, "Points")
        birthday_date = next(((birthday_season, birthday) for (birthday_season, birthday), person in BIRTHDAYS.items() if person == name), None)
        birthday_day = None
        if birthday_date:
            birthday_season, birthday = birthday_date
            current_index = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}.get(season, 0) * 28 + day
            birthday_index = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}.get(birthday_season, 0) * 28 + birthday
            birthday_day = (birthday_index - current_index) % 112
        friendships.append({
            "id": name, "name": name, "points": points, "hearts": points // 250,
            "talkedToday": bool_value(value, "TalkedToToday"), "giftsToday": number(value, "GiftsToday"),
            "giftsThisWeek": number(value, "GiftsThisWeek"),
            "daysToBirthday": birthday_day,
            "gifts": gift_options(name, available, gift_tastes),
        })
    friendships.sort(key=lambda entry: (entry["daysToBirthday"] if entry["daysToBirthday"] is not None else 999, entry["points"]))

    machine_counts: dict[str, dict] = {}
    for obj in objects:
        if not is_production_machine(obj):
            continue
        entry = machine_counts.setdefault(obj["name"], {
            "id": obj.get("id", ""), "name": obj["name"], "count": 0, "ready": 0, "working": 0, "idle": 0,
            "readyOutputs": {}, "workingOutputs": {}, "inputs": {}, "locations": set(),
            "nextReadyMinutes": None,
        })
        entry["count"] += 1
        entry["ready"] += 1 if obj.get("ready") else 0
        entry["working"] += 1 if obj.get("processing") else 0
        entry["idle"] += 1 if not obj.get("ready") and not obj.get("processing") else 0
        if obj.get("location"):
            entry["locations"].add(obj["location"])
        output = obj.get("output")
        if output and obj.get("ready"):
            entry["readyOutputs"][output] = entry["readyOutputs"].get(output, 0) + 1
        elif output and obj.get("processing"):
            entry["workingOutputs"][output] = entry["workingOutputs"].get(output, 0) + 1
        machine_input = obj.get("input")
        if machine_input and obj.get("processing"):
            entry["inputs"][machine_input] = entry["inputs"].get(machine_input, 0) + 1
        minutes = obj.get("minutesUntilReady", 0)
        if obj.get("processing") and minutes > 0:
            entry["nextReadyMinutes"] = minutes if entry["nextReadyMinutes"] is None else min(entry["nextReadyMinutes"], minutes)
    machines = []
    for entry in sorted(machine_counts.values(), key=lambda item: item["name"]):
        machines.append({
            **entry,
            "readyOutputs": [{"name": name, "count": count} for name, count in sorted(entry["readyOutputs"].items())],
            "workingOutputs": [{"name": name, "count": count} for name, count in sorted(entry["workingOutputs"].items())],
            "inputs": [{"name": name, "count": count} for name, count in sorted(entry["inputs"].items())],
            "locations": sorted(entry["locations"]),
        })
    pet_node = next((node for node in root.iter() if node.find("friendshipTowardFarmer") is not None), None)
    pet = {
        "name": pet_node.findtext("name", "Pet") if pet_node is not None else "Pet",
        "type": pet_node.findtext("petType", "Pet") if pet_node is not None else "Pet",
        "points": number(pet_node, "friendshipTowardFarmer") if pet_node is not None else 0,
    }
    return {
        "communityCenter": community_center_status(root, available, money), "buildings": buildings, "crops": crops,
        "friendships": friendships, "pet": pet, "machines": machines,
        "inventory": [{key: item[key] for key in ("id", "name", "displayName", "count", "quality", "sources", "sourceCounts", "sourceDetails", "spriteKind", "spriteIndex", "spriteWidth", "spriteHeight") if key in item} for item in available],
    }


def gift_options(person: str, available: list[dict], tastes: dict) -> dict:
    raw = tastes.get(person, "")
    fields = raw.split("/")
    specific = {
        "love": fields[1].split() if len(fields) > 1 else [],
        "like": fields[3].split() if len(fields) > 3 else [],
        "dislike": fields[5].split() if len(fields) > 5 else [],
        "hate": fields[7].split() if len(fields) > 7 else [],
        "neutral": fields[9].split() if len(fields) > 9 else [],
    }
    universal = {
        "love": tastes.get("Universal_Love", "").split(),
        "like": tastes.get("Universal_Like", "").split(),
        "neutral": tastes.get("Universal_Neutral", "").split(),
    }

    def matches(tokens: list[str], item: dict) -> bool:
        item_id = str(item["id"])
        category = str(item["category"])
        return any(
            (token == category if token.startswith("-") else qualified_item_id(token) == item_id)
            for token in tokens
        )

    result = {"love": [], "like": [], "neutral": []}
    for item in available:
        taste = None
        for level in ("love", "like", "neutral", "dislike", "hate"):
            if matches(specific[level], item):
                taste = level
                break
        if taste is None:
            for level in ("love", "like", "neutral"):
                if matches(universal[level], item):
                    taste = level
                    break
        if taste in result:
            result[taste].append({key: item[key] for key in (
                "id", "name", "count", "quality", "sources", "spriteKind",
                "spriteIndex", "spriteWidth", "spriteHeight",
            ) if key in item})
    for items in result.values():
        items.sort(key=lambda item: (-item["quality"], item["name"]))
    return result


def quest_status(quest: ET.Element, available: list[dict], player: ET.Element, game_data: dict | None = None) -> dict:
    game_data = game_data or {}
    quest_type = quest.attrib.get(XSI_TYPE, "Quest")
    quest_id = number(quest, "id", -1)
    requested_id = qualified_item_id(quest.findtext("item") or quest.findtext("resource") or quest.findtext("fish") or "")
    required = 1
    progress = 0
    stock_note = None
    checks_stock = quest_type == "ItemDeliveryQuest"
    if quest_type == "ResourceCollectionQuest":
        required, progress = number(quest, "number"), number(quest, "numberCollected")
        stock_note = localized_message("quest.stock.resourceCollection")
    elif quest_type == "FishingQuest":
        required, progress = number(quest, "numberToFish"), number(quest, "numberFished")
        stock_note = localized_message("quest.stock.fishing")
    elif quest_type == "SlayMonsterQuest":
        required, progress = number(quest, "numberToKill"), number(quest, "numberKilled")
        stock_note = localized_message("quest.stock.monsters")
    elif quest_type == "SocializeQuest":
        required, progress = number(quest, "total", 1), number(quest, "completed")
    else:
        required = max(1, number(quest, "number", 1))

    matching = [item for item in available if str(item["id"]) == requested_id]
    owned = sum(item["count"] for item in matching)
    if checks_stock:
        progress = min(required, owned)
    completed = bool_value(quest, "completed")
    ready = completed or progress >= required
    tips = []
    if quest_id == 7:
        tips = [localized_message(f"quest.tip.coop{index}") for index in range(1, 4)]
    elif quest_id == 18:
        deepest = number(player, "deepestMineLevel")
        tips = [
            localized_message("quest.tip.mine1", level=deepest),
            localized_message("quest.tip.mine2"),
            localized_message("quest.tip.mine3"),
        ]
    elif quest_type == "HaveBuildingQuest":
        tips = [localized_message("quest.tip.building")]
    elif quest_type == "ItemDeliveryQuest":
        tips = [localized_message("quest.tip.delivery")]
    elif quest_type == "ResourceCollectionQuest":
        tips = [localized_message("quest.tip.collection")]
    elif quest_type == "FishingQuest":
        tips = [localized_message("quest.tip.fishing")]
    elif quest_type == "SlayMonsterQuest":
        tips = [localized_message("quest.tip.monsters")]
    elif quest_type == "SocializeQuest":
        tips = [localized_message("quest.tip.socialize")]
    else:
        tips = [localized_message("quest.tip.generic")]
    localized_quest = game_data.get("localizedQuestsById", {}).get(str(quest_id), {})
    return {
        "accepted": True,
        "id": quest_id,
        "title": localized_quest.get("title") or quest.findtext("_questTitle", quest.findtext("questTitle", "Help Wanted")),
        "description": localized_quest.get("description") or quest.findtext("_questDescription", quest.findtext("questDescription", "")),
        "objective": localized_quest.get("objective") or quest.findtext("_currentObjective") or localized_message("quest.completeRequest"),
        "type": quest_type.removesuffix("Quest"),
        "daily": bool_value(quest, "dailyQuest"),
        "requester": quest.findtext("target", quest.findtext("requester")),
        "reward": number(quest, "moneyReward"), "daysLeft": number(quest, "daysLeft"),
        "progress": progress, "target": required, "ready": ready,
        "owned": owned, "hasRequestedItems": checks_stock and owned >= required,
        "stock": [{"name": item["name"], "count": item["count"], "sources": item["sources"]} for item in matching],
        "stockNote": stock_note,
        "tips": tips,
        "requestedId": requested_id or None,
        "requestedName": matching[0]["name"] if matching else None,
    }


def accepted_quests_status(player: ET.Element, available: list[dict], game_data: dict | None = None) -> list[dict]:
    quests = [
        quest_status(item, available, player, game_data)
        for item in player.findall("questLog/Quest")
        if not bool_value(item, "completed")
        and not bool_value(item, "destroy")
        and (not bool_value(item, "dailyQuest") or number(item, "daysLeft") >= 0)
    ]
    return sorted(quests, key=lambda quest: (not quest["daily"], quest["daysLeft"] if quest["daily"] else 9999, quest["title"]))


def special_orders_status(root: ET.Element, day_index: int, game_data: dict) -> list[dict]:
    strings = game_data.get("specialOrderStrings", {})

    def translated(value: str | None, fallback: str) -> str:
        raw = value or fallback
        raw = re.sub(
            r"\[([^\]]+)\]",
            lambda match: strings.get(match.group(1), match.group(1).replace("_", " ")),
            raw,
        )
        prefix = "Strings\\SpecialOrderStrings:"
        if raw.startswith(prefix):
            key = raw.removeprefix(prefix)
            return strings.get(key, key.replace("_", " "))
        return raw if "LocalizedText" not in raw else fallback

    orders = []
    for order in root.findall("specialOrders/SpecialOrder"):
        if order.findtext("questState", "InProgress") not in ("InProgress", "Complete"):
            continue
        objectives = []
        for objective in order.findall("objectives"):
            objectives.append({
                "description": translated(objective.findtext("description"), "Objective"),
                "progress": number(objective, "currentCount"),
                "target": number(objective, "maxCount"),
            })
        rewards = []
        for reward in order.findall("rewards"):
            reward_type = reward.attrib.get(XSI_TYPE, "Reward")
            amount = number(reward.find("amount") or reward, "int")
            if reward_type == "MoneyReward" and amount:
                rewards.append(f"{amount:,}g")
            elif reward_type == "GemsReward" and amount:
                rewards.append(f"{amount} Qi Gems")
        due_date = number(order, "dueDate", day_index)
        orders.append({
            "id": order.findtext("questKey", "special-order"),
            "title": translated(order.findtext("questName"), "Special Order"),
            "description": translated(order.findtext("questDescription"), ""),
            "requester": order.findtext("requester", "Town board"),
            "daysLeft": max(0, due_date - day_index),
            "duration": order.findtext("duration", "Week"),
            "reward": " · ".join(rewards),
            "objectives": objectives,
        })
    return orders


def daily_quest_status(player: ET.Element, available: list[dict], game_data: dict | None = None) -> dict:
    quest = next((
        item for item in player.findall("questLog/Quest")
        if bool_value(item, "dailyQuest")
        and not bool_value(item, "completed")
        and not bool_value(item, "destroy")
        and number(item, "daysLeft") >= 0
    ), None)
    if quest is not None:
        return quest_status(quest, available, player, game_data)
    return {
        "accepted": False, "title": localized_message("quest.noneAccepted"),
        "description": localized_message("quest.noneDescription"),
        "objective": localized_message("quest.checkBoard"), "type": "None", "requester": None,
        "reward": 0, "daysLeft": 0, "progress": 0, "target": 0,
        "ready": False, "owned": 0, "hasRequestedItems": False, "stock": [], "stockNote": None,
    }


def board_quest_status(save_path: Path, date_key: str, available: list[dict]) -> tuple[bool, dict | None]:
    bridge_path = save_path.parent / ".aincrad-help-wanted.json"
    if not bridge_path.exists():
        return False, None
    try:
        payload = json.loads(bridge_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False, None
    if payload.get("dateKey") != date_key:
        return False, None
    raw = payload.get("quest")
    if raw is None:
        return True, None

    requested_id = qualified_item_id(raw.get("requestedId") or "")
    quest_type = str(raw.get("type") or "Quest")
    checks_stock = quest_type == "ItemDelivery"
    matching = [item for item in available if str(item["id"]) == requested_id]
    owned = sum(item["count"] for item in matching)
    required = max(1, int(raw.get("target") or 1))
    progress = min(required, owned) if checks_stock else int(raw.get("progress") or 0)
    stock_note = None
    if quest_type == "ResourceCollection":
        stock_note = localized_message("quest.stock.resourceCollection")
    elif quest_type == "Fishing":
        stock_note = localized_message("quest.stock.fishingShort")
    elif quest_type == "SlayMonster":
        stock_note = localized_message("quest.stock.monstersShort")
    return True, {
        "accepted": False, "available": True,
        "title": raw.get("title") or localized_message("quest.available"),
        "description": raw.get("description") or localized_message("quest.availableDescription"),
        "objective": raw.get("objective") or localized_message("quest.acceptToBegin"),
        "type": quest_type, "requester": raw.get("requester"),
        "reward": int(raw.get("reward") or 0), "daysLeft": 0,
        "progress": progress, "target": required, "ready": checks_stock and owned >= required,
        "owned": owned, "hasRequestedItems": checks_stock and owned >= required,
        "stock": [{"name": item["name"], "count": item["count"], "sources": item["sources"]} for item in matching],
        "stockNote": stock_note,
        "requestedId": requested_id or None,
        "requestedName": raw.get("requestedName"),
    }


def fishing_brief(root: ET.Element, player: ET.Element, season: str, day: int, progress: dict) -> dict:
    try:
        game_data = json.loads(GAME_DATA.read_text(encoding="utf-8"))
        raw_fish = game_data.get("fish", {})
    except (OSError, json.JSONDecodeError):
        raw_fish = {}

    caught = {
        (item.findtext("key/string") or "").removeprefix("(O)")
        for item in player.findall("fishCaught/item")
    }
    mail = {node.text or "" for node in player.findall("mailReceived/string")}
    rusty_key = (player.findtext("hasRustyKey", "false") or "false").lower() == "true"
    axe_level = max((number(item, "upgradeLevel") for item in player.findall("items/Item") if item.attrib.get(XSI_TYPE) == "Axe"), default=0)
    desert_open = any(key in mail for key in ("ccVault", "jojaVault", "ccVaultFin"))
    ginger_open = "willyBoatFixed" in mail
    legendary_levels = {"159": 5, "160": 3, "163": 10, "775": 6}

    def accessible_location(location: str) -> bool:
        if location.startswith("The Mines"):
            floors = [int(value) for value in location.replace("/", " ").split() if value.isdigit()]
            return bool(floors) and min(floors) <= progress.get("deepestMineLevel", 0)
        if location == "Secret Woods": return axe_level >= 2
        if location == "Desert": return desert_open
        if location == "Sewers": return rusty_key
        if location in ("Witch's Swamp", "Mutant Bug Lair"): return rusty_key and "darkTalisman" in mail
        if location.startswith("Ginger Island"): return ginger_open
        if location == "Night Market submarine": return season == "winter" and 15 <= day <= 17
        return True

    fish = []
    for fish_id, raw in raw_fish.items():
        if fish_id not in FISH_LOCATIONS or not isinstance(raw, str):
            continue
        parts = raw.split("/")
        if len(parts) < 9 or not parts[1].isdigit():
            continue
        times_raw = [int(value) for value in parts[5].split() if value.isdigit()]
        windows = [[times_raw[index], times_raw[index + 1]] for index in range(0, len(times_raw) - 1, 2)]
        locations = FISH_LOCATIONS[fish_id]
        accessible = [location for location in locations if accessible_location(location)]
        minimum_level = legendary_levels.get(fish_id, 0)
        if progress.get("fishing", 0) < minimum_level:
            accessible = []
        fish_seasons = FISH_SEASONS.get(fish_id, parts[6].split())
        fish_weather = "rainy" if fish_id == "163" else parts[7]
        fish.append({
            "id": fish_id, "name": parts[0], "difficulty": int(parts[1]), "behavior": parts[2],
            "windows": windows, "seasons": fish_seasons, "weather": fish_weather,
            "locations": locations, "accessibleLocations": accessible, "basePrice": FISH_PRICES.get(fish_id, 0),
            "minFishingLevel": minimum_level, "caught": fish_id in caught,
        })
    fish.sort(key=lambda item: (item["caught"], item["name"]))
    raining = (root.findtext("isRaining", "false") or "false").lower() == "true"
    return {
        "season": season, "day": day, "weather": "rainy" if raining else "sunny",
        "caughtCount": len(caught), "fish": fish,
        "note": "Time is selected in the app because Stardew only updates the save after sleeping.",
    }


def farm_cave_collectibles(farm_cave: ET.Element | None, cave_choice: int) -> dict[str, int]:
    """Return only the cave reward that can actually be collected right now."""
    collectibles: dict[str, int] = {}
    if farm_cave is None or cave_choice not in {1, 2}:
        return collectibles
    cave_objects = farm_cave.find("objects")
    for item in cave_objects if cave_objects is not None else []:
        obj = item.find("value/Object")
        if obj is None:
            continue
        collectible = None
        if cave_choice == 1:
            if not bool_value(obj, "isSpawnedObject"):
                continue
            collectible = obj
        else:
            if obj.findtext("name") != "Mushroom Box" or not bool_value(obj, "readyForHarvest"):
                continue
            held_container = obj.find("heldObject")
            if held_container is not None:
                held_object = held_container.find("Object")
                collectible = held_object if held_object is not None else held_container
        name = collectible.findtext("name") if collectible is not None else None
        if not name:
            continue
        collectibles[name] = collectibles.get(name, 0) + number(collectible, "stack", 1)
    return collectibles


def daily_brief(root: ET.Element, player: ET.Element, locations: ET.Element, season: str, day: int, year: int, day_index: int, save_path: Path) -> dict:
    try:
        game_data = json.loads(GAME_DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        game_data = {"giftTastes": {}, "cookingChannel": {}, "tipChannel": {}}

    tomorrow_weather = root.findtext("weatherForTomorrow", "Sun")
    for item in root.findall("locationWeather/item"):
        if item.findtext("key/string") == "Default":
            tomorrow_weather = item.findtext("value/LocationWeather/WeatherForTomorrow", tomorrow_weather)
            break
    try:
        luck = float(root.findtext("dailyLuck", "0") or 0)
    except ValueError:
        luck = 0
    luck_tier = "excellent" if luck > .07 else "favorable" if luck > .02 else "veryBad" if luck < -.07 else "unfavorable" if luck < -.02 else "neutral"
    luck_label = localized_message(f"today.luck.{luck_tier}.label")
    luck_advice = localized_message(f"today.luck.{luck_tier}.advice")
    luck_recommendations = [
        localized_message(f"today.luck.{luck_tier}.recommendation1"),
        localized_message(f"today.luck.{luck_tier}.recommendation2"),
    ]

    tv = [
        {"id": "weather", "channel": localized_message("today.tv.weather.channel"), "title": localized_message("today.tv.weather.title", weather=localized_message(f"weather.{tomorrow_weather}")), "detail": localized_message("today.tv.weather.detail")},
        {"id": "fortune", "channel": localized_message("today.tv.fortune.channel"), "title": luck_label, "detail": localized_message("today.tv.fortune.detail", luck=f"{luck:+.3f}")},
    ]
    tip = game_data.get("tipChannel", {}).get(str(day_index))
    if tip:
        tv.append({"id": "tips", "channel": localized_message("today.tv.tips.channel"), "title": localized_message("today.tv.tips.title"), "detail": tip})
    weekday = (day_index - 1) % 7
    if weekday == 6:
        season_index = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}[season]
        recipe_number = ((year - 1) * 16 + season_index * 4 + (day - 1) // 7) % 32 + 1
        recipe = game_data.get("cookingChannel", {}).get(str(recipe_number), "")
        parts = recipe.split("/", 1)
        tv.append({"id": "queen", "channel": localized_message("today.tv.queen.channel"), "title": parts[0] if parts else localized_message("today.tv.queen.newRecipe"), "detail": parts[1] if len(parts) > 1 else localized_message("today.tv.queen.newRecipeDetail")})
    elif weekday == 2:
        tv.append({"id": "queen", "channel": localized_message("today.tv.queen.channel"), "title": localized_message("today.tv.queen.rerun"), "detail": localized_message("today.tv.queen.rerunDetail")})

    # User-authored and modded names remain untouched unless the local game
    # provides a qualified vanilla identity for them.
    item_names: dict[str, str] = {}
    location_names = {"Farm": "Farm", "Town": "Town", "Beach": "Beach", "Mountain": "Mountain", "Forest": "Cindersap Forest", "BusStop": "Bus Stop", "Backwoods": "Backwoods", "FarmCave": "Farm Cave"}
    visible_world_locations = set(location_names)
    world = []
    for location in locations:
        internal_name = location.findtext("name", "")
        if internal_name not in visible_world_locations:
            continue
        found: dict[str, int] = {}
        objects = location.find("objects")
        for item in objects if objects is not None else []:
            obj = item.find("value/Object")
            if obj is None:
                continue
            original = obj.findtext("name", "Object")
            is_dig_spot = original in {"Artifact Spot", "Seed Spot"}
            if not is_dig_spot and obj.findtext("isSpawnedObject", "false") != "true":
                continue
            translated = item_names.get(original, original)
            found[translated] = found.get(translated, 0) + 1
        if found:
            world.append({"location": location_names[internal_name], "items": [{"name": name, "count": count} for name, count in sorted(found.items())]})

    beach = next((location for location in locations if location.findtext("name") == "Beach"), None)
    beach_items: dict[str, dict] = {}
    if beach is not None:
        objects = beach.find("objects")
        for item in objects if objects is not None else []:
            obj = item.find("value/Object")
            pos = item.find("key/Vector2")
            if obj is None or obj.findtext("isSpawnedObject", "false") != "true":
                continue
            original = obj.findtext("name", "Object")
            name = item_names.get(original, original)
            entry = beach_items.setdefault(name, {"name": name, "count": 0, "tiles": []})
            entry["count"] += 1
            if pos is not None:
                entry["tiles"].append([number(pos, "X"), number(pos, "Y")])

    tomorrow_season, tomorrow_day, tomorrow_year = next_date(season, day, year)
    birthday_today = [(BIRTHDAYS.get((season, day)), BIRTHDAYS.get((season, day)))]
    birthday_tomorrow = [(BIRTHDAYS.get((tomorrow_season, tomorrow_day)), BIRTHDAYS.get((tomorrow_season, tomorrow_day)))]
    for npc_id, character in game_data.get("moddedCharacters", {}).items():
        birthday = (str(character.get("birthSeason", "")).lower(), int(character.get("birthDay") or 0))
        if birthday == (season, day):
            birthday_today.append((npc_id, character.get("displayName", npc_id)))
        if birthday == (tomorrow_season, tomorrow_day):
            birthday_tomorrow.append((npc_id, character.get("displayName", npc_id)))
    available = inventory_items(root, player, locations, game_data)
    birthdays = []
    for people, when in ((birthday_today, "today"), (birthday_tomorrow, "tomorrow")):
        for person_id, display_name in people:
            if person_id:
                birthdays.append({"id": person_id, "person": display_name, "when": when, "gifts": gift_options(person_id, available, game_data.get("giftTastes", {}))})

    farm_cave = next((location for location in locations if location.findtext("name") == "FarmCave"), None)
    cave_choice = number(player, "caveChoice")
    cave_items = farm_cave_collectibles(farm_cave, cave_choice)
    fruit_cave = {
        "unlocked": cave_choice > 0,
        "type": "fruitBats" if cave_choice == 1 else "mushrooms" if cave_choice == 2 else "notSelected",
        "count": sum(cave_items.values()),
        "items": [{"name": name, "count": count} for name, count in sorted(cave_items.items())],
    }

    tool_node = player.find("toolBeingUpgraded")
    tool_upgrade = None
    if tool_node is not None:
        days_left = number(player, "daysLeftForToolUpgrade")
        tool_type = tool_node.attrib.get(XSI_TYPE, tool_node.findtext("name", "Tool"))
        tool_names = {"Axe": "Axe", "Pickaxe": "Pickaxe", "Hoe": "Hoe", "WateringCan": "Watering Can", "TrashCan": "Trash Can"}
        target_season, target_day, target_year = date_after(season, day, year, max(0, days_left))
        season_name = {"spring": "Spring", "summer": "Summer", "fall": "Fall", "winter": "Winter"}.get(target_season, target_season.title())
        tool_upgrade = {
            "name": tool_node.findtext("name", tool_names.get(tool_type, tool_type)),
            "type": tool_names.get(tool_type, tool_type),
            "level": number(tool_node, "upgradeLevel"),
            "daysRemaining": max(0, days_left),
            "ready": days_left <= 0,
            "pickupDate": "Today" if days_left <= 0 else (f'Year {target_year}, {season_name} {target_day}' if target_year != year else f'{season_name} {target_day}'),
        }

    crops = crop_forecast(locations, season, day, year)

    today_birthday = next((birthday for birthday in birthdays if birthday["when"] == "today"), None)
    tomorrow_birthday = next((birthday for birthday in birthdays if birthday["when"] == "tomorrow"), None)
    result = {
        "weatherTomorrow": {"code": tomorrow_weather},
        "luck": {"value": luck, "tier": luck_tier, "label": luck_label, "advice": luck_advice, "recommendations": luck_recommendations, "explanation": localized_message("today.luck.explanation")},
        "tv": tv,
        "world": world,
        "beach": list(beach_items.values()),
        "birthdays": birthdays,
        "fruitCave": fruit_cave,
        "toolUpgrade": tool_upgrade,
        "crops": crops,
        "dailyQuest": daily_quest_status(player, available, game_data),
        "acceptedQuests": accepted_quests_status(player, available, game_data),
        "specialOrders": special_orders_status(root, day_index, game_data),
        # The town board is introduced on Fall 2, Year 1. Accepted Qi orders
        # still appear above regardless of this flag when that later board exists.
        "specialOrdersUnlocked": day_index >= 58,
        "inventoryItemsChecked": len(available),
        # Beach forage already appears at the relevant stop in Today's route;
        # repeating only its type count in the greeting is noise, not a task.
        "summary": localized_message(
            "today.summary.birthdayToday" if today_birthday else "today.summary.birthdayTomorrow" if tomorrow_birthday else "today.summary.weather",
            weather=localized_message(f"weather.{tomorrow_weather}"),
            **({"person": (today_birthday or tomorrow_birthday)["person"]} if today_birthday or tomorrow_birthday else {}),
        ),
    }
    has_board_reading, board_quest = board_quest_status(save_path, f"{year}-{season}-{day:02d}", available)
    if has_board_reading:
        result["boardQuest"] = board_quest
    return result


def achievement_tracking(root: ET.Element, player: ET.Element, total_earned: int, progress: dict,
                         game_data: dict | None = None) -> dict:
    game_data = game_data or {}
    earned_ids = {int(value.text) for value in player.findall("achievements/int") if value.text and value.text.isdigit()}
    mail = {value.text for value in player.findall("mailReceived/string") if value.text}
    stats = stats_values(player)
    friendships = []
    for item in player.findall("friendshipData/item"):
        if item.findtext("key/string") not in VANILLA_FRIENDSHIP_NPCS:
            continue
        points = number(item.find("value/Friendship") or item, "Points")
        friendships.append(points)
    cooked = int_dictionary(player.find("cookingRecipes"))
    crafted = int_dictionary(player.find("craftingRecipes"))
    shipped = int_dictionary(player.find("basicShipped"))
    fish_distinct = len(player.findall("fishCaught/item"))
    museum_count = len(root.findall(".//museumPieces/item"))
    cooking_catalog = set(game_data.get("cookingRecipes", {}))
    crafting_catalog = set(game_data.get("craftingRecipes", {})) - {"Wedding Ring"}
    cooking_total = len(cooking_catalog) or 81
    crafting_total = len(crafting_catalog) or 149
    cooked_count = sum(
        value > 0 for name, value in cooked.items()
        if not cooking_catalog or name in cooking_catalog
    )
    crafted_count = sum(
        value > 0 for name, value in crafted.items()
        if not crafting_catalog or name in crafting_catalog
    )
    quests_done = stats.get("BillboardQuestsDone", stats.get("questsCompleted", 0))
    best_friendship = max(friendships, default=0)
    friends_at_five = sum(value >= 1250 for value in friendships)
    friends_at_ten = sum(value >= 2500 for value in friendships)
    skill_levels = [progress[key] for key in ("farming", "mining", "foraging", "fishing", "combat")]
    spouse = (player.findtext("spouse") or "").strip()
    children_count = sum(1 for npc in root.findall(".//characters/NPC") if npc.attrib.get(XSI_TYPE) == "Child")
    joja_member = "JojaMember" in mail
    community_complete = "ccIsComplete" in mail

    polyculture_ids = ["190", "433", "248", "188", "250", "24", "192", "252", "400", "258", "270", "304", "260", "254", "264", "266", "268", "256", "262", "300", "274", "284", "278", "282", "272", "398", "276", "280"]
    monoculture_ids = polyculture_ids + ["454", "597", "595", "593", "591"]
    polyculture_done = sum(shipped.get(item_id, 0) >= 15 for item_id in polyculture_ids)
    monoculture_best = max((shipped.get(item_id, 0) for item_id in monoculture_ids), default=0)

    achievements = []

    def add(key: str, name: str, requirement: str, category: str, save_id: int | None = None,
            current: int | None = None, target: int | None = None, unit: str = "",
            inferred: bool = False, timing: str | None = None, next_step: str | None = None) -> None:
        done = save_id in earned_ids if save_id is not None else inferred
        localized_achievement = game_data.get("localizedAchievementsById", {}).get(str(save_id), {}) if save_id is not None else {}
        name = localized_achievement.get("name") or name
        requirement = localized_achievement.get("requirement") or requirement
        achievements.append({
            "id": key, "gameId": save_id, "name": name, "requirement": requirement, "category": category,
            "done": done, "current": current, "target": target, "unit": unit,
            "timing": timing, "nextStep": next_step,
        })

    add("greenhorn", "Greenhorn", "Earn 15,000g total.", "Economy", 0, total_earned, 15000, "g")
    add("fisherman", "Fisherman", "Catch 10 different species.", "Fishing", 24, fish_distinct, 10, "species")
    add("cowpoke", "Cowpoke", "Earn 50,000g total.", "Economy", 1, total_earned, 50000, "g")
    add("mother-catch", "Mother Catch", "Catch 100 fish.", "Fishing", 27, progress["fishCaught"], 100, "fish")
    add("homesteader", "Homesteader", "Earn 250,000g total.", "Economy", 2, total_earned, 250000, "g")
    add("treasure-trove", "Treasure Trove", "Donate 40 different items to the museum.", "Collections", 28, museum_count, 40, "donations")
    add("the-bottom", "The Bottom", "Reach floor 120 of The Mines.", "Exploration", inferred=progress["deepestMineLevel"] >= 120, current=progress["deepestMineLevel"], target=120, unit="floor")
    add("moving-up", "Moving Up", "Upgrade the farmhouse once.", "Farm", 18, progress["houseUpgradeLevel"], 1, "upgrades")
    add("ol-mariner", "Ol' Mariner", "Catch 24 different species.", "Fishing", 25, fish_distinct, 24, "species")
    add("singular-talent", "Singular Talent", "Reach level 10 in one skill.", "Skills", inferred=max(skill_levels) >= 10, current=max(skill_levels), target=10, unit="level")
    add("new-friend", "A New Friend", "Reach 5 hearts with one person.", "Friendship", 6, min(5, best_friendship // 250), 5, "hearts")
    add("diy", "D.I.Y.", "Craft 15 different items.", "Crafting", 20, crafted_count, 15, "items")
    add("monoculture", "Monoculture", "Ship 300 of one valid crop.", "Shipping", 32, monoculture_best, 300, "units", next_step="Choose a cheap multi-harvest crop such as Blueberry or Cranberry and ship it through the Shipping Bin; selling directly to a shop does not count. All units must be the same valid crop.")
    add("millionaire", "Millionaire", "Earn 1,000,000g total. There is no deadline, and it counts all money earned rather than your current balance.", "Economy", 3, total_earned, 1000000, "g", next_step="You do not need to earn it before Grandpa's visit or before the end of a year. Reaching 1,000,000g before his first visit would grant all 7 evaluation earnings points, but the achievement unlocks at any time.")
    add("best-friends", "Best Friends", "Reach 10 hearts with one person.", "Friendship", 7, min(10, best_friendship // 250), 10, "hearts")
    add("gofer", "Gofer", "Complete 10 Help Wanted requests.", "Requests", 29, quests_done, 10, "requests")
    add("cliques", "Cliques", "Reach 5 hearts with 4 people.", "Friendship", 11, friends_at_five, 4, "people")
    add("living-large", "Living Large", "Upgrade the farmhouse to include a nursery.", "Farm", 19, progress["houseUpgradeLevel"], 2, "upgrades")
    add("artisan", "Artisan", "Craft 30 different items.", "Crafting", 21, crafted_count, 30, "items")
    add("local-legend", "Local Legend", "Restore the Community Center.", "Story", inferred=community_complete and not joja_member, timing="Exclusive route", next_step="Complete every Community Center bundle and attend the ceremony. Buying a Joja membership closes this route; the Joja achievement requires another save.")
    add("networking", "Networking", "Reach 5 hearts with 10 people.", "Friendship", 12, friends_at_five, 10, "people")
    add("blue-ribbon", "Blue Ribbon", "Earn at least 90 points in the Stardew Valley Fair grange display.", "Events", 37, timing="Fall 16 · annual", next_step="Bring 9 items and cover 6 different categories when possible: animal products, artisan goods, cooking, fish, forage, fruit, minerals, and vegetables. A gold-quality crop helps but does not guarantee a win; nine identical crops lose most variety points. A safe mix includes valuable items such as a Diamond, quality fish, an expensive gold vegetable, fruit, Cheese or Mayonnaise, and quality forage. Retrieve the items after judging.")
    add("five-ways", "Master Of The Five Ways", "Reach level 10 in all five skills.", "Skills", inferred=all(level >= 10 for level in skill_levels), current=sum(level >= 10 for level in skill_levels), target=5, unit="skills")
    add("distant-shore", "A Distant Shore", "Reach Ginger Island.", "Exploration", 40, next_step="Finish the Community Center or Joja route, then repair Willy's boat with 200 Hardwood, 5 Iridium Bars, and 5 Battery Packs. Buy a ticket and travel to Ginger Island.")
    add("popular", "Popular", "Reach 5 hearts with 20 people.", "Friendship", 13, friends_at_five, 20, "people")
    add("beloved", "The Beloved Farmer", "Reach 10 hearts with 8 people.", "Friendship", 9, friends_at_ten, 8, "people")
    add("soup", "An Unforgettable Soup", "Get the Governor's best response at the Luau.", "Events", 38, timing="Summer 11 · annual", next_step="Safe Year 1 plan: save a gold-quality Cauliflower from spring. Otherwise, catch a gold Sturgeon at the Mountain Lake (summer, 6:00 AM–7:00 PM) or a gold Catfish in the river during rain. Gold or iridium Melon, Large Milk, Goat Milk, Cheese, Mayonnaise, Purple Mushroom, or Truffle also work. A normal Melon planted on Summer 1 will not mature before the Luau without enough speed boost. Gold Strawberry, Parsnip, Blueberry, Hot Pepper, or Tomato are not enough and give a neutral response. Raise Farming, apply Fertilizer before planting, and water daily for gold crops; cast far from shore and make a strong catch for quality fish. Carry the item, add it to the soup, and speak with Lewis.")
    add("cook", "Cook", "Cook 10 different recipes.", "Cooking", 15, cooked_count, 10, "recipes")
    add("big-help", "A Big Help", "Complete 40 Help Wanted requests.", "Requests", 30, quests_done, 40, "requests")
    add("legend", "Legend", "Earn 10,000,000g total.", "Economy", 4, total_earned, 10000000, "g")
    add("two-thumbs", "Two Thumbs Up", "Watch a movie.", "Story", 36, next_step="Unlock the Movie Theater after completing the Community Center and Missing Bundle, or by buying Joja's final upgrade. Buy a ticket, optionally invite someone, and watch the full movie.")
    add("infinite-power", "Infinite Power", "Obtain an Infinity weapon.", "Combat", 42, next_step="Obtain a Galaxy Sword, Galaxy Hammer, or Galaxy Dagger. At the Volcano Dungeon Forge, combine it with 3 Galaxy Souls, one per operation; each forge also consumes Cinder Shards. The resulting weapon must be Infinity.")
    add("full-house", "Full House", "Get married and have two children.", "Family", inferred=bool(spouse) and children_count >= 2, current=(1 if spouse else 0) + children_count, target=3, unit="family steps", next_step="Upgrade the farmhouse twice to obtain the nursery, get married, and maintain a strong relationship with your spouse. The child question appears randomly when sleeping; accept twice and wait for each child.")
    add("complete-collection", "A Complete Collection", "Complete the museum collection.", "Collections", 5, museum_count, 95, "donations", next_step="Donate all 53 minerals and 42 artifacts. Check the Collections tab; missing slots help guide which geodes to open, fishing chests to seek, Artifact Spots to dig, or areas to explore.")
    add("sous-chef", "Sous Chef", "Cook 25 different recipes.", "Cooking", 16, cooked_count, 25, "recipes")
    add("joja", "Joja Co. Member Of The Year", "Purchase every Joja development project.", "Story", inferred=community_complete and joja_member, timing="Exclusive route", next_step="Buy a Joja membership for 5,000g and pay for every community development project. This removes Community Center bundles; Local Legend requires another save.")
    add("danger-deep", "Danger In The Deep", "Reach the bottom of the dangerous mines.", "Combat", 41, next_step="Unlock Qi's Walnut Room on Ginger Island and accept Danger in the Deep. Descend from floor 1 to 120 within the time limit; afterward, the Shrine of Challenge on floor 120 can reactivate the dangerous mines.")
    add("master-angler", "Master Angler", "Catch every required fish.", "Fishing", 26, fish_distinct, None, "species", next_step="Personally catch every species in the collection, including the five legendary fish, Crab Pot species, and Ginger Island fish. Purchased fish do not count. Qi's Extended Family fish are not required.")
    add("stardrops", "Mystery Of The Stardrops", "Find all seven Stardrops.", "Collections", inferred=number(player, "maxStamina", 270) >= 508, current=max(0, (number(player, "maxStamina", 270) - 270) // 34), target=7, unit="Stardrops", next_step="The seven sources are the Fair for 2,000 Star Tokens, floor 100 of The Mines, a spouse or roommate at 12.5 hearts, Old Master Cannoli, Willy's letter after Master Angler, the museum, and Krobus's shop.")
    add("protector", "Protector Of The Valley", "Complete every guild eradication goal.", "Combat", inferred=False, next_step="Check the Monster Eradication Goals board in the Adventurer's Guild and complete every category. Kills count in The Mines, Skull Cavern, and their variants; collect Gil's rewards too.")
    add("neighbors", "Good Neighbors", "Help the raccoon family grow.", "Story", 39, next_step="After repairing the large tree in Cindersap Forest, complete the raccoon couple's requests. Wait seven days between requests and continue until the family has eight children, then revisit the forest to trigger the achievement.")
    add("full-shipment", "Full Shipment", "Ship at least one of every item in the shipping collection.", "Shipping", 34, len(shipped), 154, "types shipped", next_step="Open Collections > Items Shipped and fill every silhouette by shipping at least one unit through the Shipping Bin. Selling to Pierre, Willy, or another shop does not register the shipment.")
    add("polyculture", "Polyculture", "Ship 15 of each of the 28 required crops.", "Shipping", 31, polyculture_done, 28, "crops completed", next_step="The list contains 28 specific crops across the seasons; ship 15 of each through the Shipping Bin. Coffee Bean counts, but flowers, Ancient Fruit, wild berries, and crops outside the list do not replace any requirement. Keep a seasonal checklist to avoid losing a year.")
    add("well-read", "Well-Read", "Read every book of power.", "Collections", 35, next_step="Only books that grant permanent powers count, not Skill Books that grant experience. Check Special Items & Powers and seek missing books through the Bookseller, boxes, fishing, mining, prizes, and special vendors.")
    add("gourmet", "Gourmet Chef", "Cook every recipe.", "Cooking", 17, cooked_count, cooking_total, "recipes cooked", next_step="Learning a recipe is not enough; cook each at least once in the farmhouse kitchen or with a Cookout Kit. Check Collections > Cooking, follow The Queen of Sauce, raise friendships, and buy shop recipes before gathering ingredients.")
    add("craft-master", "Craft Master", "Craft every crafting recipe.", "Crafting", 22, crafted_count, crafting_total, "different items", next_step="Enable Show Advanced Crafting Information in Options to see how many times each recipe was crafted. Learn every recipe from levels, friendships, shops, Special Orders, and Ginger Island, then craft each at least once.")
    add("perfection", "Perfection", "Reach the Summit after achieving perfection.", "Perfection", 44, next_step="Check the Perfection Tracker in Qi's Walnut Room. It requires shipping, obelisks and the clock, friendships, skills, Stardrops, cooking and crafting recipes, fish, and Golden Walnuts. Reach 100%, then enter the Summit.")
    add("prairie-king", "Prairie King", "Complete Journey of the Prairie King.", "Minigame", inferred="Beat_PK" in mail, next_step="Play the arcade machine in the Stardrop Saloon and defeat the final boss. Coins buy upgrades between stages; prioritize fire rate and damage, and save power-ups for difficult areas.")
    add("fector", "Fector's Challenge", "Complete Journey of the Prairie King without dying.", "Minigame", inferred="Beat_PK_No_Death" in mail, next_step="Complete Prairie King without losing a life. You can leave after a stage and continue from the minigame save another day. If you die, restart before finishing and practice the standard achievement first.")

    return {
        "total": len(achievements),
        "completed": sum(item["done"] for item in achievements),
        "items": achievements,
        "note": "No achievements have a permanent calendar deadline. Events return every year; Local Legend and the Joja route are mutually exclusive within one save.",
    }


def long_term_collection_brief(
    player: ET.Element,
    game_data: dict | None = None,
    shipping: list[dict] | None = None,
) -> dict:
    """Expose exact shipping and recipe checklists from local game/save data."""
    game_data = game_data or {}
    cooked = int_dictionary(player.find("cookingRecipes"))
    crafted = int_dictionary(player.find("craftingRecipes"))

    def output_details(recipe: str, crafting: bool = False) -> tuple[str, str]:
        parts = str(recipe).split("/")
        output = parts[2].split()[0] if len(parts) > 2 and parts[2].strip() else ""
        output = output.removeprefix("(O)").removeprefix("(BC)")
        is_big = crafting and len(parts) > 3 and parts[3].strip().casefold() == "true"
        return output, "craftable" if is_big else "object"

    cooking = []
    for name, recipe in game_data.get("cookingRecipes", {}).items():
        item_id, sprite_kind = output_details(recipe)
        count = cooked.get(name, 0)
        cooking.append({
            "id": item_id, "name": name, "complete": count > 0,
            "count": count, "learned": name in cooked,
            "spriteKind": sprite_kind, "spriteIndex": item_id,
        })

    crafting = []
    for name, recipe in game_data.get("craftingRecipes", {}).items():
        if name == "Wedding Ring":
            continue
        item_id, sprite_kind = output_details(recipe, True)
        count = crafted.get(name, 0)
        crafting.append({
            "id": item_id, "name": name, "complete": count > 0,
            "count": count, "learned": name in crafted,
            "spriteKind": sprite_kind, "spriteIndex": item_id,
        })

    return {
        "shipping": shipping or [],
        "cooking": sorted(cooking, key=lambda item: item["name"]),
        "crafting": sorted(crafting, key=lambda item: item["name"]),
    }


def cached_shipping_collection(save_path: Path) -> list[dict]:
    """Reuse the exact catalog exported by the local SMAPI bridge when available."""
    source_directory_value = os.environ.get("STARDEW_TOOL_SOURCE_SAVE_DIR", "").strip()
    candidates = []
    if source_directory_value:
        candidates.append(Path(source_directory_value) / ".stardew-tool-live.json")
    candidates.extend([
        save_path.parent / ".stardew-tool-live.json",
        save_path.parent / ".aincrad-live.json",
    ])
    for candidate in candidates:
        live = read_json(candidate)
        shipping = (live or {}).get("collections", {}).get("shipping")
        if isinstance(shipping, list) and shipping:
            return shipping
    return []


def grandpa_progress(root: ET.Element, player: ET.Element, farm: ET.Element, total_earned: int, progress: dict) -> dict:
    achievements = {int(value.text) for value in player.findall("achievements/int") if value.text and value.text.isdigit()}
    mail = {value.text for value in player.findall("mailReceived/string") if value.text}
    friendship_points = []
    for item in player.findall("friendshipData/item"):
        if item.findtext("key/string") not in VANILLA_FRIENDSHIP_NPCS:
            continue
        friendship = item.find("value/Friendship")
        friendship_points.append(number(friendship if friendship is not None else item, "Points"))
    friends_at_eight = sum(1 for points in friendship_points if points >= 1975)
    pet_node = root.find(".//friendshipTowardFarmer")
    pet_points = int(pet_node.text or 0) if pet_node is not None else 0
    spouse = (player.findtext("spouse") or "").strip()
    skill_total = sum(progress[key] for key in ("farming", "mining", "foraging", "fishing", "combat"))
    milestones = [
        {"id": "museum", "label": "Museum collection", "points": 1, "done": 5 in achievements, "how": "Complete Gunther's collection by donating all 53 minerals and 42 different artifacts."},
        {"id": "angler", "label": "Every fish", "points": 1, "done": 26 in achievements, "how": "Personally catch every species required for Master Angler. Buying or receiving a fish does not count."},
        {"id": "shipment", "label": "Full shipment", "points": 1, "done": 34 in achievements, "how": "Ship at least one of every item on the Items Shipped tab through the Shipping Bin; direct shop sales do not count."},
        {"id": "marriage", "label": "Marriage and two farmhouse upgrades", "points": 1, "done": bool(spouse) and progress["houseUpgradeLevel"] >= 2, "how": "Get married and buy Robin's first two farmhouse upgrades, through the nursery upgrade."},
        {"id": "friends5", "label": "5 friends at eight hearts", "points": 1, "done": friends_at_eight >= 5, "how": "Reach eight hearts with five villagers. Talking, giving liked gifts, and remembering birthdays speeds progress."},
        {"id": "friends10", "label": "10 friends at eight hearts", "points": 1, "done": friends_at_eight >= 10, "how": "Reach eight hearts with ten villagers. This point is added to the point for the first five friends."},
        {"id": "pet", "label": "Maximum pet friendship", "points": 1, "done": pet_points >= 999, "how": "Pet your animal every day and fill its water bowl. The point is awarded at maximum friendship."},
        {"id": "community", "label": "Community Center and ceremony", "points": 3, "done": "ccIsComplete" in mail, "how": "Complete every Community Center bundle and attend the ceremony. The Joja route replaces this objective."},
        {"id": "skull", "label": "Skull Key", "points": 1, "done": bool_value(player, "hasSkullKey") or progress["deepestMineLevel"] >= 120, "how": "Reach floor 120 of The Mines to find the Skull Key, which opens Skull Cavern in the Desert."},
        {"id": "rusty", "label": "Rusty Key", "points": 1, "done": bool_value(player, "hasRustyKey"), "how": "Donate 60 different items to the museum. Gunther gives you the Rusty Key, which opens the Sewers."},
    ]
    earnings_points = sum(points for threshold, points in ((50000, 1), (100000, 1), (200000, 1), (300000, 1), (500000, 1), (1000000, 2)) if total_earned >= threshold)
    skill_points = int(skill_total >= 30) + int(skill_total >= 50)
    milestone_points = sum(item["points"] for item in milestones if item["done"])
    score = earnings_points + skill_points + milestone_points
    actual_score = number(farm, "grandpaScore")
    return {
        "score": score,
        "candles": 4 if score >= 12 else 3 if score >= 8 else 2 if score >= 4 else 1,
        "actualScore": actual_score,
        "actualCandles": 4 if actual_score >= 12 else 3 if actual_score >= 8 else 2 if actual_score >= 4 else 1 if actual_score > 0 else 0,
        "earningsPoints": earnings_points,
        "skillPoints": skill_points,
        "skillTotal": skill_total,
        "friendsAtEightHearts": friends_at_eight,
        "petFriendship": pet_points,
        "milestones": milestones,
    }


def museum_brief(root: ET.Element, player: ET.Element, progress: dict) -> dict:
    """Build spoiler-free museum guidance from donation IDs and acquisition groups."""
    artifact_ids = [str(item) for item in [*range(96, 102), *range(103, 128), *range(579, 590)]]
    mineral_ids = [str(item) for item in [60, 62, 64, 66, 68, 70, 72, 74, 80, 82, 84, 86, *range(538, 579)]]
    donated = sorted({
        (item.findtext("value/string") or "").removeprefix("(O)")
        for item in root.findall(".//museumPieces/item")
        if item.findtext("value/string")
    })
    mail = {value.text for value in player.findall("mailReceived/string") if value.text}
    desert_open = any(flag in mail for flag in ("ccVault", "jojaVault", "pamHouseUpgrade")) or progress["deepestMineLevel"] >= 120

    artifact_spots = [100, 101, *range(103, 108), 109, *range(110, 121), *range(123, 128), *range(579, 585), *range(586, 590)]
    fishing_chests = [*range(103, 120), 126, 127, 585, 586, 587, 60, 62, 64, 66, 68, 70, 72, 74, 80, 82, 84, 86]
    geodes = [*range(538, 579), 74, 82, 84, 86, 121, 122, 123]
    mines_and_monsters = [60, 62, 64, 66, 68, 70, 72, 74, 80, 82, 84, 86, 96, 97, 98, 99, 105, 107, 108, 110, 112, 114, 121, 122, 585, *range(579, 585)]
    artifact_troves = [100, *range(103, 107), 108, *range(109, 126)]

    def source(key: str, label: str, item_ids: list[int], hint: str, available: bool = True, unavailable: str | None = None) -> dict:
        return {
            "id": key, "label": label, "itemIds": [str(item) for item in item_ids],
            "items": [{"id": str(item), "name": MUSEUM_ITEM_NAMES.get(str(item), f"Item {item}")} for item in item_ids],
            "available": available, "hint": hint, "unavailableHint": unavailable,
        }

    return {
        "donated": donated,
        "artifactIds": artifact_ids,
        "mineralIds": mineral_ids,
        "sources": [
            source("artifact-spots", "Artifact Spots", artifact_spots, "Dig up the moving stems. Different areas have different groups; exact pieces remain hidden."),
            source("fishing-chests", "Fishing Treasure Chests", fishing_chests, "Open treasure chests that appear while fishing. The counter only includes donations that can actually come from this source."),
            source("geodes", "Geodes", geodes, "Process Geodes, Frozen Geodes, Magma Geodes, or Omni Geodes. Once the counter reaches zero, save future geodes for other uses.", progress["deepestMineLevel"] > 0, "Start exploring The Mines to find geodes."),
            source("mines-monsters", "The Mines and monsters", mines_and_monsters, "Digging soil, breaking nodes, and defeating monsters can cover this group without targeting a specific item.", progress["deepestMineLevel"] > 0, "This method becomes available after entering The Mines."),
            source("artifact-troves", "Artifact Troves", artifact_troves, "These are a concentrated artifact source. The card switches off when they can no longer provide a new donation.", desert_open, "You do not have normal access to this source yet; it will appear later."),
        ],
        "note": "Piece names and exact locations remain hidden. Counters are recalculated after every donation.",
    }


def read_snapshot(save_path: Path) -> dict:
    root = ET.parse(save_path).getroot()
    player = root.find("player")
    if player is None:
        raise ValueError("The save does not contain a player")
    locations = root.find("locations")
    if locations is None:
        raise ValueError("The save does not contain locations")
    farm = next(location for location in locations if location.findtext("name") == "Farm")

    objects = saved_objects(farm)

    terrain = []
    terrain_nodes = farm.find("terrainFeatures")
    for item in terrain_nodes if terrain_nodes is not None else []:
        pos = item.find("key/Vector2")
        feature = item.find("value/TerrainFeature")
        if pos is None or feature is None:
            continue
        kind = feature.attrib.get(XSI_TYPE, "Terrain")
        entry = {"x": number(pos, "X"), "y": number(pos, "Y"), "kind": kind}
        if kind == "Tree":
            tree_type = number(feature, "treeType")
            entry.update({
                "treeType": {1: "Oak", 2: "Maple", 3: "Pine", 7: "Mushroom", 8: "Mahogany", 9: "Mystic"}.get(tree_type, str(tree_type)),
                "stage": number(feature, "growthStage"),
                "stump": feature.findtext("stump", "false") == "true",
                "tapped": feature.findtext("tapped", "false") == "true",
                "fertilized": feature.findtext("fertilized", "false") == "true",
            })
        elif kind == "Grass":
            entry["amount"] = number(feature, "numberOfWeeds", 1)
        elif kind == "HoeDirt":
            entry["watered"] = number(feature, "state") > 0
            crop = feature.find("crop")
            if crop is not None:
                entry["crop"] = crop.findtext("netSeedIndex", crop.findtext("indexOfHarvest", "Crop"))
                entry["phase"] = number(crop, "currentPhase")
                entry["cropRow"] = number(crop, "rowInSpriteSheet")
                entry["flip"] = crop.findtext("flip", "false") == "true"
                entry["dead"] = crop.findtext("dead", "false") == "true"
        elif kind == "FruitTree":
            entry["stage"] = number(feature, "growthStage")
            entry["treeId"] = feature.findtext("treeId", "")
        terrain.append(entry)

    buildings = []
    building_nodes = farm.find("buildings")
    for building in building_nodes if building_nodes is not None else []:
        buildings.append({
            "x": number(building, "tileX"), "y": number(building, "tileY"),
            "width": number(building, "tilesWide", 1), "height": number(building, "tilesHigh", 1),
            "name": building.findtext("buildingType", "Building"),
            "daysOfConstructionLeft": number(building, "daysOfConstructionLeft"),
            "daysUntilUpgrade": number(building, "daysUntilUpgrade"),
        })

    clumps = []
    clump_nodes = farm.find("resourceClumps")
    for clump in clump_nodes if clump_nodes is not None else []:
        pos = clump.find("tile")
        if pos is not None:
            clumps.append({
                "x": number(pos, "X"), "y": number(pos, "Y"),
                "width": number(clump, "width", 2), "height": number(clump, "height", 2),
                "id": clump.findtext("parentSheetIndex", ""),
            })

    season = root.findtext("currentSeason", "spring")
    season_label = {"spring": "Spring", "summer": "Summer", "fall": "Fall", "winter": "Winter"}.get(season, season.title())
    stat_values = stats_values(player)
    day = number(root, "dayOfMonth", 1)
    year = number(root, "year", 1)
    season_index = {"spring": 0, "summer": 1, "fall": 2, "winter": 3}.get(season, 0)
    total_earned = number(player, "totalMoneyEarned")
    progress = {
        "farming": number(player, "farmingLevel"),
        "mining": number(player, "miningLevel"),
        "foraging": number(player, "foragingLevel"),
        "fishing": number(player, "fishingLevel"),
        "combat": number(player, "combatLevel"),
        "deepestMineLevel": number(player, "deepestMineLevel"),
        "houseUpgradeLevel": number(player, "houseUpgradeLevel"),
        "stepsTaken": stat_values.get("stepsTaken", 0),
        "itemsShipped": stat_values.get("itemsShipped", 0),
        "cropsShipped": stat_values.get("cropsShipped", 0),
        "fishCaught": stat_values.get("fishCaught", 0),
        "monstersKilled": stat_values.get("monstersKilled", 0),
        "treesChopped": stat_values.get("TreesChopped", 0),
    }
    interiors = interior_views(locations, player, farm)
    all_production_objects = [
        {**obj, "location": location.findtext("name", "Location")}
        for location in locations
        if location_is_accessible(location, player)
        for obj in saved_objects(location)
    ]
    try:
        game_data = json.loads(GAME_DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        game_data = {"giftTastes": {}}
    planning = planning_brief(root, player, locations, season, day, number(player, "money"), all_production_objects, game_data)
    planning["animals"] = farm_animals(locations)
    planning["fishPonds"] = fish_ponds(farm)
    farmer_avatar = render_farmer_avatar(player, game_data, save_path)
    artwork_catalog = item_artwork_catalog(root, game_data)
    return {
        "profileId": PROFILE_ID,
        "farmType": number(root, "whichFarm"),
        "farmName": root.findtext("player/farmName", "My Farm"),
        "farmer": root.findtext("player/name", ""),
        "farmerAvatar": farmer_avatar,
        "season": season,
        "seasonLabel": season_label,
        "day": day,
        "year": year,
        "dateKey": f"{year}-{season}-{day:02d}",
        "dayIndex": (year - 1) * 112 + season_index * 28 + day,
        "money": number(player, "money"),
        "totalMoneyEarned": total_earned,
        "progress": progress,
        "professionIds": [int(node.text) for node in player.findall("professions/int") if (node.text or "").isdigit()],
        "grandpa": grandpa_progress(root, player, farm, total_earned, progress),
        "achievements": achievement_tracking(root, player, total_earned, progress, game_data),
        "collectionBrief": long_term_collection_brief(
            player,
            game_data,
            cached_shipping_collection(save_path),
        ),
        "museumBrief": museum_brief(root, player, progress),
        "dailyBrief": daily_brief(root, player, locations, season, day, year, (year - 1) * 112 + season_index * 28 + day, save_path),
        "fishingBrief": fishing_brief(root, player, season, day, progress),
        "planningBrief": planning,
        "productionCatalog": game_data.get("productionCatalog"),
        "localizedNamesByQualifiedId": localized_names_by_qualified_id(artwork_catalog, game_data),
        "localizedObjectNamesByEnglish": game_data.get("localizedObjectNamesByEnglish", {}),
        "itemArtworkCatalog": artwork_catalog,
        "map": {"width": 80, "height": 65, "tileSize": 16, "blocked": []},
        "objects": objects,
        "interiors": interiors,
        "terrain": terrain,
        "buildings": buildings,
        "clumps": clumps,
        # Proposals are user-authored profile data. They are stored through the
        # private preferences API and must never be embedded in public snapshots.
        "suggestions": [],
    }


def history_entry(snapshot: dict) -> dict:
    tool_levels = {}
    tool_tiers = {"Copper": 1, "Steel": 2, "Gold": 3, "Iridium": 4}
    for item in snapshot.get("planningBrief", {}).get("inventory", []):
        name = str(item.get("name", ""))
        for tool in ("Axe", "Pickaxe", "Hoe", "Watering Can", "Trash Can"):
            if name == tool:
                tool_levels[tool] = max(tool_levels.get(tool, 0), 0)
            elif name.endswith(f" {tool}"):
                tier = tool_tiers.get(name.removesuffix(f" {tool}"), 0)
                tool_levels[tool] = max(tool_levels.get(tool, 0), tier)
    completed_bundles = sum(
        1
        for room in snapshot.get("planningBrief", {}).get("communityCenter", {}).get("rooms", [])
        for bundle in room.get("bundles", [])
        if bundle.get("complete")
    )
    return {
        "dateKey": snapshot["dateKey"], "dayIndex": snapshot["dayIndex"],
        "season": snapshot["season"], "seasonLabel": snapshot["seasonLabel"],
        "day": snapshot["day"], "year": snapshot["year"],
        "money": snapshot["money"], "totalMoneyEarned": snapshot["totalMoneyEarned"],
        "buildings": len(snapshot["buildings"]),
        "trees": sum(1 for item in snapshot["terrain"] if item["kind"] == "Tree"),
        "crops": sum(1 for item in snapshot["terrain"] if item["kind"] == "HoeDirt" and item.get("crop")),
        "progress": snapshot["progress"],
        "friendships": [{"id": item.get("id", item["name"]), "name": item["name"], "points": item["points"]} for item in snapshot.get("planningBrief", {}).get("friendships", [])],
        "petFriendship": snapshot.get("planningBrief", {}).get("pet", {}).get("points", snapshot.get("grandpa", {}).get("petFriendship", 0)),
        "buildingStates": [
            {
                "key": f'{item.get("name", "Building")}@{item.get("x", 0)},{item.get("y", 0)}',
                "name": item.get("name", "Building"),
                "complete": int(item.get("daysOfConstructionLeft", 0) or 0) <= 0,
            }
            for item in snapshot.get("buildings", [])
        ],
        "completedBundles": completed_bundles,
        "completedAchievements": [
            item.get("name", item.get("id", "Achievement"))
            for item in snapshot.get("achievements", {}).get("items", [])
            if item.get("done")
        ],
        "toolLevels": tool_levels,
    }


def update_history(snapshots: list[dict]) -> None:
    history_path = PROFILE_DATA / "farm-history.json"
    farm_name = snapshots[-1]["farmName"]
    history = {"farmName": farm_name, "entries": []}
    season_labels = {"spring": "Spring", "summer": "Summer", "fall": "Fall", "winter": "Winter"}
    progress_defaults = {
        "farming": 0, "mining": 0, "foraging": 0, "fishing": 0, "combat": 0,
        "deepestMineLevel": 0, "houseUpgradeLevel": 0, "stepsTaken": 0,
        "itemsShipped": 0, "cropsShipped": 0, "fishCaught": 0,
        "monstersKilled": 0, "treesChopped": 0,
    }
    indexed: dict[str, dict] = {}

    def add_entry(entry: dict) -> None:
        if not isinstance(entry, dict) or not entry.get("dateKey") or "dayIndex" not in entry:
            return
        normalized = {
            **entry,
            "seasonLabel": season_labels.get(entry.get("season"), str(entry.get("season", "")).title()),
            "progress": {**progress_defaults, **entry.get("progress", {})},
        }
        normalized.setdefault("income", 0)
        normalized.setdefault("spending", 0)
        normalized.setdefault("friendships", [])
        normalized.setdefault("petFriendship", 0)
        normalized.setdefault("buildingStates", [])
        normalized.setdefault("completedBundles", 0)
        normalized.setdefault("completedAchievements", [])
        normalized.setdefault("toolLevels", {})
        normalized.setdefault("annotations", [])
        indexed[normalized["dateKey"]] = normalized

    checkpoint_root = Path(os.environ.get("STARDEW_TOOL_SOURCE_SAVE_DIR", "")) / ".stardew-tool-history"
    if checkpoint_root.is_dir():
        checkpoint_paths = sorted(checkpoint_root.glob("*.json.bak")) + sorted(checkpoint_root.glob("*.json"))
        for checkpoint_path in checkpoint_paths:
            checkpoint = read_json(checkpoint_path)
            if checkpoint and checkpoint.get("farmName", farm_name) == farm_name:
                add_entry(checkpoint)

    history_sources = [history_path]
    history_sources.extend(sorted(HISTORY_BACKUPS.glob("farm-history-*.json")) if HISTORY_BACKUPS.is_dir() else [])
    history_sources.extend(root / "farm-history.json" for root in history_data_roots())
    for source in history_sources:
        recovered = read_json(source)
        if not recovered or recovered.get("farmName", farm_name) != farm_name:
            continue
        for entry in recovered.get("entries", []):
            add_entry(entry)

    days_path = PROFILE_DATA / "days"
    days_path.mkdir(parents=True, exist_ok=True)
    for root in [PROFILE_DATA, *history_data_roots()]:
        source_days = root / "days"
        if not source_days.is_dir():
            continue
        for snapshot_path in sorted(source_days.glob("*.json")):
            recovered_snapshot = read_json(snapshot_path)
            if not recovered_snapshot or recovered_snapshot.get("farmName", farm_name) != farm_name:
                continue
            try:
                add_entry(history_entry(recovered_snapshot))
            except (KeyError, TypeError):
                continue
            # Legacy/public snapshot directories may already prefix a filename
            # with one or more profile IDs. Store one canonical file per game
            # date so a migration can never prefix the same snapshot again.
            destination = days_path / f'{recovered_snapshot["dateKey"]}.json'
            if not destination.exists():
                atomic_write_json(destination, recovered_snapshot)

    for snapshot in snapshots:
        add_entry(history_entry(snapshot))
    entries = sorted(indexed.values(), key=lambda item: item["dayIndex"])
    previous = None
    for entry in entries:
        if previous is None:
            entry["income"] = 0
            entry["spending"] = 0
        else:
            income = max(0, entry["totalMoneyEarned"] - previous["totalMoneyEarned"])
            balance_change = entry["money"] - previous["money"]
            entry["income"] = income
            entry["spending"] = max(0, income - balance_change)
            annotations = []
            previous_buildings = {item.get("key"): item for item in previous.get("buildingStates", [])}
            for building in entry.get("buildingStates", []):
                old = previous_buildings.get(building.get("key"))
                if old is None:
                    annotations.append(localized_message("history.annotation.buildingAdded", building=building.get("name", "Building")))
                elif building.get("complete") and not old.get("complete"):
                    annotations.append(localized_message("history.annotation.buildingCompleted", building=building.get("name", "Building")))
            bundle_delta = entry.get("completedBundles", 0) - previous.get("completedBundles", 0)
            if bundle_delta > 0:
                annotations.append(localized_message("history.annotation.bundlesCompleted", count=bundle_delta))
            previous_achievements = set(previous.get("completedAchievements", []))
            annotations.extend(
                localized_message("history.annotation.achievement", achievement=name)
                for name in entry.get("completedAchievements", [])
                if name not in previous_achievements
            )
            for tool, level in entry.get("toolLevels", {}).items():
                if level > previous.get("toolLevels", {}).get(tool, 0):
                    tier = ["Basic", "Copper", "Steel", "Gold", "Iridium"][min(4, level)]
                    annotations.append(localized_message("history.annotation.toolUpgraded", tool=tool, tier=tier))
            if entry["progress"].get("houseUpgradeLevel", 0) > previous["progress"].get("houseUpgradeLevel", 0):
                annotations.append(localized_message("history.annotation.farmhouseUpgraded"))
            for skill in ("farming", "mining", "foraging", "fishing", "combat"):
                if entry["progress"].get(skill, 0) > previous["progress"].get(skill, 0):
                    annotations.append(localized_message("history.annotation.skillLevel", skill=skill, level=entry["progress"][skill]))
            if entry["progress"].get("deepestMineLevel", 0) > previous["progress"].get("deepestMineLevel", 0):
                annotations.append(localized_message("history.annotation.mineFloor", floor=entry["progress"]["deepestMineLevel"]))
            old_friends = {item.get("id", item.get("name")): item for item in previous.get("friendships", [])}
            for friend in entry.get("friendships", []):
                old_points = old_friends.get(friend.get("id", friend.get("name")), {}).get("points", 0)
                if friend.get("points", 0) // 250 > old_points // 250:
                    annotations.append(localized_message("history.annotation.friendshipHearts", friend=friend.get("name", "Friendship"), hearts=friend.get("points", 0) // 250))
            entry["annotations"] = annotations[:12]
        previous = entry
    history["farmName"] = farm_name
    history["entries"] = entries
    atomic_write_json(history_path, history, backup=True)
    atomic_write_json(DATA / "farm-history.json", history)
    active_days_path = DATA / "days"
    active_days_path.mkdir(parents=True, exist_ok=True)
    for snapshot in snapshots:
        atomic_write_json(days_path / f'{snapshot["dateKey"]}.json', snapshot)
    for snapshot_path in days_path.glob("*.json"):
        snapshot = read_json(snapshot_path)
        if snapshot and snapshot.get("dateKey"):
            atomic_write_json(active_days_path / f'{PROFILE_ID}--{snapshot["dateKey"]}.json', snapshot)


def main() -> None:
    if SAVE is None:
        raise SystemExit(
            "No save configured. Run the desktop application or set STARDEW_SAVE."
        )
    render_extracted_ui_sprites()
    DATA.mkdir(parents=True, exist_ok=True)
    snapshots = []
    old_save = Path(f"{SAVE}_old")
    if old_save.exists():
        snapshots.append(read_snapshot(old_save))
    snapshot = read_snapshot(SAVE)
    snapshots.append(snapshot)
    atomic_write_json(DATA / "farm-state.json", snapshot)
    update_history(snapshots)
    print(f'Updated: {snapshot["farmName"]}, Year {snapshot["year"]}, {snapshot["seasonLabel"]} {snapshot["day"]}')


def render_avatar_files(save_paths: list[Path]) -> None:
    try:
        game_data = json.loads(GAME_DATA.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        game_data = {"hair": {}, "hats": {}}
    rendered = 0
    for save_path in save_paths:
        try:
            root = ET.parse(save_path).getroot()
            player = root.find("player")
            if player is None:
                continue
            profile_id = re.sub(r"[^a-zA-Z0-9._-]+", "-", save_path.parent.name)[:96] or "default"
            if render_farmer_avatar(player, game_data, save_path, profile_id):
                rendered += 1
        except (OSError, ET.ParseError):
            continue
    print(f"Updated {rendered} farmer avatar{'s' if rendered != 1 else ''}.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--avatars-only":
        render_avatar_files([Path(path) for path in sys.argv[2:]])
    else:
        main()
