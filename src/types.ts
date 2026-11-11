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

export interface ProjectState {
  nodes: NodeItem[];
  edges: Edge[];
  frames: Frame[];
}
