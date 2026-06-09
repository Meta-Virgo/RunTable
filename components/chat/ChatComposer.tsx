import React, { useEffect, useRef, useState } from "react";
import {
  Crown,
  Dice5,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Lock,
  Send,
  Sparkles,
  Unlock,
  User,
  X,
} from "lucide-react";
import type { Character, Log, ModuleInfo } from "../../types";
import { callDeepSeekAI, buildContext } from "../../services/ai";
import { Button, cn, NumberStepper } from "../UI";
import { ChatAiAssistantModal } from "./ChatAiAssistantModal";

type ChatQuote = {
  id: string;
  content: string;
  charName: string;
};

type CharacterAttributeKey =
  | "str"
  | "con"
  | "siz"
  | "dex"
  | "app"
  | "int"
  | "pow"
  | "edu"
  | "luck";

const ATTRIBUTES: Array<{ key: CharacterAttributeKey; label: string }> = [
  { key: "str", label: "力量" },
  { key: "con", label: "体质" },
  { key: "siz", label: "体型" },
  { key: "dex", label: "敏捷" },
  { key: "app", label: "外貌" },
  { key: "int", label: "智力" },
  { key: "pow", label: "意志" },
  { key: "edu", label: "教育" },
  { key: "luck", label: "幸运" },
];

interface ChatComposerProps {
  logs: Log[];
  activeChar: { name: string; role: string };
  activeCharId: string;
  characters: Character[];
  moduleInfo?: ModuleInfo;
  isKP: boolean;
  kpId: string | null;
  isVip: boolean;
  quoteMessage: ChatQuote | null;
  onSend: (
    text: string,
    recipientId?: string | null,
    type?: Log["type"],
    quote?: ChatQuote
  ) => void;
  onRollDice: (
    count: number,
    type: number,
    isSecret: boolean,
    checkInfo?: { name: string; target: number }
  ) => void;
  onShowStory: () => void;
  onClearQuote: () => void;
  onMessageSent: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  logs,
  activeChar,
  activeCharId,
  characters,
  moduleInfo,
  isKP,
  kpId,
  isVip,
  quoteMessage,
  onSend,
  onRollDice,
  onShowStory,
  onClearQuote,
  onMessageSent,
}) => {
  const [inputText, setInputText] = useState("");
  const [diceCount, setDiceCount] = useState(1);
  const [diceType, setDiceType] = useState(6);
  const [showDiceSelect, setShowDiceSelect] = useState(false);
  const [isSecret, setIsSecret] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [showRecipientSelect, setShowRecipientSelect] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const [showAttrSelect, setShowAttrSelect] = useState(false);
  const [showSkillSelect, setShowSkillSelect] = useState(false);
  const [menuPosition, setMenuPosition] = useState<React.CSSProperties>({});
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const diceButtonRef = useRef<HTMLButtonElement>(null);
  const attrButtonRef = useRef<HTMLButtonElement>(null);
  const skillButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const myChar = characters.find((character) => character.id === activeCharId);
  const canRollCheck = !!myChar;

  const calculateMenuStyles = (
    ref: React.RefObject<HTMLElement>,
    width: number
  ) => {
    if (!ref.current) return {};
    const rect = ref.current.getBoundingClientRect();
    const screenW = window.innerWidth;
    let left = rect.left;

    if (left + width > screenW - 10) {
      left = screenW - width - 10;
    }
    if (left < 10) left = 10;

    return {
      position: "fixed" as const,
      bottom: window.innerHeight - rect.top + 8,
      left,
      zIndex: 9999,
    };
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [inputText]);

  const handleAskAI = async () => {
    if (!isVip) {
      alert("AI 功能仅限 VIP 用户使用。");
      return;
    }
    if (!moduleInfo) return;
    setAiLoading(true);
    setAiError("");
    setAiResult("");

    try {
      const { system, context } = buildContext(moduleInfo, logs, characters);
      const messages = [
        { role: "system", content: system } as any,
        {
          role: "user",
          content: `${context}\n\n[指令]\n${
            aiPrompt || "请根据当前情况继续推进剧情。"
          }`,
        },
      ];

      const result = await callDeepSeekAI(messages);
      setAiResult(result);
    } catch (error: any) {
      setAiError(error.message || "AI 请求失败");
    } finally {
      setAiLoading(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("图片大小不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPendingImage({ dataUrl: result, name: file.name });
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const getRecipientLabel = () => {
    if (!recipientId) return "所有人";
    if (kpId && recipientId === kpId) return "守秘人 (KP)";
    const character = characters.find((item) => item.user_id === recipientId);
    return character ? character.name : "未知用户";
  };

  const handleSend = () => {
    if (pendingImage) {
      onSend(pendingImage.dataUrl, recipientId, "image");
      setPendingImage(null);
    }
    if (!inputText.trim()) return;
    onSend(inputText, recipientId, "normal", quoteMessage || undefined);
    setInputText("");
    onClearQuote();
    onMessageSent();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="absolute bottom-0 left-0 w-full z-50 p-2 md:p-6 pt-0 md:pt-2 bg-slate-950/50 md:bg-transparent backdrop-blur-md md:backdrop-blur-none pb-safe">
        <div className="max-w-4xl mx-auto rounded-2xl relative z-20 transition-all focus-within:ring-2 focus-within:ring-indigo-500/30 focus-within:border-indigo-500/50 shadow-2xl">
          <div className="absolute inset-0 glass-panel rounded-2xl z-0 pointer-events-none"></div>
          <div className="relative z-10 p-2 md:p-3">
            <div className="absolute -top-3 left-4 bg-slate-900 text-slate-300 text-[10px] px-3 py-1 rounded-full border border-slate-700 shadow-lg flex items-center gap-2 font-medium tracking-wide z-10">
              <span
                className={cn(
                  "w-2 h-2 rounded-full animate-pulse",
                  activeCharId === "pc" ? "bg-indigo-500" : "bg-emerald-500"
                )}
              ></span>
              正在扮演:{" "}
              <span className="text-white font-bold max-w-[100px] truncate">
                {activeChar.name}
              </span>
            </div>
            {pendingImage && (
              <div className="mx-4 mt-2 flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-2 rounded-lg w-fit animate-fade-in relative z-20">
                <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center shrink-0 border border-slate-700">
                  <ImageIcon size={14} className="text-indigo-400" />
                </div>
                <span className="text-xs text-slate-300 truncate max-w-[150px] font-mono">
                  {pendingImage.name}
                </span>
                <button
                  onClick={() => setPendingImage(null)}
                  className="ml-1 p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-white/5"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {quoteMessage && (
              <div className="mx-4 mt-2 flex items-center gap-2 bg-slate-800/80 border-l-4 border-indigo-500 p-2 rounded-r-lg w-fit animate-fade-in relative z-20 max-w-[80%]">
                <div className="flex flex-col overflow-hidden">
                  <span className="text-xs font-bold text-indigo-400">
                    回复 {quoteMessage.charName}:
                  </span>
                  <span className="text-xs text-slate-300 truncate font-mono opacity-80">
                    {quoteMessage.content}
                  </span>
                </div>
                <button
                  onClick={onClearQuote}
                  className="ml-2 p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-white/5 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onDrop={handleDrop}
              placeholder={`以 ${activeChar.name} 的身份发言...`}
              rows={1}
              className="w-full bg-transparent border-none text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-0 resize-none px-4 py-3 min-h-[3rem] max-h-[200px] custom-scrollbar text-sm md:text-base"
            />
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 md:gap-0 px-1 md:px-2 pt-2 border-t border-white/5 mt-1">
              <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto overflow-x-auto md:overflow-visible custom-scrollbar justify-start md:justify-start pb-1 md:pb-0">
                <div className="flex items-center gap-2 shrink-0">
                  {canRollCheck && (
                    <>
                      <div className="relative shrink-0">
                        <button
                          ref={attrButtonRef}
                          type="button"
                          onClick={() => {
                            if (!showAttrSelect) {
                              setMenuPosition(
                                calculateMenuStyles(attrButtonRef, 256)
                              );
                              setShowAttrSelect(true);
                              setShowSkillSelect(false);
                              setShowDiceSelect(false);
                            } else {
                              setShowAttrSelect(false);
                            }
                          }}
                          className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                        >
                          <span className="text-sm font-bold text-slate-300 font-mono group-hover:text-white">
                            属性
                          </span>
                        </button>
                        {showAttrSelect && (
                          <>
                            <div
                              className="fixed inset-0 z-[9990]"
                              onClick={() => setShowAttrSelect(false)}
                            ></div>
                            <div
                              className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-[9999] animate-scale-in w-64 max-w-[90vw]"
                              style={menuPosition}
                            >
                              {ATTRIBUTES.map((attribute) => {
                                const value = myChar?.[attribute.key] ?? 0;
                                return (
                                  <button
                                    key={attribute.key}
                                    onClick={() => {
                                      onRollDice(1, 100, isSecret, {
                                        name: attribute.label,
                                        target: value,
                                      });
                                      setShowAttrSelect(false);
                                    }}
                                    className="flex flex-col items-center p-2 hover:bg-indigo-600 rounded-lg transition-colors group/item"
                                  >
                                    <span className="text-xs font-bold text-slate-300 group-hover/item:text-white">
                                      {attribute.label}
                                    </span>
                                    <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">
                                      {value}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="relative shrink-0">
                        <button
                          ref={skillButtonRef}
                          type="button"
                          onClick={() => {
                            if (!showSkillSelect) {
                              setMenuPosition(
                                calculateMenuStyles(skillButtonRef, 256)
                              );
                              setShowSkillSelect(true);
                              setShowAttrSelect(false);
                              setShowDiceSelect(false);
                            } else {
                              setShowSkillSelect(false);
                            }
                          }}
                          className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group min-w-[3.5rem]"
                        >
                          <span className="text-sm font-bold text-slate-300 font-mono group-hover:text-white">
                            技能
                          </span>
                        </button>
                        {showSkillSelect && (
                          <>
                            <div
                              className="fixed inset-0 z-[9990]"
                              onClick={() => setShowSkillSelect(false)}
                            ></div>
                            <div
                              className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-2 gap-1 shadow-xl z-[9999] animate-scale-in w-64 max-w-[90vw] max-h-64 overflow-y-auto custom-scrollbar"
                              style={menuPosition}
                            >
                              {Object.keys(myChar?.skills || {}).length ===
                              0 ? (
                                <div className="col-span-2 text-center text-xs text-slate-500 py-2">
                                  暂无技能
                                </div>
                              ) : (
                                Object.entries(myChar?.skills || {}).map(
                                  ([name, value]) => (
                                    <button
                                      key={name}
                                      onClick={() => {
                                        onRollDice(1, 100, isSecret, {
                                          name,
                                          target: value,
                                        });
                                        setShowSkillSelect(false);
                                      }}
                                      className="flex justify-between items-center px-3 py-2 hover:bg-indigo-600 rounded-lg transition-colors text-left group/item"
                                    >
                                      <span className="text-xs font-bold text-slate-300 group-hover/item:text-white truncate max-w-[80px]">
                                        {name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 group-hover/item:text-slate-200">
                                        {value}
                                      </span>
                                    </button>
                                  )
                                )
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  <NumberStepper
                    value={diceCount}
                    onChange={setDiceCount}
                    min={1}
                    max={100}
                    className="w-24 md:w-28"
                  />

                  <div className="relative shrink-0">
                    <button
                      ref={diceButtonRef}
                      type="button"
                      onClick={() => {
                        if (!showDiceSelect) {
                          setMenuPosition(
                            calculateMenuStyles(diceButtonRef, 192)
                          );
                          setShowDiceSelect(true);
                          setShowAttrSelect(false);
                          setShowSkillSelect(false);
                        } else {
                          setShowDiceSelect(false);
                        }
                      }}
                      className="flex items-center justify-center px-3 bg-[#020617] border border-slate-700 rounded-xl h-10 min-w-[3.5rem] md:min-w-[4.5rem] shadow-sm hover:border-slate-500 transition-all active:bg-slate-900 group"
                    >
                      <span className="text-base font-bold text-white font-mono">
                        D{diceType}
                      </span>
                    </button>
                    {showDiceSelect && (
                      <>
                        <div
                          className="fixed inset-0 z-[9990]"
                          onClick={() => setShowDiceSelect(false)}
                        ></div>
                        <div
                          className="fixed bg-slate-900 border border-slate-700 p-2 rounded-xl grid grid-cols-3 gap-1 shadow-xl z-[9999] animate-scale-in w-48"
                          style={menuPosition}
                        >
                          {[2, 3, 4, 6, 8, 10, 12, 20, 100].map((dice) => (
                            <button
                              key={dice}
                              onClick={() => {
                                setDiceType(dice);
                                setShowDiceSelect(false);
                              }}
                              className="p-2 hover:bg-indigo-600 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors"
                            >
                              D{dice}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {isKP && (
                    <button
                      onClick={() => setIsSecret(!isSecret)}
                      className={cn(
                        "p-2 md:p-1.5 rounded-xl transition-colors h-10 w-10 flex items-center justify-center border shrink-0",
                        isSecret
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                          : "bg-transparent text-slate-400 border-transparent hover:bg-slate-800 hover:text-indigo-400"
                      )}
                    >
                      {isSecret ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  )}

                  <button
                    onClick={() => onRollDice(diceCount, diceType, isSecret)}
                    className="p-2 md:p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors h-10 w-10 flex items-center justify-center border border-transparent hover:border-slate-700 shrink-0"
                  >
                    <Dice5 size={20} />
                  </button>
                </div>
                {isKP && (
                  <button
                    onClick={onShowStory}
                    className="p-2 text-slate-500 hover:text-slate-300 transition-colors hover:bg-white/5 rounded-lg shrink-0"
                  >
                    <FileText size={18} />
                  </button>
                )}
                {isKP && (
                  <button
                    onClick={() => setShowAIModal(true)}
                    className="p-2 text-purple-400 hover:text-purple-300 transition-colors hover:bg-purple-500/10 rounded-lg shrink-0"
                  >
                    <Sparkles size={18} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 relative w-full md:w-auto justify-end shrink-0">
                {showRecipientSelect && (
                  <div className="absolute bottom-full right-0 mb-3 w-52 bg-slate-950/95 backdrop-blur-md border border-slate-800/80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in flex flex-col p-1 ring-1 ring-white/5">
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      发送给
                    </div>
                    <button
                      onClick={() => {
                        setRecipientId(null);
                        setShowRecipientSelect(false);
                      }}
                      className={cn(
                        "px-3 py-2.5 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                        !recipientId
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          !recipientId
                            ? "bg-indigo-500/20 text-indigo-400"
                            : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                        )}
                      >
                        <Unlock size={14} />
                      </div>
                      <span className="font-medium">所有人</span>
                      {!recipientId && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                      )}
                    </button>

                    <div className="h-px bg-slate-800/50 my-1 mx-2" />

                    <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                      {isKP &&
                        characters
                          .filter((character) => character.type === "investigator")
                          .map((character) => (
                            <button
                              key={character.id}
                              onClick={() => {
                                setRecipientId(character.user_id || null);
                                setShowRecipientSelect(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                                recipientId === character.user_id
                                  ? "bg-indigo-500/10 text-indigo-400"
                                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                                  recipientId === character.user_id
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                                )}
                              >
                                <User size={14} />
                              </div>
                              <span className="font-medium truncate flex-1">
                                {character.name}
                              </span>
                              {recipientId === character.user_id && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                              )}
                            </button>
                          ))}

                      {!isKP && kpId && (
                        <button
                          onClick={() => {
                            setRecipientId(kpId);
                            setShowRecipientSelect(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-xs rounded-xl transition-all flex items-center gap-3 group",
                            recipientId === kpId
                              ? "bg-indigo-500/10 text-indigo-400"
                              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                              recipientId === kpId
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-slate-800 text-slate-500 group-hover:bg-slate-700"
                            )}
                          >
                            <Crown size={14} />
                          </div>
                          <span className="font-medium truncate flex-1">
                            守秘人 (KP)
                          </span>
                          {recipientId === kpId && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowRecipientSelect(!showRecipientSelect)}
                  className={cn(
                    "h-9 px-4 rounded-xl border flex items-center gap-2 transition-all font-medium text-xs",
                    recipientId
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
                      : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300"
                  )}
                >
                  {recipientId ? (
                    <Lock size={14} className="opacity-70" />
                  ) : (
                    <Unlock size={14} className="opacity-70" />
                  )}
                  <span className="max-w-[100px] truncate">
                    {getRecipientLabel()}
                  </span>
                </button>
                <Button
                  onClick={handleSend}
                  disabled={!inputText.trim() && !pendingImage}
                  size="sm"
                  icon={Send}
                  className="rounded-lg shadow-indigo-500/20 px-4"
                >
                  发送
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChatAiAssistantModal
        open={showAIModal}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiResult={aiResult}
        aiLoading={aiLoading}
        aiError={aiError}
        onAskAI={handleAskAI}
        onUseResult={(result) => {
          setInputText(result);
          setShowAIModal(false);
        }}
        onClose={() => setShowAIModal(false)}
      />
    </>
  );
};
