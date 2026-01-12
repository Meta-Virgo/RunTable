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
        max: 44,
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
        desc: "健身房的黄金VIP；能把KP的头按在键盘上摩擦；物理说服力极强。",
      },
      {
        max: 99,
        title: "人形高达",
        desc: "你的握手礼通常被视为“谋杀未遂”；徒手拆门是基操；能一拳打晕一头牛。",
      },
      {
        max: 9999,
        title: "一拳超人",
        desc: "你的力量已经超越了人类极限，能徒手拆高达，甚至能和旧日支配者掰手腕。",
      },
    ],
  },
  con: {
    name: "体质 (CON)",
    ranges: [
      {
        max: 44,
        title: "林黛玉",
        desc: "走两步就喘；“林黛玉倒拔垂杨柳”里倒的那个林黛玉；换季必感冒，常驻ICU。",
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
        max: 9999,
        title: "不朽之躯",
        desc: "核弹洗地你都能存活；你可能已经不是碳基生物了；只有剧情杀能带走你。",
      },
    ],
  },
  siz: {
    name: "体型 (SIZ)",
    ranges: [
      {
        max: 44,
        title: "哈比人",
        desc: "进电梯如果没人按键会被以为是鬼；经常买童装；甚至可以钻进大型犬的狗洞。",
      },
      {
        max: 64,
        title: "路人甲",
        desc: "衣服全是均码；站在人群里毫无存在感；不高不矮不胖不瘦。",
      },
      {
        max: 79,
        title: "挡风墙",
        desc: "站在那就像一堵墙；看电影坐前排会被打；给人极强的压迫感（或安全感）。",
      },
      {
        max: 99,
        title: "进击巨人",
        desc: "坐飞机经济舱对你来说是酷刑；进门必须低头；在此空间内你是绝对的庞然大物。",
      },
      {
        max: 9999,
        title: "泰坦巨兽",
        desc: "你就是哥斯拉；移动时会引发地震；普通房间对你来说就是个模型屋。",
      },
    ],
  },
  dex: {
    name: "敏捷 (DEX)",
    ranges: [
      {
        max: 44,
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
        max: 9999,
        title: "时间停止",
        desc: "你的速度快到产生残影；子弹在你眼中是静止的；甚至能跑赢死神。",
      },
    ],
  },
  app: {
    name: "外貌 (APP)",
    ranges: [
      {
        max: 44,
        title: "有趣的灵魂",
        desc: "长得比较抽象；可能有点“防身”；主要是靠才华或性格活着。",
      },
      {
        max: 59,
        title: "大众脸",
        desc: "扔进人堆里瞬间隐身；去相亲会被评价为“老实人”；看过就忘。",
      },
      {
        max: 79,
        title: "现充",
        desc: "食堂阿姨打菜手都不抖了；经常被发好人卡的备胎之王；很容易问到路。",
      },
      {
        max: 99,
        title: "魅魔/天神",
        desc: "只要抛个媚眼，邪教徒都想改邪归正；明明可以靠脸吃饭，偏要来跑团。",
      },
      {
        max: 9999,
        title: "不可名状",
        desc: "凡人直视你会掉 SAN；你的美（或丑）已经超越了维度的限制；由于过于惊世骇俗，无法用语言描述。",
      },
    ],
  },
  int: {
    name: "智力 (INT)",
    ranges: [
      {
        max: 44,
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
        max: 9999,
        title: "全知全能",
        desc: "你看透了宇宙的真理；凡人的智慧在你面前如同蝼蚁；也许你就是下一个奈亚拉托提普。",
      },
    ],
  },
  pow: {
    name: "意志 (POW)",
    ranges: [
      {
        max: 44,
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
        max: 9999,
        title: "神格化",
        desc: "你的意志能扭曲现实；克苏鲁看到你都要做个 SAN Check；你就是规则本身。",
      },
    ],
  },
  edu: {
    name: "教育 (EDU)",
    ranges: [
      {
        max: 44,
        title: "网瘾少年",
        desc: "你的知识储备主要来自短视频和营销号；文盲或小学学历；实战派。",
      },
      {
        max: 59,
        title: "义务教育",
        desc: "也就是九年义务教育的漏网之鱼；该懂的都懂，不该懂的完全不懂。",
      },
      {
        max: 79,
        title: "知识分子",
        desc: "说话总喜欢拽专业名词；遇到问题第一反应是查论文；戴眼镜的概率很高。",
      },
      {
        max: 99,
        title: "权威秃头",
        desc: "头发稀疏，这是强者的证明；你在该领域说话就是真理；行走的图书馆。",
      },
      {
        max: 9999,
        title: "阿卡西记录",
        desc: "你知晓过去未来的一切知识；真理之门为你敞开；由于知道得太多，你可能有些疯癫。",
      },
    ],
  },
  luck: {
    name: "幸运 (LUCK)",
    ranges: [
      {
        max: 44,
        title: "倒霉蛋",
        desc: "喝凉水都塞牙；出门必踩狗屎；骰子女神的弃子。",
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
        desc: "世界围着你转；想要什么来什么；骰子女神的亲儿子。",
      },
      {
        max: 9999,
        title: "因果律武器",
        desc: "你想要的结果就是必然；世界意志为你让路；幸运女神可能是你亲戚。",
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
        className
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
                  isOverflow && "drop-shadow-[0_0_4px_rgba(244,114,182,0.8)]"
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
              isGodMode ? "text-amber-200/60" : "text-slate-500"
            )}
          >
            我猜你是...
          </span>
          <span
            className={cn(
              "text-5xl font-black tracking-tighter transition-colors duration-300 leading-none mb-3",
              isGodMode
                ? "text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                : "text-white"
            )}
          >
            {activeDesc.title}
          </span>

          <div className="flex items-center gap-3 mb-4 opacity-80">
            <span
              className={cn(
                "text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-300",
                isGodMode ? "text-amber-300" : "text-slate-500"
              )}
            >
              {activeDescData?.name || activeAttrKey.toUpperCase()}
            </span>
            <div
              className={cn(
                "h-px w-8 transition-colors duration-300",
                isGodMode ? "bg-amber-500/50" : "bg-slate-700"
              )}
            />
            <span
              className={cn(
                "font-mono text-lg transition-colors duration-300",
                isGodMode
                  ? "text-amber-400 font-bold"
                  : "text-indigo-400 font-medium"
              )}
            >
              {activeAttrValue}
            </span>
          </div>

          <p
            className={cn(
              "text-sm leading-relaxed font-light transition-colors duration-300 max-w-md",
              isGodMode ? "text-amber-100/80" : "text-slate-400"
            )}
          >
            {activeDesc.desc}
          </p>
        </div>
      </div>
    </div>
  );
};
