import { useEffect, useMemo, useRef, useState } from "react";
import { createNode, getEdgePath, getNodeById, hasCycle, isCompatible, PORT_TYPES } from "./lib/graph";
import { loadProject, saveProject } from "./store/db";
import type { Edge, NodeItem, PortType, ProjectState } from "./types";
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
};

function App() {
  const [project, setProject] = useState<ProjectState>(initialProject);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("جاهز");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string } | null>(null);

  const dragRef = useRef<{
    kind: "node" | "pan";
    nodeId?: string;
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadProject();
      if (saved && Array.isArray(saved.nodes) && Array.isArray(saved.edges)) {
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
      const hay = `${node.title} ${node.content} ${node.type}`.toLowerCase();
      return hay.includes(q);
    });
  }, [project, search]);

  const addNode = () => {
    const node = createNode(200 + Math.random() * 180, 150 + Math.random() * 180, "بطاقة جديدة");
    setProject((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
    setStatus("تمت إضافة بطاقة جديدة");
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
    }));
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

    if (hasCycle(project.nodes, project.edges, fromNodeId, toNodeId)) {
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

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".node")) return;

    dragRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;

    if (dragRef.current.kind === "node" && dragRef.current.nodeId) {
      const dx = event.clientX - dragRef.current.startX;
      const dy = event.clientY - dragRef.current.startY;

      setProject((prev) => ({
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === dragRef.current!.nodeId
            ? {
                ...node,
                x: (dragRef.current!.origX ?? node.x) + dx / 1.1,
                y: (dragRef.current!.origY ?? node.y) + dy / 1.1,
              }
            : node
        ),
      }));
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="brand">
          <b>NODE</b> <span>UNIVERSE</span>
        </div>

        <button onClick={addNode}>+ بطاقة</button>
        <button onClick={() => setProject(initialProject)}>إعادة تعيين</button>

        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث في البطاقات..."
        />

        <div className="status">{status}</div>
      </header>

      <div className="stage" onPointerDown={onStagePointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
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
  );
}

export default App;
