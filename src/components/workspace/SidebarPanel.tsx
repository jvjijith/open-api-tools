'use client';

import React, { useState, useRef } from 'react';
import { useMergeStore } from '../../store/useMergeStore';
import { Upload, Link, AlertTriangle, FileCode, Trash2, CheckSquare, Square, RefreshCw, Zap, Table, CheckCircle2 } from 'lucide-react';
import { USERS_SERVICE_TEMPLATE, PAYMENTS_SERVICE_TEMPLATE } from '../../lib/openapi/templates';

const FORMAT_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  swagger2: { label: 'OAS 2.0', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/25' },
  'openapi3.0': { label: 'OAS 3.0', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/25' },
  'openapi3.1': { label: 'OAS 3.1', bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/25' }
};

export default function SidebarPanel() {
  const { 
    specs, 
    addSpec, 
    removeSpec, 
    selectedEndpoints, 
    selectEndpointsBatch, 
    graph,
    validationReport 
  } = useMergeStore();

  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setErrorMsg(null);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          addSpec(file.name, content);
        } catch (err: any) {
          setErrorMsg(`Error parsing "${file.name}": ${err.message || 'Malformed schema'}`);
        }
      };
      
      reader.readAsText(file);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUrlImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      
      const content = await res.text();
      const urlParts = url.split('/');
      let filename = urlParts[urlParts.length - 1] || 'imported-api.yaml';
      if (!filename.includes('.')) filename += '.yaml';
      
      addSpec(filename, content);
      setUrl('');
    } catch (err: any) {
      setErrorMsg(`Failed to import URL: ${err.message || 'Fetch failed'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSandbox = () => {
    setErrorMsg(null);
    try {
      addSpec('users-service.yaml', USERS_SERVICE_TEMPLATE);
      addSpec('payments-service.yaml', PAYMENTS_SERVICE_TEMPLATE);
    } catch (err: any) {
      setErrorMsg(`Failed to load sandbox: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border p-4 text-foreground overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-2 mb-6 select-none shrink-0">
        <div className="bg-primary p-2 rounded-lg text-primary-foreground shadow-md shadow-primary/20">
          <FileCode size={20} className="animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            APIMerge Platform
          </h1>
          <p className="text-[10px] text-muted-foreground font-mono">AST Spec Compiler v1.2</p>
        </div>
      </div>

      {/* Sandbox Trigger */}
      {specs.length === 0 && (
        <button
          onClick={loadSandbox}
          className="w-full flex items-center justify-center gap-2 mb-4 p-3 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer shadow-sm hover:scale-[1.01]"
        >
          <Zap size={14} />
          Load Sandbox Spec Template
        </button>
      )}

      {/* Drop Zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 bg-background/50 hover:bg-background/80 p-5 rounded-xl cursor-pointer transition-all duration-200 group relative mb-4 shrink-0"
      >
        <Upload size={24} className="text-muted-foreground group-hover:text-primary mb-2 transition-colors duration-200" />
        <span className="text-xs font-medium text-foreground mb-1">Upload specs</span>
        <span className="text-[10px] text-muted-foreground text-center">YAML or JSON spec files</span>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".yaml,.yml,.json" 
          multiple 
          className="hidden" 
        />
      </div>

      {/* Import URL */}
      <form onSubmit={handleUrlImport} className="mb-4 shrink-0">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Link size={12} className="absolute left-2.5 top-3 text-muted-foreground" />
            <input
              type="url"
              placeholder="Import spec from URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full pl-7.5 pr-2 py-2 bg-input border border-border text-xs rounded-lg focus:outline-none focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading || !url.trim()}
            className="px-3 bg-secondary hover:bg-primary border border-border text-xs rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:hover:bg-secondary flex items-center justify-center"
          >
            {isLoading ? <RefreshCw size={12} className="animate-spin" /> : 'Fetch'}
          </button>
        </div>
      </form>

      {/* Error notification */}
      {errorMsg && (
        <div className="flex gap-2 bg-destructive/10 border border-destructive/30 p-3 rounded-lg text-destructive text-[11px] mb-4 shrink-0 animate-fadeIn">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* VISUAL COMPATIBILITY MATRIX PANEL */}
      {specs.length > 1 && (
        <div className="mb-4 bg-background/50 border border-border/80 rounded-xl p-3 space-y-2.5 shrink-0 animate-fadeIn select-none">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Table size={12} className="text-primary" /> Version Compatibility Matrix
          </span>
          <div className="border border-border/40 rounded-lg overflow-hidden text-[9px] font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border/40 text-muted-foreground">
                  <th className="p-1.5 font-semibold">Specs Comparison</th>
                  <th className="p-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {validationReport.matrix.map((row, idx) => (
                  <tr key={idx} className="hover:bg-secondary/10">
                    <td className="p-1.5 text-foreground/80 font-medium font-mono truncate max-w-[130px]">
                      {row.specAName.slice(0, 10)} ↔ {row.specBName.slice(0, 10)}
                    </td>
                    <td className="p-1.5">
                      {row.status === 'compatible' && (
                        <span className="text-emerald-400 font-semibold">✅ Compatible</span>
                      )}
                      {row.status === 'minor_warning' && (
                        <span className="text-amber-400 font-semibold">⚠ Warn</span>
                      )}
                      {row.status === 'incompatible' && (
                        <span className="text-rose-400 font-black">❌ Blocked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Validation Failure Warnings */}
          {!validationReport.isValid && (
            <div className="flex gap-2 bg-rose-500/10 border border-rose-500/25 p-3 rounded-lg text-rose-400 text-[10px] leading-relaxed font-sans shrink-0 animate-fadeIn">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400 animate-bounce" />
              <div>
                <span className="font-bold block mb-0.5">COMPILATION BLOCKED</span>
                <span className="whitespace-pre-wrap">{validationReport.errors[0]}</span>
              </div>
            </div>
          )}

          {validationReport.isValid && validationReport.warnings.length > 0 && (
            <div className="flex gap-2 bg-amber-500/10 border border-amber-500/25 p-3 rounded-lg text-amber-400 text-[10px] leading-relaxed font-sans shrink-0 animate-fadeIn">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-bold block mb-0.5">MIGRATION ACTIVE</span>
                <span>Older specifications will be auto-normalized into Intermediate AST.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Specs counted list header */}
      <div className="flex items-center justify-between border-t border-border pt-4 mb-3 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Specifications ({specs.length})
        </span>
        {specs.length > 0 && validationReport.isValid && (
          <button 
            onClick={() => {
              const allEpIds = specs.flatMap(s => {
                const temp = useMergeStore.getState().graph;
                return Array.from(temp.endpoints.keys()).filter(id => id.startsWith(s.id));
              });
              const anyDeselected = allEpIds.some(id => !selectedEndpoints.includes(id));
              selectEndpointsBatch(allEpIds, anyDeselected);
            }}
            className="text-[10px] text-primary hover:underline font-medium cursor-pointer"
          >
            Toggle All
          </button>
        )}
      </div>

      {/* Spec list items */}
      <div className="flex-1 space-y-3">
        {specs.map((spec) => {
          const specEpIds = Array.from(graph.endpoints.keys()).filter(id => id.startsWith(spec.id));
          const selectedSpecEpIds = specEpIds.filter(id => selectedEndpoints.includes(id));
          const allSelected = specEpIds.length > 0 && specEpIds.length === selectedSpecEpIds.length;
          const someSelected = selectedSpecEpIds.length > 0 && !allSelected;
          
          const componentsCount = spec.schemas.size;
          const badge = FORMAT_BADGES[spec.detectedFormat] || {
            label: 'OAS 3.x',
            bg: 'bg-secondary',
            text: 'text-muted-foreground',
            border: 'border-border'
          };

          return (
            <div 
              key={spec.id}
              className="bg-background/60 border border-border/80 rounded-xl p-3.5 hover:border-primary/30 transition-all duration-200"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="truncate pr-2">
                  <h3 className="text-xs font-bold truncate text-foreground/90 group-hover:text-primary">
                    {spec.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 select-none">
                    <span className={`px-1.5 py-0.5 border text-[8px] font-black rounded font-mono ${badge.bg} ${badge.text} ${badge.border}`}>
                      {badge.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono">
                      v{spec.originalVersion}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeSpec(spec.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10 transition-colors duration-150 cursor-pointer"
                  title="Remove Specification"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground line-clamp-2 mb-3">
                {spec.info?.description || 'No description provided.'}
              </p>

              <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-[9px] text-muted-foreground">
                <div className="flex gap-3">
                  <span>
                    Endpoints: <strong className="text-foreground">{specEpIds.length}</strong>
                  </span>
                  <span>
                    Schemas: <strong className="text-foreground">{componentsCount}</strong>
                  </span>
                </div>
                {validationReport.isValid && (
                  <button
                    onClick={() => selectEndpointsBatch(specEpIds, !allSelected)}
                    className="flex items-center gap-1.5 text-primary hover:text-indigo-400 font-semibold cursor-pointer"
                  >
                    {allSelected ? (
                      <CheckSquare size={10} className="fill-primary/20" />
                    ) : someSelected ? (
                      <div className="w-2.5 h-2.5 bg-primary/30 border border-primary rounded flex items-center justify-center">
                        <div className="w-1.5 h-0.5 bg-primary" />
                      </div>
                    ) : (
                      <Square size={10} />
                    )}
                    <span>Select Spec</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {specs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
            <FileCode size={32} className="opacity-20 mb-3" />
            <p className="text-xs">No specifications loaded</p>
            <p className="text-[10px] opacity-70 mt-1 max-w-[180px]">
              Upload OpenAPI files or click the Sandbox Template button above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
