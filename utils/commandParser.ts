export interface DiceCommand {
  type: 'roll' | 'roll_hidden' | 'check' | 'sanity' | 'set' | 'help' | 'error';
  payload?: any;
  original?: string;
}

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

    const changes = matches.map(m => ({
      stat: m[1],
      op: m[2] || '=',
      value: parseInt(m[3])
    }));

    return {
      type: 'set',
      payload: changes
    };
  }

  return null;
};
