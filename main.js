const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { USDA_API_KEY } = require('./api-config');

function getNutrient(food, nutrientId) {
  const item = (food.foodNutrients || []).find(
    n => Number(n.nutrientId) === Number(nutrientId)
  );

  return item && item.value != null
    ? Number(item.value)
    : null;
}

// Get calories using available USDA energy values.
function getCalories(food) {
  const energyIds = [1008, 2047, 2048];

  for (const id of energyIds) {
    const value = getNutrient(food, id);

    if (value !== null && value > 0) {
      return value;
    }
  }

  return 0;
}

function formatFood(food) {
  return {
    id: String(food.fdcId),
    name: food.description || 'Unknown food',
    brand: 'Generic food · ' + food.dataType,
    calories: getCalories(food),
    protein: getNutrient(food, 1003),
    carbs: getNutrient(food, 1005),
    fat: getNutrient(food, 1004),
    fiber: getNutrient(food, 1079),
    sugar: getNutrient(food, 2000),
    source: 'USDA FoodData Central'
  };
}

async function searchUSDA(foodName) {
  if (!USDA_API_KEY || USDA_API_KEY.includes('PASTE_')) {
    throw new Error('USDA API key is missing. Add it in api-config.js.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: foodName,
          pageSize: 25,
          dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)']
        }),
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`USDA HTTP ${response.status}: ${details.slice(0, 180)}`);
    }

    const data = await response.json();
    const foods = (data.foods || []).filter(food =>
      ['Foundation', 'SR Legacy', 'Survey (FNDDS)'].includes(food.dataType)
    );

    foods.sort((a, b) => {
      const aExact = a.description?.toLowerCase() === foodName.toLowerCase() ? 1 : 0;
      const bExact = b.description?.toLowerCase() === foodName.toLowerCase() ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const order = { Foundation: 1, 'SR Legacy': 2, 'Survey (FNDDS)': 3 };
      return order[a.dataType] - order[b.dataType];
    });

    return foods.slice(0, 10).map(formatFood);
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('USDA search timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle('food:search', async (event, foodName) => {
  const query = String(foodName || '').trim();
  if (!query) return { foods: [], message: 'Please enter a food name.' };

  try {
    const foods = await searchUSDA(query);
    if (!foods.length) {
      return { foods: [], message: 'No generic food found. Try a simpler name such as apple, banana or rice.' };
    }
    return { foods, source: 'USDA FoodData Central' };
  } catch (error) {
    return { foods: [], message: error.message || 'Food search failed.' };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
