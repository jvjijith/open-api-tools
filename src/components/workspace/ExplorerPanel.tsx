'use client';

import React from 'react';
import { useMergeStore } from '../../store/useMergeStore';
import { Search, CheckSquare, Square, Folder, RefreshCcw } from 'lucide-react';
import { EndpointNode } from '../../lib/openapi/types';

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  get: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25' },
  post: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/25' },
  put: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/25' },
  delete: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/25' },
  patch: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/25' },
  options: { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/25' },
  head: { bg: 'bg-teal-500/15', text: 'text-teal-400', border: 'border-teal-500/25' }
};

export default function ExplorerPanel() {
  const {
    specs,
    graph,
    selectedEndpoints,
    toggleEndpoint,
    selectEndpointsBatch,
    searchQuery,
    setSearchQuery,
    selectedMethodFilter,
    setSelectedMethodFilter
  } = useMergeStore();

  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const methods = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  // Flatten endpoints from graph
  const allEndpoints = Array.from(graph.endpoints.values());

  // Filter endpoints by query and method
  const filteredEndpoints = allEndpoints.filter((ep) => {
    const matchesSearch =
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ep.summary && ep.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ep.description && ep.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMethod =
      selectedMethodFilter === 'ALL' ||
      ep.method.toUpperCase() === selectedMethodFilter.toUpperCase();

    return matchesSearch && matchesMethod;
  });

  // Group filtered endpoints by Tag Category
  const groupedEndpoints: Record<string, EndpointNode[]> = {};
  for (const ep of filteredEndpoints) {
    // If no tags, classify as "General"
    const tag = ep.tags.length > 0 ? ep.tags[0] : 'General Operations';
    if (!groupedEndpoints[tag]) {
      groupedEndpoints[tag] = [];
    }
    groupedEndpoints[tag].push(ep);
  }

  const toggleGroup = (tag: string, groupEpIds: string[]) => {
    const groupSelectedCount = groupEpIds.filter(id => selectedEndpoints.includes(id)).length;
    const shouldSelect = groupSelectedCount < groupEpIds.length;
    selectEndpointsBatch(groupEpIds, shouldSelect);
  };

  return (
    <div className="flex flex-col h-full bg-card/90 border-r border-border text-foreground">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Folder size={14} /> API Explorer
          </h2>
          <span className="text-[10px] bg-secondary border border-border px-2 py-0.5 rounded-full font-mono text-muted-foreground">
            Selected: {selectedEndpoints.length} / {allEndpoints.length}
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by path, operation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-input border border-border text-xs rounded-lg focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>

        {/* HTTP Method Filters */}
        <div className="flex gap-1 overflow-x-auto pb-1 select-none">
          {methods.map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethodFilter(method)}
              className={`px-2.5 py-1 text-[9px] font-bold rounded-md border transition-all cursor-pointer ${
                selectedMethodFilter === method
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-background hover:bg-secondary border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped API Endpoints list */}
      <div className="flex-1 overflow-y-auto overflow-visible relative p-4 space-y-5">
        {Object.entries(groupedEndpoints).map(([tag, eps]) => {
          const epIds = eps.map((e) => e.id);
          const selectedInGroupCount = epIds.filter((id) => selectedEndpoints.includes(id)).length;
          const allGroupSelected = eps.length > 0 && selectedInGroupCount === eps.length;
          const someGroupSelected = selectedInGroupCount > 0 && !allGroupSelected;
          const isCollapsed = !!collapsedGroups[tag];

          return (
            <div key={tag} className="space-y-2">
              {/* Category group header */}
              <div 
                onClick={() => setCollapsedGroups(prev => ({ ...prev, [tag]: !prev[tag] }))}
                className="flex justify-between items-center bg-secondary/30 hover:bg-secondary/50 px-2 py-1.5 rounded-lg select-none border border-border/20 cursor-pointer transition-all duration-150"
              >
                <span className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                  <Folder size={12} className={`text-primary/75 transition-transform duration-150 ${isCollapsed ? '-rotate-90 opacity-60' : ''}`} />
                  {tag}
                  <span className="text-[10px] font-normal text-muted-foreground">({eps.length})</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleGroup(tag, epIds);
                  }}
                  className="flex items-center gap-1 text-[10px] text-primary hover:text-indigo-400 font-semibold cursor-pointer"
                >
                  {allGroupSelected ? (
                    <CheckSquare size={11} className="fill-primary/20" />
                  ) : someGroupSelected ? (
                    <div className="w-2.5 h-2.5 bg-primary/30 border border-primary rounded flex items-center justify-center">
                      <div className="w-1.5 h-0.5 bg-primary" />
                    </div>
                  ) : (
                    <Square size={11} />
                  )}
                  <span>Toggle Group</span>
                </button>
              </div>

              {/* Endpoints in this group */}
              {!isCollapsed && (
                <div className="space-y-1.5 pl-1.5 animate-fadeIn">
                {eps.map((ep) => {
                  const isSelected = selectedEndpoints.includes(ep.id);
                  const colors = METHOD_COLORS[ep.method.toLowerCase()] || {
                    bg: 'bg-slate-500/10',
                    text: 'text-slate-400',
                    border: 'border-slate-500/20'
                  };

                  return (
                    <div
                      key={ep.id}
                      onClick={() => toggleEndpoint(ep.id)}
                      className={`relative group flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer select-none transition-all duration-150 hover:scale-[1.005] ${
                        isSelected
                          ? 'bg-primary/5 border-primary/30 hover:bg-primary/10'
                          : 'bg-background/40 hover:bg-background border-border/60 hover:border-border'
                      }`}
                    >
                      {/* Floating detailed hover tooltip */}
                      <div className="hidden group-hover:block absolute left-full top-[-10px] ml-2.5 z-[9999] w-[380px] bg-[#090d1a]/95 backdrop-blur-md border border-border/90 rounded-xl p-4 shadow-2xl text-left pointer-events-auto animate-fadeIn select-text leading-normal border-indigo-500/20">
                        <div className="max-h-[480px] overflow-y-auto pr-1.5 space-y-3.5 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                          {/* Title */}
                          <div className="flex items-center gap-1.5 border-b border-border/40 pb-1.5 font-mono">
                            <span className={`text-[8.5px] font-black tracking-wider uppercase px-1.5 py-0.5 border rounded ${colors.bg} ${colors.text} ${colors.border}`}>
                              {ep.method}
                            </span>
                            <span className="text-[10px] font-bold text-slate-200 truncate max-w-[260px]" title={ep.path}>
                              {ep.path}
                            </span>
                          </div>

                          {/* Summary & Description */}
                          {(ep.summary || ep.description) && (
                            <div className="space-y-1">
                              {ep.summary && (
                                <div className="text-[9.5px] font-bold text-slate-100">
                                  {ep.summary}
                                </div>
                              )}
                              {ep.description && (
                                <p className="text-[9px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                  {ep.description}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Parameters List */}
                          <div className="space-y-1.5">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono block tracking-wider">
                              Parameters
                            </span>
                            {ep.parameters && ep.parameters.length > 0 ? (
                              <div className="space-y-2.5 font-mono text-[8.5px]">
                                {['path', 'query', 'header', 'cookie', 'body', 'formData'].map((inType) => {
                                  const filteredParams = ep.parameters?.filter((p: any) => (p.in || 'query') === inType) || [];
                                  if (filteredParams.length === 0) return null;
                                  return (
                                    <div key={inType} className="space-y-1">
                                      <span className="text-[7.5px] font-bold text-indigo-400/90 uppercase font-mono block tracking-wider">
                                        {inType}
                                      </span>
                                      <div className="space-y-1">
                                        {filteredParams.map((p: any, idx: number) => {
                                          const typeStr = p.schema?.$ref?.split('/').pop() || p.schema?.type || p.type || 'string';
                                          return (
                                            <div key={idx} className="bg-secondary/20 p-1.5 rounded border border-border/10">
                                              <div className="flex justify-between items-start gap-2">
                                                <span className="font-semibold text-slate-200">
                                                  {p.name}
                                                  {p.required && <span className="text-rose-400 ml-0.5">*</span>}
                                                </span>
                                                <span className="text-muted-foreground text-[7.5px] shrink-0 font-normal">
                                                  ({typeStr})
                                                </span>
                                              </div>
                                              {p.description && (
                                                <p className="text-[8px] text-muted-foreground mt-0.5 leading-normal whitespace-pre-wrap">
                                                  {p.description}
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[8.5px] text-muted-foreground italic font-mono block">None</span>
                            )}
                          </div>

                          {/* Request Body */}
                          {ep.requestBody && (
                            <div className="space-y-1.5 border-t border-border/20 pt-2">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono block tracking-wider">
                                Request Body
                              </span>
                              <div className="text-[8.5px] font-mono text-slate-300 space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400 font-semibold">Requirement:</span>
                                  <span className={ep.requestBody.required ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                                    {ep.requestBody.required ? 'Required' : 'Optional'}
                                  </span>
                                </div>
                                {ep.requestBody.description && (
                                  <p className="text-[8px] text-muted-foreground leading-normal whitespace-pre-wrap">
                                    {ep.requestBody.description}
                                  </p>
                                )}
                                {ep.requestBody.content && (
                                  <div className="space-y-0.5 pt-0.5 border-t border-border/5">
                                    {Object.entries(ep.requestBody.content).map(([contentType, mediaTypeObj]: [string, any]) => {
                                      const schemaRef = mediaTypeObj.schema?.$ref?.split('/').pop() || mediaTypeObj.schema?.type || 'any';
                                      return (
                                        <div key={contentType} className="flex justify-between items-center text-[7.5px] text-muted-foreground">
                                          <span className="truncate max-w-[170px]">{contentType}</span>
                                          <span className="text-indigo-400 font-semibold">{schemaRef}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Responses list */}
                          <div className="space-y-1.5 border-t border-border/20 pt-2">
                            <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono block tracking-wider">
                              Responses
                            </span>
                            {ep.responses ? (
                              <div className="space-y-2 font-mono text-[8.5px]">
                                {Object.entries(ep.responses).map(([code, r]: [string, any]) => {
                                  let responseSchema = '';
                                  if (r.content) {
                                    const firstContent = Object.values(r.content)[0] as any;
                                    if (firstContent?.schema) {
                                      responseSchema = firstContent.schema.$ref?.split('/').pop() || firstContent.schema.type || '';
                                    }
                                  } else if (r.schema) {
                                    responseSchema = r.schema.$ref?.split('/').pop() || r.schema.type || '';
                                  }

                                  return (
                                    <div key={code} className="flex flex-col text-slate-300 bg-secondary/10 p-1.5 rounded border border-border/10 gap-0.5">
                                      <div className="flex justify-between items-center">
                                        <span className={`font-bold ${code.startsWith('2') ? 'text-emerald-400' : code.startsWith('3') ? 'text-amber-400' : 'text-rose-400'}`}>
                                          {code}
                                        </span>
                                        {responseSchema && (
                                          <span className="text-indigo-400 text-[7.5px] font-semibold">{responseSchema}</span>
                                        )}
                                      </div>
                                      {r.description && (
                                        <p className="text-[8px] text-muted-foreground leading-normal whitespace-pre-wrap">
                                          {r.description}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[8.5px] text-muted-foreground italic font-mono block">None</span>
                            )}
                          </div>

                          {/* Security Requirements */}
                          {ep.security && ep.security.length > 0 && (
                            <div className="space-y-1.5 border-t border-border/20 pt-2">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase font-mono block tracking-wider">
                                Security Schemes
                              </span>
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {ep.security.flatMap((secObj: any) => Object.keys(secObj)).map((scheme, idx) => (
                                  <span key={idx} className="bg-purple-500/10 border border-purple-500/25 text-purple-300 text-[8px] font-mono px-2 py-0.5 rounded font-semibold">
                                    {scheme}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Checkbox */}
                      <div className="shrink-0 text-primary">
                        {isSelected ? <CheckSquare size={13} className="fill-primary/15" /> : <Square size={13} />}
                      </div>

                      {/* Method Verb */}
                      <span
                        className={`w-14 px-1.5 py-0.5 border rounded text-[9px] font-black uppercase text-center ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        {ep.method}
                      </span>

                      {/* Path & Description */}
                      {(() => {
                        const spec = specs.find(s => s.id === ep.specId);
                        return (
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold truncate text-foreground/90">
                                {ep.path}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                {spec && (
                                  <span className={`px-1 py-0.2 text-[7.5px] border rounded font-mono font-black ${
                                    spec.detectedFormat === 'swagger2'
                                      ? 'border-orange-500/20 bg-orange-500/10 text-orange-400'
                                      : spec.detectedFormat === 'openapi3.1'
                                      ? 'border-violet-500/20 bg-violet-500/10 text-violet-400'
                                      : 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                                  }`}>
                                    {spec.detectedFormat === 'swagger2' ? '2.0' : spec.detectedFormat === 'openapi3.1' ? '3.1' : '3.0'}
                                  </span>
                                )}
                                <span className="text-[8px] font-mono text-muted-foreground truncate max-w-[65px]">
                                  {ep.specName}
                                </span>
                              </div>
                            </div>
                            {ep.summary && (
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {ep.summary}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })}

        {allEndpoints.length > 0 && filteredEndpoints.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Search size={28} className="opacity-20 mb-2" />
            <p className="text-xs">No endpoints match your query.</p>
            <p className="text-[10px] opacity-70 mt-0.5">Try widening your search terms or clearing method filters.</p>
          </div>
        )}

        {allEndpoints.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <RefreshCcw size={28} className="opacity-20 mb-2 animate-spin-slow" />
            <p className="text-xs">Waiting for specifications...</p>
            <p className="text-[10px] opacity-70 mt-0.5">Please upload or fetch specifications in the Sidebar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
