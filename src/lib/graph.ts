import type { Edge, NodeItem, Port, PortType } from "../types";

export const NODE_WIDTH = 260;
export const NODE_HEIGHT = 170;

export const PORT_TYPES: PortType[] = [
  "Any",
  "Text",
  "Number",
  "Boolean",
  "Image",
  "Audio",
  "Video",
  "File",
  "JSON",
  "Table",
  "Object",
  "Collection",
];

export function createPort(
  id: string,
  name: string,
  side: "input" | "output",
  type: PortType = "Any"
): Port {
  return { id, name, type, side };
}

export function createNode(x: number, y: number, title = "Node"): NodeItem {
  return {
    id: crypto.randomUUID(),
    x,
    y,
    title,
    content: "",
    type: "Any",
    inputPorts: [createPort(crypto.randomUUID(), "in", "input", "Any")],
    outputPorts: [createPort(crypto.randomUUID(), "out", "output", "Any")],
  };
}

export function isCompatible(sourceType: PortType, targetType: PortType): boolean {
  return sourceType === targetType || sourceType === "Any" || targetType === "Any";
}

export function getNodeById(nodes: NodeItem[], id: string) {
  return nodes.find((node) => node.id === id);
}

export function getEdgePath(from: NodeItem, to: NodeItem) {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + 60;
  const x2 = to.x;
  const y2 = to.y + 60;
  const curve = Math.max(90, Math.abs(x2 - x1) * 0.5);

  return {
    d: `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`,
  };
}

export function createsCycle(
  nodes: NodeItem[],
  edges: Edge[],
  fromNodeId: string,
  toNodeId: string
): boolean {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node.id, []));

  edges.forEach((edge) => {
    const list = adjacency.get(edge.fromNodeId);
    if (list) list.push(edge.toNodeId);
  });

  const visited = new Set<string>();
  const path = new Set<string>();

  const dfs = (nodeId: string): boolean => {
    if (nodeId === fromNodeId) return true;
    if (path.has(nodeId)) return false;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    path.add(nodeId);

    for (const next of adjacency.get(nodeId) ?? []) {
      if (dfs(next)) return true;
    }

    path.delete(nodeId);
    return false;
  };

  return dfs(toNodeId);
}
