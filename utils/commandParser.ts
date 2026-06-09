export type StatChange = {
  stat: string;
  type: "=" | "+" | "-";
  value: number;
};

export type CocRuleCommandPayload =
  | {
      rule: "growth";
      skill: string;
      currentValue: number;
      roll: number;
    }
  | {
      rule: "bonus_penalty";
      mode: "bonus" | "penalty";
      tensRolls: number[];
      onesRoll: number;
    }
  | {
      rule: "opposed";
      challenger: { name: string; target: number; roll: number };
      defender: { name: string; target: number; roll: number };
    };

export type DiceCommand =
  | {
      type: "roll" | "roll_hidden";
      payload: {
        expression: string;
        reason: string;
      };
      original?: string;
    }
  | {
      type: "check";
      payload:
        | { targetExpression: string; skill?: never; modifier?: never }
        | { skill: string; modifier?: string; targetExpression?: never };
      original?: string;
    }
  | {
      type: "sanity";
      payload: {
        success: string;
        failure: string;
        value?: number;
      };
      original?: string;
    }
  | { type: "set"; payload: StatChange[]; original?: string }
  | { type: "coc_rule"; payload: CocRuleCommandPayload; original?: string }
  | { type: "help"; original?: string }
  | { type: "error"; payload: string; original?: string };

export const parseDiceCommand = (input: string): DiceCommand | null => {
  if (!input.startsWith('.') && !input.startsWith('。')) return null;

  const cleanInput = input.substring(1).trim();
  const args = cleanInput.split(/\s+/);
  const cmd = args[0].toLowerCase();

  // .help
  if (cmd === 'help' || cmd === 'h') {
    return { type: 'help' };
  }

  // .r / .rh (Roll)
  if (cmd === 'r' || cmd === 'rh') {
    const isHidden = cmd === 'rh';
    // .r 1d100 reason
    // .r reason (default 1d100)
    // .r 3d6+str
    
    let expression = '1d100';
    let reason = '';
    
    if (args.length > 1) {
      const firstArg = args[1];
      // Heuristic: If arg contains digits, it's likely an expression
      if (/\d/.test(firstArg)) {
        expression = firstArg;
        reason = args.slice(2).join(' ');
      } else {
        reason = args.slice(1).join(' ');
      }
    }

    return {
      type: isHidden ? 'roll_hidden' : 'roll',
      payload: {
        expression,
        reason: reason.trim()
      }
    };
  }

  // .ra (Roll Attribute / Skill Check)
  // .ra 侦查 [target]
  // .ra 力量 +3d6
  // .ra 3d6+力量
  if (cmd === 'ra') {
    if (args.length < 2) return { type: 'error', payload: '请输入技能名，例如: .ra 侦查' };
    
    // Reconstruct params from args to be safe (preserve spaces if needed)
    const params = args.slice(1).join(' '); 
    
    // Case 1: Starts with digit -> Expression Target (e.g. .ra 3d6+力量)
    if (/^[\d]/.test(params)) {
        return {
            type: 'check',
            payload: {
                targetExpression: params
            }
        };
    } 
    
    // Case 2: Skill + Optional Modifier
    // Regex to capture skill name (starts with word char) and remainder
    // e.g. "力量 +10" -> Skill="力量", Mod="+10"
    // e.g. "力量+10" -> Skill="力量", Mod="+10"
    // e.g. "力量" -> Skill="力量", Mod=""
    const match = params.match(/^([a-zA-Z\u4e00-\u9fa5]+)(.*)/);
    
    if (match) {
        return {
            type: 'check',
            payload: {
                skill: match[1],
                modifier: match[2].trim() || undefined
            }
        };
    } else {
        // Fallback for weird inputs
        return { 
            type: 'check', 
            payload: { 
                targetExpression: params 
            } 
        };
    }
  }

  // .sc (Sanity Check)
  // .sc success/failure [current]
  // .sc 1/1d4
  // .sc 1/1d4 50
  if (cmd === 'sc') {
    if (args.length < 2) return { type: 'error', payload: '格式错误，例如: .sc 1/1d4' };
    
    const expr = args[1]; // 1/1d4
    const parts = expr.split('/');
    if (parts.length !== 2) return { type: 'error', payload: 'SC表达式格式错误，应为 成功/失败' };
    
    const successExpr = parts[0];
    const failureExpr = parts[1];
    
    let currentSan: number | undefined = undefined;
    if (args.length > 2) {
      const val = parseInt(args[2]);
      if (!isNaN(val)) currentSan = val;
    }

    return {
      type: 'sanity',
      payload: {
        success: successExpr,
        failure: failureExpr,
        value: currentSan
      }
    };
  }

  if (cmd === 'growth') {
    const currentValue = parseInt(args[2]);
    const roll = parseInt(args[3]);
    if (!args[1] || isNaN(currentValue) || isNaN(roll)) {
      return { type: 'error', payload: 'Usage: .growth skill currentValue roll' };
    }

    return {
      type: 'coc_rule',
      payload: {
        rule: 'growth',
        skill: args[1],
        currentValue,
        roll,
      },
    };
  }

  if (cmd === 'bp' || cmd === 'penalty') {
    const mode = args[1] === 'penalty' || cmd === 'penalty' ? 'penalty' : 'bonus';
    const tensRolls = args.slice(2, -1).map((value) => parseInt(value));
    const onesRoll = parseInt(args[args.length - 1]);

    if (tensRolls.length === 0 || tensRolls.some(isNaN) || isNaN(onesRoll)) {
      return { type: 'error', payload: 'Usage: .bp bonus 7 2 4' };
    }

    return {
      type: 'coc_rule',
      payload: {
        rule: 'bonus_penalty',
        mode,
        tensRolls,
        onesRoll,
      },
    };
  }

  if (cmd === 'opp') {
    const challengerTarget = parseInt(args[2]);
    const challengerRoll = parseInt(args[3]);
    const defenderTarget = parseInt(args[5]);
    const defenderRoll = parseInt(args[6]);

    if (
      !args[1] ||
      !args[4] ||
      isNaN(challengerTarget) ||
      isNaN(challengerRoll) ||
      isNaN(defenderTarget) ||
      isNaN(defenderRoll)
    ) {
      return {
        type: 'error',
        payload: 'Usage: .opp Alice 60 32 Cultist 50 40',
      };
    }

    return {
      type: 'coc_rule',
      payload: {
        rule: 'opposed',
        challenger: {
          name: args[1],
          target: challengerTarget,
          roll: challengerRoll,
        },
        defender: {
          name: args[4],
          target: defenderTarget,
          roll: defenderRoll,
        },
      },
    };
  }

  // .st (Set Stats)
  // .st hp-1 san+2 str=50
  if (cmd === 'st') {
    // Join the rest of the string to parse complex patterns
    const rest = cleanInput.substring(3);
    // Regex to find patterns like: name+val, name-val, name=val, name val
    // Supported: hp-1, hp+1, hp=10, hp 10 (same as =)
    const matches = [...rest.matchAll(/([a-zA-Z\u4e00-\u9fa5]+)\s*([=+-]?)\s*(\d+)/g)];
    
    if (matches.length === 0) {
      // Maybe it's just showing stats? ".st"
      // For now, only support setting.
       return { type: 'help' }; // or error
    }

    const changes = matches.map((m): StatChange => ({
      stat: m[1],
      type: (m[2] || '=') as StatChange["type"],
      value: parseInt(m[3])
    }));

    return {
      type: 'set',
      payload: changes
    };
  }

  return null;
};
