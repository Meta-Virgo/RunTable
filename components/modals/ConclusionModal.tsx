import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { Character } from "../../types";
import { AvatarUpload } from "../AvatarUpload";
import { Button, Modal } from "../UI";

const DEFAULT_OUTCOME = "存活";
const OUTCOME_OPTIONS = ["存活", "死亡", "失踪", "疯狂"];

export const ConclusionModal: React.FC<{
  characters: Character[];
  onConfirm: (outcomes: Record<string, string>) => Promise<void>;
  onClose: () => void;
}> = ({ characters, onConfirm, onClose }) => {
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initial: Record<string, string> = {};
    characters.forEach((character) => {
      if (character.user_id) {
        initial[character.user_id] = DEFAULT_OUTCOME;
      }
    });
    setOutcomes(initial);
  }, [characters]);

  const handleSubmit = async () => {
    setLoading(true);
    await onConfirm(outcomes);
    setLoading(false);
  };

  return (
    <Modal
      onClose={onClose}
      title="结团结算"
      icon={Check}
      className="max-w-2xl"
    >
      <div className="p-6 space-y-6">
        <div className="bg-dicecho-primary/12 border border-dicecho-primary/25 p-4 rounded-lg text-sm text-slate-200">
          结团后，房间状态将变为“已完成”，并生成永久的跑团履历。<br></br>
          请确认每位玩家角色的最终结局，这将记录在他们的个人履历中。<br></br>
          <span className="text-amber-400 font-bold">
            注意：结团会删除房间数据，请务必提前留存好战报！
          </span>
        </div>

        <div className="space-y-4">
          {characters.map((character) => (
            <div
              key={character.id}
              className="flex items-center justify-between p-4 bg-dicecho-card/70 rounded-lg border border-dicecho-border/40"
            >
              <div className="flex items-center gap-3">
                <AvatarUpload
                  url={character.avatar_url}
                  onUpload={() => {}}
                  editable={false}
                  size={40}
                />
                <div>
                  <div className="font-bold text-white">{character.name}</div>
                  <div className="text-xs text-dicecho-muted">
                    {character.role}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-dicecho-muted">结局:</label>
                <select
                  className="bg-dicecho-panel/80 border border-dicecho-border/55 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-dicecho-primary/70"
                  value={outcomes[character.user_id!] || DEFAULT_OUTCOME}
                  onChange={(event) =>
                    setOutcomes({
                      ...outcomes,
                      [character.user_id!]: event.target.value,
                    })
                  }
                  disabled={!character.user_id}
                >
                  {OUTCOME_OPTIONS.map((outcome) => (
                    <option key={outcome} value={outcome}>
                      {outcome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {characters.length === 0 && (
            <div className="text-center text-dicecho-muted py-8">
              没有需要结算的调查员角色。
            </div>
          )}
        </div>
      </div>
      <div className="px-6 py-4 border-t border-dicecho-border/45 bg-dicecho-card/50 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          取消
        </Button>
        <Button onClick={handleSubmit} variant="primary" disabled={loading}>
          {loading ? "结算中..." : "确认结团"}
        </Button>
      </div>
    </Modal>
  );
};
