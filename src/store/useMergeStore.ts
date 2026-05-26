import { create } from 'zustand';
import {
  DependencyGraph,
  MergeConflict,
  ResolvedDependencies,
  MergePolicy,
  ValidationReport
} from '../lib/openapi/types';
import { CanonicalSpec } from '../lib/openapi/ir';
import { parseSpec } from '../lib/openapi/parser';
import { buildDependencyGraph, resolveDependencies } from '../lib/openapi/graph';
import { detectConflicts, compileMergedSpecs } from '../lib/openapi/merger';
import { validateCompatibility } from '../lib/openapi/validator';
import { upgradeSwaggerSpecToOpenAPI3 } from '../lib/openapi/upgrade';

interface MergeState {
  specs: CanonicalSpec[];
  graph: DependencyGraph;
  selectedEndpoints: string[];
  resolvedDeps: ResolvedDependencies;
  conflicts: MergeConflict[];
  globalMetadata: {
    title: string;
    version: string;
    description: string;
  };
  mergePolicy: MergePolicy;
  validationReport: ValidationReport;
  migrationLogs: string[];
  mergedYaml: string;
  activeConflictId: string | null;
  searchQuery: string;
  selectedMethodFilter: string; // 'ALL', 'GET', 'POST', etc.
  activeTab: 'explorer' | 'conflicts' | 'graph';
  
  // Actions
  addSpec: (name: string, content: string) => void;
  removeSpec: (id: string) => void;
  toggleEndpoint: (id: string) => void;
  selectEndpointsBatch: (ids: string[], select: boolean) => void;
  resolveConflict: (
    conflictId: string,
    resolution: MergeConflict['resolution'],
    extra?: { rename?: string; manualContent?: any }
  ) => void;
  updateMetadata: (meta: Partial<MergeState['globalMetadata']>) => void;
  updateMergePolicy: (policy: Partial<MergePolicy>) => void;
  setSearchQuery: (query: string) => void;
  setSelectedMethodFilter: (method: string) => void;
  setActiveTab: (tab: MergeState['activeTab']) => void;
  setActiveConflictId: (id: string | null) => void;
  resetSession: () => void;
}

const emptyGraph: DependencyGraph = {
  endpoints: new Map(),
  schemas: new Map(),
  securitySchemes: new Map(),
  parameters: new Map(),
  responses: new Map()
};

const emptyDeps: ResolvedDependencies = {
  schemas: new Set(),
  securitySchemes: new Set(),
  parameters: new Set(),
  responses: new Set()
};

const initialPolicy: MergePolicy = {
  allowCrossVersionMerge: false,
  allowMinorVersionMismatch: false,
  strictValidation: true,
  targetOutputVersion: '3.0.0'
};

const initialReport: ValidationReport = {
  isValid: true,
  errors: [],
  warnings: [],
  matrix: [],
  migrationLogs: []
};

export const useMergeStore = create<MergeState>((set, get) => {
  
  // Helper to re-calculate validation checks, AST dependencies, and compile YAML
  const recompute = (
    specs: CanonicalSpec[],
    selectedEndpoints: string[],
    conflictsList: MergeConflict[],
    globalMetadata: MergeState['globalMetadata'],
    mergePolicy: MergePolicy
  ) => {
    if (specs.length === 0) {
      return {
        graph: emptyGraph,
        resolvedDeps: emptyDeps,
        conflicts: [],
        validationReport: initialReport,
        migrationLogs: [],
        mergedYaml: ''
      };
    }

    // 1. Run Pre-AST Version Validation
    const validationReport = validateCompatibility(specs, mergePolicy);

    // 2. If validation fails in Strict Mode, abort merge compilation
    if (!validationReport.isValid) {
      return {
        graph: emptyGraph,
        resolvedDeps: emptyDeps,
        conflicts: [],
        validationReport,
        migrationLogs: validationReport.migrationLogs,
        mergedYaml: ''
      };
    }

    // 2.5 Apply Legacy Swagger 2.0 Upgrade Normalization (Compatibility Mode)
    const normalizedSpecs = mergePolicy.allowCrossVersionMerge 
      ? specs.map(upgradeSwaggerSpecToOpenAPI3) 
      : specs;

    // 3. Build unified dependency graph from Canonical spec collection
    const graph = buildDependencyGraph(normalizedSpecs);

    // 4. Trace dependencies recursively
    const resolvedDeps = resolveDependencies(selectedEndpoints, graph);

    // 5. Detect clash conflicts
    const newConflicts = detectConflicts(normalizedSpecs, selectedEndpoints, graph, resolvedDeps);

    // Keep active resolution choices from old session if still existing
    const updatedConflicts = newConflicts.map(nc => {
      const match = conflictsList.find(
        oc => oc.type === nc.type && oc.name === nc.name && oc.specAId === nc.specAId && oc.specBId === nc.specBId
      );
      if (match && match.resolution) {
        return {
          ...nc,
          resolution: match.resolution,
          resolvedRename: match.resolvedRename,
          resolvedManualContent: match.resolvedManualContent
        };
      }
      return nc;
    });

    // 6. Compile Canonical Spec models into output spec (Swagger or OAS 3.x)
    const { yamlString } = compileMergedSpecs(
      normalizedSpecs,
      selectedEndpoints,
      graph,
      resolvedDeps,
      updatedConflicts,
      globalMetadata,
      mergePolicy
    );

    return {
      graph,
      resolvedDeps,
      conflicts: updatedConflicts,
      validationReport,
      migrationLogs: validationReport.migrationLogs,
      mergedYaml: yamlString
    };
  };

  return {
    specs: [],
    graph: emptyGraph,
    selectedEndpoints: [],
    resolvedDeps: emptyDeps,
    conflicts: [],
    globalMetadata: {
      title: 'Unified Gateway API',
      version: '2.0.0',
      description: 'Unified gateway compiled using APIMerge Compiler.'
    },
    mergePolicy: initialPolicy,
    validationReport: initialReport,
    migrationLogs: [],
    mergedYaml: '',
    activeConflictId: null,
    searchQuery: '',
    selectedMethodFilter: 'ALL',
    activeTab: 'explorer',

    addSpec: (name: string, content: string) => {
      const specId = `spec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const parsedSpec = parseSpec(specId, name, content);
      
      const newSpecs = [...get().specs, parsedSpec];
      
      // Auto-select all endpoints for rapid sandboxing
      const tempGraph = buildDependencyGraph([parsedSpec]);
      const addedEndpointIds = Array.from(tempGraph.endpoints.keys());
      const newSelectedEndpoints = [...get().selectedEndpoints, ...addedEndpointIds];
      
      const results = recompute(
        newSpecs,
        newSelectedEndpoints,
        get().conflicts,
        get().globalMetadata,
        get().mergePolicy
      );
      
      set({
        specs: newSpecs,
        selectedEndpoints: newSelectedEndpoints,
        ...results
      });
    },

    removeSpec: (id: string) => {
      const newSpecs = get().specs.filter(s => s.id !== id);
      const newSelectedEndpoints = get().selectedEndpoints.filter(epId => !epId.startsWith(id));
      
      const results = recompute(
        newSpecs,
        newSelectedEndpoints,
        get().conflicts,
        get().globalMetadata,
        get().mergePolicy
      );

      set({
        specs: newSpecs,
        selectedEndpoints: newSelectedEndpoints,
        ...results,
        activeConflictId: null
      });
    },

    toggleEndpoint: (id: string) => {
      const isSelected = get().selectedEndpoints.includes(id);
      const newSelectedEndpoints = isSelected
        ? get().selectedEndpoints.filter(eid => eid !== id)
        : [...get().selectedEndpoints, id];

      const results = recompute(
        get().specs,
        newSelectedEndpoints,
        get().conflicts,
        get().globalMetadata,
        get().mergePolicy
      );

      set({
        selectedEndpoints: newSelectedEndpoints,
        ...results
      });
    },

    selectEndpointsBatch: (ids: string[], select: boolean) => {
      const current = get().selectedEndpoints;
      let newSelected: string[];
      
      if (select) {
        newSelected = Array.from(new Set([...current, ...ids]));
      } else {
        newSelected = current.filter(id => !ids.includes(id));
      }

      const results = recompute(
        get().specs,
        newSelected,
        get().conflicts,
        get().globalMetadata,
        get().mergePolicy
      );

      set({
        selectedEndpoints: newSelected,
        ...results
      });
    },

    resolveConflict: (conflictId: string, resolution, extra) => {
      const updatedConflicts = get().conflicts.map(c => {
        if (c.id === conflictId) {
          return {
            ...c,
            resolution,
            resolvedRename: extra?.rename,
            resolvedManualContent: extra?.manualContent
          };
        }
        return c;
      });

      const specs = get().specs;
      const normalizedSpecs = get().mergePolicy.allowCrossVersionMerge 
        ? specs.map(upgradeSwaggerSpecToOpenAPI3) 
        : specs;

      const { yamlString } = compileMergedSpecs(
        normalizedSpecs,
        get().selectedEndpoints,
        get().graph,
        get().resolvedDeps,
        updatedConflicts,
        get().globalMetadata,
        get().mergePolicy
      );

      set({
        conflicts: updatedConflicts,
        mergedYaml: yamlString
      });
    },

    updateMetadata: (meta) => {
      const globalMetadata = { ...get().globalMetadata, ...meta };
      
      const specs = get().specs;
      const normalizedSpecs = get().mergePolicy.allowCrossVersionMerge 
        ? specs.map(upgradeSwaggerSpecToOpenAPI3) 
        : specs;

      const { yamlString } = compileMergedSpecs(
        normalizedSpecs,
        get().selectedEndpoints,
        get().graph,
        get().resolvedDeps,
        get().conflicts,
        globalMetadata,
        get().mergePolicy
      );

      set({
        globalMetadata,
        mergedYaml: yamlString
      });
    },

    updateMergePolicy: (policy) => {
      const newPolicy = { ...get().mergePolicy, ...policy };

      // Re-run validator and re-compile using the updated policy
      const results = recompute(
        get().specs,
        get().selectedEndpoints,
        get().conflicts,
        get().globalMetadata,
        newPolicy
      );

      set({
        mergePolicy: newPolicy,
        ...results
      });
    },

    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedMethodFilter: (selectedMethodFilter) => set({ selectedMethodFilter }),
    setActiveTab: (activeTab) => set({ activeTab }),
    setActiveConflictId: (activeConflictId) => set({ activeConflictId }),

    resetSession: () => {
      set({
        specs: [],
        graph: emptyGraph,
        selectedEndpoints: [],
        resolvedDeps: emptyDeps,
        conflicts: [],
        globalMetadata: {
          title: 'Unified Gateway API',
          version: '2.0.0',
          description: 'Unified gateway compiled using APIMerge Compiler.'
        },
        mergePolicy: initialPolicy,
        validationReport: initialReport,
        migrationLogs: [],
        mergedYaml: '',
        activeConflictId: null,
        searchQuery: '',
        selectedMethodFilter: 'ALL',
        activeTab: 'explorer'
      });
    }
  };
});
