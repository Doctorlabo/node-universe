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
import type {
  AiTask,
  FileItem,
  Frame,
  KnowledgeCard,
  NodeItem,
  PortType,
  ProjectState,
  WorkspaceMode,
} from "./types";
import "./styles.css";

const initialCards: KnowledgeCard[] = [
  {
    id: "k1",
    title: "نظام المعرفة",
    body: "إدارة المعرفة محلياً عبر بطاقات مفاهيمية، روابط دلالية، ومراجع قابلة للبحث.",
    tags: ["knowledge", "memory", "local"],
    source: "Knowledge Studio",
    createdAt: new Date().toISOString(),
    summary: "قاعدة المعرفة الأساسية",
  },
  {
    id: "k2",
    title: "وحدة العقد",
    body: "تمثل كل عقدة وحدة مستقلة من المعالجة والبيانات، مع منافذ إدخال/إخراج ومحتوى نصي قابل للتحرير.",
    tags: ["nodes", "graph", "studio"],
    source: "Node Editor",
    createdAt: new Date().toISOString(),
    summary: "قيمة معرفية للعقد",
  },
];

const initialAiTasks: AiTask[] = [
  {
    id: "ai-1",
    title: "تلخيص مفهوم",
    prompt: "تلخيص فكرة المشروع في 3 نقاط.",
    result: "نظام محلي أولاً، يربط المعرفة بالعقد، ويؤدي العمليات داخل مساحة عمل موحدة.",
    model: "local-heuristic",
    status: "done",
  },
];

const initialFiles: FileItem[] = [
  {
    id: "f-1",
    name: "project-overview.md",
    type: "md",
    content: "# NODE UNIVERSE\n\nمشروع معرفي وبنائي محلي.",
    size: 120,
  },
  {
    id: "f-2",
    name: "notes.json",
    type: "json",
    content: JSON.stringify({ project: "NODE UNIVERSE", status: "active" }, null, 2),
    size: 180,
  },
];

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
  cards: initialCards,
  aiTasks: initialAiTasks,
  files: initialFiles,
};

function App() {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("جاهز");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(initialCards[0]?.id ?? null);
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string } | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceMode>("graph");
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
      if (
        saved &&
        Array.isArray(saved.nodes) &&
        Array.isArray(saved.edges) &&
        Array.isArray(saved.frames) &&
        Array.isArray(saved.cards) &&
        Array.isArray(saved.aiTasks) &&
        Array.isArray(saved.files)
      ) {
        setProject(saved);
        setSelectedCardId(saved.cards[0]?.id ?? null);
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

  const selectedCard = useMemo(
    () => project.cards.find((card) => card.id === selectedCardId) ?? null,
    [project.cards, selectedCardId]
  );

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return project.nodes;
    const q = search.toLowerCase();
    return project.nodes.filter((node) => {
      const value = `${node.title} ${node.content} ${node.type}`.toLowerCase();
      return value.includes(q);
    });
  }, [project, search]);

  const filteredCards = useMemo(() => {
    if (!search.trim()) return project.cards;
    const q = search.toLowerCase();
    return project.cards.filter((card) => {
      const hay = `${card.title} ${card.body} ${card.summary} ${card.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [project.cards, search]);

  const addNode = () => {
    const node = createNode(220 + Math.random() * 200, 170 + Math.random() * 170, "بطاقة جديدة");
    setProject((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    setStatus("تمت إضافة بطاقة جديدة");
  };

  const addFrame = () => {
    const frame: Frame = {
      id: crypto.randomUUID(),
      title: `إطار ${project.frames.length + 1}`,
      x: 180,
      y: 120,
      width: 340,
      height: 220,
      memberNodeIds: [],
    };

    setProject((prev) => ({ ...prev, frames: [...prev.frames, frame] }));
    setStatus("تم إنشاء إطار جديد");
  };

  const addCard = () => {
    const card: KnowledgeCard = {
      id: crypto.randomUUID(),
      title: "بطاقة جديدة",
      body: "اكتب محتوى البطاقة...",
      tags: ["new"],
      source: "manual",
      createdAt: new Date().toISOString(),
      summary: "ملخص البطاقة",
    };

    setProject((prev) => ({ ...prev, cards: [card, ...prev.cards] }));
    setSelectedCardId(card.id);
    setStatus("تمت إضافة بطاقة معرفية جديدة");
  };

  const deleteCard = (id: string) => {
    setProject((prev) => ({ ...prev, cards: prev.cards.filter((card) => card.id !== id) }));
    setSelectedCardId((current) => (current === id ? null : current));
    setStatus("تم حذف البطاقة");
  };

  const updateCard = (id: string, patch: Partial<KnowledgeCard>) => {
    setProject((prev) => ({
      ...prev,
      cards: prev.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    }));
  };

  const addAiTask = () => {
    const task: AiTask = {
      id: crypto.randomUUID(),
      title: "مهمة ذكاء اصطناعي جديدة",
      prompt: "اكتب فكرة أو سؤالًا...",
      result: "النتيجة ستظهر بعد التنفيذ المحلي.",
      model: "local-heuristic",
      status: "idle",
    };

    setProject((prev) => ({ ...prev, aiTasks: [task, ...prev.aiTasks] }));
    setStatus("تمت إضافة مهمة جديدة إلى AI Lab");
  };

  const runAiTask = (taskId: string) => {
    setProject((prev) => ({
      ...prev,
      aiTasks: prev.aiTasks.map((task) => {
        if (task.id !== taskId) return task;

        const prompt = task.prompt.toLowerCase();
        let result = "تمت معالجة المهمة محلياً.";

        if (prompt.includes("تلخيص") || prompt.includes("summary")) {
          result = "ملخص: المشروع مركّز حول المعرفة والعقد والاختبارات التشغيلية، مع دعم محلي للتخزين والتدفق.";
        } else if (prompt.includes("تحليل") || prompt.includes("analysis")) {
          result = "تحليل: تم اكتشاف عناصر رئيسية: العقد، المعرفة، الملفات، والتدفق. النقطة المركزية هي دمج المحتوى والعمليات في مساحة واحدة.";
        } else if (prompt.includes("فكرة") || prompt.includes("idea")) {
          result = "فكرة: إنشاء مساحة عمل معرفية تتضمن بطاقات، محرك عقد، ملفات، ومخرجات قابلة للتحويل.";
        } else if (prompt.includes("خطة") || prompt.includes("plan")) {
          result = "خطة: 1) تنظيم المعرفة 2) ربط العقد 3) تشغيل الملفات 4) تقييم النتائج 5) تحسين الأتمتة.";
        }

        return {
          ...task,
          status: "done",
          result,
        };
      }),
    }));

    setStatus("تم تنفيذ المهمة محليًا");
  };

  const addFile = () => {
    const file: FileItem = {
      id: crypto.randomUUID(),
      name: `note-${Date.now()}.txt`,
      type: "txt",
      content: "اكتب محتوى الملف هنا...",
      size: 110,
    };

    setProject((prev) => ({ ...prev, files: [file, ...prev.files] }));
    setStatus("تمت إضافة ملف جديد");
  };

  const updateFile = (id: string, patch: Partial<FileItem>) => {
    setProject((prev) => ({
      ...prev,
      files: prev.files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
    }));
  };

  const resetProject = () => {
    setProject(initialProject);
    setSelectedNodeId(null);
    setConnecting(null);
    setSelectedCardId(initialCards[0]?.id ?? null);
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

      if (
        !Array.isArray(parsed.nodes) ||
        !Array.isArray(parsed.edges) ||
        !Array.isArray(parsed.frames) ||
        !Array.isArray(parsed.cards) ||
        !Array.isArray(parsed.aiTasks) ||
        !Array.isArray(parsed.files)
      ) {
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
        <button type="button" onClick={addCard}>+ بطاقة معرفة</button>
        <button type="button" onClick={exportProject}>تصدير</button>
        <label className="import-button">
          <input type="file" accept="application/json" onChange={importProject} />
          <span>استيراد</span>
        </label>

        <div className="workspace-toggle">
          <button type="button" className={workspaceTab === "graph" ? "active" : ""} onClick={() => setWorkspaceTab("graph")}>Graph</button>
          <button type="button" className={workspaceTab === "knowledge" ? "active" : ""} onClick={() => setWorkspaceTab("knowledge")}>Knowledge</button>
          <button type="button" className={workspaceTab === "ai" ? "active" : ""} onClick={() => setWorkspaceTab("ai")}>AI Lab</button>
          <button type="button" className={workspaceTab === "files" ? "active" : ""} onClick={() => setWorkspaceTab("files")}>File Factory</button>
        </div>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث..."
        />

        <div className="status">{status}</div>
      </header>

      {workspaceTab === "knowledge" && (
        <div className="knowledge-panel">
          <div className="panel-header-row">
            <h3>Knowledge Studio</h3>
            <button type="button" onClick={addCard}>+ بطاقة</button>
          </div>

          <div className="knowledge-grid">
            <aside className="knowledge-sidebar">
              {filteredCards.length === 0 && <div className="empty-state">لا توجد بطاقات</div>}
              {filteredCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`card-item ${selectedCardId === card.id ? "selected" : ""}`}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  <span>{card.title}</span>
                  <small>{card.summary}</small>
                </button>
              ))}
            </aside>

            <div className="knowledge-editor">
              {selectedCard ? (
                <>
                  <input
                    value={selectedCard.title}
                    onChange={(e) => updateCard(selectedCard.id, { title: e.target.value })}
                  />
                  <input
                    value={selectedCard.summary}
                    onChange={(e) => updateCard(selectedCard.id, { summary: e.target.value })}
                  />
                  <input
                    value={selectedCard.tags.join(", ")}
                    onChange={(e) =>
                      updateCard(selectedCard.id, {
                        tags: e.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                  <input
                    value={selectedCard.source}
                    onChange={(e) => updateCard(selectedCard.id, { source: e.target.value })}
                  />
                  <textarea
                    value={selectedCard.body}
                    onChange={(e) => updateCard(selectedCard.id, { body: e.target.value })}
                  />
                  <button type="button" className="danger" onClick={() => deleteCard(selectedCard.id)}>
                    حذف البطاقة
                  </button>
                </>
              ) : (
                <div className="empty-state large">اختر بطاقة معرفية للبدء</div>
              )}
            </div>
          </div>
        </div>
      )}

      {workspaceTab === "ai" && (
        <div className="ai-panel">
          <div className="panel-header-row">
            <h3>AI Lab</h3>
            <button type="button" onClick={addAiTask}>+ مهمة</button>
          </div>

          <div className="ai-grid">
            {project.aiTasks.map((task) => (
              <div key={task.id} className="ai-card">
                <div className="ai-topline">
                  <strong>{task.title}</strong>
                  <span className={`status-pill ${task.status}`}>{task.status}</span>
                </div>

                <input
                  value={task.prompt}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      aiTasks: prev.aiTasks.map((item) =>
                        item.id === task.id ? { ...item, prompt: e.target.value } : item
                      ),
                    }))
                  }
                />

                <textarea
                  value={task.result}
                  onChange={(e) =>
                    setProject((prev) => ({
                      ...prev,
                      aiTasks: prev.aiTasks.map((item) =>
                        item.id === task.id ? { ...item, result: e.target.value } : item
                      ),
                    }))
                  }
                />

                <button type="button" onClick={() => runAiTask(task.id)}>تشغيل</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {workspaceTab === "files" && (
        <div className="file-panel">
          <div className="panel-header-row">
            <h3>File Factory</h3>
            <button type="button" onClick={addFile}>+ ملف</button>
          </div>

          <div className="file-grid">
            {project.files.map((file) => (
              <div key={file.id} className="file-card">
                <div className="file-header">
                  <input
                    value={file.name}
                    onChange={(e) => updateFile(file.id, { name: e.target.value })}
                  />
                  <select
                    value={file.type}
                    onChange={(e) =>
                      updateFile(file.id, {
                        type: e.target.value as FileItem["type"],
                      })
                    }
                  >
                    <option value="txt">txt</option>
                    <option value="md">md</option>
                    <option value="json">json</option>
                    <option value="csv">csv</option>
                    <option value="html">html</option>
                  </select>
                </div>

                <textarea
                  value={file.content}
                  onChange={(e) =>
                    updateFile(file.id, {
                      content: e.target.value,
                      size: e.target.value.length,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {workspaceTab === "graph" && (
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
              return (
                <div
                  key={node.id}
                  className={`node ${selected ? "selected" : ""}`}
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
                        <option key={type} value={type}>{type}</option>
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
      )}
    </div>
  );
}

export default App;

