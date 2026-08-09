(function createNutritionManager(global) {
  const GOAL_DEFAULTS = Object.freeze({ fat_loss: 1600, muscle_gain: 2300, maintain: 1900 });
  const GOAL_LABELS = Object.freeze({ fat_loss: "减脂", muscle_gain: "增肌", maintain: "保持体重" });

  function dateKey(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function mealDate(log) {
    return String(log?.date || dateKey(log?.at));
  }

  function mealsForDate(logs, input = new Date()) {
    const key = dateKey(input);
    return (Array.isArray(logs) ? logs : []).filter(log => log?.type === "meal" && mealDate(log) === key);
  }

  function totals(logs, input = new Date()) {
    return mealsForDate(logs, input).reduce((result, meal) => {
      result.calories += Math.max(0, Number(meal.value) || 0);
      result.weight += Math.max(0, Number(meal.weight) || 0);
      result.protein += Math.max(0, Number(meal.protein) || 0);
      result.carbs += Math.max(0, Number(meal.carbs) || 0);
      result.fat += Math.max(0, Number(meal.fat) || 0);
      return result;
    }, { calories: 0, weight: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function normalizeGoal(goal) {
    return Object.hasOwn(GOAL_DEFAULTS, goal) ? goal : "maintain";
  }

  function summary(logs, settings, input = new Date()) {
    const healthGoal = normalizeGoal(settings?.healthGoal);
    const target = Math.max(1, Number(settings?.energyTarget) || GOAL_DEFAULTS[healthGoal]);
    const consumed = totals(logs, input);
    const remaining = target - consumed.calories;
    return {
      healthGoal,
      healthGoalLabel: GOAL_LABELS[healthGoal],
      target,
      consumed,
      remaining,
      percentage: Math.round(consumed.calories / target * 100),
      exceeded: remaining < 0
    };
  }

  global.NutritionManager = Object.freeze({ GOAL_DEFAULTS, GOAL_LABELS, dateKey, mealsForDate, totals, normalizeGoal, summary });
})(window);
