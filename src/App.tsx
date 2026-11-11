import { useEffect, useMemo, useRef, useState } from "react";
import {
  createNode,
  createsCycle,
  getEdgePath,
  getNodeById,
  isCompatible,
  PORT_TYPES,
} from "./lib/graph";
import { loadProject, saveProject } from "./store/db";
import type { Frame, NodeItem, PortType, ProjectState } from "./types";
import "./styles.css";

const initialProject: ProjectState = {
  nodes: [
    {
      id: "n1",
      x: 120,
      y: 120,
      title: "Input",
      content: "اكتب شيئًا هنا",
      type: "Text",
      inputPorts: [],
      outputPorts: [{ id: "o1", name: "out", type: "Text", side: "output" }],
    },
    {
      id: "n2",
      x: 560,
      y: 180,
      title: "Output",
      content: "الناتج النهائي",
      type: "Text",
      inputPorts: [{ id: "i2", name: "in", type: "Text", side: "input" }],
      outputPorts: [],
    },
  ],
  edges: [
    {
      id: "e1",
      fromNodeId: "n1",
      toNodeId: "n2",
      fromPortId: "o1",
      toPortId: "i2",
    },
  ],
  frames: [],
};

function App() {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("جاهز");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    kind: "node" | "pan" | "frame";
    nodeId?: string;
    frameId?: string;
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
    panX?: number;
    panY?: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadProject();
      if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges) && Array.isArray(saved.frames)) {
        setProject(saved);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveProject(project).catch((err) => {
        console.error(err);
        setStatus("فشل حفظ المشروع");
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [project]);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return project.nodes;

    const q = search.toLowerCase();
    return project.nodes.filter((node) => {
      const value = `${node.title} ${node.content} ${node.type}`.toLowerCase();
      return value.includes(q);
    });
  }, [project, search]);

  const addNode = () => {
    const node = createNode(220 + Math.random() * 200, 170 + Math.random() * 170, "بطاقة جديدة");
    setProject((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    setStatus("تمت إضافة بطاقة جديدة");
  };

  const addFrame = () => {
    const newFrame: Frame = {
      id: crypto.randomUUID(),
      title: `إطار ${project.frames.length + 1}`,
      x: 180,
      y: 120,
      width: 340,
      height: 220,
      memberNodeIds: [],
    };

    setProject((prev) => ({ ...prev, frames: [...prev.frames, newFrame] }));
    setStatus("تم إنشاء إطار جديد");
  };

  const resetProject = () => {
    setProject(initialProject);
    setSelectedNodeId(null);
    setConnecting(null);
    setView({ x: 0, y: 0, scale: 1 });
    setStatus("تمت إعادة تعيين مساحة العمل");
  };

  const updateNode = (nodeId: string, patch: Partial<NodeItem>) => {
    setProject((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }));
  };

  const deleteNode = (nodeId: string) => {
    setProject((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((node) => node.id !== nodeId),
      edges: prev.edges.filter((edge) => edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId),
      frames: prev.frames.map((frame) => ({
        ...frame,
        memberNodeIds: frame.memberNodeIds.filter((id) => id !== nodeId),
      })),
    }));
    setSelectedNodeId((current) => (current === nodeId ? null : current));
    setStatus("تم حذف البطاقة");
  };

  const assignSelectedToFrame = (frameId: string) => {
    if (!selectedNodeId) {
      setStatus("اختر بطاقة أولاً");
      return;
    }

    setProject((prev) => ({
      ...prev,
      frames: prev.frames.map((frame) => {
        if (frame.id !== frameId) return frame;
        return {
          ...frame,
          memberNodeIds: [...new Set([...frame.memberNodeIds, selectedNodeId])],
        };
      }),
    }));

    setStatus("تمت إضافة البطاقة إلى الإطار");
  };

  const connect = (fromNodeId: string, fromPortId: string, toNodeId: string, toPortId: string) => {
    const fromNode = getNodeById(project.nodes, fromNodeId);
    const toNode = getNodeById(project.nodes, toNodeId);

    if (!fromNode || !toNode) return;

    const fromPort = fromNode.outputPorts.find((port) => port.id === fromPortId);
    const toPort = toNode.inputPorts.find((port) => port.id === toPortId);

    if (!fromPort || !toPort) return;
    if (!isCompatible(fromPort.type, toPort.type)) {
      setStatus("نوع المنفذ غير متوافق");
      return;
    }

    const duplicate = project.edges.some(
      (edge) =>
        edge.fromNodeId === fromNodeId &&
        edge.toNodeId === toNodeId &&
        edge.fromPortId === fromPortId &&
        edge.toPortId === toPortId
    );

    if (duplicate) {
      setStatus("الاتصال موجود مسبقًا");
      return;
    }

    if (createsCycle(project.nodes, project.edges, fromNodeId, toNodeId)) {
      setStatus("تم رفض الاتصال لأنه يؤدي إلى دورة");
      return;
    }

    setProject((prev) => ({
      ...prev,
      edges: [
        ...prev.edges,
        {
          id: crypto.randomUUID(),
          fromNodeId,
          toNodeId,
          fromPortId,
          toPortId,
        },
      ],
    }));

    setStatus("تم إنشاء اتصال جديد");
    setConnecting(null);
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "node-universe-project.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("تم تصدير المشروع");
  };

  const importProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.frames)) {
        throw new Error("تنسيق الملف غير صالح");
      }

      setProject(parsed);
      setStatus("تم استيراد المشروع");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "فشل الاستيراد");
    } finally {
      event.target.value = "";
    }
  };

  const onNodePointerDown = (event: React.PointerEvent<HTMLDivElement>, node: NodeItem) => {
    if ((event.target as HTMLElement).closest("button, input, textarea, select")) return;

    dragRef.current = {
      kind: "node",
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: node.x,
      origY: node.y,
    };
    setSelectedNodeId(node.id);
  };

  const onFramePointerDown = (event: React.PointerEvent<HTMLDivElement>, frame: Frame) => {
    event.stopPropagation();
    dragRef.current = {
      kind: "frame",
      frameId: frame.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: frame.x,
      origY: frame.y,
    };
  };

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".node") || (event.target as HTMLElement).closest(".frame")) return;

    dragRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      panX: view.x,
      panY: view.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    if (dragRef.current.kind === "node" && dragRef.current.nodeId) {
      const dx = (event.clientX - dragRef.current.startX) / view.scale;
      const dy = (event.clientY - dragRef.current.startY) / view.scale;

      setProject((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === dragRef.current!.nodeId
            ? {
                ...node,
                x: (dragRef.current!.origX ?? node.x) + dx,
                y: (dragRef.current!.origY ?? node.y) + dy,
              }
            : node
        ),
      }));
    }

    if (dragRef.current.kind === "frame" && dragRef.current.frameId) {
      const dx = (event.clientX - dragRef.current.startX) / view.scale;
      const dy = (event.clientY - dragRef.current.startY) / view.scale;

      setProject((prev) => ({
        ...prev,
        frames: prev.frames.map((frame) =>
          frame.id === dragRef.current!.frameId
            ? {
                ...frame,
                x: (dragRef.current!.origX ?? frame.x) + dx,
                y: (dragRef.current!.origY ?? frame.y) + dy,
              }
            : frame
        ),
      }));
    }

    if (dragRef.current.kind === "pan") {
      setView((prev) => ({
        ...prev,
        x: (dragRef.current!.panX ?? prev.x) + (event.clientX - dragRef.current!.startX),
        y: (dragRef.current!.panY ?? prev.y) + (event.clientY - dragRef.current!.startY),
      }));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const oldScale = view.scale;
    const newScale = Math.min(1.8, Math.max(0.45, oldScale * (event.deltaY < 0 ? 1.12 : 0.9)));

    const nextX = mouseX - ((mouseX - view.x) / oldScale) * newScale;
    const nextY = mouseY - ((mouseY - view.y) / oldScale) * newScale;

    setView({ x: nextX, y: nextY, scale: newScale });
  };

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <b>NODE</b> <span>UNIVERSE</span>
        </div>

        <button type="button" onClick={addNode}>+ بطاقة</button>
        <button type="button" onClick={addFrame}>+ إطار</button>
        {project.frames.length > 0 && selectedNodeId && (
          <button type="button" onClick={() => assignSelectedToFrame(project.frames[0].id)}>
            تجميع
          </button>
        )}
        <button type="button" onClick={resetProject}>إعادة تعيين</button>
        <button type="button" onClick={exportProject}>تصدير</button>

        <label className="import-button">
          <input type="file" accept="application/json" onChange={importProject} />
          <span>استيراد</span>
        </label>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في البطاقات..."
        />

        <div className="status">{status}</div>
      </header>

      <div
        ref={stageRef}
        className="stage"
        onPointerDown={onStagePointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <div
          className="scene"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          {project.frames.map((frame) => (
            <div
              key={frame.id}
              className="frame"
              style={{
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                width: `${frame.width}px`,
                height: `${frame.height}px`,
              }}
              onPointerDown={(event) => onFramePointerDown(event, frame)}
            >
              <div className="frame-header">
                <input
                  value={frame.title}
                  onChange={(event) =>
                    setProject((prev) => ({
                      ...prev,
                      frames: prev.frames.map((item) =>
                        item.id === frame.id ? { ...item, title: event.target.value } : item
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="delete-frame-btn"
                  onClick={(event) => {
                    event.stopPropagation();
                    setProject((prev) => ({
                      ...prev,
                      frames: prev.frames.filter((item) => item.id !== frame.id),
                    }));
                  }}
                >
                  ×
                </button>
              </div>
              {frame.memberNodeIds.length > 0 && (
                <div className="frame-members">
                  {frame.memberNodeIds.map((nodeId) => {
                    const member = getNodeById(project.nodes, nodeId);
                    return member ? <span key={nodeId}>{member.title}</span> : null;
                  })}
                </div>
              )}
            </div>
          ))}

          <svg className="wire-layer" aria-label="Layer of wires">
            {project.edges.map((edge) => {
              const from = getNodeById(project.nodes, edge.fromNodeId);
              const to = getNodeById(project.nodes, edge.toNodeId);
              if (!from || !to) return null;

              const path = getEdgePath(from, to);
              return <path key={edge.id} className="wire" d={path.d} />;
            })}
          </svg>

          {filteredNodes.map((node) => {
            const selected = node.id === selectedNodeId;
            const inFrame = project.frames.some((frame) => frame.memberNodeIds.includes(node.id));

            return (
              <div
                key={node.id}
                className={`node ${selected ? "selected" : ""} ${inFrame ? "in-frame" : ""}`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
                onPointerDown={(event) => onNodePointerDown(event, node)}
              >
                <div className="node-header">
                  <input
                    value={node.title}
                    onChange={(event) => updateNode(node.id, { title: event.target.value })}
                  />
                  <select
                    value={node.type}
                    onChange={(event) => updateNode(node.id, { type: event.target.value as PortType })}
                  >
                    {PORT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="delete-btn" onClick={() => deleteNode(node.id)}>
                    ×
                  </button>
                </div>

                <div className="ports">
                  <div className="port-column">
                    {node.inputPorts.map((port) => (
                      <button
                        key={port.id}
                        type="button"
                        className="port port-in"
                        onClick={() => {
                          if (connecting) {
                            connect(connecting.nodeId, connecting.portId, node.id, port.id);
                          }
                        }}
                      >
                        {port.name}
                      </button>
                    ))}
                  </div>

                  <div className="port-column">
                    {node.outputPorts.map((port) => (
                      <button
                        key={port.id}
                        type="button"
                        className="port port-out"
                        onClick={() => {
                          setConnecting({ nodeId: node.id, portId: port.id });
                          setStatus("حدد مدخل العقدة الهدف");
                        }}
                      >
                        {port.name}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={node.content}
                  onChange={(event) => updateNode(node.id, { content: event.target.value })}
                  placeholder="اكتب محتوى البطاقة..."
                />

                <div className="node-footer">
                  <span>{node.type}</span>
                  <span>{node.id.slice(0, 4)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
