import React, { useState, useMemo } from "react";
import { Character } from "../types";
import { cn } from "./UI";

interface AttributeRadarProps {
  character: Character;
  className?: string;
}

const ATTR_KEYS = [
  "str",
  "con",
  "siz",
  "dex",
  "app",
  "int",
  "pow",
  "edu",
  "luck",
] as const;

const ATTR_LABELS: Record<string, string> = {
  str: "力量",
  con: "体质",
  siz: "体型",
  dex: "敏捷",
  app: "外貌",
  int: "智力",
  pow: "意志",
  edu: "教育",
  luck: "幸运",
};

const ATTR_DESCRIPTIONS: Record<
  string,
  { name: string; ranges: { max: number; title: string; desc: string }[] }
> = {
  str: {
    name: "力量 (STR)",
    ranges: [
      {
        max: 19,
        title: "没有力量",
        desc: "偶遇村口大鹅，拼尽全力无法战胜；被子盖厚了会被压得喘不过气；活着就是生命的奇迹。",
      },
      {
        max: 39,
        title: "战五渣",
        desc: "连矿泉水瓶盖都拧不开；最大的运动量是拿外卖；通常是队伍里被保护的吉祥物。",
      },
      {
        max: 59,
        title: "普通人",
        desc: "超市打折能抢到两袋米回家；搬家时能帮忙搭把手；但遇到僵尸建议先跑。",
      },
      {
        max: 79,
        title: "猛男/女",
        desc: "健身房黄金VIP；能把KP的头按在键盘上摩擦；物理说服力极强。",
      },
      {
        max: 99,
        title: "人形高达",
        desc: "你的握手礼通常被视为“谋杀未遂”；徒手拆门是基操；能一拳打晕一头牛。",
      },
      {
        max: 199,
        title: "美队体质",
        desc: "你可以徒手拉停直升机；普通的手铐对你来说就像纸糊的；人体限制器已解除。",
      },
      {
        max: 299,
        title: "血肉飞升",
        desc: "你可以把轿车当棒球扔；水泥墙对你来说像威化饼干；普通的物理束缚已经失去意义。",
      },
      {
        max: 599,
        title: "移山填海",
        desc: "举手投足间引发小型地震；你的肌肉纤维比钻石还硬；这是纯粹的暴力美学。",
      },
      {
        max: 999,
        title: "狮子将/上校",
        desc: "身动如山移，出手如压顶。“用力气掌控他人。用力量掌控自我。”",
      },
    ],
  },
  con: {
    name: "体质 (CON)",
    ranges: [
      {
        max: 19,
        title: "玻璃纸",
        desc: "ICU是你第二个家；呼吸稍微用力会骨折；风吹人倒，真正的二次元纸片人。",
      },
      {
        max: 39,
        title: "林黛玉",
        desc: "走两步就喘；“林黛玉垂杨柳倒拔”里倒的那个林黛玉；换季必感冒，板蓝根单推人。",
      },
      {
        max: 59,
        title: "社畜体格",
        desc: "熬夜修仙第二天还能爬起来上班；偶尔头疼脑热；普通的亚健康状态。",
      },
      {
        max: 79,
        title: "硬骨头",
        desc: "冬泳怪鸽，奥利给！大雨里狂奔三公里也不带喘气的；伤口愈合速度惊人。",
      },
      {
        max: 99,
        title: "生化人",
        desc: "喝了恒河水也就是拉个肚子而已；把毒药当饮料喝；很难死，除非剧情杀。",
      },
      {
        max: 199,
        title: "星际战士",
        desc: "你可能拥有两颗心脏；断肢对你来说只是轻伤；可以在充满毒气的环境中谈笑风生。",
      },
      {
        max: 299,
        title: "巨魔血统",
        desc: "断肢重生只是时间问题；在真空环境中也能存活片刻；你甚至可以代谢核废料。",
      },
      {
        max: 599,
        title: "行星级生命",
        desc: "岩浆是你的洗澡水；可以在地核边缘漫步；唯有恒星熄灭能让你感到一丝凉意。",
      },
      {
        max: 999,
        title: "不朽之躯",
        desc: "岁月无法在你身上刻下痕迹，死亡亦无法触及你的衣角。“存在即是永恒。”",
      },
    ],
  },
  siz: {
    name: "体型 (SIZ)",
    ranges: [
      {
        max: 19,
        title: "掌中宝",
        desc: "哈基米把你当成猎物；可以骑在柯基背上冲锋；捉迷藏的神。",
      },
      {
        max: 39,
        title: "哈比人",
        desc: "进电梯如果没人按键会被以为是鬼；经常买童装；可以钻进大型犬的狗洞。",
      },
      {
        max: 59,
        title: "路人甲",
        desc: "衣服全是均码；不高不矮不胖不瘦；淹没人潮不知所措。",
      },
      {
        max: 79,
        title: "挡风墙",
        desc: "站在那就像一堵墙；看电影坐前排会被蛐蛐；给人极强的压迫感（或安全感）。",
      },
      {
        max: 99,
        title: "进击巨人",
        desc: "坐飞机经济舱对你来说是酷刑；进门必须低头；在此空间内你是绝对的庞然大物。",
      },
      {
        max: 199,
        title: "动力装甲",
        desc: "过木桥前得先算承重；你就是行走的掩体；普通的房屋对你而言已经开始显得拥挤。",
      },
      {
        max: 299,
        title: "陆地巡洋舰",
        desc: "由于自重过大，你每走一步都在破坏路面；你需要专门定制的工业级载具；你是行走的交通事故。",
      },
      {
        max: 599,
        title: "深海巨兽",
        desc: "重力规则在你身上开始崩坏；你可以把航母当冲浪板；人类的都市对你而言只是积木玩具。",
      },
      {
        max: 999,
        title: "世界之蛇",
        desc: "首尾相连，环绕尘世。“你的阴影覆盖大陆，你的翻身即是地壳变动。”",
      },
    ],
  },
  dex: {
    name: "敏捷 (DEX)",
    ranges: [
      {
        max: 19,
        title: "Ping 999",
        desc: "珠颈斑鸠好朋友；走路像是还在晕船；大脑下达指令，四肢连接超时。",
      },
      {
        max: 39,
        title: "手残党",
        desc: "走路经常左脚绊右脚；拿什么碎什么；潜行必定踢翻铁桶。",
      },
      {
        max: 59,
        title: "还凑合",
        desc: "扔垃圾能准确扔进垃圾桶；赶公交车通常能追上；偶尔手滑。",
      },
      {
        max: 79,
        title: "跑酷高手",
        desc: "以前练过杂技吧？能在大妈们的抢购潮中全身而退；手指灵活适合“借”东西。",
      },
      {
        max: 99,
        title: "黑客帝国",
        desc: "只要你不想，雨点都打不到你身上；能在钢丝上跳踢踏舞；物理闪避点满。",
      },
      {
        max: 199,
        title: "快银",
        desc: "你能徒手接住箭矢；在别人眨眼的一瞬间，你已经给自己泡好了咖啡。",
      },
      {
        max: 299,
        title: "瞬身止水",
        desc: "肉眼无法捕捉你的移动；你可以踩着空气奔跑；在水面上行走如履平地。",
      },
      {
        max: 599,
        title: "光速行者",
        desc: "相对论对你开始失效；你可以在过去与未来之间反复横跳；静止的时间是你唯一的束缚。",
      },
      {
        max: 999,
        title: "无处不在",
        desc: "没有移动，因为你已在终点。“你是风，是光，是无处不在的幽灵。”",
      },
    ],
  },
  app: {
    name: "外貌 (APP)",
    ranges: [
      {
        max: 19,
        title: "San值检测机",
        desc: "一种跨物种的潦草；克苏鲁为你爆灯；深潜者看到你第一时间选择报警。",
      },
      {
        max: 39,
        title: "有趣的灵魂",
        desc: "长得比较抽象；可能有点“防身”；主要是靠才华或性格活着。",
      },
      {
        max: 59,
        title: "大众脸",
        desc: "扔进人堆里瞬间隐身；去相亲会被评价为“老实人”；见过就忘。",
      },
      {
        max: 79,
        title: "现充",
        desc: "食堂阿姨打菜手都不抖了；经常发好人卡的备胎之王；很容易问到路。",
      },
      {
        max: 99,
        title: "魅魔",
        desc: "只要抛个媚眼，邪教徒都想改邪归正；明明可以靠脸吃饭，偏要来跑团。",
      },
      {
        max: 199,
        title: "富江",
        desc: "爱意会扭曲成疯狂；很多人为了得到你的一根头发一掷千金；你是行走的多巴胺。",
      },
      {
        max: 299,
        title: "倾国倾城",
        desc: "你的容貌能引发战争；种族隔阂在你面前不复存在；这已经是一种无需言语的精神控制。",
      },
      {
        max: 599,
        title: "不可名状之美",
        desc: "凡人直视你会因为大脑无法处理这种美而过载；你超越了性别的定义，是艺术的终极形态。",
      },
      {
        max: 999,
        title: "伐诃",
        desc: "你早于“美”的概念诞生。你在直立猿存在前就受崇拜，到他们化为灰烬后依然如此。",
      },
    ],
  },
  int: {
    name: "智力 (INT)",
    ranges: [
      {
        max: 19,
        title: "草履虫",
        desc: "基本依靠脊髓反射生活；不要试图思考，会过载；大概能分清石头和食物的区别。",
      },
      {
        max: 39,
        title: "光滑大脑",
        desc: "大脑光滑得像刚剥壳的鸡蛋；经常问“我是谁我在哪”；容易被队友忽悠去当诱饵。",
      },
      {
        max: 59,
        title: "及格万岁",
        desc: "也就是及格水平；能看懂大部分说明书；偶尔会犯迷糊。",
      },
      {
        max: 79,
        title: "机灵鬼",
        desc: "逻辑严密；总能发现老板画的大饼里的漏洞；擅长阴阳怪气和解谜。",
      },
      {
        max: 99,
        title: "人形外挂",
        desc: "行走的百科全书；KP最想撕的卡；看一眼就能预判剧情走向。",
      },
      {
        max: 199,
        title: "拉普拉斯妖",
        desc: "你下棋能算到这一局结束；任何谎言在你面前都漏洞百出；凡人的智慧对你来说太吵闹了。",
      },
      {
        max: 299,
        title: "超级计算机",
        desc: "多线程处理是你生活的常态；你可以同时模拟一千种未来；情感对你来说只是可计算的变量。",
      },
      {
        max: 599,
        title: "蜂巢意识",
        desc: "你的思维触角延伸至星辰大海；单一的个体智慧已无法衡量你；你就是文明本身。",
      },
      {
        max: 999,
        title: "全知全能",
        desc: "这份令人发寒的沉静正是笃定带来的沉静。“你看见了起点，亦知晓终焉。思考已无必要，因为答案早已存在。”",
      },
    ],
  },
  pow: {
    name: "意志 (POW)",
    ranges: [
      {
        max: 19,
        title: "风滚草",
        desc: "没有任何主见，墙头草随风倒；活着全靠队友拖着；被瞪一眼就会吓晕。",
      },
      {
        max: 39,
        title: "玻璃心",
        desc: "看到蟑螂都会San值狂掉；睡觉必须开灯；恐怖片第一分钟就晕过去的角色。",
      },
      {
        max: 59,
        title: "普通心脏",
        desc: "会怕但能动；一般的社畜心理素质；面对离谱的事情能勉强接受。",
      },
      {
        max: 79,
        title: "大心脏",
        desc: "泰山崩于前而先自拍一张；很难被洗脑；团队里的精神定海神针。",
      },
      {
        max: 99,
        title: "钢铁神经",
        desc: "也就是敢跟克苏鲁对视两眼吧；神话生物在你眼里可能只是“长得丑点的野生动物”。",
      },
      {
        max: 199,
        title: "霸王色",
        desc: "你的气场能让弱者下意识下跪；灵体不敢靠近你三尺之内；你不需要魔法，你的意志就是魔法。",
      },
      {
        max: 299,
        title: "现实扭曲",
        desc: "你的意志强到可以干涉物质界；“我觉得这不科学”成为了物理法则失效的理由；精神控制对你无效。",
      },
      {
        max: 599,
        title: "神之领域",
        desc: "你的梦境可以覆盖现实；凡人的疯狂只是你的余兴节目；直视神明？不，是神明不敢直视你。",
      },
      {
        max: 999,
        title: "绝对规则",
        desc: "你已成为运行世界的底层逻辑。“心胜于物，意志即是法理。你说要有光，于是便有了光。”",
      },
    ],
  },
  edu: {
    name: "教育 (EDU)",
    ranges: [
      {
        max: 19,
        title: "野生儿",
        desc: "知识主要来自生存本能；字可能认不全；但知道哪种虫子的蛋白质是牛肉的五倍。",
      },
      {
        max: 39,
        title: "网瘾少年",
        desc: "知识储备来自短视频和营销号；容易被伪科学误导；典型的“实战经验丰富”。",
      },
      {
        max: 59,
        title: "义务教育",
        desc: "接受过正统的九年义务教育；能理解基础科学逻辑；偶尔会被高深的论文绕晕。",
      },
      {
        max: 79,
        title: "知识分子",
        desc: "说话总喜欢拽专业名词；遇到问题第一反应是查论文；团队里的移动搜索引擎。",
      },
      {
        max: 99,
        title: "权威秃头",
        desc: "头发稀疏是强者的证明；你在该领域说话就是真理；人类现有知识体系的巅峰。",
      },
      {
        max: 199,
        title: "缸中之脑",
        desc: "你掌握了大量早已失传的禁忌语言；诺贝尔奖对你而言只是幼儿园奖状；“头脑好似玻璃，记忆好似光。”",
      },
      {
        max: 299,
        title: "亚历山大图书馆",
        desc: "你通晓人类文明从诞生至今的所有细节；思考速度已直连互联网。",
      },
      {
        max: 599,
        title: "伊斯伟大种族",
        desc: "你游历过时间的尽头；知晓宇宙的真实历史；所有的秘密对你来说都是公开的档案。",
      },
      {
        max: 999,
        title: "阿卡西记录",
        desc: "真理之门为你敞开。“过往皆为序章，全宇宙的知识在此汇流。”",
      },
    ],
  },
  luck: {
    name: "幸运 (LUCK)",
    ranges: [
      {
        max: 19,
        title: "死神来了",
        desc: "不要出门，不要喝水，不要呼吸；你的存在就是一场连续的意外事故。",
      },
      {
        max: 39,
        title: "倒霉蛋",
        desc: "喝凉水都塞牙；出门必踩狗屎；上辈子得罪了骰子女神。",
      },
      {
        max: 59,
        title: "普通运",
        desc: "平时不中奖，坏事也不多；平平淡淡才是真。",
      },
      {
        max: 79,
        title: "欧皇",
        desc: "游戏抽卡从不保底；蒙题全对；总能化险为夷。",
      },
      {
        max: 99,
        title: "天选之子",
        desc: "世界围着你转；想要什么来什么；骰娘亲儿子。",
      },
      {
        max: 199,
        title: "多米诺骨牌",
        desc: "你随手扔个香蕉皮，最后会导致邪神召唤仪式失败；你的无心之举是蝴蝶效应的起点。",
      },
      {
        max: 299,
        title: "概率操纵者",
        desc: "即便只有0.01%的成功率对你来说也是100%；子弹会自动绕开你；你可以随手改写薛定谔的猫的状态。",
      },
      {
        max: 599,
        title: "命运编织者",
        desc: "巧合是你手中的丝线；你可以随意安排他人的命运走向；幸运女神为你服务。",
      },
      {
        max: 999,
        title: "因果律武器",
        desc: "想要的结果即是必然。“波尔，上帝不掷骰子”",
      },
    ],
  },
};

export const AttributeRadar: React.FC<AttributeRadarProps> = ({
  character,
  className,
}) => {
  const [selectedAttr, setSelectedAttr] = useState<string | null>(null);

  const values = useMemo(() => {
    return ATTR_KEYS.map((key) => ({
      key,
      value: (character[key as keyof Character] as number) || 0,
    }));
  }, [character]);

  const size = 200;
  const center = size / 2;
  const radius = size * 0.4;
  const angleStep = (Math.PI * 2) / 9;

  const getPoint = (value: number, index: number, maxVal = 80) => {
    const angle = index * angleStep - Math.PI / 2;
    // Allow value to exceed maxVal for overflow effect
    const r = (value / maxVal) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const polyPoints = values
    .map((v, i) => {
      const p = getPoint(v.value, i);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  // Rings for 20, 40, 60, 80
  const bgPolygons = [0.25, 0.5, 0.75, 1].map((scale) => {
    return {
      scale,
      points: Array.from({ length: 9 })
        .map((_, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const r = radius * scale;
          return `${center + r * Math.cos(angle)},${
            center + r * Math.sin(angle)
          }`;
        })
        .join(" "),
    };
  });

  const activeAttrKey = selectedAttr || "str";
  const activeAttrValue =
    (character[activeAttrKey as keyof Character] as number) || 0;
  const activeDescData = ATTR_DESCRIPTIONS[activeAttrKey];
  const activeDesc = activeDescData
    ? activeDescData.ranges.find((r) => activeAttrValue <= r.max) ||
      activeDescData.ranges[activeDescData.ranges.length - 1]
    : { title: "未知", desc: "暂无描述" };

  const isGodMode = activeAttrValue > 99;

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row gap-4 items-center md:items-start",
        className,
      )}
    >
      <div className="relative shrink-0">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Webs */}
          {bgPolygons.map(({ points, scale }, i) => (
            <polygon
              key={i}
              points={points}
              fill={scale === 1 ? "rgba(99, 102, 241, 0.03)" : "none"}
              stroke={scale === 1 ? "#818cf8" : "#ffffff"}
              strokeOpacity={scale === 1 ? 0.5 : 0.05}
              strokeWidth={scale === 1 ? 1 : 0.5}
              strokeDasharray={scale === 1 ? "none" : "4 2"}
            />
          ))}

          {/* Axes */}
          {Array.from({ length: 9 }).map((_, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#ffffff"
                strokeOpacity={0.05}
                strokeWidth={0.5}
              />
            );
          })}

          {/* Labels */}
          {ATTR_KEYS.map((key, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const labelRadius = radius + 20;
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            const isOverflow =
              (character[key as keyof Character] as number) > 80;

            return (
              <text
                key={key}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={
                  selectedAttr === key
                    ? "#818cf8"
                    : isOverflow
                      ? "#f472b6"
                      : "#64748b"
                }
                fontSize={selectedAttr === key ? 12 : 10}
                fontWeight={
                  selectedAttr === key || isOverflow ? "bold" : "normal"
                }
                className="uppercase transition-colors duration-200 cursor-pointer select-none hover:text-indigo-400 pointer-events-none"
              >
                {ATTR_LABELS[key]}
              </text>
            );
          })}

          {/* Data Polygon */}
          <polygon
            points={polyPoints}
            fill="rgba(99, 102, 241, 0.2)"
            stroke="#6366f1"
            strokeWidth={2}
            className="drop-shadow-[0_0_8px_rgba(99,102,241,0.5)] pointer-events-none"
          />

          {/* Data Points */}
          {values.map((v, i) => {
            const p = getPoint(v.value, i);
            const isOverflow = v.value > 80;
            return (
              <circle
                key={v.key}
                cx={p.x}
                cy={p.y}
                r={selectedAttr === v.key ? 6 : isOverflow ? 4 : 3}
                fill={
                  selectedAttr === v.key
                    ? "#818cf8"
                    : isOverflow
                      ? "#f472b6"
                      : "#6366f1"
                }
                stroke={isOverflow ? "#fff" : "none"}
                strokeWidth={isOverflow ? 1.5 : 0}
                className={cn(
                  "transition-all duration-200 cursor-pointer hover:r-6 hover:fill-indigo-300 pointer-events-none",
                  isOverflow && "drop-shadow-[0_0_4px_rgba(244,114,182,0.8)]",
                )}
              />
            );
          })}

          {/* Interactive Sectors (Invisible but clickable) */}
          {Array.from({ length: 9 }).map((_, i) => {
            const startAngle = (i - 0.5) * angleStep - Math.PI / 2;
            const endAngle = (i + 0.5) * angleStep - Math.PI / 2;

            // Calculate wedge points
            // Start point on circle
            const x1 = center + radius * 1.2 * Math.cos(startAngle);
            const y1 = center + radius * 1.2 * Math.sin(startAngle);
            // End point on circle
            const x2 = center + radius * 1.2 * Math.cos(endAngle);
            const y2 = center + radius * 1.2 * Math.sin(endAngle);

            const wedgePath = `M ${center} ${center} L ${x1} ${y1} A ${
              radius * 1.2
            } ${radius * 1.2} 0 0 1 ${x2} ${y2} Z`;

            return (
              <path
                key={`sector-${i}`}
                d={wedgePath}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setSelectedAttr(ATTR_KEYS[i])}
              />
            );
          })}
        </svg>
      </div>

      <div className="flex-1 w-full md:w-auto h-full min-h-[160px] flex flex-col justify-center animate-fade-in pl-2 md:pl-6">
        <div className="flex flex-col">
          <span
            className={cn(
              "text-xs font-medium tracking-widest mb-1 transition-colors duration-300",
              isGodMode ? "text-amber-200/60" : "text-slate-500",
            )}
          >
            我猜你是...
          </span>
          <span
            className={cn(
              "text-4xl font-black tracking-tighter transition-colors duration-300 leading-none mb-3 whitespace-nowrap",
              isGodMode
                ? "text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                : "text-white",
            )}
          >
            {activeDesc.title}
          </span>

          <div className="flex items-center gap-3 mb-4 opacity-80">
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-300",
                isGodMode ? "text-amber-300" : "text-slate-500",
              )}
            >
              {activeDescData?.name || activeAttrKey.toUpperCase()}
            </span>
            <div
              className={cn(
                "h-px w-8 transition-colors duration-300",
                isGodMode ? "bg-amber-500/50" : "bg-slate-700",
              )}
            />
            <span
              className={cn(
                "font-mono text-lg transition-colors duration-300",
                isGodMode
                  ? "text-amber-400 font-bold"
                  : "text-indigo-400 font-medium",
              )}
            >
              {activeAttrValue}
            </span>
          </div>

          <p
            className={cn(
              "text-sm leading-relaxed font-light transition-colors duration-300 max-w-md",
              isGodMode ? "text-amber-100/80" : "text-slate-400",
            )}
          >
            {activeDesc.desc}
          </p>
        </div>
      </div>
    </div>
  );
};
