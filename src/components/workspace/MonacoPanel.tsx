'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useMergeStore } from '../../store/useMergeStore';
import { Copy, Check, Download, AlertCircle, Settings, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { parseRef } from '../../lib/openapi/graph';

export default function MonacoPanel() {
  const { mergedYaml, conflicts, globalMetadata, updateMetadata, graph } = useMergeStore();
  const [copied, setCopied] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);

  // Editable local metadata state
  const [title, setTitle] = useState(globalMetadata.title);
  const [version, setVersion] = useState(globalMetadata.version);
  const [description, setDescription] = useState(globalMetadata.description);

  useEffect(() => {
    setTitle(globalMetadata.title);
    setVersion(globalMetadata.version);
    setDescription(globalMetadata.description);
  }, [globalMetadata]);

  // Run confetti when conflicts are resolved and spec is successfully generated
  useEffect(() => {
    if (mergedYaml && conflicts.length > 0 && conflicts.every(c => !!c.resolution)) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#a855f7', '#10b981']
      });
    }
  }, [conflicts, mergedYaml]);

  // Real-time Semantic & Syntax AST Linter
  const linterResults = useMemo(() => {
    const logs: string[] = [];
    let isValid = true;

    if (!mergedYaml) {
      return { isValid: false, logs: ['Spec is currently empty. Please select endpoints to compile.'] };
    }

    try {
      // 1. Syntax Check
      const yaml = require('js-yaml');
      const spec = yaml.load(mergedYaml);
      
      if (!spec || typeof spec !== 'object') {
        throw new Error('YAML compiled, but did not resolve to a valid OpenAPI object');
      }

      // 2. OpenAPI Metadata Checks
      if (!spec.openapi) {
        logs.push('WARNING: Missing "openapi" version string.');
      }
      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        logs.push('WARNING: No active "paths" endpoints declared.');
      }

      // 3. Dangling Reference ($ref) Linter
      // Checks if any internal ref references a schema/parameter that does not exist in components
      const components = spec.components || {};
      const schemas = components.schemas || {};
      const securitySchemes = components.securitySchemes || {};
      const parameters = components.parameters || {};
      const responses = components.responses || {};

      function searchRefs(current: any) {
        if (!current || typeof current !== 'object') return;
        if (Array.isArray(current)) {
          current.forEach(searchRefs);
        } else {
          if (typeof current['$ref'] === 'string') {
            const refStr: string = current['$ref'];
            const parsed = parseRef(refStr);
            if (parsed) {
              const { type, name } = parsed;
              if (type === 'schemas' && !schemas[name]) {
                logs.push(`LINT ERROR: Dangling schema reference: "${refStr}" is missing in merged components.`);
                isValid = false;
              } else if (type === 'securitySchemes' && !securitySchemes[name]) {
                logs.push(`LINT ERROR: Dangling security reference: "${refStr}" is missing in merged components.`);
                isValid = false;
              } else if (type === 'parameters' && !parameters[name]) {
                logs.push(`LINT ERROR: Dangling parameter reference: "${refStr}" is missing in merged components.`);
                isValid = false;
              } else if (type === 'responses' && !responses[name]) {
                logs.push(`LINT ERROR: Dangling response reference: "${refStr}" is missing in merged components.`);
                isValid = false;
              }
            }
          }
          for (const k in current) {
            if (Object.prototype.hasOwnProperty.call(current, k)) {
              searchRefs(current[k]);
            }
          }
        }
      }

      searchRefs(spec);

    } catch (e: any) {
      logs.push(`SYNTAX ERROR: ${e.message || 'YAML parsing failed.'}`);
      isValid = false;
    }

    if (isValid && logs.length === 0) {
      logs.push('SUCCESS: OpenAPI specification is compiled, validated, and syntactically valid with zero errors.');
    }

    return { isValid, logs };
  }, [mergedYaml]);

  const handleCopy = () => {
    if (!mergedYaml) return;
    navigator.clipboard.writeText(mergedYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: 'yaml' | 'json') => {
    if (!mergedYaml) return;
    let dataStr = '';
    let mimeType = '';
    let filename = '';

    if (format === 'yaml') {
      dataStr = mergedYaml;
      mimeType = 'text/yaml';
      filename = `${globalMetadata.title.toLowerCase().replace(/\s+/g, '-') || 'merged-api'}.yaml`;
    } else {
      try {
        const yamlParser = require('js-yaml');
        const obj = yamlParser.load(mergedYaml);
        dataStr = JSON.stringify(obj, null, 2);
        mimeType = 'application/json';
        filename = `${globalMetadata.title.toLowerCase().replace(/\s+/g, '-') || 'merged-api'}.json`;
      } catch (err) {
        alert('Could not compile YAML to JSON for download.');
        return;
      }
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const saveMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    updateMetadata({ title, version, description });
    setShowMetaModal(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#05070f] text-foreground">
      {/* Panel Action Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-primary">Live Spec</span>
          <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full flex items-center gap-1 ${
            linterResults.isValid 
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-400 animate-pulse'
          }`}>
            <AlertCircle size={10} />
            {linterResults.isValid ? 'Valid' : 'Issues Found'}
          </span>
        </div>

        {/* Action button triggers */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowMetaModal(true)}
            className="p-2 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground rounded-lg transition-all duration-150 cursor-pointer"
            title="Gateway Spec Metadata"
          >
            <Settings size={13} />
          </button>

          <button
            onClick={handleCopy}
            disabled={!mergedYaml}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-[10px] font-bold rounded-lg cursor-pointer transition-colors duration-150 disabled:opacity-50"
            title="Copy to Clipboard"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={() => handleDownload('yaml')}
            disabled={!mergedYaml}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary hover:bg-primary/95 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all duration-150 disabled:opacity-50 shadow-sm"
          >
            <Download size={11} />
            <span>YAML</span>
          </button>

          <button
            onClick={() => handleDownload('json')}
            disabled={!mergedYaml}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-[10px] font-bold rounded-lg cursor-pointer transition-all duration-150 disabled:opacity-50"
          >
            <Download size={11} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Editor View */}
      <div className="flex-1 min-h-0 relative">
        {mergedYaml ? (
          <Editor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={mergedYaml}
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 11.5,
              fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-6">
            <Award size={36} className="opacity-10 mb-3" />
            <h3 className="text-xs font-bold text-foreground/80">API Gateway Console</h3>
            <p className="text-[10px] opacity-70 mt-1 max-w-[220px]">
              Select checkboxes or resolve clashes to compile gateway code.
            </p>
          </div>
        )}
      </div>

      {/* Embedded Real-time Console Log */}
      <div className="h-[90px] border-t border-border bg-black/60 shrink-0 font-mono text-[9px] p-3 overflow-y-auto select-text leading-relaxed">
        <span className="font-bold text-muted-foreground text-[8px] tracking-wider uppercase block mb-1">
          Diagnostics & Linter Log
        </span>
        {linterResults.logs.map((log, index) => (
          <div
            key={index}
            className={`${
              log.startsWith('SUCCESS')
                ? 'text-emerald-400'
                : log.startsWith('LINT') || log.startsWith('SYNTAX')
                ? 'text-rose-400'
                : 'text-amber-400'
            }`}
          >
            {log}
          </div>
        ))}
      </div>

      {/* Metadata Configuration Dialog Modal */}
      {showMetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm select-none p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl p-5 shadow-2xl animate-scaleUp">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
              Gateway Spec Metadata
            </h3>
            <form onSubmit={saveMetadata} className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase font-mono block mb-1">
                  API Specification Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-input border border-border text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-primary text-foreground/90 font-sans"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase font-mono block mb-1">
                  API Version
                </label>
                <input
                  type="text"
                  required
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-input border border-border text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-primary text-foreground/90 font-mono"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase font-mono block mb-1">
                  Description / Gateway summary
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-input border border-border text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-primary text-foreground/90 font-sans leading-normal"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-border/50 pt-3">
                <button
                  type="button"
                  onClick={() => setShowMetaModal(false)}
                  className="px-3.5 py-1.5 bg-secondary hover:bg-secondary/80 border border-border text-xs rounded-lg cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-lg cursor-pointer shadow"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
