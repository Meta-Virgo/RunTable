/**
 * 计算角色的伤害加值 (DB) 和体格 (Build)
 * 基于 CoC 7版规则书
 * 
 * 公式: STR + SIZ
 * 2 – 64: -2 (Build -2)
 * 65 – 84: -1 (Build -1)
 * 85 – 124: 0 (Build 0)
 * 125 – 164: +1D4 (Build 1)
 * 165 – 204: +1D6 (Build 2)
 * 205 – 284: +2D6 (Build 3)
 * 285 及以上: 每增加+80，DB增加+1D6，Build增加+1
 */
export function calculateDBAndBuild(str: number, siz: number): { db: string; build: number } {
  const total = str + siz;

  if (total < 65) return { db: "-2", build: -2 };
  if (total < 85) return { db: "-1", build: -1 };
  if (total < 125) return { db: "0", build: 0 };
  if (total < 165) return { db: "+1D4", build: 1 };
  if (total < 205) return { db: "+1D6", build: 2 };
  
  // 205 及以上
  // 205-284: +2D6, Build 3
  // 285-364: +3D6, Build 4
  // ...
  // 计算基于 205 的增量
  // 实际上公式可以是：对于 >= 205，基础是 2D6 (Build 3)
  // 增量步数 = floor((total - 205) / 80)
  // 如果 total = 205, steps = 0 -> 2D6
  // 如果 total = 284, steps = 0 -> 2D6
  // 如果 total = 285, steps = 1 -> 3D6
  
  const steps = Math.floor((total - 205) / 80);
  const diceCount = 2 + steps;
  
  return { 
    db: `+${diceCount}D6`, 
    build: 3 + steps 
  };
}
