(function createRecipeRecommendationSystem(global) {
  const recipes = Object.freeze([
    { id: "greens-mushroom-beef-soup", name: "青菜口蘑牛肉汤", emoji: "🥬", calories: 320, protein: 32, carbs: 18, fat: 13, weight: 460, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "瘦牛肉搭配青菜和口蘑，清爽高蛋白", steps: ["牛肉切薄片，用少量生抽和淀粉抓匀。", "口蘑煮开后放入牛肉片。", "最后加入青菜，少量盐和胡椒调味。"] },
    { id: "tomato-shrimp-ball-noodles", name: "番茄虾滑面", emoji: "🍅", calories: 410, protein: 30, carbs: 50, fat: 10, weight: 480, goals: ["fat_loss", "maintain"], principle: "番茄汤底配虾滑和适量面条，酸甜开胃", steps: ["番茄切块炒软出汁，加清水煮开。", "挤入虾滑煮至浮起。", "加入一小份面条和青菜煮熟。"] },
    { id: "cold-oyster-mushroom", name: "凉拌手撕平菇", emoji: "🍄", calories: 180, protein: 9, carbs: 18, fat: 8, weight: 320, goals: ["fat_loss", "maintain"], principle: "菌菇高纤维，凉拌少油适合夏天", steps: ["平菇撕成条，焯水后挤干。", "加入蒜末、香菜和小米椒。", "用少量生抽、醋和香油拌匀。"] },
    { id: "cucumber-enoki-egg-salad", name: "黄瓜金针菇鸡蛋拌菜", emoji: "🥒", calories: 260, protein: 18, carbs: 20, fat: 12, weight: 380, goals: ["fat_loss", "maintain"], principle: "鸡蛋补蛋白，黄瓜和菌菇清爽饱腹", steps: ["金针菇焯熟，黄瓜拍碎。", "鸡蛋煮熟后对半切开。", "加蒜末、生抽和醋拌匀。"] },
    { id: "lemon-shrimp", name: "柠檬鲜虾", emoji: "🍋", calories: 280, protein: 30, carbs: 14, fat: 10, weight: 350, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "鲜虾高蛋白，柠檬调味清爽少油", steps: ["鲜虾煮熟后去壳去虾线。", "加入柠檬片、蒜末和香菜。", "用少量生抽、醋和辣椒拌匀冷藏。"] },
    { id: "napa-beef-pot", name: "娃娃菜牛肉煲", emoji: "🥘", calories: 350, protein: 32, carbs: 22, fat: 14, weight: 470, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "瘦牛肉搭配大量娃娃菜，家常又饱腹", steps: ["娃娃菜切段铺入锅底。", "加入清水煮软后放入腌好的牛肉片。", "牛肉变色后用少量盐和胡椒调味。"] },
    { id: "loofah-egg-tofu-soup", name: "丝瓜煎蛋豆腐汤", emoji: "🥣", calories: 290, protein: 20, carbs: 18, fat: 15, weight: 480, goals: ["fat_loss", "maintain"], principle: "丝瓜清爽，鸡蛋豆腐提供双蛋白", steps: ["鸡蛋少油煎熟后切块。", "丝瓜炒软，加清水和豆腐煮开。", "放回鸡蛋，少量盐和胡椒调味。"] },
    { id: "napa-egg-tofu-soup", name: "娃娃菜煎蛋豆腐汤", emoji: "🍲", calories: 300, protein: 21, carbs: 19, fat: 15, weight: 500, goals: ["fat_loss", "maintain"], principle: "娃娃菜、鸡蛋和豆腐组成低卡暖汤", steps: ["鸡蛋少油煎熟后盛出。", "娃娃菜加水煮软，再放入豆腐。", "加入鸡蛋煮开，少量盐调味。"] },
    { id: "lettuce-enoki-egg-salad", name: "莴笋金针菇鸡蛋拌菜", emoji: "🥗", calories: 250, protein: 17, carbs: 22, fat: 10, weight: 380, goals: ["fat_loss", "maintain"], principle: "莴笋和金针菇口感清脆，搭配鸡蛋更耐饿", steps: ["莴笋切丝，金针菇焯熟。", "鸡蛋煮熟后切块。", "加入蒜末、生抽、醋和少量辣椒拌匀。"] },
    { id: "cucumber-coriander-tofu", name: "黄瓜香菜拌豆腐", emoji: "🥒", calories: 220, protein: 18, carbs: 16, fat: 9, weight: 360, goals: ["fat_loss", "maintain"], principle: "嫩豆腐提供植物蛋白，黄瓜清爽补水", steps: ["嫩豆腐切块，用开水稍烫。", "黄瓜拍碎，香菜切段。", "加入生抽、醋和少量芝麻拌匀。"] },
    { id: "king-oyster-beef", name: "杏鲍菇炒牛肉", emoji: "🥩", calories: 370, protein: 33, carbs: 24, fat: 16, weight: 380, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "瘦牛肉配杏鲍菇，少油也有满足感", steps: ["牛肉切片并简单腌制。", "杏鲍菇切片，少油煎软。", "加入牛肉和小米椒快速炒熟。"] },
    { id: "asparagus-mushroom-shrimp", name: "芦笋口蘑炒虾仁", emoji: "🍤", calories: 300, protein: 31, carbs: 19, fat: 11, weight: 370, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "虾仁高蛋白，芦笋和口蘑增加蔬菜量", steps: ["芦笋切段焯水，口蘑切片。", "虾仁少油炒至变色。", "加入芦笋和口蘑炒熟，黑胡椒调味。"] },
    { id: "cucumber-shrimp-stirfry", name: "黄瓜炒虾仁", emoji: "🦐", calories: 270, protein: 30, carbs: 16, fat: 9, weight: 360, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "常见食材快速成菜，清淡高蛋白", steps: ["黄瓜切块，虾仁去虾线。", "虾仁少油炒至变色。", "加入黄瓜快速翻炒，少量盐调味。"] },
    { id: "radish-shiitake-stew", name: "白萝卜炖香菇", emoji: "🍄", calories: 190, protein: 8, carbs: 28, fat: 5, weight: 450, goals: ["fat_loss", "maintain"], principle: "萝卜和香菇低脂高纤维，适合作为配菜", steps: ["白萝卜切厚片，香菇泡发。", "锅中加水、萝卜和香菇炖软。", "少量生抽和葱花调味。"] },
    { id: "broccoli-mushroom-beef", name: "西兰花口蘑炒牛肉", emoji: "🥦", calories: 390, protein: 35, carbs: 25, fat: 17, weight: 400, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "瘦牛肉搭配两种蔬菜，蛋白质充足", steps: ["西兰花焯水，口蘑切片。", "牛肉片少油快速炒至变色。", "加入蔬菜翻炒熟，用黑胡椒调味。"] },
    { id: "coriander-chicken-salad", name: "香菜拌鸡丝", emoji: "🐔", calories: 290, protein: 34, carbs: 16, fat: 9, weight: 350, goals: ["fat_loss", "maintain", "muscle_gain"], principle: "鸡胸肉高蛋白，凉拌做法适合夏天", steps: ["鸡胸肉煮熟后撕成细丝。", "加入黄瓜丝、香菜和蒜末。", "用少量生抽、醋和辣椒油拌匀。"] },
    { id: "tomato-tofu-mushroom-soup", name: "番茄豆腐菌菇汤", emoji: "🍅", calories: 240, protein: 18, carbs: 22, fat: 9, weight: 500, goals: ["fat_loss", "maintain"], principle: "番茄、豆腐和菌菇组合，低卡又有蛋白质", steps: ["番茄少油炒软出汁后加水。", "水开后放入豆腐和海鲜菇。", "淋入蛋液，少量盐和黑胡椒调味。"] },
    { id: "broccoli-tofu-egg-soup", name: "西兰花豆腐鸡蛋汤", emoji: "🥦", calories: 260, protein: 20, carbs: 18, fat: 12, weight: 500, goals: ["fat_loss", "maintain"], principle: "西兰花搭配鸡蛋豆腐，营养密度高", steps: ["鸡蛋少油煎熟后切块。", "加清水煮开，放入西兰花和豆腐。", "煮至西兰花变软，盐和黑胡椒调味。"] },
    { id: "tomato-tofu-skin-egg-soup", name: "番茄豆皮蛋花汤", emoji: "🥣", calories: 310, protein: 23, carbs: 28, fat: 12, weight: 520, goals: ["fat_loss", "maintain"], principle: "豆皮与鸡蛋双蛋白，番茄汤底开胃", steps: ["蒜末炒香，加入番茄炒软出汁。", "加水煮开，放入豆皮、金针菇和木耳。", "淋入蛋液，少量盐和黑胡椒调味。"] },
    { id: "tomato-shrimp-ball-vermicelli-soup", name: "番茄虾滑粉丝汤", emoji: "🍜", calories: 380, protein: 27, carbs: 48, fat: 9, weight: 520, goals: ["fat_loss", "maintain"], principle: "虾滑补蛋白，粉丝控制份量即可作为一餐", steps: ["粉丝提前煮软后沥水。", "番茄少油炒出汁，加清水煮开。", "放入虾滑和粉丝煮熟，少量盐调味。"] },
    { id: "corn-kelp-mushroom-soup", name: "玉米海带口蘑汤", emoji: "🌽", calories: 230, protein: 9, carbs: 38, fat: 6, weight: 520, goals: ["fat_loss", "maintain"], principle: "玉米、海带和口蘑组成清淡高纤维汤", steps: ["口蘑切片，玉米切段。", "口蘑少油炒软后加入清水。", "放入玉米和海带煮熟，少量盐调味。"] },
    { id: "tomato-shrimp-konjac-soup", name: "番茄虾仁魔芋汤", emoji: "🦐", calories: 260, protein: 28, carbs: 18, fat: 9, weight: 520, goals: ["fat_loss", "maintain"], principle: "虾仁高蛋白，魔芋增加饱腹感且热量低", steps: ["虾仁少油炒至变色后盛出。", "番茄炒出汁，加清水煮开。", "放入虾仁、魔芋和蛋液煮熟。"] },
    { id: "tuna-bean-salad", name: "金枪鱼白豆沙拉", emoji: "🥗", calories: 380, protein: 32, carbs: 38, fat: 11, weight: 390, goals: ["fat_loss", "maintain"], principle: "鱼类与豆类双蛋白，搭配大量蔬菜", steps: ["水浸金枪鱼和白芸豆沥干。", "生菜、番茄、黄瓜切好。", "混合后用柠檬汁和少量橄榄油调味。"] },
    { id: "lime-fish-skewers", name: "青柠鱼肉彩蔬串", emoji: "🍢", calories: 360, protein: 35, carbs: 30, fat: 11, weight: 380, goals: ["fat_loss", "maintain"], principle: "清淡鱼肉搭配多彩蔬菜和少量主食", steps: ["鱼肉切块，用青柠汁和黑胡椒腌制。", "与彩椒、洋葱交替串好。", "烤熟后搭配小份玉米或杂粮饭。"] },
    { id: "prawn-jambalaya", name: "鲜虾番茄杂粮烩饭", emoji: "🦐", calories: 530, protein: 34, carbs: 70, fat: 12, weight: 470, goals: ["maintain", "muscle_gain"], principle: "海鲜蛋白配杂粮饭和番茄蔬菜", steps: ["洋葱、芹菜和彩椒少油炒香。", "加入番茄、杂粮饭和少量水焖煮。", "最后放入鲜虾煮熟。"] },
    { id: "chickpea-pumpkin-curry", name: "鹰嘴豆南瓜咖喱", emoji: "🫘", calories: 460, protein: 20, carbs: 68, fat: 13, weight: 460, goals: ["fat_loss", "maintain"], principle: "豆类植物蛋白搭配南瓜和多种蔬菜", steps: ["南瓜切块，洋葱切丁。", "少油炒香洋葱和咖喱粉。", "加入南瓜、鹰嘴豆和番茄焖熟。"] },
    { id: "lentil-vegetable-stew", name: "扁豆根茎蔬菜炖锅", emoji: "🥕", calories: 400, protein: 22, carbs: 60, fat: 8, weight: 500, goals: ["fat_loss", "maintain"], principle: "豆类、根茎和绿叶菜组成高纤维一餐", steps: ["扁豆提前洗净。", "胡萝卜、芹菜和番茄切块。", "全部加水炖软，最后加入菠菜。"] },
    { id: "tofu-sweet-potato-curry", name: "豆腐红薯蔬菜咖喱", emoji: "🍛", calories: 480, protein: 24, carbs: 64, fat: 14, weight: 470, goals: ["fat_loss", "maintain"], principle: "植物蛋白搭配薯类主食和蔬菜", steps: ["豆腐和红薯切块。", "洋葱少油炒香后加入咖喱粉。", "放入豆腐、红薯和西兰花焖熟。"] },
    { id: "black-bean-corn-bowl", name: "黑豆玉米糙米碗", emoji: "🌽", calories: 520, protein: 24, carbs: 78, fat: 12, weight: 470, goals: ["maintain", "muscle_gain"], principle: "豆类、全谷物与彩色蔬菜的植物餐", steps: ["黑豆煮熟，糙米饭备好。", "玉米、番茄和彩椒切好。", "全部装碗，加入少量牛油果和青柠汁。"] },
    { id: "vegetable-frittata", name: "彩蔬烘蛋", emoji: "🥚", calories: 350, protein: 26, carbs: 20, fat: 18, weight: 350, goals: ["fat_loss", "maintain"], principle: "鸡蛋搭配多种蔬菜，主食量可灵活调整", steps: ["西葫芦、番茄和蘑菇切小块。", "蔬菜炒软后倒入蛋液。", "小火加盖或放入烤箱烘至凝固。"] },
    { id: "steamed-fish-vegetables", name: "清蒸鱼配时蔬杂粮饭", emoji: "🐠", calories: 430, protein: 37, carbs: 48, fat: 10, weight: 450, goals: ["fat_loss", "maintain"], principle: "清蒸鱼、杂粮饭和两种蔬菜的均衡餐盘", steps: ["鱼肉加姜片清蒸至熟。", "准备小份杂粮饭。", "搭配两种焯熟时蔬，少量酱油调味。"] },
    { id: "celery-shrimp-brown-rice", name: "西芹虾仁糙米饭", emoji: "🍤", calories: 460, protein: 34, carbs: 55, fat: 11, weight: 430, goals: ["fat_loss", "maintain"], principle: "虾仁蛋白搭配糙米和脆嫩蔬菜", steps: ["糙米提前煮熟。", "西芹切段，虾仁去虾线。", "二者少油快炒后搭配糙米饭。"] },
    { id: "winter-melon-meatball-soup", name: "冬瓜瘦肉丸汤", emoji: "🍲", calories: 350, protein: 30, carbs: 30, fat: 12, weight: 500, goals: ["fat_loss", "maintain"], principle: "瘦肉蛋白搭配高水分蔬菜和少量主食", steps: ["瘦肉末加葱姜拌匀并搓成丸子。", "冬瓜切片后加水煮软。", "放入肉丸煮熟，搭配小份杂粮饭。"] },
    { id: "tomato-beef-oat-rice", name: "番茄牛肉燕麦饭", emoji: "🍅", calories: 550, protein: 38, carbs: 66, fat: 15, weight: 460, goals: ["maintain", "muscle_gain"], principle: "瘦牛肉搭配番茄和燕麦杂粮饭", steps: ["大米中混入少量燕麦煮成杂粮饭。", "番茄炒软后加入瘦牛肉片。", "牛肉熟透后与青菜、杂粮饭搭配。"] },
    { id: "chicken-mushroom-steam", name: "香菇蒸鸡配青菜", emoji: "🍗", calories: 420, protein: 39, carbs: 40, fat: 11, weight: 430, goals: ["fat_loss", "maintain"], principle: "蒸制瘦禽肉搭配菌菇和绿叶菜", steps: ["去皮鸡肉切块，用少量酱油腌制。", "加入香菇后蒸至熟透。", "搭配焯青菜和小份杂粮饭。"] },
    { id: "sesame-spinach-soba", name: "芝麻菠菜荞麦面", emoji: "🍜", calories: 400, protein: 20, carbs: 56, fat: 12, weight: 400, goals: ["fat_loss", "maintain"], principle: "荞麦主食搭配豆制品和绿叶菜", steps: ["荞麦面煮熟后沥水。", "菠菜焯熟，豆腐切块。", "加入少量芝麻酱、醋和清水拌匀。"] },
    { id: "chicken-corn-soup", name: "鸡丝玉米蔬菜汤", emoji: "🌽", calories: 320, protein: 29, carbs: 36, fat: 7, weight: 480, goals: ["fat_loss", "maintain"], principle: "鸡肉蛋白搭配玉米和多种蔬菜", steps: ["鸡胸肉煮熟后撕成细丝。", "玉米粒、胡萝卜和蘑菇加水煮软。", "加入鸡丝和蛋花煮熟。"] },
    { id: "pumpkin-chickpea-soup", name: "南瓜鹰嘴豆浓汤", emoji: "🥣", calories: 280, protein: 14, carbs: 44, fat: 7, weight: 430, goals: ["fat_loss", "maintain"], principle: "南瓜和豆类组成高纤维轻食", steps: ["南瓜蒸熟，鹰嘴豆煮熟。", "加入温水搅打成浓汤。", "小火加热并撒少量黑胡椒。"] },
    { id: "greek-egg-salad", name: "希腊风鸡蛋沙拉", emoji: "🥗", calories: 300, protein: 20, carbs: 22, fat: 15, weight: 360, goals: ["fat_loss", "maintain"], principle: "鸡蛋、蔬菜和少量奶酪组成清爽轻餐", steps: ["鸡蛋煮熟后切块。", "黄瓜、番茄、生菜和洋葱切好。", "加入少量奶酪、柠檬汁和橄榄油。"] },
    { id: "hummus-veggie-wrap", name: "鹰嘴豆泥蔬菜卷", emoji: "🌯", calories: 360, protein: 16, carbs: 48, fat: 12, weight: 330, goals: ["fat_loss", "maintain"], principle: "全麦饼、豆类蛋白和多种生蔬菜组合", steps: ["全麦饼薄薄涂一层鹰嘴豆泥。", "铺上生菜、黄瓜、胡萝卜和彩椒。", "卷紧后切成两段。"] },
    { id: "apple-peanut-yogurt", name: "苹果花生酱酸奶杯", emoji: "🥜", calories: 240, protein: 14, carbs: 30, fat: 8, weight: 260, goals: ["fat_loss", "maintain"], principle: "水果搭配乳制品和少量坚果酱", steps: ["苹果洗净后切成小丁。", "无糖酸奶装入杯中。", "加入苹果和一小勺无糖花生酱。"] },
    { id: "berry-chia-pudding", name: "莓果奇亚籽布丁", emoji: "🍓", calories: 260, protein: 15, carbs: 30, fat: 9, weight: 280, goals: ["fat_loss", "maintain"], principle: "无糖奶类搭配莓果和富含纤维的种子", steps: ["奇亚籽加入低脂牛奶搅匀。", "冷藏数小时至凝固。", "食用前加入草莓和蓝莓。"] },
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

  function normalizeTokens(value) {
    return [...new Set(String(value || "").toLowerCase().split(/[\s,，、;；]+/).map(token => token.trim()).filter(Boolean))];
  }

  function recipeText(recipe) {
    return [recipe.name, recipe.principle, ...recipe.steps].join(" ").toLowerCase();
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  }

  function eligibleRecipes(remainingCalories) {
    const remaining = Number(remainingCalories);
    const limit = remaining > 0 ? remaining + 60 : 220;
    const candidates = recipes.filter(recipe => recipe.calories <= limit);
    return candidates.length ? candidates : [...recipes].sort((a, b) => a.calories - b.calories).slice(0, 3);
  }

  function recommend(remainingCalories, healthGoal, count = 5) {
    const remaining = Number(remainingCalories);
    const candidates = eligibleRecipes(remaining);
    const preferred = candidates.filter(recipe => recipe.goals.includes(healthGoal));
    const others = candidates.filter(recipe => !recipe.goals.includes(healthGoal));
    return [...shuffle(preferred), ...shuffle(others)]
      .slice(0, Math.max(1, Number(count) || 5))
      .sort((left, right) => Math.abs(remaining - left.calories) - Math.abs(remaining - right.calories));
  }

  function search(query, remainingCalories, healthGoal, limit = 8) {
    const tokens = normalizeTokens(query);
    if (!tokens.length) return recommend(remainingCalories, healthGoal);
    const remaining = Number(remainingCalories);
    return recipes
      .filter(recipe => tokens.every(token => recipeText(recipe).includes(token)))
      .sort((left, right) => {
        const exactDifference = Number(right.name.toLowerCase().includes(String(query).toLowerCase())) - Number(left.name.toLowerCase().includes(String(query).toLowerCase()));
        if (exactDifference) return exactDifference;
        const goalDifference = Number(right.goals.includes(healthGoal)) - Number(left.goals.includes(healthGoal));
        if (goalDifference) return goalDifference;
        return Math.abs(remaining - left.calories) - Math.abs(remaining - right.calories);
      })
      .slice(0, Math.max(1, Number(limit) || 8));
  }

  global.RecipeRecommendationSystem = Object.freeze({ recipes, getById, recommend, search, normalizeTokens });
})(window);
