(function createExerciseRecommendationSystem(global) {
  const TYPES = Object.freeze([
    { id: "walk", name: "步行", recommendationName: "快走", icon: "🚶", met: 3.3, defaultMinutes: 30 },
    { id: "run", name: "跑步", recommendationName: "慢跑", icon: "🏃", met: 7, defaultMinutes: 20 },
    { id: "cycle", name: "骑行", recommendationName: "轻松骑行", icon: "🚲", met: 5.5, defaultMinutes: 30 },
    { id: "strength", name: "力量训练", recommendationName: "基础力量训练", icon: "🏋️", met: 5, defaultMinutes: 25 },
    { id: "yoga", name: "瑜伽", recommendationName: "舒缓瑜伽", icon: "🧘", met: 2.5, defaultMinutes: 25 },
    { id: "stretch", name: "拉伸", recommendationName: "全身拉伸", icon: "🤸", met: 2.3, defaultMinutes: 15 },
    { id: "swim", name: "游泳", recommendationName: "轻松游泳", icon: "🏊", met: 6, defaultMinutes: 30 }
  ]);

  function getType(id) {
    return TYPES.find(type => type.id === id) || TYPES[0];
  }

  function estimateCalories(typeOrId, minutes, weight) {
    const type = typeof typeOrId === "string" ? getType(typeOrId) : typeOrId;
    return Math.max(0, Math.round(type.met * 3.5 * Math.max(30, Number(weight) || 60) / 200 * Math.max(0, Number(minutes) || 0)));
  }

  function activityLevel(minutes, steps) {
    if (minutes >= 30 || steps >= 8000) return { id: "active", label: "活动充足" };
    if (minutes >= 10 || steps >= 4000) return { id: "moderate", label: "活动一般" };
    return { id: "low", label: "活动较少" };
  }

  function recommend(input = {}) {
    const completedMinutes = Math.max(0, Number(input.activityMinutes) || 0);
    const targetMinutes = Math.max(10, Number(input.targetMinutes) || 30);
    const steps = Math.max(0, Number(input.steps) || 0);
    const level = activityLevel(completedMinutes, steps);
    const remainingMinutes = Math.max(0, Math.round(targetMinutes - completedMinutes));
    let type = getType("walk");
    let reason = "今天活动量较少，建议从低强度有氧运动开始。";

    if (completedMinutes >= targetMinutes) {
      type = getType("stretch");
      reason = "今天的运动目标已经完成，可以用轻松拉伸帮助身体恢复。";
    } else if (input.healthGoal === "muscle_gain") {
      type = getType("strength");
      reason = "你的目标是增肌，今天优先安排基础力量训练更合适。";
    } else if (level.id === "moderate" && Number(input.currentWeight) > Number(input.goalWeight)) {
      type = getType("run");
      reason = "今天已经有一些活动，目标体重仍有距离，可适量增加中等强度有氧运动。";
    } else if (Number(input.intakeCalories) > Number(input.energyTarget) && level.id !== "active") {
      type = getType("walk");
      reason = "今天摄入接近或超过目标，增加一段快走有助于改善当天的活动平衡。";
    } else if (level.id === "active") {
      type = getType("yoga");
      reason = "今天活动量已经比较充足，推荐舒缓瑜伽保持节奏。";
    }

    const minutes = Math.max(10, Math.min(type.defaultMinutes, remainingMinutes || type.defaultMinutes));
    return {
      typeId: type.id,
      name: type.recommendationName,
      icon: type.icon,
      minutes,
      calories: estimateCalories(type, minutes, input.currentWeight),
      reason,
      activityLevel: level.label,
      targetMinutes
    };
  }

  global.ExerciseRecommendationSystem = Object.freeze({ TYPES, getType, estimateCalories, activityLevel, recommend });
})(window);
