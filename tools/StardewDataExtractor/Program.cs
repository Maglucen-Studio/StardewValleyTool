using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.Loader;
using System.Text.Json;
using Microsoft.Xna.Framework.Content;
using StardewValley.GameData.BigCraftables;
using StardewValley.GameData.Crops;
using StardewValley.GameData.FruitTrees;
using StardewValley.GameData.Machines;
using StardewValley.GameData.Objects;
using StardewValley.GameData.Shops;
using StardewValley.GameData.WildTrees;
using GameObject = StardewValley.Object;

if (args.Length != 1)
    throw new ArgumentException("Expected the local Stardew Valley installation directory.");

string gameRoot = Path.GetFullPath(args[0]);
AssemblyLoadContext.Default.Resolving += (_, assemblyName) =>
{
    string candidate = Path.Combine(gameRoot, $"{assemblyName.Name}.dll");
    return File.Exists(candidate) ? AssemblyLoadContext.Default.LoadFromAssemblyPath(candidate) : null;
};

Console.Write(GameCatalogReader.Read(Path.Combine(gameRoot, "Content")));

static class GameCatalogReader
{
    private const int FruitTreeMaturityDays = 28;
    private const int FruitTreeClearanceTiles = 9;

    [MethodImpl(MethodImplOptions.NoInlining)]
    public static string Read(string contentRoot)
    {
        using var content = new ContentManager(new EmptyServices(), contentRoot);
        Dictionary<string, CropData> crops = content.Load<Dictionary<string, CropData>>("Data/Crops");
        Dictionary<string, ObjectData> objects = content.Load<Dictionary<string, ObjectData>>("Data/Objects");
        Dictionary<string, FruitTreeData> fruitTrees = content.Load<Dictionary<string, FruitTreeData>>("Data/FruitTrees");
        Dictionary<string, ShopData> shops = content.Load<Dictionary<string, ShopData>>("Data/Shops");
        Dictionary<string, WildTreeData> wildTrees = content.Load<Dictionary<string, WildTreeData>>("Data/WildTrees");
        Dictionary<string, MachineData> machines = content.Load<Dictionary<string, MachineData>>("Data/Machines");
        Dictionary<string, BigCraftableData> bigCraftables = content.Load<Dictionary<string, BigCraftableData>>("Data/BigCraftables");
        Dictionary<string, string> craftingRecipes = content.Load<Dictionary<string, string>>("Data/CraftingRecipes");

        static string QualifyObject(string? id) => string.IsNullOrWhiteSpace(id) ? "" : id.StartsWith('(') ? id : $"(O){id}";
        static string Unqualify(string? id)
        {
            if (string.IsNullOrWhiteSpace(id)) return "";
            int close = id.IndexOf(')');
            return close >= 0 ? id[(close + 1)..] : id;
        }
        ObjectData? ObjectFor(string id) => objects.GetValueOrDefault(Unqualify(id));
        int PurchasePriceFor(ShopItemData item)
        {
            if (!string.IsNullOrWhiteSpace(item.TradeItemId)) return 0;
            if (item.Price >= 0) return item.Price;
            ObjectData? data = ObjectFor(item.ItemId);
            if (data is null || data.Price <= 0) return 0;
            return item.UseObjectDataPrice ? data.Price : data.Price * 2;
        }
        int PurchasePrice(string qualifiedId)
        {
            int Cheapest(IEnumerable<ShopItemData> items) => items
                .Where(item => QualifyObject(item.ItemId) == qualifiedId)
                .Select(PurchasePriceFor)
                .Where(price => price > 0)
                .DefaultIfEmpty(0)
                .Min();
            int standardPrice = shops.TryGetValue("SeedShop", out ShopData? seedShop)
                ? Cheapest(seedShop.Items)
                : 0;
            return standardPrice > 0 ? standardPrice : Cheapest(shops.Values.SelectMany(shop => shop.Items));
        }
        object DescribeItem(string id)
        {
            string qualifiedId = QualifyObject(id);
            ObjectData? data = ObjectFor(qualifiedId);
            return new { id = qualifiedId, name = data?.Name ?? qualifiedId, price = data?.Price ?? 0, category = data?.Category, spriteIndex = data?.SpriteIndex };
        }
        object[] RecipeMaterials(string name)
        {
            string ingredients = craftingRecipes.GetValueOrDefault(name)?.Split('/').FirstOrDefault() ?? "";
            string[] parts = ingredients.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return Enumerable.Range(0, parts.Length / 2).Select(index =>
            {
                string id = QualifyObject(parts[index * 2]);
                int.TryParse(parts[index * 2 + 1], out int quantity);
                return (object)new { item = DescribeItem(id), quantity };
            }).ToArray();
        }
        int RecipeOpportunityCost(string name)
        {
            string ingredients = craftingRecipes.GetValueOrDefault(name)?.Split('/').FirstOrDefault() ?? "";
            string[] parts = ingredients.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return Enumerable.Range(0, parts.Length / 2).Sum(index =>
            {
                int.TryParse(parts[index * 2 + 1], out int quantity);
                return (ObjectFor(parts[index * 2])?.Price ?? 0) * quantity;
            });
        }
        IEnumerable<string> GeneratedCategoryTags(ObjectData data) => data.Category switch
        {
            GameObject.FruitsCategory => new[] { "category_fruits" },
            GameObject.VegetableCategory => new[] { "category_vegetable" },
            GameObject.GreensCategory => new[] { "category_greens" },
            GameObject.FishCategory => new[] { "category_fish" },
            GameObject.EggCategory => new[] { "category_egg" },
            GameObject.MilkCategory => new[] { "category_milk" },
            _ => Array.Empty<string>(),
        };
        bool MatchesInput(MachineOutputTriggerRule trigger, string inputId, ObjectData data)
        {
            if (!string.IsNullOrWhiteSpace(trigger.Condition)) return false;
            if (!string.IsNullOrWhiteSpace(trigger.RequiredItemId) && QualifyObject(trigger.RequiredItemId) != inputId) return false;
            var tags = new HashSet<string>((data.ContextTags ?? new List<string>()).Concat(GeneratedCategoryTags(data)), StringComparer.OrdinalIgnoreCase);
            return trigger.RequiredTags is null || trigger.RequiredTags.All(tags.Contains);
        }
        (string Id, string Formula) OutputIdentity(string itemQuery)
        {
            if (!itemQuery.StartsWith("FLAVORED_ITEM ", StringComparison.OrdinalIgnoreCase)) return (QualifyObject(itemQuery), "fixed");
            string flavor = itemQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries).ElementAtOrDefault(1) ?? "";
            return flavor switch
            {
                "Wine" => ("(O)348", "wine"),
                "Juice" => ("(O)350", "juice"),
                "Jelly" => ("(O)344", "jelly"),
                "Pickles" => ("(O)342", "pickles"),
                "DriedFruit" => ("(O)DriedFruit", "dried-fruit"),
                "DriedMushroom" => ("(O)DriedMushrooms", "dried-mushroom"),
                "SmokedFish" => ("(O)SmokedFish", "smoked-fish"),
                _ => ("", "unsupported"),
            };
        }

        var cropCatalog = crops.Select(pair =>
        {
            string seedId = QualifyObject(pair.Key);
            string harvestId = QualifyObject(pair.Value.HarvestItemId);
            ObjectData? seed = ObjectFor(seedId);
            ObjectData? harvest = ObjectFor(harvestId);
            int purchasePrice = PurchasePrice(seedId);
            return new
            {
                id = seedId,
                kind = "crop",
                name = seed?.Name ?? seedId,
                output = DescribeItem(harvestId),
                seasons = pair.Value.Seasons.Select(season => season.ToString().ToLowerInvariant()).ToArray(),
                growthPhases = pair.Value.DaysInPhase.ToArray(),
                firstOutputDays = pair.Value.DaysInPhase.Sum(),
                repeatDays = pair.Value.RegrowDays > 0 ? pair.Value.RegrowDays : (int?)null,
                startupCost = purchasePrice,
                yield = new { min = pair.Value.HarvestMinStack, expected = (pair.Value.HarvestMinStack + pair.Value.HarvestMaxStack) / 2d, max = pair.Value.HarvestMaxStack },
                yieldRules = new { maxIncreasePerFarmingLevel = pair.Value.HarvestMaxIncreasePerFarmingLevel, extraHarvestChance = pair.Value.ExtraHarvestChance },
                space = 1,
                raised = pair.Value.IsRaised,
                paddy = pair.Value.IsPaddyCrop,
                needsWatering = pair.Value.NeedsWatering,
                verified = harvest is not null && harvest.Price > 0 && purchasePrice > 0,
            };
        }).ToArray();

        var treeCatalog = fruitTrees.Select(pair =>
        {
            string saplingId = QualifyObject(pair.Key);
            ObjectData? sapling = ObjectFor(saplingId);
            FruitTreeFruitData? primaryFruit = pair.Value.Fruit.FirstOrDefault(fruit => !string.IsNullOrWhiteSpace(fruit.ItemId));
            string fruitId = QualifyObject(primaryFruit?.ItemId ?? "0");
            ObjectData? fruit = ObjectFor(fruitId);
            int purchasePrice = PurchasePrice(saplingId);
            return new
            {
                id = saplingId,
                kind = "fruit-tree",
                name = sapling?.Name ?? saplingId,
                output = DescribeItem(fruitId),
                seasons = pair.Value.Seasons.Select(season => season.ToString().ToLowerInvariant()).ToArray(),
                firstOutputDays = FruitTreeMaturityDays,
                repeatDays = 1,
                startupCost = purchasePrice,
                yield = new { min = 1, expected = 1, max = 1 },
                space = FruitTreeClearanceTiles,
                clearance = FruitTreeClearanceTiles,
                verified = primaryFruit is not null && fruit is not null && fruit.Price > 0 && purchasePrice > 0,
            };
        }).ToArray();

        var fertilizerCatalog = new[]
        {
            (Id: "(O)368", Kind: "quality", QualityBoost: 1, SpeedBoost: 0d),
            (Id: "(O)369", Kind: "quality", QualityBoost: 2, SpeedBoost: 0d),
            (Id: "(O)919", Kind: "quality", QualityBoost: 3, SpeedBoost: 0d),
            (Id: "(O)465", Kind: "speed", QualityBoost: 0, SpeedBoost: 0.10d),
            (Id: "(O)466", Kind: "speed", QualityBoost: 0, SpeedBoost: 0.25d),
            (Id: "(O)918", Kind: "speed", QualityBoost: 0, SpeedBoost: 0.33d),
        }.Select(spec =>
        {
            ObjectData? data = ObjectFor(spec.Id);
            int purchasePrice = PurchasePrice(spec.Id);
            return new
            {
                id = spec.Id,
                name = data?.Name ?? spec.Id,
                kind = spec.Kind,
                qualityBoost = spec.QualityBoost,
                speedBoost = spec.SpeedBoost,
                startupCost = purchasePrice,
                verified = data is not null,
                verifiedCost = purchasePrice > 0,
            };
        }).ToArray();

        var tappedTreeCatalog = wildTrees
            .Where(pair => pair.Value.TapItems?.Count > 0)
            .Select(pair => new
            {
                id = $"wild-tree:{pair.Key}",
                treeType = pair.Key,
                seed = DescribeItem(pair.Value.SeedItemId),
                growthChance = pair.Value.GrowthChance,
                fertilizedGrowthChance = pair.Value.FertilizedGrowthChance,
                growsInWinter = pair.Value.GrowsInWinter,
                isStumpDuringWinter = pair.Value.IsStumpDuringWinter,
                tapItems = pair.Value.TapItems.Select(item => new
                {
                    id = item.Id,
                    itemId = QualifyObject(item.ItemId),
                    randomItemIds = item.RandomItemId?.Select(QualifyObject).ToArray() ?? Array.Empty<string>(),
                    item = string.IsNullOrWhiteSpace(item.ItemId) ? null : DescribeItem(item.ItemId),
                    season = item.Season?.ToString().ToLowerInvariant(),
                    chance = item.Chance,
                    condition = item.Condition,
                    previousItemIds = item.PreviousItemId,
                    daysUntilReady = item.DaysUntilReady,
                    hasTimeModifiers = item.DaysUntilReadyModifiers?.Count > 0,
                }).ToArray(),
            }).ToArray();

        var mushroomLogRules = machines
            .Where(pair => pair.Key.Contains("MushroomLog", StringComparison.OrdinalIgnoreCase))
            .Select(pair => new
            {
                id = pair.Key,
                outputRules = pair.Value.OutputRules?.Select(rule => new
                {
                    rule.Id,
                    rule.DaysUntilReady,
                    rule.MinutesUntilReady,
                    outputs = rule.OutputItem?.Select(output => new
                    {
                        output.ItemId,
                        output.RandomItemId,
                        output.OutputMethod,
                        output.MinStack,
                        output.MaxStack,
                        output.Condition,
                    }).ToArray(),
                }).ToArray(),
            }).ToArray();
        var mushroomLogOutputs = new[] { "(O)404", "(O)420", "(O)422", "(O)257", "(O)281" }.Select(DescribeItem).ToArray();

        var forestryEquipment = bigCraftables
            .Where(pair => pair.Value.Name is "Tapper" or "Heavy Tapper" or "Mushroom Log")
            .Select(pair => new
            {
                id = $"(BC){pair.Key}",
                pair.Value.Name,
                pair.Value.Price,
                pair.Value.SpriteIndex,
                materials = RecipeMaterials(pair.Value.Name),
                opportunityCost = RecipeOpportunityCost(pair.Value.Name),
            }).ToArray();

        var supportedMachineNames = new HashSet<string>(new[] { "Keg", "Preserves Jar", "Dehydrator", "Fish Smoker", "Cheese Press", "Mayonnaise Machine", "Loom" });
        var artisanMachines = new List<object>();
        foreach ((string machineId, MachineData machineData) in machines)
        {
            string unqualifiedMachineId = Unqualify(machineId);
            BigCraftableData? machine = bigCraftables.GetValueOrDefault(unqualifiedMachineId);
            if (machine is null || !supportedMachineNames.Contains(machine.Name)) continue;
            foreach ((string rawInputId, ObjectData inputData) in objects)
            {
                string inputId = QualifyObject(rawInputId);
                MachineOutputRule? rule = machineData.OutputRules?.FirstOrDefault(candidate => candidate.Triggers?.Any(trigger => trigger.Trigger == MachineOutputTrigger.ItemPlacedInMachine && MatchesInput(trigger, inputId, inputData)) == true);
                MachineOutputTriggerRule? trigger = rule?.Triggers?.FirstOrDefault(candidate => candidate.Trigger == MachineOutputTrigger.ItemPlacedInMachine && MatchesInput(candidate, inputId, inputData));
                MachineItemOutput? outputRule = rule?.OutputItem?.FirstOrDefault(candidate => string.IsNullOrWhiteSpace(candidate.Condition));
                if (rule is null || trigger is null || outputRule is null || !string.IsNullOrWhiteSpace(outputRule.OutputMethod) || string.IsNullOrWhiteSpace(outputRule.ItemId)) continue;
                (string outputId, string priceFormula) = OutputIdentity(outputRule.ItemId);
                ObjectData? outputData = ObjectFor(outputId);
                if (string.IsNullOrWhiteSpace(outputId) || outputData is null) continue;
                int minimumOutput = outputRule.MinStack > 0 ? outputRule.MinStack : 1;
                int maximumOutput = outputRule.MaxStack > 0 ? outputRule.MaxStack : minimumOutput;
                int requiredInput = trigger.RequiredCount > 0 ? trigger.RequiredCount : 1;
                int cycleMinutes = rule.DaysUntilReady > 0 ? rule.DaysUntilReady * 1600 : Math.Max(1, rule.MinutesUntilReady);
                var additionalInputs = (machineData.AdditionalConsumedItems ?? new List<MachineItemAdditionalConsumedItems>())
                    .Select(item => new { item = DescribeItem(item.ItemId), quantity = Math.Max(1, item.RequiredCount) }).ToArray();
                int additionalInputCost = (machineData.AdditionalConsumedItems ?? new List<MachineItemAdditionalConsumedItems>())
                    .Sum(item => (ObjectFor(item.ItemId)?.Price ?? 0) * Math.Max(1, item.RequiredCount));
                bool hasUnmodeledModifiers = outputRule.PriceModifiers?.Count > 0 || outputRule.StackModifiers?.Count > 0 || outputRule.QualityModifiers?.Count > 0;
                artisanMachines.Add(new
                {
                    id = $"machine:{machineId}:{rule.Id}:{inputId}",
                    machine = new
                    {
                        id = machineId,
                        machine.Name,
                        machine.SpriteIndex,
                        materials = RecipeMaterials(machine.Name),
                        opportunityCost = RecipeOpportunityCost(machine.Name),
                    },
                    input = DescribeItem(inputId),
                    output = DescribeItem(outputId),
                    inputCount = requiredInput,
                    outputCount = new { min = minimumOutput, expected = (minimumOutput + maximumOutput) / 2d, max = maximumOutput },
                    outputQuality = outputRule.Quality > 0 ? outputRule.Quality : 0,
                    cycleMinutes,
                    priceFormula,
                    artisanEligible = outputData.Category == GameObject.artisanGoodsCategory,
                    additionalInputs,
                    additionalInputCost,
                    verified = inputData.Price > 0 && outputData.Price > 0 && !hasUnmodeledModifiers,
                });
            }
        }

        return JsonSerializer.Serialize(
            new { catalogVersion = 4, source = "local-game", crops = cropCatalog, fruitTrees = treeCatalog, fertilizers = fertilizerCatalog, tappedTrees = tappedTreeCatalog, mushroomLogs = mushroomLogRules, mushroomLogOutputs, forestryEquipment, artisanMachines },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }
        );
    }

    private sealed class EmptyServices : IServiceProvider
    {
        public object? GetService(Type serviceType) => null;
    }
}
