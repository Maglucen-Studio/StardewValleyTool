using System.Text.Json;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;
using StardewValley.Characters;
using StardewValley.ItemTypeDefinitions;
using StardewValley.Objects;
using StardewValley.Quests;
using StardewValley.SpecialOrders;
using StardewValley.TerrainFeatures;
using StardewValley.Tools;

namespace StardewValleyToolBridge;

public sealed class ModEntry : Mod
{
    private sealed record RouteItem(string name, int count);

    private string? lastQuestPayload;
    private string? lastLivePayload;
    private object? cachedFarmMap;
    private object? cachedWorldTasks;
    private object? cachedCollections;
    private object? cachedStorage;
    private object? cachedMachines;
    private object? cachedAnimals;
    private readonly Dictionary<string, string> liveSectionErrors = new(StringComparer.Ordinal);
    private int liveTicks;
    private static readonly HashSet<string> ProductionMachineNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "Bait Maker", "Bee House", "Bone Mill", "Cask", "Charcoal Kiln", "Cheese Press", "Crab Pot",
        "Coffee Maker", "Crystalarium", "Dehydrator", "Deluxe Worm Bin", "Fish Smoker",
        "Furnace", "Geode Crusher", "Heavy Furnace", "Heavy Tapper", "Incubator", "Keg",
        "Lightning Rod", "Loom", "Mayonnaise Machine", "Mushroom Log", "Oil Maker",
        "Ostrich Incubator", "Preserves Jar", "Recycling Machine", "Seed Maker",
        "Slime Egg-Press", "Slime Incubator", "Solar Panel", "Tapper", "Wood Chipper", "Worm Bin",
    };
    private static readonly HashSet<string> VanillaFriendshipNpcs = new(StringComparer.Ordinal)
    {
        "Abigail", "Alex", "Caroline", "Clint", "Demetrius", "Dwarf", "Elliott", "Emily", "Evelyn", "George", "Gus",
        "Haley", "Harvey", "Jas", "Jodi", "Kent", "Krobus", "Leah", "Leo", "Lewis", "Linus", "Marnie", "Maru", "Pam", "Penny",
        "Pierre", "Robin", "Sam", "Sandy", "Sebastian", "Shane", "Vincent", "Willy", "Wizard",
    };

    public override void Entry(IModHelper helper)
    {
        helper.Events.GameLoop.SaveLoaded += OnSaveLoaded;
        helper.Events.GameLoop.DayStarted += OnDayStarted;
        helper.Events.GameLoop.DayEnding += OnDayEnding;
        helper.Events.GameLoop.Saved += OnSaved;
        helper.Events.GameLoop.OneSecondUpdateTicked += OnTick;
    }

    private void OnSaveLoaded(object? sender, EventArgs e)
    {
        DiscardPendingCheckpoint();
        RefreshForCurrentDay();
    }

    private void OnDayStarted(object? sender, EventArgs e) => RefreshForCurrentDay();

    private void RefreshForCurrentDay()
    {
        ExportQuest();
        ExportLiveState(refreshSlowState: true);
        ExportDailyCheckpoint();
    }

    private void OnTick(object? sender, OneSecondUpdateTickedEventArgs e)
    {
        if (!Context.IsWorldReady) return;
        ExportQuest();
        liveTicks += 1;
        ExportLiveState(refreshSlowState: liveTicks % 5 == 0);
    }

    private void OnDayEnding(object? sender, DayEndingEventArgs e) => ExportDailyCheckpoint(pending: true);

    private void OnSaved(object? sender, SavedEventArgs e)
    {
        if (!PromotePendingCheckpoint()) ExportDailyCheckpoint();
    }

    private void ExportQuest()
    {
        if (!Context.IsWorldReady || string.IsNullOrWhiteSpace(Constants.CurrentSavePath)) return;

        try
        {
            Quest? quest = Game1.questOfTheDay;
            object? questData = null;
            if (quest is not null && !quest.accepted.Value)
            {
                quest.reloadDescription();
                quest.reloadObjective();
                questData = Describe(quest);
            }

            object[] acceptedQuests = DescribeActiveQuests(Game1.player);
            string dateKey = $"{Game1.year}-{Game1.currentSeason.ToString().ToLowerInvariant()}-{Game1.dayOfMonth:00}";
            string payload = JsonSerializer.Serialize(new { dateKey, quest = questData, acceptedQuests });
            if (payload == lastQuestPayload) return;

            string output = Path.Combine(Constants.CurrentSavePath, ".stardew-tool-help-wanted.json");
            string temporary = output + ".tmp";
            File.WriteAllText(temporary, payload);
            File.Move(temporary, output, true);
            lastQuestPayload = payload;
        }
        catch (Exception ex)
        {
            Monitor.Log($"No se pudo exportar Help Wanted: {ex.Message}", LogLevel.Warn);
        }
    }

    private void ExportLiveState(bool refreshSlowState = false)
    {
        if (!Context.IsWorldReady || string.IsNullOrWhiteSpace(Constants.CurrentSavePath)) return;
        try
        {
            Farmer? player = Game1.player;
            if (player is null)
            {
                ReportLiveSectionFailure("player", new InvalidOperationException("Game1.player was unavailable while the world was ready."));
                return;
            }

            object acceptedQuests = CaptureLiveSection<object>(
                "quests.accepted",
                () => DescribeActiveQuests(player),
                Array.Empty<object>());
            Quest? questOfTheDay = CaptureLiveSection<Quest?>("quests.daily", () => Game1.questOfTheDay, null);
            object? boardQuest = CaptureLiveSection<object?>(
                "quests.board",
                () => questOfTheDay is not null && !questOfTheDay.accepted.Value ? Describe(questOfTheDay) : null,
                null);
            bool hasActiveDailyQuest = CaptureLiveSection(
                "quests.status",
                () => player.questLog.Where(quest => quest is not null).Any(quest => quest.dailyQuest.Value && !quest.completed.Value && !quest.destroy.Value),
                false);
            bool dailyQuestCompleted = CaptureLiveSection(
                "quests.completion",
                () => questOfTheDay is not null && questOfTheDay.accepted.Value && !hasActiveDailyQuest,
                false);
            object specialOrders = CaptureLiveSection<object>("special-orders", () => player.team.specialOrders
                .Where(order => order is not null)
                .Where(order => !order.IsHidden())
                .Select(order =>
                {
                    List<string> descriptions = order.GetObjectiveDescriptions();
                    int moneyReward = order.GetMoneyReward();
                    return new
                    {
                        id = order.questKey.Value,
                        title = order.GetName(),
                        description = order.GetDescription(),
                        requester = order.requester.Value,
                        daysLeft = Math.Max(0, order.GetDaysLeft()),
                        duration = order.questDuration.Value.ToString(),
                        reward = moneyReward > 0 ? $"{moneyReward:N0}g" : "",
                        objectives = order.objectives.Where(objective => objective is not null).Select((objective, index) => new
                        {
                            description = index < descriptions.Count ? descriptions[index] : objective.GetDescription(),
                            progress = objective.GetCount(),
                            target = objective.GetMaxCount(),
                        }).ToArray(),
                    };
                }).ToArray(), Array.Empty<object>());
            object inventory = CaptureLiveSection<object>("inventory", () => player.Items.Where(item => item is not null).Select(item => new
            {
                id = item!.QualifiedItemId,
                name = item.DisplayName,
                count = item.Stack,
                quality = item.Quality,
                spriteKind = SpriteKind(item),
                spriteIndex = SpriteIndex(item),
                spriteWidth = SpriteWidth(item),
                spriteHeight = SpriteHeight(item),
            }).ToArray(), Array.Empty<object>());
            object friendships = CaptureLiveSection<object>("friendships", () => player.friendshipData.Pairs
                .Where(pair => pair.Value is not null && VanillaFriendshipNpcs.Contains(pair.Key))
                .Select(pair => new
            {
                name = pair.Key,
                points = pair.Value.Points,
                hearts = pair.Value.Points / 250,
                talkedToday = pair.Value.TalkedToToday,
                giftsToday = pair.Value.GiftsToday,
                giftsThisWeek = pair.Value.GiftsThisWeek,
            }).OrderByDescending(friendship => friendship.points).ToArray(), Array.Empty<object>());
            Farm? farm = CaptureLiveSection<Farm?>("farm", () => Game1.getFarm(), null);
            int readyCrops = CaptureLiveSection(
                "farm.ready-crops",
                () => farm?.terrainFeatures.Values.OfType<HoeDirt>().Count(dirt => dirt.crop?.fullyGrown.Value == true && dirt.crop.dayOfCurrentPhase.Value <= 0) ?? 0,
                0);
            int readyMachines = CaptureLiveSection(
                "farm.ready-machines",
                () => farm?.Objects.Values.Where(obj => obj is not null).Count(obj => obj.readyForHarvest.Value) ?? 0,
                0);
            bool toolPickupReady = CaptureLiveSection(
                "player.tool-upgrade",
                () => player.toolBeingUpgraded.Value is not null && player.daysLeftForToolUpgrade.Value <= 0,
                false);
            if (refreshSlowState || cachedFarmMap is null || cachedWorldTasks is null || cachedCollections is null || cachedStorage is null || cachedMachines is null || cachedAnimals is null)
            {
                string[] routeLocationNames = { "Farm", "FarmCave", "Beach", "Town", "Mountain", "Forest", "BusStop", "Backwoods" };
                cachedWorldTasks = CaptureLiveSection<object>("world-tasks", () => Game1.locations
                    .Where(location => location is not null)
                    .Where(location => routeLocationNames.Contains(location.NameOrUniqueName))
                    .Select(location => new
                    {
                        location = location.NameOrUniqueName,
                        items = DescribeRouteItems(location, player),
                    }).ToArray(), cachedWorldTasks ?? Array.Empty<object>());
                cachedFarmMap = CaptureLiveSection<object>(
                    "farm-map",
                    () => farm is not null ? DescribeFarmMap(farm) : new { terrain = Array.Empty<object>(), objects = Array.Empty<object>(), buildings = Array.Empty<object>() },
                    cachedFarmMap ?? new { terrain = Array.Empty<object>(), objects = Array.Empty<object>(), buildings = Array.Empty<object>() });
                cachedCollections = CaptureLiveSection<object>("collections", () =>
                {
                    string[] caughtFish = player.fishCaught.Keys.Where(id => id is not null).Select(NormalizeId).ToArray();
                    var bundleProgress = Game1.netWorldState.Value.Bundles.Pairs.Select(pair => new
                    {
                        id = pair.Key,
                        donated = pair.Value?.ToArray() ?? Array.Empty<bool>(),
                    }).ToArray();
                    string[] museumItems = Game1.netWorldState.Value.MuseumPieces.Values.Where(id => id is not null).Select(NormalizeId).Distinct().ToArray();
                    var shipping = Game1.objectData.Keys
                        .Where(itemId => itemId is not null)
                        .Select(itemId => ItemRegistry.GetDataOrErrorItem($"(O){itemId}"))
                        .Where(item => item is not null && StardewValley.Object.isPotentialBasicShipped(item.ItemId, item.Category, item.ObjectType))
                        .Select(item => new
                        {
                            id = item.ItemId,
                            name = item.DisplayName,
                            complete = player.basicShipped.ContainsKey(item.ItemId),
                            count = player.basicShipped.TryGetValue(item.ItemId, out int shippedCount) ? shippedCount : 0,
                            learned = true,
                            spriteKind = int.TryParse(item.ItemId, out _) ? "object" : "object2",
                            spriteIndex = item.SpriteIndex.ToString(),
                        })
                        .OrderBy(item => item.name)
                        .ToArray();
                    return new { caughtFish, bundleProgress, museumItems, shipping };
                }, cachedCollections ?? new { caughtFish = Array.Empty<string>(), bundleProgress = Array.Empty<object>(), museumItems = Array.Empty<string>(), shipping = Array.Empty<object>() });
                GameLocation[] trackedLocations = farm is null ? Array.Empty<GameLocation>() : CaptureLiveSection(
                    "locations",
                    () => GetTrackedLocations(farm)
                    .Where(location => location is not null)
                    .Where(location => IsAccessibleLocation(location, player))
                    .Distinct()
                    .ToArray(), Array.Empty<GameLocation>());
                cachedStorage = CaptureLiveSection<object>("storage", () => trackedLocations.SelectMany(location =>
                {
                    string locationKey = TrackedLocationKey(location, farm!);
                    return location.Objects.Pairs
                        .Where(pair => pair.Value is Chest chest && chest.playerChest.Value)
                        .SelectMany(pair =>
                        {
                            var chest = (Chest)pair.Value;
                            var color = chest.playerChoiceColor.Value;
                            string? containerColor = color.R == 0 && color.G == 0 && color.B == 0
                                ? null
                                : $"#{color.R:X2}{color.G:X2}{color.B:X2}";
                            return chest.Items
                                .Where(item => item is not null)
                                .Select(item => new
                                {
                                    id = item!.QualifiedItemId,
                                    name = item.DisplayName,
                                    count = item.Stack,
                                    quality = item.Quality,
                                    spriteKind = SpriteKind(item),
                                    spriteIndex = SpriteIndex(item),
                                    spriteWidth = SpriteWidth(item),
                                    spriteHeight = SpriteHeight(item),
                                    containerKind = "chest",
                                    containerName = chest.Name,
                                    containerItemId = chest.ItemId,
                                    containerColor,
                                    containerLocation = locationKey,
                                    containerX = (int)pair.Key.X,
                                    containerY = (int)pair.Key.Y,
                                });
                        });
                }).ToArray(), cachedStorage ?? Array.Empty<object>());
                cachedMachines = CaptureLiveSection<object>("machines", () => trackedLocations.SelectMany(location => location.Objects.Pairs
                    .Where(pair => pair.Value is not null && IsProductionMachine(pair.Value))
                    .Select(pair => new
                    {
                        id = pair.Value.QualifiedItemId,
                        name = pair.Value.Name,
                        location = location.NameOrUniqueName,
                        ready = pair.Value.readyForHarvest.Value,
                        processing = pair.Value.MinutesUntilReady > 0 && !pair.Value.readyForHarvest.Value,
                        output = pair.Value.heldObject.Value?.DisplayName,
                        outputId = pair.Value.heldObject.Value?.QualifiedItemId,
                        outputVariant = pair.Value.heldObject.Value?.preservedParentSheetIndex.Value,
                        input = pair.Value.lastInputItem.Value?.DisplayName,
                        inputId = pair.Value.lastInputItem.Value?.QualifiedItemId,
                        inputVariant = (pair.Value.lastInputItem.Value as StardewValley.Object)?.preservedParentSheetIndex.Value,
                        minutesUntilReady = Math.Max(0, pair.Value.MinutesUntilReady),
                    })).ToArray(), cachedMachines ?? Array.Empty<object>());
                cachedAnimals = CaptureLiveSection<object>("animals", () => trackedLocations.SelectMany(location => location.animals.Values
                    .Where(animal => animal is not null)
                    .Select(animal => new
                {
                    id = animal.myID.Value.ToString(),
                    name = animal.Name,
                    type = animal.type.Value,
                    location = location.NameOrUniqueName,
                    friendship = animal.friendshipTowardFarmer.Value,
                    happiness = animal.happiness.Value,
                    fullness = animal.fullness.Value,
                    petted = animal.wasPet.Value,
                    produceQuality = animal.produceQuality.Value,
                    currentProduce = animal.currentProduce.Value.ToString(),
                })).ToArray(), cachedAnimals ?? Array.Empty<object>());
            }
            string dateKey = $"{Game1.year}-{Game1.currentSeason.ToString().ToLowerInvariant()}-{Game1.dayOfMonth:00}";
            long heartbeat = DateTimeOffset.Now.ToUnixTimeMilliseconds() / 4000 * 4000;
            string payload = JsonSerializer.Serialize(new
            {
                active = true,
                updatedAt = heartbeat,
                dateKey,
                timeOfDay = Game1.timeOfDay,
                season = Game1.currentSeason.ToString().ToLowerInvariant(),
                day = Game1.dayOfMonth,
                year = Game1.year,
                raining = Game1.isRaining,
                location = Game1.currentLocation?.DisplayName ?? Game1.currentLocation?.NameOrUniqueName ?? "Unknown",
                locationId = Game1.currentLocation?.NameOrUniqueName ?? "Unknown",
                tileX = (int)player.Tile.X,
                tileY = (int)player.Tile.Y,
                energy = Math.Round(player.Stamina, 1),
                maxEnergy = player.MaxStamina,
                health = player.health,
                maxHealth = player.maxHealth,
                money = player.Money,
                fishingLevel = player.FishingLevel,
                grandpaScore = farm?.grandpaScore.Value ?? 0,
                currentTool = player.CurrentTool?.DisplayName,
                boardQuest,
                dailyQuestCompleted,
                acceptedQuests,
                specialOrders,
                inventory,
                storage = cachedStorage,
                machines = cachedMachines,
                animals = cachedAnimals,
                friendships,
                routeState = new { worldTasks = cachedWorldTasks, readyCrops, readyMachines, toolPickupReady },
                collections = cachedCollections,
                farmMap = cachedFarmMap,
                bridgeWarnings = liveSectionErrors.Keys.OrderBy(section => section).ToArray(),
            });
            if (payload == lastLivePayload) return;
            WriteAtomic(Path.Combine(Constants.CurrentSavePath, ".stardew-tool-live.json"), payload);
            lastLivePayload = payload;
        }
        catch (Exception ex)
        {
            ReportLiveSectionFailure("core", ex);
        }
    }

    private T CaptureLiveSection<T>(string section, Func<T> capture, T fallback)
    {
        try
        {
            T value = capture();
            if (liveSectionErrors.Remove(section))
                Monitor.Log($"LIVE section '{section}' recovered.", LogLevel.Info);
            return value;
        }
        catch (Exception ex)
        {
            ReportLiveSectionFailure(section, ex);
            return fallback;
        }
    }

    private void ReportLiveSectionFailure(string section, Exception ex)
    {
        string signature = ex.ToString();
        if (liveSectionErrors.TryGetValue(section, out string? previous) && previous == signature) return;
        liveSectionErrors[section] = signature;
        Monitor.Log($"Could not export LIVE section '{section}'. The remaining LIVE data will continue updating.\n{signature}", LogLevel.Warn);
    }

    private static string SpriteKind(Item item)
    {
        if (item is StardewValley.Object obj && obj.bigCraftable.Value) return "craftable";
        if (item is StardewValley.Object objectItem && !int.TryParse(objectItem.ItemId, out _)) return "object2";
        if (item is Furniture) return "furniture";
        if (item is MeleeWeapon or Slingshot) return "weapon";
        if (item is Tool) return "tool";
        if (item is Hat) return "hat";
        if (item is Clothing) return "shirt";
        return "object";
    }

    private static string SpriteIndex(Item item)
    {
        if (item is Tool tool) return tool.IndexOfMenuItemView.ToString();
        if (item is Clothing clothing) return clothing.indexInTileSheet.Value.ToString();
        return item.ParentSheetIndex.ToString();
    }

    private static int SpriteWidth(Item item)
    {
        return item is Furniture furniture
            ? Math.Max(1, furniture.defaultSourceRect.Value.Width / 16)
            : 1;
    }

    private static int SpriteHeight(Item item)
    {
        if (item is FishingRod) return 1;
        if (item is Tool) return 2;
        return item is Furniture furniture
            ? Math.Max(1, furniture.defaultSourceRect.Value.Height / 16)
            : 1;
    }

    private static object DescribeFarmMap(Farm farm)
    {
        var terrain = farm.terrainFeatures.Pairs
            .Where(pair => pair.Value is not null)
            .Select(pair => new
        {
            x = (int)pair.Key.X,
            y = (int)pair.Key.Y,
            kind = pair.Value.GetType().Name,
            hasCrop = pair.Value is HoeDirt dirt && dirt.crop is not null,
            watered = pair.Value is HoeDirt wateredDirt && wateredDirt.state.Value > 0,
            ready = pair.Value is HoeDirt cropDirt && cropDirt.crop?.fullyGrown.Value == true && cropDirt.crop.dayOfCurrentPhase.Value <= 0,
        }).ToArray();
        var objects = farm.Objects.Pairs
            .Where(pair => pair.Value is not null)
            .Select(pair => new
        {
            x = (int)pair.Key.X,
            y = (int)pair.Key.Y,
            name = pair.Value.DisplayName,
            kind = pair.Value.bigCraftable.Value ? "machine" : pair.Value.Name,
            id = NormalizeId(pair.Value.ItemId),
            big = pair.Value.bigCraftable.Value,
            ready = pair.Value.readyForHarvest.Value,
            processing = pair.Value.MinutesUntilReady > 0,
            output = pair.Value.heldObject.Value?.DisplayName,
                        outputId = pair.Value.heldObject.Value?.QualifiedItemId,
                        outputVariant = pair.Value.heldObject.Value?.preservedParentSheetIndex.Value,
            input = pair.Value.lastInputItem.Value?.DisplayName,
                        inputId = pair.Value.lastInputItem.Value?.QualifiedItemId,
                        inputVariant = (pair.Value.lastInputItem.Value as StardewValley.Object)?.preservedParentSheetIndex.Value,
            minutesUntilReady = Math.Max(0, pair.Value.MinutesUntilReady),
            color = pair.Value is Chest chest
                && (chest.playerChoiceColor.Value.R != 0
                    || chest.playerChoiceColor.Value.G != 0
                    || chest.playerChoiceColor.Value.B != 0)
                ? $"#{chest.playerChoiceColor.Value.R:x2}{chest.playerChoiceColor.Value.G:x2}{chest.playerChoiceColor.Value.B:x2}"
                : null,
        }).ToArray();
        var buildings = farm.buildings
            .Where(building => building is not null)
            .Select(building => new
        {
            x = building.tileX.Value,
            y = building.tileY.Value,
            width = building.tilesWide.Value,
            height = building.tilesHigh.Value,
            name = building.buildingType.Value,
            daysOfConstructionLeft = building.daysOfConstructionLeft.Value,
            daysUntilUpgrade = building.daysUntilUpgrade.Value,
        }).ToArray();
        return new { terrain, objects, buildings };
    }

    private static bool IsProductionMachine(StardewValley.Object obj) =>
        ProductionMachineNames.Contains(obj.Name)
        || obj.readyForHarvest.Value
        || (obj.heldObject.Value is not null && obj.MinutesUntilReady > 0);

    private static bool IsAccessibleLocation(GameLocation location, Farmer player)
    {
        if (location.NameOrUniqueName.StartsWith("Cellar", StringComparison.OrdinalIgnoreCase))
            return player.HouseUpgradeLevel >= 3;
        return true;
    }

    private static IEnumerable<GameLocation> GetTrackedLocations(Farm farm)
    {
        foreach (GameLocation location in Game1.locations) yield return location;
        foreach (var building in farm.buildings)
        {
            if (building is null) continue;
            GameLocation? indoors = building.GetIndoors();
            if (indoors is not null) yield return indoors;
        }
    }

    private static string TrackedLocationKey(GameLocation location, Farm farm)
    {
        foreach (var building in farm.buildings)
            if (building is not null && ReferenceEquals(building.GetIndoors(), location))
                return $"{building.buildingType.Value}-{building.tileX.Value}-{building.tileY.Value}";
        return location.NameOrUniqueName;
    }

    private void ExportDailyCheckpoint(bool pending = false)
    {
        if (!Context.IsWorldReady || string.IsNullOrWhiteSpace(Constants.CurrentSavePath)) return;
        try
        {
            Farmer player = Game1.player;
            Farm farm = Game1.getFarm();
            string dateKey = $"{Game1.year}-{Game1.currentSeason.ToString().ToLowerInvariant()}-{Game1.dayOfMonth:00}";
            int seasonIndex = Game1.currentSeason.ToString().ToLowerInvariant() switch { "spring" => 0, "summer" => 1, "fall" => 2, _ => 3 };
            string payload = JsonSerializer.Serialize(new
            {
                farmName = player.farmName.Value,
                dateKey,
                capturedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                dayIndex = (Game1.year - 1) * 112 + seasonIndex * 28 + Game1.dayOfMonth,
                season = Game1.currentSeason.ToString().ToLowerInvariant(),
                day = Game1.dayOfMonth,
                year = Game1.year,
                money = player.Money,
                totalMoneyEarned = player.totalMoneyEarned,
                buildings = farm.buildings.Count,
                trees = farm.terrainFeatures.Values.Count(feature => feature is Tree),
                crops = farm.terrainFeatures.Values.Count(feature => feature is HoeDirt dirt && dirt.crop is not null),
                friendships = player.friendshipData.Pairs.Where(pair => VanillaFriendshipNpcs.Contains(pair.Key)).Select(pair => new { name = pair.Key, points = pair.Value.Points }).ToArray(),
                petFriendship = farm.characters.OfType<Pet>().FirstOrDefault()?.friendshipTowardFarmer.Value ?? 0,
                buildingStates = farm.buildings.Select(building => new
                {
                    key = $"{building.buildingType.Value}@{building.tileX.Value},{building.tileY.Value}",
                    name = building.buildingType.Value,
                    complete = building.daysOfConstructionLeft.Value <= 0,
                }).ToArray(),
                completedAchievements = player.achievements.Select(id => id.ToString()).ToArray(),
                toolLevels = player.Items.OfType<Tool>()
                    .GroupBy(tool => tool.BaseName)
                    .ToDictionary(group => group.Key, group => group.Max(tool => tool.UpgradeLevel)),
                progress = new
                {
                    farming = player.FarmingLevel, mining = player.MiningLevel, foraging = player.ForagingLevel,
                    fishing = player.FishingLevel, combat = player.CombatLevel, deepestMineLevel = player.deepestMineLevel,
                    houseUpgradeLevel = player.HouseUpgradeLevel,
                },
            });
            string directory = Path.Combine(Constants.CurrentSavePath, ".stardew-tool-history");
            Directory.CreateDirectory(directory);
            string output = pending ? PendingCheckpointPath(directory) : Path.Combine(directory, $"{dateKey}.json");
            WriteAtomic(output, payload, keepBackup: !pending);
        }
        catch (Exception ex)
        {
            Monitor.Log($"Could not export the daily checkpoint: {ex.Message}", LogLevel.Warn);
        }
    }

    private bool PromotePendingCheckpoint()
    {
        if (string.IsNullOrWhiteSpace(Constants.CurrentSavePath)) return false;
        string directory = Path.Combine(Constants.CurrentSavePath, ".stardew-tool-history");
        string pending = PendingCheckpointPath(directory);
        if (!File.Exists(pending)) return false;

        try
        {
            string payload = File.ReadAllText(pending);
            using JsonDocument document = JsonDocument.Parse(payload);
            if (!document.RootElement.TryGetProperty("dateKey", out JsonElement dateElement)) return false;
            string? dateKey = dateElement.GetString();
            if (string.IsNullOrWhiteSpace(dateKey)) return false;
            WriteAtomic(Path.Combine(directory, $"{dateKey}.json"), payload, keepBackup: true);
            File.Delete(pending);
            return true;
        }
        catch (Exception ex)
        {
            Monitor.Log($"Could not confirm the pending daily checkpoint: {ex.Message}", LogLevel.Warn);
            return false;
        }
    }

    private void DiscardPendingCheckpoint()
    {
        if (string.IsNullOrWhiteSpace(Constants.CurrentSavePath)) return;
        string pending = PendingCheckpointPath(Path.Combine(Constants.CurrentSavePath, ".stardew-tool-history"));
        try
        {
            if (File.Exists(pending)) File.Delete(pending);
        }
        catch (Exception ex)
        {
            Monitor.Log($"Could not discard an unconfirmed daily checkpoint: {ex.Message}", LogLevel.Warn);
        }
    }

    private static string PendingCheckpointPath(string directory) => Path.Combine(directory, "pending.checkpoint");

    private static RouteItem[] DescribeRouteItems(GameLocation location, Farmer player)
    {
        if (location.NameOrUniqueName == "FarmCave")
        {
            if (player.caveChoice.Value == 1)
                return location.Objects.Pairs
                    .Where(pair => pair.Value is not null && pair.Value.IsSpawnedObject)
                    .GroupBy(pair => pair.Value.DisplayName)
                    .Select(group => new RouteItem(group.Key, group.Sum(pair => pair.Value.Stack)))
                    .OrderBy(item => item.name)
                    .ToArray();
            if (player.caveChoice.Value == 2)
                return location.Objects.Pairs
                    .Where(pair => pair.Value is not null && pair.Value.Name == "Mushroom Box" && pair.Value.readyForHarvest.Value && pair.Value.heldObject.Value is not null)
                    .GroupBy(pair => pair.Value.heldObject.Value!.DisplayName)
                    .Select(group => new RouteItem(group.Key, group.Sum(pair => pair.Value.heldObject.Value!.Stack)))
                    .OrderBy(item => item.name)
                    .ToArray();
            return Array.Empty<RouteItem>();
        }
        return location.Objects.Pairs
            .Where(pair => pair.Value is not null && (pair.Value.IsSpawnedObject || pair.Value.Name is "Artifact Spot" or "Seed Spot"))
            .GroupBy(pair => pair.Value.Name)
            .Select(group => new RouteItem(group.Key, group.Count()))
            .OrderBy(item => item.name)
            .ToArray();
    }

    private static void WriteAtomic(string output, string payload, bool keepBackup = false)
    {
        string temporary = output + ".tmp";
        File.WriteAllText(temporary, payload);
        if (keepBackup && File.Exists(output)) File.Copy(output, output + ".bak", true);
        File.Move(temporary, output, true);
    }

    private static string NormalizeId(string id) => id.StartsWith("(O)", StringComparison.Ordinal) ? id[3..] : id;

    private static object[] DescribeActiveQuests(Farmer player) => player.questLog
        .Where(quest => quest is not null && !quest.completed.Value && !quest.destroy.Value)
        .Select(quest =>
        {
            quest.reloadDescription();
            quest.reloadObjective();
            return Describe(quest);
        })
        .ToArray();

    private static object Describe(Quest quest)
    {
        string? requestedId = null;
        string? requester = null;
        int target = 1;
        int progress = 0;
        int reward = quest.moneyReward.Value;
        string type = quest.GetType().Name.Replace("Quest", "");

        switch (quest)
        {
            case ItemDeliveryQuest item:
                requestedId = item.ItemId.Value;
                requester = item.target.Value;
                target = Math.Max(1, item.number.Value);
                break;
            case ResourceCollectionQuest resource:
                requestedId = resource.ItemId.Value;
                requester = resource.target.Value;
                target = resource.number.Value;
                progress = resource.numberCollected.Value;
                reward = resource.reward.Value;
                break;
            case FishingQuest fishing:
                requestedId = fishing.ItemId.Value;
                requester = fishing.target.Value;
                target = fishing.numberToFish.Value;
                progress = fishing.numberFished.Value;
                reward = fishing.reward.Value;
                break;
            case SlayMonsterQuest slay:
                requester = slay.target.Value;
                target = slay.numberToKill.Value;
                progress = slay.numberKilled.Value;
                reward = slay.reward.Value;
                requestedId = slay.monsterName.Value;
                break;
            case SocializeQuest socialize:
                target = socialize.total.Value;
                progress = Math.Max(0, socialize.total.Value - socialize.whoToGreet.Count);
                break;
        }

        string? requestedName = requestedId;
        if (!string.IsNullOrWhiteSpace(requestedId) && !type.Equals("SlayMonster", StringComparison.Ordinal))
        {
            try { requestedName = ItemRegistry.Create(requestedId).DisplayName; }
            catch { /* El ID sigue siendo suficiente para que la web lo relacione con el inventario. */ }
        }

        return new
        {
            id = quest.id.Value,
            accepted = quest.accepted.Value,
            available = true,
            daily = quest.dailyQuest.Value,
            daysLeft = quest.daysLeft.Value,
            title = quest.questTitle,
            description = quest.questDescription,
            objective = quest.currentObjective,
            type,
            requester,
            reward,
            progress,
            target,
            ready = progress >= target,
            requestedId,
            requestedName,
        };
    }
}
