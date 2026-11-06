// NutriTrack data classes: Food, NutritionCalculator, FoodDiary and FoodSuggestion.
(function () {

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function convertLegacyDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // Older records used toLocaleDateString(). Use the computer's current
  // locale order to interpret those dates when possible.
  const parts = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(new Date(2026, 10, 5));
  const order = parts.filter(part => ['year', 'month', 'day'].includes(part.type))
    .map(part => part.type);
  const numbers = String(value).match(/\d+/g);
  if (!numbers || numbers.length !== 3) return null;

  const values = {};
  order.forEach((type, index) => values[type] = Number(numbers[index]));
  if (values.year < 100) values.year += values.year < 50 ? 2000 : 1900;
  if (values.month < 1 || values.month > 12 || values.day < 1 || values.day > 31) return null;

  const date = new Date(values.year, values.month - 1, values.day);
  if (date.getFullYear() !== values.year || date.getMonth() !== values.month - 1 || date.getDate() !== values.day) return null;
  return getLocalDateKey(date);
}

class Food {
  constructor(data) {
    this.id = String(data.id || data.fdcId || Date.now());
    this.name = data.name || data.description || 'Unknown food';
    this.brand = data.brand || data.dataType || 'Generic food';
    this.calories = Number(data.calories) || 0;
    this.protein = data.protein == null ? null : Number(data.protein);
    this.carbs = data.carbs == null ? null : Number(data.carbs);
    this.fat = data.fat == null ? null : Number(data.fat);
    this.fiber = data.fiber == null ? null : Number(data.fiber);
    this.sugar = data.sugar == null ? null : Number(data.sugar);
    this.source = data.source || 'USDA FoodData Central';
  }
}

class NutritionCalculator {
  static calculate(food, grams) {
    const factor = Number(grams) / 100;
    return {
      calories: food.calories * factor,
      protein: (food.protein || 0) * factor,
      carbs: (food.carbs || 0) * factor,
      fat: (food.fat || 0) * factor,
      fiber: (food.fiber || 0) * factor,
      sugar: (food.sugar || 0) * factor
    };
  }

  static calculateTotals(records) {
    return records.reduce((total, record) => {
      total.calories += Number(record.calories) || 0;
      total.protein += Number(record.protein) || 0;
      total.carbs += Number(record.carbs) || 0;
      total.fat += Number(record.fat) || 0;
      return total;
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  }
}

class FoodDiary {
  constructor(storageKey = 'foodRecords') {
    this.storageKey = storageKey;
  }

  getRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      let changed = false;

      // Add dateKey to records created by the older version without deleting them.
      records.forEach(record => {
        if (!record.dateKey) {
          const converted = convertLegacyDate(record.date);
          if (converted) {
            record.dateKey = converted;
            changed = true;
          }
        }
      });

      if (changed) this.saveRecords(records);
      return records;
    } catch (error) {
      console.error('Unable to read food records:', error);
      return [];
    }
  }

  saveRecords(records) {
    localStorage.setItem(this.storageKey, JSON.stringify(records));
  }

  addFood(foodData, grams, meal, dateKey = getLocalDateKey()) {
    const food = new Food(foodData);
    const amount = Number(grams);
    const nutrients = NutritionCalculator.calculate(food, amount);
    const records = this.getRecords();

    records.push({
      id: Date.now().toString() + Math.random().toString(16).slice(2, 6),
      name: food.name,
      grams: amount,
      meal,
      ...nutrients,
      valuesPer100g: food,
      dateKey,
      date: dateKey
    });

    this.saveRecords(records);
    return true;
  }

  updateFood(id, name, grams, meal, dateKey) {
    const records = this.getRecords();
    const record = records.find(item => item.id === id);
    if (!record) return false;

    const amount = Number(grams);
    const food = new Food({ ...record.valuesPer100g, name });
    Object.assign(record, NutritionCalculator.calculate(food, amount), {
      name,
      grams: amount,
      meal,
      dateKey: dateKey || record.dateKey || getLocalDateKey(),
      date: dateKey || record.dateKey || getLocalDateKey()
    });

    this.saveRecords(records);
    return true;
  }

  deleteFood(id) {
    this.saveRecords(this.getRecords().filter(item => item.id !== id));
  }

  getRecordsForDate(dateKey) {
    return this.getRecords().filter(item => item.dateKey === dateKey);
  }

  getTodayRecords() {
    return this.getRecordsForDate(getLocalDateKey());
  }
}

class FoodSuggestion {
  static getFoods(goal) {
    let suggestions = [];

    if (goal === 'balanced') {
      suggestions = [
        { name: 'Brown Rice', detail: 'A source of carbohydrates and fiber.' },
        { name: 'Grilled Chicken', detail: 'A source of protein.' },
        { name: 'Broccoli', detail: 'Provides fiber and vitamins.' }
      ];
    } else if (goal === 'protein') {
      suggestions = [
        { name: 'Egg', detail: 'A convenient source of protein.' },
        { name: 'Chicken Breast', detail: 'Provides protein.' },
        { name: 'Tempeh', detail: 'A plant-based source of protein.' }
      ];
    } else if (goal === 'fiber') {
      suggestions = [
        { name: 'Oats', detail: 'Contains dietary fiber.' },
        { name: 'Lentils', detail: 'Provides fiber and plant protein.' },
        { name: 'Apple with Skin', detail: 'Provides dietary fiber.' }
      ];
    } else if (goal === 'lower-carb') {
      suggestions = [
        { name: 'Egg', detail: 'Contains very little carbohydrate.' },
        { name: 'Cucumber', detail: 'A low-carbohydrate vegetable.' },
        { name: 'Grilled Fish', detail: 'Provides protein with very little carbohydrate.' }
      ];
    } else if (goal === 'lower-calorie') {
      suggestions = [
        { name: 'Cucumber', detail: 'A low-energy-density vegetable.' },
        { name: 'Watermelon', detail: 'Contains high water content.' },
        { name: 'Strawberries', detail: 'A fruit that is relatively low in calories.' }
      ];
    } else if (goal === 'diabetes') {
      suggestions = [
        { name: 'Broccoli', detail: 'Provides fiber and is naturally low in carbohydrates.' },
        { name: 'Plain Oats', detail: 'Contains soluble fiber; choose unsweetened oats.' },
        { name: 'Grilled Fish', detail: 'Provides protein without adding carbohydrates.' }
      ];
    } else if (goal === 'hypertension') {
      suggestions = [
        { name: 'Fresh Apple', detail: 'A naturally low-sodium fruit.' },
        { name: 'Fresh Cucumber', detail: 'A naturally low-sodium vegetable.' },
        { name: 'Plain Oats', detail: 'Choose unsalted and unflavoured oats.' }
      ];
    } else if (goal === 'cholesterol') {
      suggestions = [
        { name: 'Oats', detail: 'Contains beta-glucan, a type of soluble fiber.' },
        { name: 'Lentils', detail: 'Provides soluble fiber and plant protein.' },
        { name: 'Beans', detail: 'A source of dietary fiber and plant protein.' }
      ];
    } else if (goal === 'weight') {
      suggestions = [
        { name: 'Broccoli', detail: 'Provides fiber with relatively low calories.' },
        { name: 'Chicken Breast', detail: 'Provides protein to help make meals satisfying.' },
        { name: 'Watermelon', detail: 'Contains plenty of water.' }
      ];
    } else {
      suggestions = [
        { name: 'No suggestion available', detail: 'Please select a valid nutrition goal or health category.' }
      ];
    }

    return suggestions;
  }
}

window.NutriTrack = { Food, NutritionCalculator, FoodDiary, FoodSuggestion };
})();
