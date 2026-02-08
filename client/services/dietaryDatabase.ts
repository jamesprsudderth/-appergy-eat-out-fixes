/*
 * Dietary Preferences Database
 *
 * Defines rules for each dietary preference: what ingredients violate it,
 * what ingredients are cautionary, and why.
 *
 * Each preference has:
 *   - violationTerms: ingredients that definitively break this diet
 *   - cautionTerms: ingredients that MIGHT break it (ambiguous/unclear source)
 *   - description: human-readable explanation shown in UI
 */

export interface DietaryRule {
  key: string;
  label: string;
  description: string;
  /** Ingredients that definitively violate this preference */
  violationTerms: string[];
  /** Ingredients that might violate (ambiguous source) → CAUTION */
  cautionTerms: string[];
  /** Short explanation template: "{ingredient} is {reason}" */
  reasonTemplate: string;
}

export const DIETARY_RULES: Record<string, DietaryRule> = {
  Vegan: {
    key: "Vegan",
    label: "Vegan",
    description: "No animal-derived ingredients",
    violationTerms: [
      // Dairy
      "milk", "cream", "butter", "cheese", "whey", "casein", "caseinate",
      "lactose", "yogurt", "yoghurt", "ghee", "buttermilk", "custard",
      "ice cream", "gelato", "paneer", "kefir", "curds", "sour cream",
      "cream cheese", "ricotta", "mozzarella", "parmesan", "cheddar",
      "lactalbumin", "lactoglobulin", "whey protein", "milk powder",
      "milk solids", "butterfat", "half and half", "nougat",
      // Eggs
      "egg", "eggs", "egg white", "egg yolk", "albumin", "albumen",
      "mayonnaise", "mayo", "meringue", "lysozyme", "ovalbumin",
      "ovomucoid", "eggnog",
      // Meat
      "beef", "pork", "chicken", "turkey", "lamb", "veal", "duck",
      "goose", "venison", "bison", "bacon", "ham", "sausage", "salami",
      "pepperoni", "prosciutto", "chorizo", "jerky", "meat",
      "meat extract", "meat broth", "bone broth", "bone marrow",
      "lard", "tallow", "suet", "dripping", "schmaltz",
      // Fish/Seafood
      "fish", "salmon", "tuna", "cod", "shrimp", "prawn", "crab",
      "lobster", "clam", "mussel", "oyster", "scallop", "squid",
      "calamari", "anchovy", "anchovies", "sardine", "fish sauce",
      "oyster sauce", "fish oil", "surimi",
      // Other animal
      "gelatin", "gelatine", "collagen", "isinglass",
      "honey", "beeswax", "royal jelly", "propolis",
      "carmine", "cochineal", "shellac", "lanolin",
      "pepsin", "rennet", "castor",
      "vitamin d3", "omega-3",
    ],
    cautionTerms: [
      "natural flavors", "natural flavours", "natural flavor",
      "artificial flavors", "mono and diglycerides", "mono-diglyceride",
      "lecithin", "vitamin d", "stearic acid", "glycerin", "glycerine",
      "l-cysteine", "confectioner's glaze", "oleic acid",
      "palmitic acid", "capric acid",
    ],
    reasonTemplate: "not vegan (animal-derived)",
  },

  Vegetarian: {
    key: "Vegetarian",
    label: "Vegetarian",
    description: "No meat, poultry, or fish (dairy and eggs OK)",
    violationTerms: [
      // Meat
      "beef", "pork", "chicken", "turkey", "lamb", "veal", "duck",
      "goose", "venison", "bison", "bacon", "ham", "sausage", "salami",
      "pepperoni", "prosciutto", "chorizo", "jerky", "meat",
      "meat extract", "meat broth", "bone broth", "bone marrow",
      "lard", "tallow", "suet", "dripping", "schmaltz",
      // Fish/Seafood
      "fish", "salmon", "tuna", "cod", "shrimp", "prawn", "crab",
      "lobster", "clam", "mussel", "oyster", "scallop", "squid",
      "calamari", "anchovy", "anchovies", "sardine", "fish sauce",
      "oyster sauce", "fish oil", "surimi",
      // Animal-derived processing
      "gelatin", "gelatine", "isinglass", "rennet",
      "carmine", "cochineal",
    ],
    cautionTerms: [
      "natural flavors", "natural flavours",
      "worcestershire sauce", "caesar dressing",
    ],
    reasonTemplate: "not vegetarian (contains meat/fish)",
  },

  "Gluten-free": {
    key: "Gluten-free",
    label: "Gluten-Free",
    description: "No wheat, barley, rye, or their derivatives",
    violationTerms: [
      "wheat", "wheat flour", "whole wheat", "wheat starch", "wheat germ",
      "wheat bran", "wheat gluten", "wheat protein", "gluten",
      "vital wheat gluten", "enriched flour", "bleached flour",
      "unbleached flour", "all-purpose flour", "all purpose flour",
      "bread flour", "cake flour", "pastry flour", "self-rising flour",
      "semolina", "durum", "durum wheat", "spelt", "kamut",
      "farina", "farro", "einkorn", "emmer", "triticale",
      "bulgur", "couscous", "seitan",
      "barley", "barley malt", "malt", "malt extract", "malt syrup",
      "malt flavoring", "malt vinegar", "brewer's yeast",
      "rye", "rye flour", "pumpernickel",
      "bread crumbs", "breadcrumbs", "panko", "cracker meal",
      "graham flour", "matzo", "matzoh",
      "pasta", "noodles", "orzo", "roux",
      "hydrolyzed wheat protein", "modified wheat starch",
    ],
    cautionTerms: [
      "modified food starch", "modified starch",
      "natural flavors", "natural flavours",
      "caramel color", "dextrin",
      "oats", "oat", "oat flour", // may be cross-contaminated
      "soy sauce", // often contains wheat
    ],
    reasonTemplate: "contains gluten",
  },

  "Dairy-free": {
    key: "Dairy-free",
    label: "Dairy-Free",
    description: "No milk or milk-derived ingredients",
    violationTerms: [
      "milk", "cream", "butter", "cheese", "whey", "casein", "caseinate",
      "lactose", "yogurt", "yoghurt", "ghee", "buttermilk", "custard",
      "ice cream", "gelato", "paneer", "kefir", "curds", "sour cream",
      "cream cheese", "ricotta", "mozzarella", "parmesan", "cheddar",
      "lactalbumin", "lactoglobulin", "whey protein", "milk powder",
      "milk solids", "butterfat", "half and half",
      "sodium caseinate", "calcium caseinate",
      "nonfat milk", "skim milk", "whole milk", "milk protein",
      "condensed milk", "evaporated milk", "dry milk", "dried milk",
    ],
    cautionTerms: [
      "natural flavors", "natural flavours",
      "caramel color", "caramel colour",
    ],
    reasonTemplate: "contains dairy",
  },

  "Nut-free": {
    key: "Nut-free",
    label: "Nut-Free",
    description: "No tree nuts or peanuts",
    violationTerms: [
      "peanut", "peanuts", "peanut butter", "peanut oil", "peanut flour",
      "almond", "almonds", "almond butter", "almond milk", "almond flour",
      "almond extract", "almond paste", "marzipan",
      "cashew", "cashews", "cashew butter",
      "walnut", "walnuts", "pecan", "pecans",
      "pistachio", "pistachios",
      "brazil nut", "brazil nuts",
      "hazelnut", "hazelnuts", "filbert", "filberts",
      "macadamia", "macadamia nut", "macadamia nuts",
      "pine nut", "pine nuts", "pignoli",
      "praline", "pralines", "gianduja", "nutella",
      "nut butter", "nut oil", "nut paste", "nut extract",
      "nut meal", "nut flour", "mixed nuts",
      "chestnut", "chestnuts",
      "groundnuts", "arachis oil",
      "nougat",
    ],
    cautionTerms: [
      "coconut", // FDA classifies as tree nut but many nut-allergic can eat it
      "natural flavors", "natural flavours",
    ],
    reasonTemplate: "contains nuts",
  },

  "Keto / Low-carb": {
    key: "Keto / Low-carb",
    label: "Keto / Low-Carb",
    description: "Avoid high-carb and high-sugar ingredients",
    violationTerms: [
      "sugar", "cane sugar", "brown sugar", "powdered sugar",
      "confectioners sugar", "turbinado sugar", "raw sugar",
      "high fructose corn syrup", "hfcs", "corn syrup",
      "agave", "agave nectar", "agave syrup",
      "honey", "maple syrup", "molasses", "treacle",
      "rice syrup", "brown rice syrup", "barley malt syrup",
      "dextrose", "glucose", "glucose syrup", "fructose",
      "sucrose", "maltose", "galactose",
      "wheat flour", "all-purpose flour", "bread flour",
      "enriched flour", "whole wheat flour",
      "rice", "white rice", "brown rice", "rice flour",
      "corn starch", "cornstarch", "corn flour", "cornmeal",
      "potato starch", "potato flour",
      "tapioca", "tapioca starch", "arrowroot",
      "bread crumbs", "breadcrumbs", "panko",
      "pasta", "noodles", "couscous",
      "maltodextrin",
    ],
    cautionTerms: [
      "modified food starch", "modified starch",
      "natural sweetener", "fruit juice concentrate",
      "evaporated cane juice", "invert sugar",
      "oat flour", "oats",
    ],
    reasonTemplate: "high in carbohydrates (not keto-friendly)",
  },

  "Low-sodium": {
    key: "Low-sodium",
    label: "Low-Sodium",
    description: "Avoid high-sodium ingredients",
    violationTerms: [
      "salt", "sea salt", "table salt", "kosher salt",
      "sodium chloride",
      "msg", "monosodium glutamate",
      "sodium nitrate", "sodium nitrite",
      "sodium benzoate", "sodium phosphate",
      "sodium bicarbonate", "baking soda",
      "soy sauce", "tamari", "shoyu",
      "fish sauce",
      "bouillon", "broth", "stock",
      "worcestershire sauce",
    ],
    cautionTerms: [
      "seasoning", "seasoning blend", "spice blend",
      "natural flavors", "hydrolyzed protein",
    ],
    reasonTemplate: "high in sodium",
  },

  Pescatarian: {
    key: "Pescatarian",
    label: "Pescatarian",
    description: "No meat or poultry (fish and seafood OK)",
    violationTerms: [
      "beef", "pork", "chicken", "turkey", "lamb", "veal", "duck",
      "goose", "venison", "bison", "bacon", "ham", "sausage", "salami",
      "pepperoni", "prosciutto", "chorizo", "jerky", "meat",
      "meat extract", "meat broth", "bone broth",
      "lard", "tallow", "suet", "dripping", "schmaltz",
    ],
    cautionTerms: [
      "natural flavors", "natural flavours",
      "gelatin", "gelatine",
    ],
    reasonTemplate: "contains meat/poultry (not pescatarian)",
  },

  Paleo: {
    key: "Paleo",
    label: "Paleo",
    description: "No grains, legumes, dairy, refined sugar, or processed foods",
    violationTerms: [
      // Grains
      "wheat", "wheat flour", "rice", "corn", "oats", "barley", "rye",
      "quinoa", "bulgur", "couscous", "pasta", "noodles", "bread",
      // Legumes
      "soybean", "soy", "lentil", "lentils", "chickpea", "chickpeas",
      "black bean", "kidney bean", "pinto bean", "navy bean",
      "peanut", "peanuts", "peanut butter",
      "tofu", "tempeh", "edamame",
      // Dairy
      "milk", "cream", "butter", "cheese", "whey", "casein", "yogurt",
      // Refined sugar
      "sugar", "cane sugar", "high fructose corn syrup", "corn syrup",
      "dextrose", "maltodextrin",
      // Processed
      "soybean oil", "canola oil", "vegetable oil", "corn oil",
      "margarine", "shortening",
    ],
    cautionTerms: [
      "natural flavors", "modified food starch",
      "xanthan gum", "guar gum", "carrageenan",
    ],
    reasonTemplate: "not paleo-compatible",
  },

  "Low-FODMAP": {
    key: "Low-FODMAP",
    label: "Low-FODMAP",
    description: "Avoid fermentable carbohydrates that cause digestive issues",
    violationTerms: [
      // High-FODMAP
      "garlic", "garlic powder", "onion", "onion powder",
      "high fructose corn syrup", "hfcs", "agave", "honey",
      "inulin", "chicory root", "chicory root fiber",
      "fructo-oligosaccharides", "fos",
      "sorbitol", "mannitol", "xylitol", "maltitol", "isomalt",
      "apple juice concentrate", "pear juice concentrate",
      "lactose", "milk", "cream", "ice cream", "yogurt",
      "wheat", "rye", "barley",
      "chickpeas", "lentils", "black beans", "kidney beans",
    ],
    cautionTerms: [
      "natural flavors", "spices", "seasoning",
      "mushroom", "mushrooms", "cauliflower",
    ],
    reasonTemplate: "high-FODMAP ingredient",
  },

  Halal: {
    key: "Halal",
    label: "Halal",
    description: "No pork, alcohol, or non-halal animal derivatives",
    violationTerms: [
      "pork", "ham", "bacon", "prosciutto", "pancetta",
      "lard", "pork gelatin", "pork fat", "pork rind",
      "pepperoni", "salami", "chorizo",
      "alcohol", "ethanol", "wine", "beer", "rum", "brandy",
      "bourbon", "whiskey", "whisky", "vodka", "gin",
      "liqueur", "liquor", "mirin",
      "wine vinegar", "red wine", "white wine",
      "vanilla extract", // typically contains alcohol
    ],
    cautionTerms: [
      "gelatin", "gelatine", // could be pork-derived
      "glycerin", "glycerine", // could be animal-derived
      "mono and diglycerides", "mono-diglyceride",
      "l-cysteine", // could be from human hair or duck feathers
      "natural flavors", "natural flavours",
      "enzymes", "rennet",
      "emulsifier", "e471", "e472",
      "stearic acid",
    ],
    reasonTemplate: "not halal",
  },

  Kosher: {
    key: "Kosher",
    label: "Kosher",
    description: "Follows Jewish dietary laws",
    violationTerms: [
      "pork", "ham", "bacon", "lard", "pork gelatin",
      "shellfish", "shrimp", "crab", "lobster", "clam",
      "mussel", "oyster", "scallop", "squid", "calamari",
    ],
    cautionTerms: [
      "gelatin", "gelatine",
      "glycerin", "glycerine",
      "natural flavors", "natural flavours",
      "enzymes", "rennet",
      "emulsifier",
      "mono and diglycerides",
      "stearic acid",
    ],
    reasonTemplate: "not kosher",
  },
};

/**
 * Get the dietary rule for a given preference key.
 * Also handles custom user entries (returns null for unknown preferences).
 */
export function getDietaryRule(preferenceKey: string): DietaryRule | null {
  return DIETARY_RULES[preferenceKey] || null;
}

/**
 * All built-in dietary preference keys (matching UI options).
 */
export const ALL_DIETARY_PREFERENCES = Object.keys(DIETARY_RULES);
