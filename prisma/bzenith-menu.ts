import type { ProductUnit } from "@prisma/client";

export type MenuVariant = {
  name: string;
  price: number;
  unit: ProductUnit;
};

export type MenuItem = {
  name: string;
  description?: string;
  unit?: ProductUnit;
  price?: number;
  variants?: MenuVariant[];
};

export type MenuCategory = {
  name: string;
  items: MenuItem[];
};

const portion = (price: number, unit: ProductUnit = "PORTION"): MenuVariant[] => [
  { name: "Portion", price, unit },
];

const bottleAndShot = (bottle: number, shot: number): MenuVariant[] => [
  { name: "Bottle", price: bottle, unit: "BOTTLE" },
  { name: "Shot", price: shot, unit: "SHOT" },
];

const bottleAndGlass = (bottle: number, glass?: number): MenuVariant[] =>
  glass
    ? [
        { name: "Bottle", price: bottle, unit: "BOTTLE" },
        { name: "Glass", price: glass, unit: "GLASS" },
      ]
    : [{ name: "Bottle", price: bottle, unit: "BOTTLE" }];

/** Official B-ZENITH menu transcribed from the 16-page PDF. */
export const bzenithMenu: MenuCategory[] = [
  {
    name: "Break Fast",
    items: [
      { name: "Full Breakfast", price: 10000, description: "Bread, tea, coffee, bacon, fried eggs, tomato, french toast, fruits, juice" },
      { name: "Simple Breakfast", price: 6000, description: "Tea or coffee, omelet, bread" },
      { name: "Two Two Breackfast", price: 6000 },
      { name: "Royal Breakfast", price: 6000, description: "Tea or coffee, two crepe" },
      { name: "Sanduish Garnie", price: 5000 },
      { name: "Fisherman Breakfast", price: 12000, description: "Two eggs prepared to your choice, grilled or poached fish fillet, and a side of home fries or bread toast" },
    ],
  },
  {
    name: "Row Fat Dish",
    items: [
      { name: "Beef Agatogo or Boilo", price: 8000 },
      { name: "Chicken Agatogo or Boilo", price: 8000 },
      { name: "Fish Agatogo or Boilo", price: 8000 },
      { name: "Goat Agatogo or Boilo", price: 8000 },
    ],
  },
  {
    name: "Snack",
    items: [
      { name: "Mixed Plate (Sausage, Cheese)", price: 6000 },
      { name: "Sausage Plate", price: 3000 },
      { name: "Chicken Lolipop", price: 8000 },
      { name: "Fishe Finger", price: 8000 },
      { name: "Chicken Finger", price: 8000 },
      { name: "Beef Boulet 4pces", price: 5000 },
      { name: "Samboussa Viande 3pces", price: 4000 },
      { name: "Samboussa Vegetable 3pces", price: 4000 },
    ],
  },
  {
    name: "Sandwish",
    items: [
      { name: "Vegetable Sandwich", price: 4000 },
      { name: "Club Sandwich", price: 8000 },
      { name: "Garnish Sandwich", price: 8000, description: "With your choice of beef or chicken" },
      { name: "Croque Monsieur / Croquet Madame", price: 5000 },
      { name: "Toast with Salad Tuna Avocado", price: 5000 },
    ],
  },
  {
    name: "Hot Stearter",
    items: [
      { name: "Garden Green Vegetable Soup", price: 4000 },
      { name: "Ginger & Carot Soup", price: 4000 },
      { name: "Minestrone Soup", price: 8000 },
      { name: "Mashroom Soup", price: 5000 },
    ],
  },
  {
    name: "Pasta",
    items: [
      { name: "Spaghetti Bolognese", price: 8000 },
      { name: "Spagheetti Calbonara", price: 8000 },
      { name: "Chicken Alphedo", price: 7000 },
      { name: "Pasta Napolitan", price: 8000 },
      { name: "Beef Lasagna", price: 10000 },
      { name: "Vegetable Lasagna", price: 5000 },
    ],
  },
  {
    name: "Piza",
    items: [
      { name: "Chicken Pizza", price: 8000 },
      { name: "Hawai Pizza", price: 10000 },
      { name: "Margarita Piza", price: 5000 },
      { name: "Sausage Pizza", price: 8000 },
      { name: "4 Saisons", price: 10000 },
    ],
  },
  {
    name: "Burger",
    items: [
      { name: "Classic Cheese Burger", price: 10000, description: "Beef meat, lettuce, tomato, onions and burger, bread, cheese" },
      { name: "Chicken Burger", price: 8000, description: "Miced chicken meat, lettuce, tomato, onions, burger, bread" },
      { name: "Fish Burgerbread", price: 8000, description: "Fried fish, lettuce, tomato, onions and burger, bread, chees" },
    ],
  },
  {
    name: "Side Dishes",
    items: [
      { name: "Cheeps Potatoes & Banana", price: 2000 },
      { name: "Roasted Potatoes", price: 2000 },
      { name: "Pomme Saute", price: 2000 },
      { name: "Plantin Banana (Mizuzu)", price: 3000 },
      { name: "Green Banana", price: 2000 },
      { name: "Veg Rice & Steamed Rice & Pilaw Rice", price: 3000 },
      { name: "Kaunga or Ugali", price: 3000 },
      { name: "Ugali with Vegetables", price: 5000 },
    ],
  },
  {
    name: "Fish Dishes",
    items: [
      { name: "Filet de Tilapia Meniere", price: 15000, description: "Chips, rice, potatoes grilled, boiled potatoes" },
      { name: "Captain’s Fillet with Mushrooms", price: 10000, description: "Chips, rice, potatoes grilled, boiled potatoes" },
      { name: "Whole Fish Tilapia", price: 15000, description: "Chips, rice, potatoes grilled, boiled potatoes" },
    ],
  },
  {
    name: "Beef Dishes",
    items: [
      { name: "Beef Steak with Green Peppers", price: 10000, description: "Chips, rice, potatoes grilled, boiled potatoes" },
      { name: "Beef Stew", price: 8000, description: "Ugali, kaunga, chips, rice, potatoes grilled, boiled potatoes" },
      { name: "Beef Shawarma", price: 8000 },
      { name: "Beef Stal Fried", price: 8000 },
      { name: "Chicken Stal Fried", price: 8000 },
      { name: "Beef Pilawo", price: 8000 },
    ],
  },
  {
    name: "Chicken Dishes",
    items: [
      { name: "Chicken Fillet Cordon Bleu", price: 10000, description: "Choice of sauce: mushroom sauce, béchamel sauce, tomato sauce" },
      { name: "Chicken Shawarma", price: 8000 },
      { name: "Chicken Breast with Bechamel Sauce", price: 8000 },
      { name: "1/4 Chicken Leg", price: 8000, description: "Chips, grilled potatoes with salad" },
      { name: "Whole Chicken", price: 20000, description: "Chips, grilled potatoes with salad" },
      { name: "Whole Chicken Nyarwanda", price: 25000, description: "Chips, grilled potatoes with salad" },
      { name: "Chicken Stew", price: 8000, description: "Ugali, kaunga, chips, rice, potatoes grilled, boiled potatoes" },
      { name: "Chicken Pilaw", price: 8000 },
      { name: "Chicken Mayo", price: 8000 },
    ],
  },
  {
    name: "Main Dishes",
    items: [
      { name: "Rabbit", price: 15000 },
      { name: "Chicken Biriyani", price: 10000 },
      { name: "Chicken Zenith", price: 30000 },
      { name: "Gisafuriya Chicken,Goat", price: 20000 },
      { name: "Pilawo", price: 4000 },
    ],
  },
  {
    name: "Platter",
    items: [
      {
        name: "Chicken, Beef, Brochette, Kawunga/Ugali, Rice, Vegetable Greens, Chips, Saute, Banana Soute",
        price: 40000,
      },
    ],
  },
  {
    name: "Salads",
    items: [
      { name: "Chef Salad", price: 10000 },
      { name: "Garden Vegetable Salad", price: 5000 },
      { name: "Kachumbari", price: 3000 },
    ],
  },
  {
    name: "BBQ",
    items: [
      { name: "Leg", price: 20000 },
      { name: "Ribs", price: 18000 },
      { name: "Arm", price: 16000 },
      { name: "Local Chicken", price: 25000 },
      { name: "Broiler Chicken", price: 20000 },
      { name: "Fish Tilapia", price: 15000 },
    ],
  },
  {
    name: "Brochettes",
    items: [
      { name: "Goat Brochette", price: 2000 },
      { name: "2 Fish Brochette", price: 8000 },
      { name: "Chicken Brochette", price: 8000 },
      { name: "Zingalo", price: 2500 },
    ],
  },
  {
    name: "Grilling",
    items: [
      { name: "Grilled Beef Skewer + Side", price: 10000, description: "Chips, potatoes, grilled banana" },
      { name: "Grilled Captain’s Skewer + Side", price: 10000, description: "Chips, potatoes, grilled banana" },
      { name: "Chicken Skewer + Side Dish", price: 10000, description: "Chips, potatoes, grilled banana" },
      { name: "Single Skewer (Beef, Chicken, Fish)", price: 10000, description: "Chips, potatoes, grilled banana" },
      { name: "Grilled Pork (Akabenzi)", price: 8000, description: "1kg (chips, potatoes, grilled banana)" },
      { name: "Whole Chicken", price: 20000, description: "Chips, potatoes, grilled banana" },
      { name: "Whole Chicken Nyarwanda", price: 25000, description: "Chips, potatoes, grilled banana" },
      { name: "Whole Fish or Whole Fish Cesarienne", price: 15000 },
    ],
  },
  {
    name: "Our Specialties",
    items: [
      { name: "Beef Satimboka", price: 15000, description: "Fried beef rib, coriander, persil served with potatoes" },
      { name: "Chicken Zenith", price: 30000 },
      { name: "Nyama Choma", price: 20000 },
      { name: "Fish Brochette", price: 8000 },
    ],
  },
  {
    name: "Chinese Food",
    items: [
      { name: "Beef Sizzling", price: 15000 },
      { name: "Chicken Sizzling", price: 15000 },
      { name: "Vegetable Sizzling", price: 10000 },
      { name: "Chicken Stir Fry", price: 15000 },
      { name: "Crispy Captain Fillet Sizzling", price: 15000 },
      { name: "Fried Chicken & Beef Noodle", price: 15000 },
    ],
  },
  {
    name: "Indian Food",
    items: [
      { name: "Chicken Manchurian", price: 10000 },
      { name: "Chicken 65", price: 10000 },
      { name: "Chicken Biryani", price: 10000 },
      { name: "Fish Tempura (Captain)", price: 10000 },
      { name: "Mutton Biryani", price: 10000 },
    ],
  },
  {
    name: "Coffee",
    items: [
      { name: "Cappuccino Small Cup", price: 3000, description: "Our single shot espresso in a cup of steamed milk with foam" },
      { name: "Cappuccino Big Cup", price: 3000, description: "Our double shot espresso in a cup of steamed milk with foam" },
      { name: "Espresso Single", price: 2000 },
      { name: "Espresso Double", price: 2000 },
      { name: "Espresso Macchiato", price: 3000, description: "Coffee with steam milk" },
      { name: "Black Coffee", price: 2500, description: "Test always as strong as double shot with hot water" },
      { name: "Americano Coffee", price: 2500, description: "Always strong with fresh hot water" },
      { name: "Café Late", price: 2500, description: "Less to light coffee in form of steamed milk" },
      { name: "Caramel Macchiato", price: 3000, description: "Sweet like sugar, test like caramel and looks like strong coffee" },
      { name: "Hot Chocolate", price: 2500, description: "It looks dark like chociate and test fresh milk" },
      { name: "Vanilla Late", price: 3000 },
      { name: "Caramel Mocha", price: 3000, description: "Sabo fresh streamed milk with chocolate powder in a glass of double espresso" },
      { name: "African Coffee", price: 3000 },
      { name: "English Coffee", price: 3000 },
      { name: "Dalgona Coffee", price: 3000, description: "Is an instant coffee with sugar and milk" },
      { name: "Baileys Irish Latte", price: 5000, description: "Is an Irish cream liquor steamed with a milk and single espresso" },
    ],
  },
  {
    name: "Cold Brew",
    items: [
      { name: "Cold Brew with Sweet Cream", price: 4000, description: "Enjoy a classic cold brew with our hand crafted, frothy sweet cream" },
      { name: "Sweet Almond Cold Brew", price: 4000, description: "Vanilla cold foam over roasted cold brew, dusted with cocoa powder" },
      { name: "Belgium Chocolate Cold Brew with Sweet Cream", price: 4000, description: "Roasted beans with Belgium chocolate, cold down in ice shakes" },
      { name: "Sugar Cookie Latte", price: 4000, description: "Steamed milk, espresso, marshmallow vanilla and rainbow sprinkles" },
      { name: "Purple Cookie Latte", price: 4000, description: "Espresso combined with light lavender, brown sugar, hot or cold" },
      { name: "Nutty Caramel Latte", price: 4000, description: "Espresso mixed with caramel and hazel nut (nutella)" },
    ],
  },
  {
    name: "Signature Drinks",
    items: [
      { name: "Bob Marley Juice", price: 5000, description: "Tree tomato and watermelon with mango, topped with avocado juice" },
      { name: "Lemonade", price: 4000, description: "Shaked lemon and pineapple with ice cubes and lemon slice" },
    ],
  },
  {
    name: "Iced Drinks",
    items: [
      { name: "Freddo Espresso", price: 3000, description: "Is an iced espresso" },
      { name: "Iced Vanilla Latte", price: 3000, description: "Vanilla flavored syrup with a shot of espresso in a cool foam of milk" },
      { name: "Iced Cappuccino", price: 3000, description: "Always known as strong as double shot, with a foam of milk" },
      { name: "Iced Mocha", price: 3000, description: "What a dark powder? I like you very cold glass ever" },
      { name: "Iced Carmel Mocha", price: 4000, description: "Strong coffee mixed with powder in a glass of white foam with caramel" },
      { name: "Iced Dawa Tea", price: 4000, description: "Fresh mix of lemon, ginger and honey, too much cold" },
      { name: "Iced Americano", price: 3000 },
    ],
  },
  {
    name: "Liquor Coffee",
    items: [
      { name: "Irish Coffee", price: 7000, description: "Strong coffee spiked with a shot of Irish whiskey and whipped cream" },
      { name: "Jamaica Coffee", price: 7000, description: "Strong coffee spiked with shot of dark rum and whipped cream" },
      { name: "Café Amore", price: 7000, description: "Combination of cognac and amaretto mixed into cream and shaved almonds" },
    ],
  },
  {
    name: "Frappe",
    items: [
      { name: "Mocha Frappe", price: 4000, description: "Vanilla ice cream in a cold glass of coffee, milk and chocolate powder" },
      { name: "Carmel Frappe", price: 4000, description: "Coffee, milk and caramel syrup with vanilla ice cream" },
      { name: "Chocolate Frappe", price: 4000, description: "A scoop of vanilla ice cream with chocolate powder shaken in milk" },
    ],
  },
  {
    name: "Tea",
    items: [
      { name: "African Tea", price: 3000 },
      { name: "Zenith Dawa Tea", price: 4000, description: "House spice tea mixed with lemon, ginger and honey" },
      { name: "Masala Tea", price: 2500, description: "Hot milk and masala powder" },
      { name: "Green Tea", price: 2500, description: "Green tea leaves or teabag in hot water" },
      { name: "English Tea", price: 4000, description: "Hot water, tea leaves and milk powder a side" },
      { name: "Black Tea", price: 2000 },
      { name: "Ginger Tea", price: 2000 },
      { name: "Special Tea", price: 4000 },
      { name: "Lemon Tea", price: 2500 },
      { name: "Hot Milk", price: 2500 },
    ],
  },
  {
    name: "Nojito",
    items: [
      { name: "Passion Nojito", price: 4500 },
      { name: "Orange Nojito", price: 4500 },
      { name: "Strawberry Nojito", price: 4500 },
    ],
  },
  {
    name: "Booster",
    items: [
      { name: "Stinger Booster", price: 5000, description: "Tropical carrots and ginger with mango and pineapple" },
      { name: "Pinneapple Crush", price: 4000, description: "Two big slices of pineapple blended with ice cubes" },
      { name: "Mango Crush", price: 4000, description: "Fresh mango blended with ice cubes" },
    ],
  },
  {
    name: "Mocktail Juice",
    items: [
      { name: "Pineapple Juice", price: 3000 },
      { name: "Mango Juice", price: 3000 },
      { name: "Watermelon Juice", price: 2500 },
      { name: "Ginger Juice", price: 2500 },
      { name: "Janjaweed", price: 4000 },
      { name: "Treet Tomato Juice", price: 3000 },
      { name: "Passion Juice", price: 3000 },
      { name: "Lemon Juice", price: 3000 },
      { name: "Fresh Fruit Salad", price: 5000 },
      { name: "Tomato Juice", price: 2000 },
      { name: "Orange Juice", price: 3000 },
      { name: "Pawpaw Juice", price: 2000 },
      { name: "Avocado Juice", price: 2000 },
      { name: "Beet Root Juice", price: 2000 },
      { name: "Mocktail Juice", price: 4000 },
      { name: "Apple Juice", price: 2000 },
    ],
  },
  {
    name: "Milk Shake",
    items: [
      { name: "Mango Milk Shake", price: 4500 },
      { name: "Oreo Milk Shake", price: 5000 },
      { name: "Chocolate Milk Shake", price: 4500 },
      { name: "Strawberry Milk Shake", price: 4500 },
      { name: "Vanilla Milk Shake", price: 4500 },
      { name: "Banana Mik Shake", price: 4500 },
    ],
  },
  {
    name: "Ice Cream",
    items: [
      { name: "A Scoop of Ice Cream", price: 1500 },
      { name: "Banan Split", price: 3000, description: "Two scoops of vanilla ice cream garnished with banana and chocolate syrup" },
      { name: "Affogato", price: 4000, description: "Double espresso in vanilla ice cream" },
    ],
  },
  {
    name: "Smoothie",
    items: [
      { name: "Snow White", price: 5000, description: "Coconut milk with avocado and banana" },
      { name: "Strawberry Banana", price: 5000, description: "Banana, strawberries and yoghurt" },
      { name: "Summer Peanut Butter", price: 5000, description: "Banana, chocolate syrup, coconut powder, peanut butter and yoghurt" },
      { name: "Nutty Summer Smoothie", price: 5000, description: "Mango, banana, peanut butter and yoghurt" },
      { name: "Tropical Smoothie", price: 5000, description: "Mango, pawpaw, coconut powder blended with yoghurt" },
      { name: "Mango & Strawberry", price: 5000 },
    ],
  },
  {
    name: "Drinks",
    items: [
      { name: "Water", price: 1000, unit: "BOTTLE" },
      { name: "Fanta", price: 1500, unit: "BOTTLE" },
      { name: "Virunga Water", price: 1000, unit: "BOTTLE" },
      { name: "Red Bull", price: 5000, unit: "CAN" },
      { name: "Panache", price: 1500, unit: "BOTTLE" },
      { name: "Primus", price: 1500, unit: "BOTTLE" },
      { name: "Bavaria none alcohol", price: 4000, unit: "BOTTLE" },
      { name: "Mutzing", price: 2000, unit: "BOTTLE" },
      { name: "Amstel", price: 2000, unit: "BOTTLE" },
      { name: "Petit Skol Malt", price: 1500, unit: "BOTTLE" },
      { name: "Tusker", price: 3000, unit: "BOTTLE" },
      { name: "Savan", price: 5000, unit: "BOTTLE" },
      { name: "Virunga sliver", price: 2000, unit: "BOTTLE" },
      { name: "Virunga Mist", price: 2000, unit: "BOTTLE" },
      { name: "Heineken", price: 2000, unit: "BOTTLE" },
      { name: "Smirnoff Ice", price: 3000, unit: "BOTTLE" },
      { name: "Smirnoff Canet (Guarana)", price: 4000, unit: "CAN" },
      { name: "Guinness", price: 3000, unit: "BOTTLE" },
      { name: "Exo", price: 4000, unit: "CAN" },
      { name: "Stella", price: 3000, unit: "BOTTLE" },
      { name: "Leffe", price: 5000, unit: "BOTTLE" },
      { name: "Konyagi petit", price: 4500, unit: "BOTTLE" },
      { name: "Konyagi Grand", price: 12500, unit: "BOTTLE" },
      { name: "Gilbeys petit", price: 6000, unit: "BOTTLE" },
      { name: "Gilbeys Grand", price: 20000, unit: "BOTTLE" },
      { name: "Desperados", price: 3500, unit: "BOTTLE" },
    ],
  },
  {
    name: "Spirits",
    items: [
      { name: "Gordon Gin", variants: bottleAndShot(60000, 3000) },
      { name: "Tequila Camino", variants: bottleAndShot(60000, 3000) },
      { name: "Hennessy VSOP", variants: bottleAndShot(250000, 9000) },
      { name: "Hennessy VS", variants: bottleAndShot(200000, 7000) },
      { name: "Absolut Vodka", variants: bottleAndShot(65000, 3000) },
      { name: "Absolut Vanilla", variants: bottleAndShot(65000, 3000) },
      { name: "Absolut Citron", variants: bottleAndShot(65000, 3000) },
      { name: "Absolut Mandarin", variants: bottleAndShot(65000, 3000) },
      { name: "Cointreau", variants: bottleAndShot(70000, 4000) },
      { name: "Jack Daniel", variants: bottleAndShot(100000, 5000) },
      { name: "Jack Daniel Honey", variants: bottleAndShot(80000, 5000) },
      { name: "Jameson", variants: bottleAndShot(70000, 4000) },
      { name: "Nelson", variants: bottleAndShot(50000, 4000) },
      { name: "Martini", variants: bottleAndShot(70000, 5000) },
      { name: "Kingstone", variants: bottleAndShot(50000, 3000) },
      { name: "Amarura", variants: bottleAndShot(70000, 9000) },
      { name: "Smirnoff Vodk", variants: bottleAndShot(50000, 3000) },
      { name: "Smirnoff Vanilla", variants: bottleAndShot(50000, 3000) },
      { name: "Bailys", variants: bottleAndShot(70000, 4000) },
      { name: "Ahwua", variants: bottleAndShot(80000, 4000) },
      { name: "Jager Master", variants: bottleAndShot(70000, 4000) },
      { name: "Malibu", variants: bottleAndShot(70000, 4000) },
      { name: "Olmeca Tequilla", variants: bottleAndShot(80000, 4000) },
      { name: "Remy Malt", variants: bottleAndShot(200000, 7000) },
      { name: "Martel", variants: bottleAndShot(200000, 7000) },
      { name: "Black Label", variants: bottleAndShot(100000, 5000) },
      { name: "D.Black", variants: bottleAndShot(150000, 6000) },
      { name: "Chivas", variants: bottleAndShot(100000, 5000) },
      { name: "Bomba + Gin", variants: bottleAndShot(60000, 3000) },
      { name: "Hendrick’s", variants: bottleAndShot(200000, 7000) },
    ],
  },
  {
    name: "Red Wine",
    items: [
      { name: "Pinta Negra", variants: bottleAndGlass(35000, 5000) },
      { name: "Four Cousins", variants: bottleAndGlass(30000) },
      { name: "Baron D'Arignac", variants: bottleAndGlass(35000) },
      { name: "Nederburg", variants: bottleAndGlass(90000) },
      { name: "Moutocadet", variants: bottleAndGlass(50000) },
    ],
  },
  {
    name: "White Wine",
    items: [
      { name: "Pinta Negra", variants: bottleAndGlass(35000, 5000) },
      { name: "Four Cousins", variants: bottleAndGlass(30000) },
      { name: "Baron D'Arignac", variants: bottleAndGlass(35000) },
      { name: "Nederburg", variants: bottleAndGlass(90000) },
      { name: "Moutocadet", variants: bottleAndGlass(50000) },
    ],
  },
  {
    name: "Champagne",
    items: [
      { name: "Moet", variants: bottleAndGlass(200000) },
      { name: "Baron Darignac", variants: bottleAndGlass(50000) },
    ],
  },
  {
    name: "Cocktail",
    items: [
      { name: "Mojito", price: 10000, description: "Classic strawberry rum with fresh lime, mint" },
      { name: "Margarita", price: 12000, description: "Tequila, triple sec, fresh lime juice" },
      { name: "Pina Colada", price: 12000, description: "Fresh pineapple juice, white rum, coconut milk" },
      { name: "Long Island", price: 15000, description: "White rum, vodka, gin, tequila, triple sec, cola" },
      { name: "Sex on the Beach", price: 12000, description: "Vodka, peach juice, orange juice, triple sec" },
      { name: "Gin Tonic", price: 12000, description: "Tonic water, gin" },
      { name: "Tequila Sunrise", price: 15000, description: "Tequila, orange juice, grenadine" },
      { name: "Maitai", price: 12000, description: "White rum, lime juice, orange curacao" },
      { name: "B 52", price: 7000 },
    ],
  },
];

export function itemVariants(item: MenuItem): MenuVariant[] {
  if (item.variants?.length) return item.variants;
  if (item.price == null) throw new Error(`Menu item "${item.name}" is missing a price.`);
  return portion(item.price, item.unit ?? "PORTION");
}
