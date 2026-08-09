(function createRecipeRecommendationSystem(global) {
  const recipes = Object.freeze([
    { id: "chicken-set", name: "香煎鸡胸肉套餐", emoji: "🍗", calories: 520, protein: 45, carbs: 50, fat: 12, weight: 430, goals: ["fat_loss", "muscle_gain"], principle: "优质蛋白＋全谷物＋两种蔬菜", steps: ["鸡胸肉用少量盐和黑胡椒腌制。", "平底锅少油煎熟鸡胸肉。", "搭配糙米和两种焯熟蔬菜装盘。"] },
    { id: "beef-rice", name: "彩椒牛肉糙米饭", emoji: "🍛", calories: 650, protein: 38, carbs: 76, fat: 18, weight: 480, goals: ["muscle_gain"], principle: "瘦肉蛋白＋全谷物＋彩色蔬菜", steps: ["瘦牛肉切片并简单腌制。", "彩椒、洋葱与牛肉少油快炒。", "配糙米饭和绿叶菜一起食用。"] },
    { id: "healthy-bento", name: "轻松熊均衡便当", emoji: "🍱", calories: 560, protein: 34, carbs: 62, fat: 15, weight: 460, goals: ["maintain"], principle: "半盘蔬菜＋四分之一主食＋四分之一蛋白", steps: ["准备杂粮饭作为主食。", "煮熟鸡蛋并准备少油瘦肉。", "加入两种不同颜色的蔬菜装入便当盒。"] },
    { id: "salmon-bowl", name: "三文鱼杂粮碗", emoji: "🐟", calories: 610, protein: 40, carbs: 58, fat: 20, weight: 440, goals: ["maintain", "muscle_gain"], principle: "鱼类蛋白＋杂粮＋丰富蔬菜", steps: ["三文鱼少油煎熟。", "杂粮饭与时蔬铺入碗中。", "放上三文鱼并挤少量柠檬汁。"] },
    { id: "yogurt-cup", name: "草莓燕麦酸奶杯", emoji: "🍓", calories: 280, protein: 18, carbs: 36, fat: 6, weight: 300, goals: ["fat_loss", "maintain"], principle: "无糖奶类＋水果＋全谷物", steps: ["杯底放入无糖酸奶。", "加入新鲜草莓和原味燕麦。", "撒一小份无盐坚果碎即可。"] },
    { id: "low-fat-salad", name: "鸡肉鹰嘴豆沙拉", emoji: "🥗", calories: 300, protein: 28, carbs: 28, fat: 8, weight: 360, goals: ["fat_loss"], principle: "蔬菜＋禽肉＋豆类双蛋白", steps: ["生菜、番茄和黄瓜洗净切好。", "加入熟鸡胸肉和鹰嘴豆。", "用柠檬汁和少量橄榄油拌匀。"] },
    { id: "tofu-bowl", name: "豆腐菌菇杂粮碗", emoji: "🥣", calories: 360, protein: 22, carbs: 48, fat: 10, weight: 420, goals: ["fat_loss", "maintain"], principle: "植物蛋白＋全谷物＋菌菇蔬菜", steps: ["豆腐切块并少油煎至微黄。", "菌菇和青菜快速翻炒。", "与杂粮饭组合，少量酱油调味。"] },
    { id: "lentil-soup", name: "番茄扁豆蔬菜汤", emoji: "🍲", calories: 190, protein: 12, carbs: 30, fat: 4, weight: 400, goals: ["fat_loss", "maintain"], principle: "豆类蛋白＋多样蔬菜＋低能量密度", steps: ["番茄切块煮出汤底。", "加入煮熟的扁豆、蘑菇和胡萝卜。", "放入绿叶菜煮熟并少量盐调味。"] }
  ]);

  function getById(id) {
    return recipes.find(recipe => recipe.id === id) || null;
  }

  function recommend(remainingCalories, healthGoal) {
    const remaining = Number(remainingCalories);
    const limit = remaining > 0 ? remaining + 60 : 220;
    const candidates = recipes.filter(recipe => recipe.calories <= limit);
    const pool = candidates.length ? candidates : [...recipes].sort((a, b) => a.calories - b.calories).slice(0, 3);
    return [...pool]
      .sort((left, right) => {
        const goalDifference = Number(right.goals.includes(healthGoal)) - Number(left.goals.includes(healthGoal));
        if (goalDifference) return goalDifference;
        return Math.abs(remaining - left.calories) - Math.abs(remaining - right.calories);
      })
      .slice(0, 4);
  }

  global.RecipeRecommendationSystem = Object.freeze({ recipes, getById, recommend });
})(window);
