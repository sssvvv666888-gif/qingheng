(function createAIFoodRecognition(global) {
  function recognize() {
    return {
      foods: ["米饭", "鸡蛋", "青菜"],
      name: "米饭、鸡蛋、青菜",
      calories: 520,
      protein: 25,
      carbs: 60,
      fat: 15,
      weight: 420,
      confidence: 86,
      simulated: true
    };
  }

  global.AIFoodRecognition = Object.freeze({ recognize });
})(window);
