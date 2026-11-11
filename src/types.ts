export type PortType =
  | "Text"
  | "Number"
  | "Boolean"
  | "Image"
  | "Audio"
  | "Video"
  | "File"
  | "JSON"
  | "Table"
  | "Object"
  | "Collection"
  | "Any";

export interface Port {
  id: string;
  name: string;
  type: PortType;
  side: "input" | "output";
}

export interface NodeItem {
  id: string;
  x: number;
  y: number;
  title: string;
  content: string;
  type: PortType;
  inputPorts: Port[];
  outputPorts: Port[];
}

export interface Frame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  memberNodeIds: string[];
}

export interface Edge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPortId: string;
  toPortId: string;
}

export interface KnowledgeCard {
  id: string;
  title: string;
  body: string;
  tags: string[];
  source: string;
  createdAt: string;
  summary: string;
}

export interface AiTask {
  id: string;
  title: string;
  prompt: string;
  result: string;
  model: string;
  status: "idle" | "running" | "done";
}

export interface FileItem {
  id: string;
  name: string;
  type: "txt" | "md" | "json" | "csv" | "html";
  content: string;
  size: number;
}

export type WorkspaceMode = "graph" | "knowledge" | "ai" | "files";

export interface ProjectState {
  nodes: NodeItem[];
  edges: Edge[];
  frames: Frame[];
  cards: KnowledgeCard[];
  aiTasks: AiTask[];
  files: FileItem[];
}
