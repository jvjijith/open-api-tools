'use client';

import React, { useState } from 'react';
import { useMergeStore } from '../../store/useMergeStore';
import { AlertOctagon, Network, CheckSquare, ListPlus, Edit3, CornerDownRight, ArrowRight, Save, Search } from 'lucide-react';
import ReactFlowPanel from './ReactFlowPanel';

export default function DetailPanel() {
  const {
    activeTab,
    setActiveTab,
    conflicts,
    resolveConflict,
    resolvedDeps,
    graph,
    mergePolicy,
    updateMergePolicy,
    migrationLogs
  } = useMergeStore();

  const [renameInputs, setRenameInputs] = useState<Record<string, string>>({});
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});
  const [editingManualId, setEditingManualId] = useState<string | null>(null);
  const [schemaSearch, setSchemaSearch] = useState('');

  const unresolvedCount = conflicts.filter(c => !c.resolution).length;

  const handleRenameSave = (conflictId: string, originalName: string) => {
    const inputName = renameInputs[conflictId] || `${originalName}_v2`;
    resolveConflict(conflictId, 'rename', { rename: inputName });
  };

  const handleManualEditStart = (conflictId: string, itemA: any) => {
    setEditingManualId(conflictId);
    setManualInputs({
      ...manualInputs,
      [conflictId]: JSON.stringify(itemA, null, 2)
    });
  };

  const handleManualSave = (conflictId: string) => {
    try {
      const parsed = JSON.parse(manualInputs[conflictId]);
      resolveConflict(conflictId, 'manual', { manualContent: parsed });
      setEditingManualId(null);
    } catch (e) {
      alert('Invalid JSON! Please verify schema structure.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-card text-foreground">
      {/* Workspace Tabs Header */}
      <div className="flex border-b border-border shrink-0 bg-background/50 select-none">
        <button
          onClick={() => setActiveTab('explorer')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
            activeTab === 'explorer'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListPlus size={14} /> Spec Entities
        </button>

        <button
          onClick={() => setActiveTab('conflicts')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 relative ${
            activeTab === 'conflicts'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertOctagon size={14} /> Resolutions Center
          {unresolvedCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer border-b-2 ${
            activeTab === 'graph'
              ? 'border-primary text-primary bg-card'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Network size={14} /> Spec Graph
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: SPEC ENTITIES (SCHEMA EXPLORER) */}
        {activeTab === 'explorer' && (
          <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
            
            {/* COMPILER CONFIGURATION DASHBOARD */}
            <div className="bg-background/40 border border-border/80 rounded-xl p-4 space-y-4 select-none animate-fadeIn shrink-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary font-mono">
                Merge Policy Settings
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs font-sans">
                {/* Mode Toggle */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase font-mono block">
                    Validation Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateMergePolicy({
                        allowCrossVersionMerge: false,
                        allowMinorVersionMismatch: false,
                        strictValidation: true
                      })}
                      className={`flex-1 py-1.5 text-[10px] font-bold border rounded-lg cursor-pointer text-center transition-all ${
                        !mergePolicy.allowCrossVersionMerge
                          ? 'bg-primary border-primary text-white shadow'
                          : 'bg-input border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Strict Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => updateMergePolicy({
                        allowCrossVersionMerge: true,
                        allowMinorVersionMismatch: true,
                        strictValidation: false
                      })}
                      className={`flex-1 py-1.5 text-[10px] font-bold border rounded-lg cursor-pointer text-center transition-all ${
                        mergePolicy.allowCrossVersionMerge
                          ? 'bg-amber-600 border-amber-500 text-white shadow'
                          : 'bg-input border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Compatibility Mode
                    </button>
                  </div>
                </div>

                {/* Target Output spec version */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase font-mono block">
                    Target Output Spec Version
                  </label>
                  <select
                    value={mergePolicy.targetOutputVersion}
                    onChange={(e) => updateMergePolicy({ targetOutputVersion: e.target.value as any })}
                    className="w-full bg-input border border-border text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary text-foreground/90 font-mono"
                  >
                    <option value="3.0.0">OpenAPI 3.0.3 (Recommended)</option>
                    <option value="3.1.0">OpenAPI 3.1.0</option>
                    <option value="2.0">Swagger 2.0</option>
                  </select>
                </div>
              </div>

              {/* Strict Mode explanations */}
              <p className="text-[10px] text-muted-foreground leading-normal italic font-sans border-t border-border/20 pt-2.5">
                {!mergePolicy.allowCrossVersionMerge 
                  ? '🛡️ Strict Mode prevents semantic inconsistencies by enforcing that only specs of identical formats are compiled together.'
                  : '⚠️ Compatibility Mode enables auto-upgrading older formats (Swagger 2.0) into Canonical Intermediate AST structures prior to compiler generation.'
                }
              </p>
            </div>

            {/* MIGRATION LOG TERMINAL OVERLAY */}
            {migrationLogs.length > 0 && (
              <div className="bg-black/60 border border-border/80 rounded-xl p-3 font-mono text-[9px] leading-relaxed shrink-0 animate-fadeIn select-text">
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Canonical IR Migration Log
                </span>
                <div className="max-h-[105px] overflow-y-auto space-y-0.5">
                  {migrationLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`${
                        log.startsWith('[Validator Error]')
                          ? 'text-rose-400 font-bold'
                          : log.startsWith('[Upgrade') || log.startsWith('[Migration]')
                          ? 'text-indigo-400'
                          : log.startsWith('[Policy]')
                          ? 'text-slate-400'
                          : 'text-emerald-400 font-medium'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <hr className="border-border/40 shrink-0 select-none" />

            <div className="flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Merged Schema Explorer
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Inspect unified properties and schemas compiled from active endpoints.
                </p>
              </div>
              <span className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-mono text-indigo-300 shrink-0">
                Total Schemas: {resolvedDeps.schemas.size}
              </span>
            </div>

            {/* Search Schema */}
            <div className="relative shrink-0 select-none">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search schemas..."
                value={schemaSearch}
                onChange={(e) => setSchemaSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-input border border-border text-xs rounded-lg focus:outline-none focus:border-primary placeholder:text-muted-foreground"
              />
            </div>

            {/* Schema nodes */}
            <div className="flex-1 space-y-3">
              {(Array.from(resolvedDeps.schemas) as string[])
                .map((key) => graph.schemas.get(key)!)
                .filter((s) => s && s.name.toLowerCase().includes(schemaSearch.toLowerCase()))
                .map((s) => (
                  <div key={`${s.specId}::${s.name}`} className="bg-background/40 border border-border/80 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono">
                          {s.specName}
                        </span>
                        <h4 className="text-xs font-mono font-bold text-indigo-300 mt-1.5">
                          {s.name}
                        </h4>
                      </div>
                    </div>

                    {/* Properties breakdown */}
                    {s.raw?.properties ? (
                      <div className="border-t border-border/40 pt-2 text-[10px] space-y-1">
                        <span className="font-bold text-muted-foreground text-[9px] uppercase tracking-wider block mb-1">
                          Properties:
                        </span>
                        {Object.entries(s.raw.properties).map(([propName, propVal]: [string, any]) => {
                          const isRequired = Array.isArray(s.raw.required) && s.raw.required.includes(propName);
                          return (
                            <div key={propName} className="flex justify-between items-center border-b border-border/20 py-1 font-mono">
                              <span className="text-foreground/95">
                                {propName}
                                {isRequired && <span className="text-rose-400 ml-0.5">*</span>}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-muted-foreground text-[9px]">
                                  {propVal.type || 'object'}
                                </span>
                                {propVal['$ref'] && (
                                  <span className="px-1 py-0.2 bg-purple-500/10 text-purple-300 text-[8px] border border-purple-500/25 rounded">
                                    Ref
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground italic border-t border-border/40 pt-2">
                        Simple or customized structural definition (no direct properties).
                      </p>
                    )}
                  </div>
                ))}

              {resolvedDeps.schemas.size === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Network size={28} className="opacity-20 mb-2" />
                  <p className="text-xs">No schemas aggregate in this session</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Please check endpoint checkbox items in the Explorer Panel.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RESOLUTIONS CENTER (CONFLICTS) */}
        {activeTab === 'conflicts' && (
          <div className="flex flex-col h-full p-4 overflow-y-auto space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Resolutions Center
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Manage identifier clashes or model incompatibilities detected across microservices.
              </p>
            </div>

            {/* List of conflicts */}
            <div className="space-y-4">
              {conflicts.map((c) => {
                const isManualEditing = editingManualId === c.id;
                
                return (
                  <div
                    key={c.id}
                    className={`border rounded-xl p-4 space-y-3.5 transition-all duration-200 ${
                      c.resolution
                        ? 'border-emerald-500/30 bg-emerald-950/5'
                        : 'border-rose-500/30 bg-rose-950/5 shadow-md shadow-rose-950/5 animate-pulse-slow'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            c.type === 'schema'
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : c.type === 'path'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {c.type} clash
                        </span>
                        <h4 className="text-xs font-mono font-bold text-foreground/95 mt-1.5 flex items-center gap-1.5">
                          {c.name}
                        </h4>
                      </div>

                      <span className="text-[9px] text-muted-foreground font-mono">
                        {c.resolution ? (
                          <span className="text-emerald-400 font-bold border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Resolved ({c.resolution})
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 rounded-full">
                            Requires Input
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Conflict context details */}
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Identifier exists in both <strong className="text-foreground">{c.specAName}</strong> and{' '}
                      <strong className="text-foreground">{c.specBName}</strong> but contains differing schemas or configurations.
                    </p>

                    {/* Visual Buttons Resolution Area */}
                    {!isManualEditing && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/30">
                        {/* Option 1: Keep A */}
                        <button
                          onClick={() => resolveConflict(c.id, 'keepA')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold rounded-lg border cursor-pointer transition-all duration-150 ${
                            c.resolution === 'keepA'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <CheckSquare size={11} /> Keep Spec A ({c.specAName.slice(0, 12)})
                        </button>

                        {/* Option 2: Keep B */}
                        <button
                          onClick={() => resolveConflict(c.id, 'keepB')}
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold rounded-lg border cursor-pointer transition-all duration-150 ${
                            c.resolution === 'keepB'
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <CheckSquare size={11} /> Keep Spec B ({c.specBName.slice(0, 12)})
                        </button>

                        {/* Option 3: Rename (Only for schemas/security) */}
                        {(c.type === 'schema' || c.type === 'security') && (
                          <button
                            onClick={() => {
                              const currentRename = renameInputs[c.id] || `${c.name}_v2`;
                              setRenameInputs({ ...renameInputs, [c.id]: currentRename });
                              resolveConflict(c.id, 'rename', { rename: currentRename });
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold rounded-lg border cursor-pointer transition-all duration-150 ${
                              c.resolution === 'rename'
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Edit3 size={11} /> Auto Rename (Spec B)
                          </button>
                        )}

                        {/* Option 4: Manual Merge (Only for schemas) */}
                        {c.type === 'schema' && (
                          <button
                            onClick={() => handleManualEditStart(c.id, c.itemA)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 text-[9px] font-bold rounded-lg border cursor-pointer transition-all duration-150 ${
                              c.resolution === 'manual'
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Edit3 size={11} /> Manual Merge
                          </button>
                        )}
                      </div>
                    )}

                    {/* RENAME INPUT CARD */}
                    {c.resolution === 'rename' && renameInputs[c.id] !== undefined && (
                      <div className="flex gap-2 items-center bg-secondary/30 p-2.5 rounded-lg border border-border/50 animate-fadeIn shrink-0">
                        <CornerDownRight size={12} className="text-muted-foreground shrink-0" />
                        <div className="flex-1">
                          <label className="text-[8px] font-bold text-muted-foreground uppercase font-mono block mb-1">
                            Rewrite Spec B Schema Name
                          </label>
                          <input
                            type="text"
                            value={renameInputs[c.id]}
                            onChange={(e) => setRenameInputs({ ...renameInputs, [c.id]: e.target.value })}
                            className="w-full bg-input border border-border text-[10px] font-mono px-2 py-1 rounded focus:outline-none focus:border-primary text-indigo-300"
                          />
                        </div>
                        <button
                          onClick={() => handleRenameSave(c.id, c.name)}
                          className="px-2.5 py-1.5 bg-primary hover:bg-primary/90 text-white text-[9px] font-bold rounded cursor-pointer self-end"
                        >
                          Save
                        </button>
                      </div>
                    )}

                    {/* MANUAL MERGE SIDE-BY-SIDE EDITOR */}
                    {isManualEditing && (
                      <div className="space-y-2 animate-fadeIn pt-2 border-t border-border/30">
                        <div className="flex justify-between items-center">
                          <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                            Edit manual JSON schema structure:
                          </span>
                          <button
                            onClick={() => handleManualSave(c.id)}
                            className="flex items-center gap-1 px-2 py-1 bg-primary hover:bg-indigo-600 text-white text-[9px] font-bold rounded cursor-pointer"
                          >
                            <Save size={10} /> Compile Manual spec
                          </button>
                        </div>
                        <textarea
                          rows={6}
                          value={manualInputs[c.id] || ''}
                          onChange={(e) => setManualInputs({ ...manualInputs, [c.id]: e.target.value })}
                          className="w-full bg-input border border-border font-mono text-[9.5px] p-2.5 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary leading-normal text-slate-300"
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {conflicts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                  <CheckSquare size={32} className="opacity-20 text-emerald-400 mb-3" />
                  <p className="text-xs font-bold text-foreground/80">No active conflicts detected</p>
                  <p className="text-[10px] opacity-70 mt-1 max-w-[200px]">
                    All schema mappings resolved cleanly! Upload colliding specs to activate.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SPEC GRAPH */}
        {activeTab === 'graph' && <ReactFlowPanel />}
      </div>
    </div>
  );
}
