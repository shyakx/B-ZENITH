import { BusinessArea } from "@prisma/client";

export const EXPECTED_CATEGORY_COUNT = 39;
export const EXPECTED_PRODUCT_COUNT = 246;
export const EXPECTED_TRACKED_PRODUCT_COUNT = 48;
export const EXPECTED_UNTRACKED_PRODUCT_COUNT = 198;

export type CatalogCategory = {
  name: string;
  area: BusinessArea;
};

/** name, sellingPrice, trackInventory?, developmentStockQuantity? */
export type CatalogProductTuple = [string, number, boolean?, number?];

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  { name: "Breakfast", area: BusinessArea.KITCHEN },
  { name: "Raw Food / Dishes", area: BusinessArea.KITCHEN },
  { name: "Snack", area: BusinessArea.KITCHEN },
  { name: "Sandwich", area: BusinessArea.KITCHEN },
  { name: "Hot Starter", area: BusinessArea.KITCHEN },
  { name: "Pasta", area: BusinessArea.KITCHEN },
  { name: "Pizza", area: BusinessArea.KITCHEN },
  { name: "Burger", area: BusinessArea.KITCHEN },
  { name: "Side Dishes", area: BusinessArea.KITCHEN },
  { name: "Fish", area: BusinessArea.KITCHEN },
  { name: "Beef", area: BusinessArea.KITCHEN },
  { name: "Chicken", area: BusinessArea.KITCHEN },
  { name: "Main Dishes", area: BusinessArea.KITCHEN },
  { name: "Platter", area: BusinessArea.KITCHEN },
  { name: "Salads", area: BusinessArea.KITCHEN },
  { name: "BBQ", area: BusinessArea.KITCHEN },
  { name: "Brochettes", area: BusinessArea.KITCHEN },
  { name: "Grilling", area: BusinessArea.KITCHEN },
  { name: "Specialties", area: BusinessArea.KITCHEN },
  { name: "Chinese Food", area: BusinessArea.KITCHEN },
  { name: "Indian Food", area: BusinessArea.KITCHEN },
  { name: "Coffee", area: BusinessArea.CAFE },
  { name: "Cold Brew", area: BusinessArea.CAFE },
  { name: "Signature Drinks", area: BusinessArea.CAFE },
  { name: "Iced Drinks", area: BusinessArea.CAFE },
  { name: "Liquor Coffee", area: BusinessArea.CAFE },
  { name: "Frappe", area: BusinessArea.CAFE },
  { name: "Tea", area: BusinessArea.CAFE },
  { name: "Nojito", area: BusinessArea.CAFE },
  { name: "Booster", area: BusinessArea.CAFE },
  { name: "Juice", area: BusinessArea.CAFE },
  { name: "Milk Shake", area: BusinessArea.CAFE },
  { name: "Ice Cream", area: BusinessArea.CAFE },
  { name: "Smoothie", area: BusinessArea.CAFE },
  { name: "Drinks", area: BusinessArea.BAR },
  { name: "Spirits", area: BusinessArea.BAR },
  { name: "Wine", area: BusinessArea.BAR },
  { name: "Champagne", area: BusinessArea.BAR },
  { name: "Cocktails", area: BusinessArea.BAR },
];

export const CATALOG_PRODUCTS_BY_CATEGORY: Record<string, CatalogProductTuple[]> = {
  Breakfast: [
    ["Full Breakfast", 10000],
    ["Simple Breakfast", 6000],
    ["Two Two Breakfast", 6000],
    ["Royal Breakfast", 6000],
    ["Sandwich Garnie", 5000],
    ["Fisherman Breakfast", 12000],
  ],
  "Raw Food / Dishes": [
    ["Beef Agatogo or Boilo", 8000],
    ["Chicken Agatogo or Boilo", 8000],
    ["Fish Agatogo or Boilo", 8000],
    ["Goat Agatogo or Boilo", 8000],
  ],
  Snack: [
    ["Mixed Plate (Sausage, Cheese)", 6000],
    ["Sausage Plate", 3000],
    ["Chicken Lollipop", 8000],
    ["Fish Finger", 8000],
    ["Chicken Finger", 8000],
    ["Beef Boulet 4 pcs", 5000],
    ["Samboussa Viande 3 pcs", 4000],
    ["Samboussa Vegetable 3 pcs", 4000],
  ],
  Sandwich: [
    ["Vegetable Sandwich", 4000],
    ["Club Sandwich", 8000],
    ["Garnish Sandwich", 8000],
    ["Croque Monsieur / Croque Madame", 5000],
    ["Toast with Salad Tuna Avocado", 5000],
  ],
  "Hot Starter": [
    ["Garden Green Vegetable Soup", 4000],
    ["Ginger & Carrot Soup", 4000],
    ["Minestrone Soup", 8000],
    ["Mushroom Soup", 5000],
  ],
  Pasta: [
    ["Spaghetti Bolognese", 8000],
    ["Spaghetti Carbonara", 8000],
    ["Chicken Alfredo", 7000],
    ["Pasta Napolitan", 8000],
    ["Beef Lasagna", 10000],
    ["Vegetable Lasagna", 5000],
  ],
  Pizza: [
    ["Chicken Pizza", 8000],
    ["Hawaiian Pizza", 10000],
    ["Margarita Pizza", 5000],
    ["Sausage Pizza", 8000],
    ["4 Saisons", 10000],
  ],
  Burger: [
    ["Classic Cheese Burger", 10000],
    ["Chicken Burger", 8000],
    ["Fish Burger", 8000],
  ],
  "Side Dishes": [
    ["Chips Potatoes & Banana", 2000],
    ["Roasted Potatoes", 2000],
    ["Pomme Saute", 2000],
    ["Plantain Banana (Mizuzu)", 3000],
    ["Green Banana", 2000],
    ["Veg Rice / Steamed Rice / Pilau Rice", 3000],
    ["Kawunga or Ugali", 3000],
    ["Ugali with Vegetables", 5000],
  ],
  Fish: [
    ["Filet de Tilapia Meuniere", 15000],
    ["Captain's Fillet with Mushrooms", 10000],
    ["Whole Fish Tilapia", 15000],
  ],
  Beef: [
    ["Beef Steak with Green Peppers", 10000],
    ["Beef Stew", 8000],
    ["Beef Shawarma", 8000],
    ["Beef Stir Fried", 8000],
    ["Beef Pilau", 8000],
  ],
  Chicken: [
    ["Chicken Fillet Cordon Bleu", 10000],
    ["Chicken Shawarma", 8000],
    ["Chicken Breast with Bechamel Sauce", 8000],
    ["1/4 Chicken Leg", 8000],
    ["Whole Chicken", 20000],
    ["Whole Chicken Nyarwanda", 25000],
    ["Chicken Stew", 8000],
    ["Chicken Pilau", 8000],
    ["Chicken Mayo", 8000],
    ["Chicken Stir Fried", 8000],
  ],
  "Main Dishes": [
    ["Rabbit", 15000],
    ["Chicken Biryani", 10000],
    ["Chicken Zenith", 30000],
    ["Gisafuriya Chicken, Goat", 20000],
    ["Pilau", 4000],
  ],
  Platter: [["B-ZENITH Platter", 40000]],
  Salads: [
    ["Chef Salad", 10000],
    ["Garden Vegetable Salad", 5000],
    ["Kachumbari", 3000],
  ],
  BBQ: [
    ["BBQ Leg", 20000],
    ["BBQ Ribs", 18000],
    ["BBQ Arm", 16000],
    ["BBQ Local Chicken", 25000],
    ["BBQ Broiler Chicken", 20000],
    ["BBQ Fish Tilapia", 15000],
  ],
  Brochettes: [
    ["Goat Brochette", 2000],
    ["2 Fish Brochette", 8000],
    ["Chicken Brochette", 8000],
    ["Zingalo", 2500],
  ],
  Grilling: [
    ["Grilled Beef Skewer + Side", 10000],
    ["Grilled Captain's Skewer + Side", 10000],
    ["Chicken Skewer + Side", 10000],
    ["Single Skewer (Beef, Chicken or Fish)", 10000],
    ["Grilled Pork (Akabenzi) 1kg", 8000],
    ["Whole Fish or Whole Fish Cesarienne", 15000],
  ],
  Specialties: [
    ["Beef Satimboka", 15000],
    ["Nyama Choma", 20000],
    ["Fish Brochette", 8000],
  ],
  "Chinese Food": [
    ["Beef Sizzling", 15000],
    ["Chicken Sizzling", 15000],
    ["Vegetable Sizzling", 10000],
    ["Chicken Stir Fry", 15000],
    ["Crispy Captain Fillet Sizzling", 15000],
    ["Fried Chicken & Beef Noodle", 15000],
  ],
  "Indian Food": [
    ["Chicken Manchurian", 10000],
    ["Chicken 65", 10000],
    ["Mutton Biryani", 10000],
    ["Fish Tempura (Captain)", 10000],
  ],
  Coffee: [
    ["Cappuccino Small Cup", 3000],
    ["Cappuccino Big Cup", 3000],
    ["Espresso Single", 2000],
    ["Espresso Double", 2000],
    ["Espresso Macchiato", 3000],
    ["Black Coffee", 2500],
    ["Americano Coffee", 2500],
    ["Cafe Latte", 2500],
    ["Caramel Macchiato", 3000],
    ["Hot Chocolate", 2500],
    ["Vanilla Latte", 3000],
    ["Caramel Mocha", 3000],
    ["African Coffee", 3000],
    ["English Coffee", 3000],
    ["Dalgona Coffee", 3000],
    ["Baileys Irish Latte", 5000],
  ],
  "Cold Brew": [
    ["Cold Brew with Sweet Cream", 4000],
    ["Sweet Almond Cold Brew", 4000],
    ["Belgium Chocolate Cold Brew", 4000],
    ["Sugar Cookie Latte", 4000],
    ["Purple Cookie Latte", 4000],
    ["Nutty Caramel Latte", 4000],
  ],
  "Signature Drinks": [
    ["Bob Marley Juice", 5000],
    ["Lemonade", 4000],
  ],
  "Iced Drinks": [
    ["Freddo Espresso", 3000],
    ["Iced Vanilla Latte", 3000],
    ["Iced Cappuccino", 3000],
    ["Iced Mocha", 3000],
    ["Iced Caramel Mocha", 4000],
    ["Iced Dawa Tea", 4000],
    ["Iced Americano", 3000],
  ],
  "Liquor Coffee": [
    ["Irish Coffee", 7000],
    ["Jamaica Coffee", 7000],
    ["Cafe Amore", 7000],
  ],
  Frappe: [
    ["Mocha Frappe", 4000],
    ["Caramel Frappe", 4000],
    ["Chocolate Frappe", 4000],
  ],
  Tea: [
    ["African Tea", 3000],
    ["Zenith Dawa Tea", 4000],
    ["Masala Tea", 2500],
    ["Green Tea", 2500],
    ["English Tea", 4000],
    ["Black Tea", 2000],
    ["Ginger Tea", 2000],
    ["Special Tea", 4000],
    ["Lemon Tea", 2500],
    ["Hot Milk", 2500],
  ],
  Nojito: [
    ["Passion Nojito", 4500],
    ["Orange Nojito", 4500],
    ["Strawberry Nojito", 4500],
  ],
  Booster: [
    ["Stinger Booster", 5000],
    ["Pineapple Crush", 4000],
    ["Mango Crush", 4000],
  ],
  Juice: [
    ["Pineapple Juice", 3000],
    ["Mango Juice", 3000],
    ["Watermelon Juice", 2500],
    ["Ginger Juice", 2500],
    ["Janjaweed", 4000],
    ["Tree Tomato Juice", 3000],
    ["Passion Juice", 3000],
    ["Lemon Juice", 3000],
    ["Fresh Fruit Salad", 5000],
    ["Tomato Juice", 2000],
    ["Orange Juice", 3000],
    ["Pawpaw Juice", 2000],
    ["Avocado Juice", 2000],
    ["Beet Root Juice", 2000],
    ["Mocktail Juice", 4000],
    ["Apple Juice", 2000],
  ],
  "Milk Shake": [
    ["Mango Milk Shake", 4500],
    ["Oreo Milk Shake", 5000],
    ["Chocolate Milk Shake", 4500],
    ["Strawberry Milk Shake", 4500],
    ["Vanilla Milk Shake", 4500],
    ["Banana Milk Shake", 4500],
  ],
  "Ice Cream": [
    ["A Scoop of Ice Cream", 1500],
    ["Banana Split", 3000],
    ["Affogato", 4000],
  ],
  Smoothie: [
    ["Snow White", 5000],
    ["Strawberry Banana", 5000],
    ["Summer Peanut Butter", 5000],
    ["Nutty Summer Smoothie", 5000],
    ["Tropical Smoothie", 5000],
    ["Mango & Strawberry", 5000],
  ],
  Drinks: [
    ["Water", 1000, true, 80],
    ["Virunga Water", 1000, true, 40],
    ["Fanta", 1500, true, 36],
    ["Red Bull", 5000, true, 18],
    ["Panache", 1500, true, 20],
    ["Primus", 1500, true, 48],
    ["Bavaria Non Alcohol", 4000, true, 12],
    ["Mutzig", 2000, true, 36],
    ["Amstel", 2000, true, 24],
    ["Petit Skol Malt", 1500, true, 18],
    ["Tusker", 3000, true, 18],
    ["Savanna", 5000, true, 12],
    ["Virunga Silver", 2000, true, 16],
    ["Virunga Mist", 2000, true, 16],
    ["Heineken", 2000, true, 24],
    ["Smirnoff Ice", 3000, true, 16],
    ["Smirnoff Guarana", 4000, true, 10],
    ["Guinness", 3000, true, 18],
    ["Exo", 4000, true, 10],
    ["Stella", 3000, true, 12],
    ["Leffe", 5000, true, 10],
    ["Konyagi Petit", 4500, true, 10],
    ["Konyagi Grand", 12500, true, 4],
    ["Gilbeys Petit", 6000, true, 8],
    ["Gilbeys Grand", 20000, true, 3],
    ["Desperados", 3500, true, 12],
  ],
  Spirits: [
    ["Gordon Gin Shot", 3000, true, 20],
    ["Gordon Gin Bottle", 60000, true, 4],
    ["Tequila Camino Shot", 3000, true, 12],
    ["Tequila Camino Bottle", 60000, true, 2],
    ["Hennessy VS Shot", 7000, true, 16],
    ["Hennessy VS Bottle", 200000, true, 2],
    ["Hennessy VSOP Shot", 9000, true, 10],
    ["Hennessy VSOP Bottle", 250000, true, 1],
    ["Absolut Vodka Shot", 3000, true, 20],
    ["Jack Daniel Shot", 5000, true, 16],
    ["Jack Daniel Bottle", 100000, true, 3],
    ["Jameson Shot", 4000, true, 16],
    ["Baileys Shot", 4000, true, 12],
  ],
  Wine: [
    ["Pinta Negra Red Glass", 5000, true, 16],
    ["Pinta Negra Red Bottle", 35000, true, 6],
    ["Four Cousins Red Bottle", 30000, true, 6],
    ["Baron d'Arignac Red Bottle", 35000, true, 4],
    ["Nederburg Bottle", 90000, true, 2],
    ["Pinta Negra White Glass", 5000, true, 12],
    ["Four Cousins White Bottle", 30000, true, 4],
  ],
  Champagne: [
    ["Moet", 200000, true, 2],
    ["Baron d'Arignac Champagne", 50000, true, 3],
  ],
  Cocktails: [
    ["Mojito", 10000],
    ["Margarita", 12000],
    ["Pina Colada", 12000],
    ["Long Island", 15000],
    ["Sex on the Beach", 12000],
    ["Gin Tonic", 12000],
    ["Tequila Sunrise", 15000],
    ["Mai Tai", 12000],
    ["B-52", 7000],
  ],
};

export type FlattenedCatalogProduct = {
  categoryName: string;
  name: string;
  sellingPrice: number;
  trackInventory: boolean;
  active: true;
  sortOrder: number;
  developmentStockQuantity: number;
};

/** Matches the location-inventory migration: Shot / Glass SKUs, otherwise Bottle. */
export function trackedProductBaseUnitCode(name: string): "SHOT" | "GLASS" | "BOTTLE" {
  if (name.endsWith("Shot")) return "SHOT";
  if (name.endsWith("Glass")) return "GLASS";
  return "BOTTLE";
}

export function flattenCatalogProducts(): FlattenedCatalogProduct[] {
  const products: FlattenedCatalogProduct[] = [];
  for (const category of CATALOG_CATEGORIES) {
    const rows = CATALOG_PRODUCTS_BY_CATEGORY[category.name];
    if (!rows) {
      throw new Error(`Catalog is missing products for category ${category.name}.`);
    }
    for (const [index, [name, sellingPrice, track = false, stock = 0]] of rows.entries()) {
      products.push({
        categoryName: category.name,
        name,
        sellingPrice,
        trackInventory: track,
        active: true,
        sortOrder: index,
        developmentStockQuantity: stock,
      });
    }
  }
  return products;
}

export function assertCatalogIntegrity() {
  const names = CATALOG_CATEGORIES.map((category) => category.name);
  if (new Set(names).size !== names.length) {
    throw new Error("Catalog contains duplicate category names.");
  }
  for (const key of Object.keys(CATALOG_PRODUCTS_BY_CATEGORY)) {
    if (!names.includes(key)) {
      throw new Error(`Catalog products reference unknown category ${key}.`);
    }
  }
  const products = flattenCatalogProducts();
  const pairs = products.map((product) => `${product.categoryName}::${product.name}`);
  if (new Set(pairs).size !== pairs.length) {
    throw new Error("Catalog contains duplicate category+product names.");
  }
  if (CATALOG_CATEGORIES.length !== EXPECTED_CATEGORY_COUNT) {
    throw new Error(`Expected ${EXPECTED_CATEGORY_COUNT} categories, found ${CATALOG_CATEGORIES.length}.`);
  }
  if (products.length !== EXPECTED_PRODUCT_COUNT) {
    throw new Error(`Expected ${EXPECTED_PRODUCT_COUNT} products, found ${products.length}.`);
  }
  const tracked = products.filter((product) => product.trackInventory).length;
  if (tracked !== EXPECTED_TRACKED_PRODUCT_COUNT) {
    throw new Error(`Expected ${EXPECTED_TRACKED_PRODUCT_COUNT} tracked products, found ${tracked}.`);
  }
  const untracked = products.length - tracked;
  if (untracked !== EXPECTED_UNTRACKED_PRODUCT_COUNT) {
    throw new Error(`Expected ${EXPECTED_UNTRACKED_PRODUCT_COUNT} untracked products, found ${untracked}.`);
  }
}
