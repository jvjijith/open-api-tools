'use client';

import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMergeStore } from '../../store/useMergeStore';
import { parseRef } from '../../lib/openapi/graph';
import { Maximize2, Minimize2, Database, Network } from 'lucide-react';

const METHOD_THEMES: Record<string, { labelBg: string; text: string; border: string; glow: string }> = {
  GET: { labelBg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/50', glow: 'shadow-emerald-500/10' },
  POST: { labelBg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50', glow: 'shadow-blue-500/10' },
  PUT: { labelBg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/50', glow: 'shadow-amber-500/10' },
  PATCH: { labelBg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/50', glow: 'shadow-purple-500/10' },
  DELETE: { labelBg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/50', glow: 'shadow-rose-500/10' }
};

export default function ReactFlowPanel() {
  const { selectedEndpoints, graph, resolvedDeps } = useMergeStore();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { nodes, edges } = useMemo(() => {
    const nodesList: Node[] = [];
    const edgesList: Edge[] = [];

    if (selectedEndpoints.length === 0) {
      return { nodes: [], edges: [] };
    }

    const resolvedSchemasList = Array.from(resolvedDeps.schemas) as string[];
    const rowHeight = 85;
    
    // 1. Create Endpoint Nodes (Column 0: X = 50)
    selectedEndpoints.forEach((epId, index) => {
      const ep = graph.endpoints.get(epId);
      if (!ep) return;
      
      const methodUpper = ep.method.toUpperCase();
      const theme = METHOD_THEMES[methodUpper] || {
        labelBg: 'bg-slate-500/20',
        text: 'text-slate-400',
        border: 'border-slate-500/40',
        glow: 'shadow-slate-500/5'
      };

      nodesList.push({
        id: epId,
        type: 'default',
        data: {
          label: (
            <div className="p-2 text-left select-none space-y-1.5 font-sans">
              <div className="flex items-center justify-between text-[8px] font-mono font-bold tracking-wider opacity-60">
                <span className="truncate max-w-[95px]">{ep.specName}</span>
                <span className="text-[7px] border border-border px-1 rounded font-mono uppercase">API</span>
              </div>
              <div className="flex items-center gap-2 mt-1 border-t border-border/15 pt-1.5">
                <span className={`text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded ${theme.labelBg} ${theme.text}`}>
                  {methodUpper}
                </span>
                <span className="text-[10px] font-mono font-bold text-slate-100 truncate max-w-[110px]">
                  {ep.path}
                </span>
              </div>
            </div>
          )
        },
        position: { x: 50, y: index * rowHeight },
        className: `border ${theme.border} bg-[#080d1e] rounded-lg shadow-lg w-[190px] ${theme.glow}`
      });

      // Add direct edges to Schema nodes
      ep.refs.forEach((ref) => {
        const parsed = parseRef(ref);
        if (parsed && parsed.type === 'schemas') {
          const targetSchemaKey = `${ep.specId}::${parsed.name}`;
          if (resolvedDeps.schemas.has(targetSchemaKey)) {
            let strokeColor = '#6366f1';
            if (methodUpper === 'GET') strokeColor = '#10b981';
            if (methodUpper === 'POST') strokeColor = '#3b82f6';
            if (methodUpper === 'PUT' || methodUpper === 'PATCH') strokeColor = '#f59e0b';
            if (methodUpper === 'DELETE') strokeColor = '#rose-500';

            edgesList.push({
              id: `edge-${epId}-${targetSchemaKey}`,
              source: epId,
              target: targetSchemaKey,
              animated: true,
              type: 'smoothstep',
              style: { stroke: strokeColor, strokeWidth: 2, opacity: 0.85 },
              markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor }
            });
          }
        }
      });
    });

    // 2. Create Schema Nodes (Column 1: X = 350, Column 2: X = 650)
    const rootSchemaKeys = new Set<string>();
    
    selectedEndpoints.forEach((epId) => {
      const ep = graph.endpoints.get(epId);
      if (!ep) return;
      ep.refs.forEach((ref) => {
        const parsed = parseRef(ref);
        if (parsed && parsed.type === 'schemas') {
          rootSchemaKeys.add(`${ep.specId}::${parsed.name}`);
        }
      });
    });

    const rootSchemas = resolvedSchemasList.filter((key) => rootSchemaKeys.has(key));
    const childSchemas = resolvedSchemasList.filter((key) => !rootSchemaKeys.has(key));

    // Render Root schemas (Column 1)
    rootSchemas.forEach((key, index) => {
      const s = graph.schemas.get(key);
      if (!s) return;

      nodesList.push({
        id: key,
        type: 'default',
        data: {
          label: (
            <div className="p-2 text-left select-none space-y-1.5 font-sans">
              <div className="flex items-center justify-between text-[8px] font-mono font-bold tracking-wider opacity-60">
                <span className="truncate max-w-[95px]">{s.specName}</span>
                <Database size={10} className="text-indigo-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-1 border-t border-border/15 pt-1.5 font-mono">
                <span className="text-[10px] font-bold text-indigo-300 truncate max-w-[145px]">
                  {s.name}
                </span>
              </div>
            </div>
          )
        },
        position: { x: 340, y: index * rowHeight },
        className: 'border border-indigo-500/40 bg-[#090b1e] text-indigo-200 rounded-lg shadow-lg w-[190px] shadow-indigo-500/5'
      });

      // Add child edges (schema-to-schema)
      s.refs.forEach((ref) => {
        const parsed = parseRef(ref);
        if (parsed && parsed.type === 'schemas') {
          const targetKey = `${s.specId}::${parsed.name}`;
          if (resolvedDeps.schemas.has(targetKey)) {
            edgesList.push({
              id: `edge-${key}-${targetKey}`,
              source: key,
              target: targetKey,
              type: 'smoothstep',
              style: { stroke: '#a855f7', strokeWidth: 1.5, opacity: 0.7 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
            });
          }
        }
      });
    });

    // Render Child schemas (Column 2)
    childSchemas.forEach((key, index) => {
      const s = graph.schemas.get(key);
      if (!s) return;

      nodesList.push({
        id: key,
        type: 'default',
        data: {
          label: (
            <div className="p-2 text-left select-none space-y-1.5 font-sans">
              <div className="flex items-center justify-between text-[8px] font-mono font-bold tracking-wider opacity-60">
                <span className="truncate max-w-[95px]">{s.specName}</span>
                <Database size={10} className="text-purple-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-1 border-t border-border/15 pt-1.5 font-mono">
                <span className="text-[10px] font-bold text-purple-300 truncate max-w-[145px]">
                  {s.name}
                </span>
              </div>
            </div>
          )
        },
        position: { x: 630, y: index * rowHeight },
        className: 'border border-purple-500/40 bg-[#0c091e] text-purple-200 rounded-lg shadow-lg w-[190px] shadow-purple-500/5'
      });

      s.refs.forEach((ref) => {
        const parsed = parseRef(ref);
        if (parsed && parsed.type === 'schemas') {
          const targetKey = `${s.specId}::${parsed.name}`;
          if (resolvedDeps.schemas.has(targetKey)) {
            edgesList.push({
              id: `edge-${key}-${targetKey}`,
              source: key,
              target: targetKey,
              type: 'smoothstep',
              style: { stroke: '#a855f7', strokeWidth: 1.5, opacity: 0.7 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' }
            });
          }
        }
      });
    });

    return { nodes: nodesList, edges: edgesList };
  }, [selectedEndpoints, graph, resolvedDeps]);

  return (
    <div className={isFullscreen ? "fixed inset-0 z-[100] bg-[#040815] p-2 animate-fadeIn" : "w-full h-full bg-[#040815] relative select-none"}>
      {/* Fullscreen view toggle button */}
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="absolute top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-primary border border-border text-white text-xs font-bold rounded-lg cursor-pointer transition-all duration-150 shadow"
        title={isFullscreen ? 'Exit Full Screen' : 'Go Full Screen'}
      >
        {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
      </button>

      {nodes.length > 0 ? (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.15}
          maxZoom={1.5}
        >
          <Background color="#1e293b" gap={16} size={1} />
          <Controls />
          <MiniMap 
            nodeColor={(node) => {
              if (node.className?.includes('emerald')) return 'rgba(16, 185, 129, 0.4)';
              if (node.className?.includes('blue')) return 'rgba(59, 130, 246, 0.4)';
              if (node.className?.includes('amber')) return 'rgba(245, 158, 11, 0.4)';
              if (node.className?.includes('rose')) return 'rgba(239, 68, 68, 0.4)';
              if (node.className?.includes('indigo')) return 'rgba(99, 102, 241, 0.4)';
              return 'rgba(168, 85, 247, 0.4)';
            }}
            maskColor="rgba(3, 7, 18, 0.7)"
            style={{ backgroundColor: '#0b0f19', border: '1px solid #1f2937' }}
          />
        </ReactFlow>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <Network size={36} className="opacity-10 mb-3" />
          <p className="text-xs">No endpoints selected to build graph</p>
          <p className="text-[10px] opacity-70 mt-1">Select API endpoints in the Explorer Panel to view dependencies.</p>
        </div>
      )}
    </div>
  );
}
