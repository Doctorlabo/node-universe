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
import type { Frame, KnowledgeCard, NodeItem, PortType, ProjectState } from "./types";
import "./styles.css";

const initialKnowledgeCards: KnowledgeCard[] = [
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
    body: "ممرات تربط بين العقد وتدفق البيانات مع التحقق من توافق الأنواع ومنع الحلقات.