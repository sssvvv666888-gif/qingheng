(function createBMIManager(global) {
  function calculate(weightKg, heightCm) {
    const weight = Number(weightKg);
    const heightMeters = Number(heightCm) / 100;
    if (!(weight > 0) || !(heightMeters > 0)) return null;
    return Math.round(weight / (heightMeters ** 2) * 10) / 10;
  }

  function category(value) {
    const bmi = Number(value);
    if (!(bmi > 0)) return "";
    if (bmi < 18.5) return "偏低";
    if (bmi < 24) return "正常";
    return "偏高";
  }

  function getResult(weightKg, heightCm) {
    const value = calculate(weightKg, heightCm);
    return value === null ? { value: null, label: "" } : { value, label: category(value) };
  }

  global.BMIManager = Object.freeze({ calculate, category, getResult });
})(window);
