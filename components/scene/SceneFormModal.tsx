import React from "react";
import { Map, Save } from "lucide-react";
import type { RoomScene } from "../../types";
import {
  SCENE_BACKGROUND_COLORS,
  SCENE_BACKGROUND_PATTERNS,
} from "../../services/roomScenes";
import { Button, Input, Modal, Textarea, cn } from "../UI";
import { scenePatternLabels } from "./scenePresentation";

export interface SceneFormState {
  title: string;
  description: string;
  backgroundColor: string;
  backgroundPattern: RoomScene["background_pattern"];
}

interface SceneFormModalProps {
  mode: "create" | "edit";
  form: SceneFormState;
  busy: boolean;
  onChange: (form: SceneFormState) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const emptySceneForm: SceneFormState = {
  title: "",
  description: "",
  backgroundColor: SCENE_BACKGROUND_COLORS[0],
  backgroundPattern: "plain",
};

export function getSceneFormFromScene(scene: RoomScene): SceneFormState {
  return {
    title: scene.title,
    description: scene.description || "",
    backgroundColor: scene.background_color,
    backgroundPattern: scene.background_pattern,
  };
}

export const SceneFormModal: React.FC<SceneFormModalProps> = ({
  mode,
  form,
  busy,
  onChange,
  onSubmit,
  onClose,
}) => (
  <Modal
    title={mode === "edit" ? "编辑场景" : "新建场景"}
    icon={Map}
    className="max-w-xl"
    onClose={onClose}
  >
    <div className="space-y-4 overflow-y-auto p-5 md:p-6">
      <Input
        label="标题"
        value={form.title}
        onChange={(event) =>
          onChange({
            ...form,
            title: event.target.value,
          })
        }
        placeholder="例如：旧宅大厅"
      />
      <Textarea
        label="描述"
        rows={4}
        value={form.description}
        onChange={(event) =>
          onChange({
            ...form,
            description: event.target.value,
          })
        }
        placeholder="简短记录光源、出口、危险点..."
      />

      <div>
        <label className="mb-1.5 ml-1 block text-xs font-medium text-dicecho-muted">
          背景色
        </label>
        <div className="flex flex-wrap gap-2">
          {SCENE_BACKGROUND_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => onChange({ ...form, backgroundColor: color })}
              className={cn(
                "h-9 w-9 rounded-lg border transition-transform hover:scale-105",
                form.backgroundColor === color
                  ? "border-white"
                  : "border-dicecho-border/50"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 ml-1 block text-xs font-medium text-dicecho-muted">
          背景纹理
        </label>
        <div className="grid grid-cols-2 gap-2">
          {SCENE_BACKGROUND_PATTERNS.map((pattern) => (
            <button
              key={pattern}
              type="button"
              onClick={() =>
                onChange({
                  ...form,
                  backgroundPattern: pattern,
                })
              }
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                form.backgroundPattern === pattern
                  ? "border-dicecho-primary/50 bg-dicecho-primary/15 text-white"
                  : "border-dicecho-border/45 bg-dicecho-panel/55 text-dicecho-muted hover:text-white"
              )}
            >
              {scenePatternLabels[pattern]}
            </button>
          ))}
        </div>
      </div>
    </div>
    <div className="flex shrink-0 justify-end gap-2 border-t border-dicecho-border/40 bg-dicecho-card/45 px-5 py-4 md:px-6">
      <Button variant="ghost" onClick={onClose}>
        取消
      </Button>
      <Button
        icon={Save}
        disabled={!form.title.trim() || busy}
        onClick={onSubmit}
      >
        {busy ? "保存中..." : mode === "edit" ? "保存" : "创建"}
      </Button>
    </div>
  </Modal>
);
