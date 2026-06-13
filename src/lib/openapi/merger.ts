import {
  DependencyGraph,
  EndpointNode,
  MergeConflict,
  MergePolicy,
  SchemaNode,
  SecurityNode
} from './types';
import { CanonicalSpec } from './ir';
import { parseRef } from './graph';
import yaml from 'js-yaml';

/**
 * Checks deep equality of two JSON/JS objects to identify structurally identical objects.
 */
export function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Scan required dependencies and detect any merge conflicts.
 * Structurally identical items are automatically deduplicated and NOT flagged as conflicts.
 */
export function detectConflicts(
  specs: CanonicalSpec[],
  selectedEndpointIds: string[],
  graph: DependencyGraph,
  resolvedDeps: {
    schemas: Set<string>;
    securitySchemes: Set<string>;
    parameters: Set<string>;
    responses: Set<string>;
  }
): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  const makeId = () => Math.random().toString(36).substring(2, 9);

  // 1. Detect Path Conflicts
  const selectedEndpoints = selectedEndpointIds
    .map(id => graph.endpoints.get(id))
    .filter((ep): ep is EndpointNode => !!ep);

  const pathMap = new Map<string, EndpointNode>();
  for (const ep of selectedEndpoints) {
    const key = `${ep.path}::${ep.method}`;
    if (pathMap.has(key)) {
      const existing = pathMap.get(key)!;
      if (existing.specId !== ep.specId) {
        conflicts.push({
          id: `path-${makeId()}`,
          type: 'path',
          name: `${ep.method.toUpperCase()} ${ep.path}`,
          specAId: existing.specId,
          specAName: existing.specName,
          specBId: ep.specId,
          specBName: ep.specName,
          itemA: existing,
          itemB: ep,
          resolution: null
        });
      }
    } else {
      pathMap.set(key, ep);
    }
  }

  // 2. Detect Schema Conflicts
  const schemaNameMap = new Map<string, SchemaNode>();
  const resolvedSchemasList = Array.from(resolvedDeps.schemas) as string[];
  for (const key of resolvedSchemasList) {
    const schema = graph.schemas.get(key);
    if (!schema) continue;

    const name = schema.name;
    if (schemaNameMap.has(name)) {
      const existing = schemaNameMap.get(name)!;
      if (existing.specId !== schema.specId) {
        if (!isDeepEqual(existing.raw, schema.raw)) {
          conflicts.push({
            id: `schema-${makeId()}`,
            type: 'schema',
            name,
            specAId: existing.specId,
            specAName: existing.specName,
            specBId: schema.specId,
            specBName: schema.specName,
            itemA: existing.raw,
            itemB: schema.raw,
            resolution: null
          });
        }
      }
    } else {
      schemaNameMap.set(name, schema);
    }
  }

  // 3. Detect Security Scheme Conflicts
  const securityNameMap = new Map<string, SecurityNode>();
  const resolvedSecurityList = Array.from(resolvedDeps.securitySchemes) as string[];
  for (const key of resolvedSecurityList) {
    const scheme = graph.securitySchemes.get(key);
    if (!scheme) continue;

    const name = scheme.name;
    if (securityNameMap.has(name)) {
      const existing = securityNameMap.get(name)!;
      if (existing.specId !== scheme.specId) {
        if (!isDeepEqual(existing.raw, scheme.raw)) {
          conflicts.push({
            id: `sec-${makeId()}`,
            type: 'security',
            name,
            specAId: existing.specId,
            specAName: existing.specName,
            specBId: scheme.specId,
            specBName: scheme.specName,
            itemA: existing.raw,
            itemB: scheme.raw,
            resolution: null
          });
        }
      }
    } else {
      securityNameMap.set(name, scheme);
    }
  }

  return conflicts;
}

/**
 * Builds maps for resolved names to perform $ref re-writing.
 */
function buildResolvedNamesMap(
  conflicts: MergeConflict[],
  graph: DependencyGraph,
  resolvedDeps: {
    schemas: Set<string>;
    securitySchemes: Set<string>;
    parameters: Set<string>;
    responses: Set<string>;
  }
) {
  const schemaNames = new Map<string, string>();
  const securityNames = new Map<string, string>();
  const parameterNames = new Map<string, string>();
  const responseNames = new Map<string, string>();

  const resolvedSchemasList = Array.from(resolvedDeps.schemas) as string[];
  for (const key of resolvedSchemasList) {
    const s = graph.schemas.get(key);
    if (s) schemaNames.set(key, s.name);
  }

  const resolvedSecList = Array.from(resolvedDeps.securitySchemes) as string[];
  for (const key of resolvedSecList) {
    const sec = graph.securitySchemes.get(key);
    if (sec) securityNames.set(key, sec.name);
  }

  const resolvedParamsList = Array.from(resolvedDeps.parameters) as string[];
  for (const key of resolvedParamsList) {
    const p = graph.parameters.get(key);
    if (p) parameterNames.set(key, p.name);
  }

  const resolvedRespList = Array.from(resolvedDeps.responses) as string[];
  for (const key of resolvedRespList) {
    const r = graph.responses.get(key);
    if (r) responseNames.set(key, r.name);
  }

  for (const c of conflicts) {
    if (!c.resolution) continue;

    if (c.type === 'schema') {
      const keyA = `${c.specAId}::${c.name}`;
      const keyB = `${c.specBId}::${c.name}`;

      if (c.resolution === 'keepA') {
        schemaNames.set(keyB, c.name);
      } else if (c.resolution === 'keepB') {
        schemaNames.set(keyA, c.name);
      } else if (c.resolution === 'rename') {
        const renameName = c.resolvedRename || `${c.name}_renamed`;
        schemaNames.set(keyB, renameName);
      }
    } else if (c.type === 'security') {
      const keyA = `${c.specAId}::${c.name}`;
      const keyB = `${c.specBId}::${c.name}`;

      if (c.resolution === 'keepA') {
        securityNames.set(keyB, c.name);
      } else if (c.resolution === 'keepB') {
        securityNames.set(keyA, c.name);
      } else if (c.resolution === 'rename') {
        const renameName = c.resolvedRename || `${c.name}_renamed`;
        securityNames.set(keyB, renameName);
      }
    }
  }

  return { schemaNames, securityNames, parameterNames, responseNames };
}

/**
 * Deeply searches and rewrites all references ($ref) within a spec block based on target version.
 */
function rewriteRefsInBlock(
  obj: any,
  specId: string,
  namesMap: {
    schemaNames: Map<string, string>;
    securityNames: Map<string, string>;
    parameterNames: Map<string, string>;
    responseNames: Map<string, string>;
  },
  targetOutputVersion: MergePolicy['targetOutputVersion']
): any {
  if (!obj || typeof obj !== 'object') return obj;

  const clone = JSON.parse(JSON.stringify(obj));

  function recurse(current: any) {
    if (!current || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      current.forEach(recurse);
    } else {
      if (typeof current['$ref'] === 'string') {
        const refStr: string = current['$ref'];
        const parsed = parseRef(refStr);
        
        if (parsed) {
          const { type, name } = parsed;
          const lookupKey = `${specId}::${name}`;
          let finalName = name;

          if (type === 'schemas') {
            finalName = namesMap.schemaNames.get(lookupKey) || name;
          } else if (type === 'securitySchemes') {
            finalName = namesMap.securityNames.get(lookupKey) || name;
          } else if (type === 'parameters') {
            finalName = namesMap.parameterNames.get(lookupKey) || name;
          } else if (type === 'responses') {
            finalName = namesMap.responseNames.get(lookupKey) || name;
          }

          // Compile rewritten ref based on target version output
          if (targetOutputVersion === '2.0') {
            if (type === 'schemas') {
              current['$ref'] = `#/definitions/${finalName}`;
            } else if (type === 'securitySchemes') {
              current['$ref'] = `#/securityDefinitions/${finalName}`;
            } else if (type === 'parameters') {
              current['$ref'] = `#/parameters/${finalName}`;
            } else if (type === 'responses') {
              current['$ref'] = `#/responses/${finalName}`;
            }
          } else {
            current['$ref'] = `#/components/${type}/${finalName}`;
          }
        }
      }

      for (const k in current) {
        if (Object.prototype.hasOwnProperty.call(current, k)) {
          recurse(current[k]);
        }
      }
    }
  }

  recurse(clone);
  return clone;
}

export interface MergedSpecsOutput {
  specObject: any;
  yamlString: string;
}

/**
 * Compiles resolved spec AST models into a single unified specifications document (Swagger 2.0 or OpenAPI 3.x).
 */
export function compileMergedSpecs(
  specs: CanonicalSpec[],
  selectedEndpointIds: string[],
  graph: DependencyGraph,
  resolvedDeps: {
    schemas: Set<string>;
    securitySchemes: Set<string>;
    parameters: Set<string>;
    responses: Set<string>;
  },
  conflicts: MergeConflict[],
  metadata: { title: string; version: string; description: string },
  policy: MergePolicy
): MergedSpecsOutput {
  const namesMap = buildResolvedNamesMap(conflicts, graph, resolvedDeps);
  const targetOutputVersion = policy.targetOutputVersion;

  // Initialize unified root spec structure
  const merged: any = {};

  // Collect unique server URLs from all specs that contribute selected endpoints
  const contributingSpecIds = new Set<string>();
  for (const epId of selectedEndpointIds) {
    const ep = graph.endpoints.get(epId);
    if (ep) contributingSpecIds.add(ep.specId);
  }

  const allServers: { url: string; description?: string; variables?: Record<string, any> }[] = [];
  const seenUrls = new Set<string>();
  for (const spec of specs) {
    if (!contributingSpecIds.has(spec.id)) continue;
    for (const srv of spec.servers || []) {
      if (!seenUrls.has(srv.url)) {
        seenUrls.add(srv.url);
        allServers.push(srv);
      }
    }
  }

  if (targetOutputVersion === '2.0') {
    merged.swagger = '2.0';
    merged.info = {
      title: metadata.title || 'Merged Swagger API',
      version: metadata.version || '1.0.0',
      description: metadata.description || 'Generated by APIMerge Platform'
    };

    // For Swagger 2.0, decompose the first server URL into host + basePath + schemes
    if (allServers.length > 0) {
      try {
        const url = new URL(allServers[0].url);
        merged.host = url.host;
        merged.basePath = url.pathname === '' ? '/' : url.pathname;
        merged.schemes = [url.protocol.replace(':', '')];
      } catch {
        // If URL parsing fails, store raw
        merged.host = allServers[0].url;
      }
    }

    merged.paths = {};
    merged.definitions = {};
    merged.securityDefinitions = {};
    merged.parameters = {};
    merged.responses = {};
  } else {
    merged.openapi = targetOutputVersion;
    merged.info = {
      title: metadata.title || 'Merged OpenAPI Spec',
      version: metadata.version || '1.0.0',
      description: metadata.description || 'Generated by APIMerge Platform'
    };

    // For OpenAPI 3.x, add servers array
    if (allServers.length > 0) {
      merged.servers = allServers.map(s => {
        const entry: any = { url: s.url };
        if (s.description) entry.description = s.description;
        if (s.variables && Object.keys(s.variables).length > 0) entry.variables = s.variables;
        return entry;
      });
    }

    merged.paths = {};
    merged.components = {
      schemas: {},
      securitySchemes: {},
      parameters: {},
      responses: {}
    };
  }

  // Compile selected endpoints
  const pathConflicts = conflicts.filter(c => c.type === 'path');

  for (const epId of selectedEndpointIds) {
    const ep = graph.endpoints.get(epId);
    if (!ep) continue;

    const pathConflict = pathConflicts.find(
      c =>
        (c.specAId === ep.specId && c.itemA.path === ep.path && c.itemA.method === ep.method) ||
        (c.specBId === ep.specId && c.itemB.path === ep.path && c.itemB.method === ep.method)
    );

    if (pathConflict) {
      if (pathConflict.resolution === 'keepA' && ep.specId !== pathConflict.specAId) continue;
      if (pathConflict.resolution === 'keepB' && ep.specId !== pathConflict.specBId) continue;
    }

    if (!merged.paths[ep.path]) {
      merged.paths[ep.path] = {};
    }

    const spec = specs.find(s => s.id === ep.specId);
    const originalOperation = spec?.endpoints.find(e => e.path === ep.path && e.method === ep.method);
    
    // Fallback to graph parameters if endpoint parsing requires deep cloning
    const baseOperationObj = originalOperation 
      ? {
          operationId: originalOperation.operationId,
          summary: originalOperation.summary,
          description: originalOperation.description,
          tags: originalOperation.tags,
          parameters: originalOperation.parameters,
          requestBody: originalOperation.requestBody,
          responses: originalOperation.responses,
          security: originalOperation.security
        }
      : {};

    const rewrittenOperation = rewriteRefsInBlock(baseOperationObj, ep.specId, namesMap, targetOutputVersion);
    merged.paths[ep.path][ep.method] = rewrittenOperation;
  }

  // Compile component schemas
  const resolvedSchemasList = Array.from(resolvedDeps.schemas) as string[];
  for (const key of resolvedSchemasList) {
    const schema = graph.schemas.get(key);
    if (!schema) continue;

    const schemaConflict = conflicts.find(
      c => c.type === 'schema' && c.name === schema.name
    );

    let finalName = namesMap.schemaNames.get(key) || schema.name;
    let schemaBody = schema.raw;

    if (schemaConflict) {
      if (schemaConflict.resolution === 'keepA' && schema.specId !== schemaConflict.specAId) continue;
      if (schemaConflict.resolution === 'keepB' && schema.specId !== schemaConflict.specBId) continue;
      if (schemaConflict.resolution === 'manual') {
        schemaBody = schemaConflict.resolvedManualContent || schema.raw;
        finalName = schema.name;
      }
    }

    const rewrittenBody = rewriteRefsInBlock(schemaBody, schema.specId, namesMap, targetOutputVersion);
    
    if (targetOutputVersion === '2.0') {
      merged.definitions[finalName] = rewrittenBody;
    } else {
      merged.components.schemas[finalName] = rewrittenBody;
    }
  }

  // Compile security schemes
  const resolvedSecList = Array.from(resolvedDeps.securitySchemes) as string[];
  for (const key of resolvedSecList) {
    const scheme = graph.securitySchemes.get(key);
    if (!scheme) continue;

    const secConflict = conflicts.find(
      c => c.type === 'security' && c.name === scheme.name
    );

    let finalName = namesMap.securityNames.get(key) || scheme.name;
    let schemeBody = scheme.raw;

    if (secConflict) {
      if (secConflict.resolution === 'keepA' && scheme.specId !== secConflict.specAId) continue;
      if (secConflict.resolution === 'keepB' && scheme.specId !== secConflict.specBId) continue;
      if (secConflict.resolution === 'manual') {
        schemeBody = secConflict.resolvedManualContent || scheme.raw;
        finalName = scheme.name;
      }
    }

    const rewrittenBody = rewriteRefsInBlock(schemeBody, scheme.specId, namesMap, targetOutputVersion);
    
    if (targetOutputVersion === '2.0') {
      merged.securityDefinitions[finalName] = rewrittenBody;
    } else {
      merged.components.securitySchemes[finalName] = rewrittenBody;
    }
  }

  // Compile parameters
  const resolvedParamsList = Array.from(resolvedDeps.parameters) as string[];
  for (const key of resolvedParamsList) {
    const p = graph.parameters.get(key);
    if (!p) continue;

    const finalName = namesMap.parameterNames.get(key) || p.name;
    const rewrittenBody = rewriteRefsInBlock(p.raw, p.specId, namesMap, targetOutputVersion);
    
    if (targetOutputVersion === '2.0') {
      merged.parameters[finalName] = rewrittenBody;
    } else {
      merged.components.parameters[finalName] = rewrittenBody;
    }
  }

  // Compile responses
  const resolvedRespList = Array.from(resolvedDeps.responses) as string[];
  for (const key of resolvedRespList) {
    const r = graph.responses.get(key);
    if (!r) continue;

    const finalName = namesMap.responseNames.get(key) || r.name;
    const rewrittenBody = rewriteRefsInBlock(r.raw, r.specId, namesMap, targetOutputVersion);
    
    if (targetOutputVersion === '2.0') {
      merged.responses[finalName] = rewrittenBody;
    } else {
      merged.components.responses[finalName] = rewrittenBody;
    }
  }

  // Clean empty properties to yield tidy files
  if (targetOutputVersion === '2.0') {
    if (Object.keys(merged.definitions).length === 0) delete merged.definitions;
    if (Object.keys(merged.securityDefinitions).length === 0) delete merged.securityDefinitions;
    if (Object.keys(merged.parameters).length === 0) delete merged.parameters;
    if (Object.keys(merged.responses).length === 0) delete merged.responses;
  } else {
    if (Object.keys(merged.components.schemas).length === 0) delete merged.components.schemas;
    if (Object.keys(merged.components.securitySchemes).length === 0) delete merged.components.securitySchemes;
    if (Object.keys(merged.components.parameters).length === 0) delete merged.components.parameters;
    if (Object.keys(merged.components.responses).length === 0) delete merged.components.responses;
    if (Object.keys(merged.components).length === 0) delete merged.components;
  }

  const yamlString = yaml.dump(merged, { noRefs: true, indent: 2 });

  return {
    specObject: merged,
    yamlString
  };
}
