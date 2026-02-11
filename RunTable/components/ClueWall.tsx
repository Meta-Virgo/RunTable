import React, { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { supabase } from "../supabase";
import { Button } from "./UI";
import {
  Save,
  StickyNote,
  Trash2,
  Link as LinkIcon,
  Palette,
  Type,
  Settings2,
  X,
} from "lucide-react";

interface ClueWallProps {
  roomId: string;
}

export const ClueWall: React.FC<ClueWallProps> = ({ roomId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeNote, setActiveNote] = useState<fabric.Object | null>(null);

  // Style states
  const [fontSize, setFontSize] = useState(16);
  const [fontColor, setFontColor] = useState("#1e293b");
  const [bgColor, setBgColor] = useState("#fef3c7");
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Presets
  const PRESET_FONT_COLORS = [
    "#1e293b", // Slate 800
    "#ffffff", // White
    "#ef4444", // Red 500
    "#3b82f6", // Blue 500
    "#22c55e", // Green 500
    "#eab308", // Yellow 500
    "#a855f7", // Purple 500
  ];

  const PRESET_BG_COLORS = [
    "#fef3c7", // Amber 100 (Default)
    "#ffffff", // White
    "#f1f5f9", // Slate 100
    "#fee2e2", // Red 100
    "#e0f2fe", // Sky 100
    "#dcfce7", // Green 100
    "#f3e8ff", // Purple 100
    "#1e293b", // Slate 800 (Dark)
  ];

  // Update style states when active note changes
  useEffect(() => {
    if (activeNote && activeNote.type === "textbox") {
      const text = activeNote as fabric.Textbox;
      setFontSize(text.fontSize || 16);
      setFontColor((text.fill as string) || "#1e293b");
      setBgColor((text.backgroundColor as string) || "#fef3c7");
      setShowStyleMenu(true);
    } else {
      setShowStyleMenu(false);
    }
  }, [activeNote]);

  // Update active note style
  const updateStyle = (key: string, value: any) => {
    if (!fabricCanvas || !activeNote) return;
    activeNote.set(key, value);
    if (key === "fontSize") setFontSize(value);
    if (key === "fill") setFontColor(value);
    if (key === "backgroundColor") setBgColor(value);

    fabricCanvas.requestRenderAll();
    setHasUnsavedChanges(true);
  };

  // Removed explicit mode state as we use Shift modifier now
  const connectionRef = useRef<{
    line: fabric.Line | null;
    source: fabric.Object | null;
  }>({ line: null, source: null });

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current || !wrapperRef.current) return;

    // Use wrapper dimensions
    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: width,
      height: height,
      backgroundColor: "transparent", // Transparent to allow grid drawing in before:render without occlusion
      selection: true,
      fireRightClick: true, // Enable right click events
      stopContextMenu: true, // Prevent default context menu
    });

    // Custom property for dragging state
    (canvas as any).isDragging = false;
    (canvas as any).lastPosX = 0;
    (canvas as any).lastPosY = 0;

    setFabricCanvas(canvas);

    const handleResize = () => {
      if (wrapperRef.current) {
        canvas.setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
        canvas.requestRenderAll();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      canvas.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Grid & Infinite Canvas Logic
  useEffect(() => {
    if (!fabricCanvas) return;

    // Grid Drawing Logic
    const drawGrid = () => {
      const gridSize = 50;
      const width = fabricCanvas.width || 800;
      const height = fabricCanvas.height || 600;
      const zoom = fabricCanvas.getZoom();
      const viewport = fabricCanvas.viewportTransform;
      if (!viewport) return;

      const ctx = fabricCanvas.getContext();
      if (!ctx) return;

      ctx.save();
      // Draw Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"; // Very subtle grid
      ctx.lineWidth = 1;

      // Calculate visible area
      const offsetX = -viewport[4];
      const offsetY = -viewport[5];

      // Calculate start/end grid lines
      // We want grid lines to appear fixed in world space
      const startX = Math.floor(offsetX / zoom / gridSize) * gridSize;
      const startY = Math.floor(offsetY / zoom / gridSize) * gridSize;
      const endX = (offsetX + width) / zoom;
      const endY = (offsetY + height) / zoom;

      ctx.beginPath();
      // Vertical lines
      for (let i = startX; i < endX; i += gridSize) {
        const x = i * zoom + viewport[4];
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      // Horizontal lines
      for (let i = startY; i < endY; i += gridSize) {
        const y = i * zoom + viewport[5];
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    // Hook into render loop
    fabricCanvas.on("before:render", drawGrid);

    // Zoom Handling (Ctrl + Wheel)
    fabricCanvas.on("mouse:wheel", (opt) => {
      if (opt.e.ctrlKey || opt.e.metaKey) {
        const delta = opt.e.deltaY;
        let zoom = fabricCanvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 5) zoom = 5;
        if (zoom < 0.1) zoom = 0.1;

        fabricCanvas.zoomToPoint(
          new fabric.Point(opt.e.offsetX, opt.e.offsetY),
          zoom,
        );
        opt.e.preventDefault();
        opt.e.stopPropagation();
      }
    });

    // Pan Handling (Ctrl + Drag) & Connection (Shift + Drag)
    fabricCanvas.on("mouse:down", (opt) => {
      const evt = opt.e as any;

      // Connection Mode Handling (Shift + Drag from Object)
      // Removed Shift+Drag logic as requested
      // if (evt.shiftKey && opt.target && opt.target.type !== "line") { ... }

      // Ctrl + Left Click OR Middle Click (button 1) for Panning
      if (evt.ctrlKey || evt.metaKey || evt.button === 1) {
        (fabricCanvas as any).isDragging = true;
        (fabricCanvas as any).selection = false;
        (fabricCanvas as any).lastPosX = evt.clientX;
        (fabricCanvas as any).lastPosY = evt.clientY;
        fabricCanvas.defaultCursor = "grab";
      }
    });

    fabricCanvas.on("selection:created", (e) => {
      if (
        e.selected &&
        e.selected.length === 1 &&
        e.selected[0].type !== "line"
      ) {
        setActiveNote(e.selected[0]);
      } else {
        setActiveNote(null);
      }
    });

    fabricCanvas.on("selection:updated", (e) => {
      if (
        e.selected &&
        e.selected.length === 1 &&
        e.selected[0].type !== "line"
      ) {
        setActiveNote(e.selected[0]);
      } else {
        setActiveNote(null);
      }
    });

    fabricCanvas.on("selection:cleared", () => {
      setActiveNote(null);
    });

    fabricCanvas.on("mouse:move", (opt) => {
      // Connection Drawing
      if (connectionRef.current.line) {
        const pointer = fabricCanvas.getScenePoint(opt.e);
        connectionRef.current.line.set({ x2: pointer.x, y2: pointer.y });
        fabricCanvas.requestRenderAll();
        return;
      }

      if ((fabricCanvas as any).isDragging) {
        const e = opt.e as any;
        const vpt = fabricCanvas.viewportTransform;
        if (!vpt) return;

        vpt[4] += e.clientX - (fabricCanvas as any).lastPosX;
        vpt[5] += e.clientY - (fabricCanvas as any).lastPosY;

        fabricCanvas.requestRenderAll();
        (fabricCanvas as any).lastPosX = e.clientX;
        (fabricCanvas as any).lastPosY = e.clientY;
      }
    });

    fabricCanvas.on("mouse:up", (opt) => {
      // Connection Finishing
      if (connectionRef.current.line) {
        const target = opt.target;
        const source = connectionRef.current.source;
        const line = connectionRef.current.line;

        if (target && source && target !== source && target.type !== "line") {
          // Success connection
          const center = target.getCenterPoint();
          line.set({ x2: center.x, y2: center.y });
          line.set({ selectable: true, evented: true }); // Allow selection to delete

          // Bind data
          (line as any).sourceId = (source as any).id;
          (line as any).targetId = (target as any).id;
          (line as any).id = crypto.randomUUID();

          setHasUnsavedChanges(true);
        } else {
          // Cancel connection
          fabricCanvas.remove(line);
          fabricCanvas.requestRenderAll();
        }

        connectionRef.current = { line: null, source: null };
        // Restore selection if it was disabled by shift drag
        fabricCanvas.selection = true;
        return;
      }

      // on mouse up we want to recalculate new interaction
      // for all objects, so we call setViewportTransform
      if ((fabricCanvas as any).isDragging) {
        fabricCanvas.setViewportTransform(fabricCanvas.viewportTransform!);
        (fabricCanvas as any).isDragging = false;
        (fabricCanvas as any).selection = true;
        fabricCanvas.defaultCursor = "default";
      }
    });

    // Initial Render
    fabricCanvas.requestRenderAll();

    return () => {
      fabricCanvas.off("before:render", drawGrid);
      fabricCanvas.off("mouse:wheel");
      fabricCanvas.off("mouse:down");
      fabricCanvas.off("mouse:move");
      fabricCanvas.off("mouse:up");
    };
  }, [fabricCanvas]);

  // Load Data
  useEffect(() => {
    if (!fabricCanvas || !roomId) return;

    const loadData = async () => {
      const { data, error } = await supabase
        .from("clue_walls")
        .select("content")
        .eq("room_id", roomId)
        .single();

      if (data && data.content && Object.keys(data.content).length > 0) {
        try {
          await fabricCanvas.loadFromJSON(data.content);
          // Ensure background is transparent so grid (drawn in before:render) is visible
          fabricCanvas.backgroundColor = "transparent";
          fabricCanvas.requestRenderAll();

          // 校准连线位置：重新遍历所有线，确保其端点坐标与所连接的对象中心一致
          // Calibrate lines: Re-calculate all line endpoints to match connected object centers
          const lines = fabricCanvas.getObjects("line");
          const objects = fabricCanvas
            .getObjects()
            .filter((o) => o.type !== "line");

          lines.forEach((line: any) => {
            const source = objects.find((o: any) => o.id === line.sourceId);
            const target = objects.find((o: any) => o.id === line.targetId);

            if (source && target) {
              const sourceCenter = source.getCenterPoint();
              const targetCenter = target.getCenterPoint();
              line.set({
                x1: sourceCenter.x,
                y1: sourceCenter.y,
                x2: targetCenter.x,
                y2: targetCenter.y,
              });
            }
          });
          fabricCanvas.requestRenderAll();
        } catch (e) {
          console.error("Error loading canvas data:", e);
        }
      } else if (error && error.code === "PGRST116") {
        // Not found, create one
        await supabase
          .from("clue_walls")
          .insert({ room_id: roomId, content: {} });
      }
    };

    loadData();
  }, [fabricCanvas, roomId]);

  // Change listeners
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleChange = () => {
      setHasUnsavedChanges(true);
    };

    const updateLines = (obj: fabric.Object) => {
      if (!obj || !(obj as any).id) return;
      const objId = (obj as any).id;
      const center = obj.getCenterPoint();

      fabricCanvas.getObjects("line").forEach((line: any) => {
        if (line.sourceId === objId) {
          line.set({ x1: center.x, y1: center.y });
        } else if (line.targetId === objId) {
          line.set({ x2: center.x, y2: center.y });
        }
      });
    };

    fabricCanvas.on("object:modified", handleChange);
    fabricCanvas.on("object:added", handleChange);
    fabricCanvas.on("object:removed", handleChange);

    fabricCanvas.on("object:moving", (e) => {
      if (e.target) updateLines(e.target);
    });

    // Keyboard delete
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // Only delete if not editing text
        const activeObjects = fabricCanvas.getActiveObjects();
        const isEditing = activeObjects.some((obj) => (obj as any).isEditing);

        if (activeObjects.length > 0 && !isEditing) {
          activeObjects.forEach((obj) => {
            fabricCanvas.remove(obj);
          });
          fabricCanvas.discardActiveObject();
          fabricCanvas.requestRenderAll();
          handleChange();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      fabricCanvas.off("object:modified", handleChange);
      fabricCanvas.off("object:added", handleChange);
      fabricCanvas.off("object:removed", handleChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fabricCanvas]);

  const saveData = async () => {
    if (!fabricCanvas || !roomId) return;
    setSaving(true);
    const json = fabricCanvas.toObject(["id", "sourceId", "targetId"]);
    // Optionally save viewport transform if we want to restore position
    // (json as any).viewportTransform = fabricCanvas.viewportTransform;

    const { error } = await supabase
      .from("clue_walls")
      .upsert({ room_id: roomId, content: json }, { onConflict: "room_id" });

    if (error) {
      console.error("Save failed:", error);
      alert("保存失败");
    } else {
      setHasUnsavedChanges(false);
    }
    setSaving(false);
  };

  const addNote = () => {
    if (!fabricCanvas) return;

    // Get center of viewport to add note in visible area
    const zoom = fabricCanvas.getZoom();
    const vpt = fabricCanvas.viewportTransform!;
    const centerX = (-vpt[4] + fabricCanvas.width! / 2) / zoom;
    const centerY = (-vpt[5] + fabricCanvas.height! / 2) / zoom;

    const text = new fabric.Textbox("新线索", {
      left: centerX - 75, // Center - half width
      top: centerY - 25,
      width: 150,
      fontSize: 16,
      fontFamily: "sans-serif",
      backgroundColor: "#fef3c7", // amber-100
      fill: "#1e293b", // slate-800
      padding: 10,
      rx: 5,
      ry: 5,
      textAlign: "center",
      borderColor: "#f59e0b",
      cornerColor: "#f59e0b",
      cornerSize: 8,
      transparentCorners: false,
      splitByGrapheme: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hasControls: false,
      // Custom Props
      ...({ id: crypto.randomUUID() } as any),
    });

    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);
    fabricCanvas.requestRenderAll();
    setHasUnsavedChanges(true);
  };

  const startConnection = () => {
    if (!fabricCanvas || !activeNote) return;

    const source = activeNote;
    const center = source.getCenterPoint();

    const points = [center.x, center.y, center.x, center.y] as [
      number,
      number,
      number,
      number,
    ];
    const line = new fabric.Line(points, {
      strokeWidth: 3,
      stroke: "#ef4444", // red-500
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    fabricCanvas.add(line);
    // 3. 连线图层要高于线索 -> bringToFront instead of sendToBack
    fabricCanvas.bringObjectToFront(line);
    connectionRef.current = { line, source };

    // Deselect to allow clicking target
    fabricCanvas.discardActiveObject();
    fabricCanvas.requestRenderAll();
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const activeObjects = fabricCanvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj) => {
        // If deleting a node, find connected lines and remove them
        if (obj.type !== "line") {
          const objId = (obj as any).id;
          const connectedLines = fabricCanvas
            .getObjects("line")
            .filter(
              (line: any) => line.sourceId === objId || line.targetId === objId,
            );
          connectedLines.forEach((line) => fabricCanvas.remove(line));
        }
        fabricCanvas.remove(obj);
      });
      fabricCanvas.discardActiveObject();
      fabricCanvas.requestRenderAll();
      setHasUnsavedChanges(true);
    }
  };

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-slate-900/90 p-2 rounded-xl backdrop-blur-md border border-white/10 shadow-2xl ring-1 ring-white/5">
        <Button
          onClick={addNote}
          icon={StickyNote}
          variant="secondary"
          size="sm"
          className="shadow-sm"
        >
          添加线索
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
        {activeNote ? (
          <Button
            onClick={startConnection}
            icon={LinkIcon}
            variant="primary"
            size="sm"
            className="animate-fade-in"
          >
            连线
          </Button>
        ) : (
          <div className="flex items-center gap-2 px-2 text-xs text-slate-400 select-none opacity-50">
            <span className="flex items-center gap-1">选中线索以连线</span>
          </div>
        )}

        {activeNote && activeNote.type === "textbox" && (
          <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
        )}

        <Button
          onClick={deleteSelected}
          icon={Trash2}
          variant="ghost"
          size="sm"
          title="删除选中 (Del)"
          className="text-slate-400 hover:text-red-400"
        >
          删除
        </Button>
        <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
        <Button
          onClick={saveData}
          icon={Save}
          variant={hasUnsavedChanges ? "primary" : "ghost"}
          size="sm"
          disabled={saving}
          className={
            hasUnsavedChanges ? "animate-pulse-subtle" : "text-slate-400"
          }
        >
          {hasUnsavedChanges ? "保存 *" : "已保存"}
        </Button>
      </div>

      {/* Style Menu Panel */}
      {showStyleMenu && activeNote && activeNote.type === "textbox" && (
        <div className="absolute top-20 right-4 z-20 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 animate-slide-in-right flex flex-col gap-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              样式设置
            </span>
            <button
              onClick={() => setShowStyleMenu(false)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Type size={12} /> 字体大小
              </span>
              <span className="text-xs font-mono text-indigo-400">
                {fontSize}px
              </span>
            </div>
            <input
              type="range"
              min="12"
              max="72"
              step="1"
              value={fontSize}
              onChange={(e) =>
                updateStyle("fontSize", parseInt(e.target.value))
              }
              className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Font Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Palette size={12} /> 字体颜色
              </span>
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20 cursor-pointer">
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => updateStyle("fill", e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: fontColor }}
                />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {PRESET_FONT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateStyle("fill", color)}
                  className={`w-6 h-6 rounded-lg border transition-all ${
                    fontColor === color
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:scale-105 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Palette size={12} /> 背景颜色
              </span>
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-white/20 cursor-pointer">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) =>
                    updateStyle("backgroundColor", e.target.value)
                  }
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: bgColor }}
                />
              </div>
            </div>
            <div className="grid grid-cols-8 gap-1.5">
              {PRESET_BG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateStyle("backgroundColor", color)}
                  className={`w-6 h-6 rounded-lg border transition-all ${
                    bgColor === color
                      ? "border-white scale-110 shadow-lg"
                      : "border-transparent hover:scale-105 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Help Hint */}
      <div className="absolute bottom-4 right-4 z-10 pointer-events-none opacity-50 text-[10px] text-slate-500 bg-black/20 px-2 py-1 rounded select-none">
        Ctrl + 滚轮缩放 · Ctrl + 拖拽平移
      </div>

      <div ref={wrapperRef} className="flex-1 w-full h-full relative">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
};
