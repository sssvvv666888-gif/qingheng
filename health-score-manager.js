(function createHealthScoreManager(global) {
  function isToday(iso) {
    const date = new Date(iso);
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  }

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function calculate({ logs = [], settings = {} } = {}) {
    const today = logs.filter(log => isToday(log.at));
    const calories = today.filter(log => log.type === "meal").reduce((sum, log) => sum + (Number(log.value) || 0), 0);
    const protein = today.filter(log => log.type === "meal").reduce((sum, log) => sum + (Number(log.protein) || 0), 0);
    const exerciseMinutes = today
      .filter(log => log.type === "activity" || log.type === "video")
      .reduce((sum, log) => sum + (Number(log.duration ?? log.value) || 0), 0);
    const water = today.filter(log => log.type === "water").reduce((sum, log) => sum + (Number(log.value) || 0), 0);
    const calorieTarget = Math.max(1, Number(settings.energyTarget) || 1850);
    const activityTarget = Math.max(1, Number(settings.activityTarget) || 30);
    const waterTarget = Math.max(1, Number(settings.waterTarget) || 1800);
    const calorieRatio = calories / calorieTarget;
    const diet = calorieRatio <= 1
      ? clampScore((calorieRatio / 0.7) * 100)
      : clampScore(100 - ((calorieRatio - 1) * 120));
    const exercise = clampScore((exerciseMinutes / activityTarget) * 100);
    const hydration = clampScore((water / waterTarget) * 100);
    const total = clampScore(diet * 0.45 + exercise * 0.3 + hydration * 0.25);

    let advice = "今天的节奏很不错，继续温柔地照顾自己。";
    if (!calories) advice = "还没有饮食记录，先记录一餐，让建议更准确。";
    else if (protein < 50) advice = "蛋白质摄入偏少，下一餐可以增加鸡蛋、牛奶或豆制品。";
    else if (hydration < 70) advice = "今天饮水还不够，可以先慢慢喝一杯水。";
    else if (exercise < 70) advice = "今天活动时间偏少，轻松散步十分钟也很好。";

    return { total, diet, exercise, hydration, advice, calories, protein, exerciseMinutes, water };
  }

  global.HealthScoreManager = Object.freeze({ calculate });
})(window);
