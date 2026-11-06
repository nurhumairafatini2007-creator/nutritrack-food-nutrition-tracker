// NutriTrack interface and event handling.
(function () {
  const { Food, NutritionCalculator, FoodDiary, FoodSuggestion } = window.NutriTrack;
  const diary = new FoodDiary();

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDate(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function nutrientCard(label, value, unit) {
    const display = value == null ? 'N/A' : Number(value).toFixed(1);
    return `<div class="nutrient-card"><span>${label}</span><strong>${display} ${value == null ? '' : `<small>${unit}</small>`}</strong></div>`;
  }

  // Dashboard page: always shows today's intake.
  if (document.getElementById('dash-calories')) {
    function renderDashboard() {
      const records = diary.getTodayRecords();
      const totals = NutritionCalculator.calculateTotals(records);
      const goal = Number(localStorage.getItem('calorieGoal')) || 2000;
      document.getElementById('dash-calories').textContent = Math.round(totals.calories);
      document.getElementById('dash-protein').textContent = totals.protein.toFixed(1);
      document.getElementById('dash-carbs').textContent = totals.carbs.toFixed(1);
      document.getElementById('dash-fat').textContent = totals.fat.toFixed(1);
      document.getElementById('dash-goal-label').textContent = goal.toLocaleString();
      document.getElementById('calorie-goal').value = goal;
      document.getElementById('calorie-progress').style.width = `${Math.min(totals.calories / goal * 100, 100)}%`;
      document.getElementById('calorie-remaining').textContent = `${Math.max(0, goal - totals.calories).toFixed(0)} kcal remaining`;
      document.getElementById('dashboard-food-list').innerHTML = records.length
        ? records.slice(-4).map(item => `<div class="simple-food-row"><span>${escapeText(item.name)}<small>${item.grams}g · ${escapeText(item.meal)}</small></span><strong>${Math.round(item.calories)} kcal</strong></div>`).join('')
        : 'No food added yet. Search for a food to get started.';
    }

    document.getElementById('save-goal').addEventListener('click', () => {
      const goal = Number(document.getElementById('calorie-goal').value);
      if (!Number.isFinite(goal) || goal < 1 || goal > 10000) return alert('Enter a daily goal between 1 and 10,000 kcal.');
      localStorage.setItem('calorieGoal', String(goal));
      renderDashboard();
      alert('Daily calorie goal saved.');
    });

    renderDashboard();
  }

  // Food search page.
  if (document.getElementById('search-form')) {
    let isSearching = false;
    let selectedFood = null;
    const form = document.getElementById('search-form');
    const button = document.getElementById('search-button');
    const message = document.getElementById('search-message');
    const resultsBox = document.getElementById('search-results');
    const detailBox = document.getElementById('selected-food');

    function showFoodDetails(foodData) {
      selectedFood = new Food(foodData);
      detailBox.classList.remove('hidden');
      detailBox.innerHTML = `
        <div class="section-heading"><div><p class="eyebrow">NUTRITION FACTS PER 100G</p><h3>${escapeText(selectedFood.name)}</h3><p>${escapeText(selectedFood.brand)}</p></div><span class="source-label">${escapeText(selectedFood.source)}</span></div>
        <div class="nutrition-grid">
          ${nutrientCard('Calories', selectedFood.calories, 'kcal')}
          ${nutrientCard('Protein', selectedFood.protein, 'g')}
          ${nutrientCard('Carbohydrates', selectedFood.carbs, 'g')}
          ${nutrientCard('Fat', selectedFood.fat, 'g')}
          ${nutrientCard('Fiber', selectedFood.fiber, 'g')}
          ${nutrientCard('Sugar', selectedFood.sugar, 'g')}
        </div>
        <p class="per-gram">Per gram: ${(selectedFood.calories / 100).toFixed(3)} kcal · Per 100g: ${selectedFood.calories.toFixed(1)} kcal</p>
        <form id="add-food-form" class="add-food-form">
          <label>Amount (grams)<input type="number" id="food-grams" min="1" max="5000" value="100" required></label>
          <label>Meal<select id="food-meal"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select></label>
          <label>Date eaten<input type="date" id="food-date" value="${localDateKey()}" required></label>
          <button class="primary-button" type="submit">+ Add to diary</button>
        </form>`;

      document.getElementById('add-food-form').addEventListener('submit', event => {
        event.preventDefault();
        const grams = Number(document.getElementById('food-grams').value);
        const dateKey = document.getElementById('food-date').value;
        if (!Number.isFinite(grams) || grams < 1 || grams > 5000) return alert('Please enter an amount between 1 and 5000 grams.');
        if (!dateKey) return alert('Please select the date you ate this food.');
        diary.addFood(selectedFood, grams, document.getElementById('food-meal').value, dateKey);
        alert(`Food added to your diary for ${formatDate(dateKey)}.`);
      });
    }

    function renderResults(foods) {
      if (!foods.length) {
        resultsBox.innerHTML = '<div class="empty-state">No food found. Try another food name.</div>';
        return;
      }
      resultsBox.innerHTML = foods.map((food, index) => `
        <button class="food-result" type="button" data-index="${index}">
          <span class="food-result-icon">${escapeText(food.name.charAt(0).toUpperCase())}</span>
          <span class="food-result-info"><strong>${escapeText(food.name)}</strong><small>${escapeText(food.brand)}</small></span>
          <span class="food-result-calories">${Number(food.calories).toFixed(1)} kcal<small>per 100g</small></span>
        </button>`).join('');
      resultsBox.querySelectorAll('[data-index]').forEach(item => {
        item.addEventListener('click', () => showFoodDetails(foods[Number(item.dataset.index)]));
      });
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (isSearching) return;
      const query = document.getElementById('food-search').value.trim();
      if (!query) { message.textContent = 'Please enter a food name.'; return; }
      isSearching = true;
      button.disabled = true;
      button.textContent = 'Searching...';
      message.textContent = 'Searching USDA FoodData Central...';
      resultsBox.innerHTML = '';
      detailBox.classList.add('hidden');
      try {
        if (!window.nutritionAPI) throw new Error('Please run the application using npm start.');
        const response = await window.nutritionAPI.searchFood(query);
        const foods = response.foods || [];
        if (!foods.length) {
          message.textContent = response.message || 'No food found.';
          renderResults([]);
        } else {
          message.textContent = 'Select a food to view its nutrition facts.';
          renderResults(foods);
        }
      } catch (error) {
        message.textContent = error.message || 'Food search failed. Please try again.';
        renderResults([]);
      } finally {
        isSearching = false;
        button.disabled = false;
        button.textContent = 'Search food';
      }
    });
  }

  // Food diary page with selectable date history.
  if (document.getElementById('diary-list')) {
    const dateInput = document.getElementById('diary-date');
    let selectedDate = localDateKey();

    function renderDiary() {
      const records = diary.getRecordsForDate(selectedDate);
      const totals = NutritionCalculator.calculateTotals(records);
      document.getElementById('diary-total').textContent =
        `Daily summary for ${formatDate(selectedDate)} · ${records.length} food record(s)`;

      // Recalculate and display nutrients for the currently selected date only.
      document.getElementById('diary-nutrition-summary').innerHTML = `
        ${nutrientCard('Calories', totals.calories, 'kcal')}
        ${nutrientCard('Protein', totals.protein, 'g')}
        ${nutrientCard('Carbohydrates', totals.carbs, 'g')}
        ${nutrientCard('Fat', totals.fat, 'g')}
      `;

      const list = document.getElementById('diary-list');

      if (!records.length) {
        list.innerHTML = '<div class="empty-state">No food records for this date. Add food from Food Search and select this date.</div>';
        return;
      }

      list.innerHTML = records.map(item => `
        <div class="diary-row">
          <div><strong>${escapeText(item.name)}</strong><small>${escapeText(item.meal)} · ${item.grams}g · ${Math.round(item.calories)} kcal</small></div>
          <div class="row-actions"><button class="small-button" data-edit="${item.id}">Edit</button><button class="small-button delete-button" data-delete="${item.id}">Delete</button></div>
        </div>`).join('');

      list.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => openEdit(button.dataset.edit)));
      list.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => {
        if (confirm('Delete this food record?')) {
          diary.deleteFood(button.dataset.delete);
          renderDiary();
        }
      }));
    }

    function openEdit(id) {
      const record = diary.getRecords().find(item => item.id === id);
      if (!record) return;
      document.getElementById('edit-id').value = id;
      document.getElementById('edit-name').value = record.name;
      document.getElementById('edit-grams').value = record.grams;
      document.getElementById('edit-meal').value = record.meal;
      document.getElementById('edit-date').value = record.dateKey || selectedDate;
      document.getElementById('edit-modal').classList.remove('hidden');
    }

    function closeEdit() {
      document.getElementById('edit-modal').classList.add('hidden');
    }

    document.getElementById('edit-form').addEventListener('submit', event => {
      event.preventDefault();
      const id = document.getElementById('edit-id').value;
      const name = document.getElementById('edit-name').value.trim();
      const grams = Number(document.getElementById('edit-grams').value);
      const dateKey = document.getElementById('edit-date').value;
      if (!name) return alert('Please enter a food name.');
      if (!Number.isFinite(grams) || grams < 1 || grams > 5000) return alert('Enter an amount between 1 and 5000 grams.');
      if (!dateKey) return alert('Please select the date.');
      diary.updateFood(id, name, grams, document.getElementById('edit-meal').value, dateKey);
      selectedDate = dateKey;
      dateInput.value = selectedDate;
      closeEdit();
      renderDiary();
    });

    document.getElementById('close-modal').addEventListener('click', closeEdit);
    document.getElementById('cancel-edit').addEventListener('click', closeEdit);

    dateInput.value = selectedDate;
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      selectedDate = dateInput.value;
      renderDiary();
    });

    document.getElementById('previous-day').addEventListener('click', () => {
      const date = new Date(`${selectedDate}T12:00:00`);
      date.setDate(date.getDate() - 1);
      selectedDate = localDateKey(date);
      dateInput.value = selectedDate;
      renderDiary();
    });

    document.getElementById('next-day').addEventListener('click', () => {
      const date = new Date(`${selectedDate}T12:00:00`);
      date.setDate(date.getDate() + 1);
      selectedDate = localDateKey(date);
      dateInput.value = selectedDate;
      renderDiary();
    });

    document.getElementById('get-suggestions').addEventListener('click', () => {
      const goal = document.getElementById('suggestion-goal').value;
      const ideas = FoodSuggestion.getFoods(goal);
      localStorage.setItem('savedSuggestions', JSON.stringify({ goal, ideas, date: localDateKey() }));
      document.getElementById('suggestion-results').innerHTML = ideas.map(food => `
        <div class="suggestion-card"><span class="food-result-icon">✦</span><div><strong>${escapeText(food.name)}</strong><p>${escapeText(food.detail)}</p></div></div>`).join('');
    });

    renderDiary();
  }
})();
