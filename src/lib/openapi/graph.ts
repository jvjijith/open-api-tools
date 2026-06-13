import {
  CanonicalSpec,
  CanonicalEndpoint,
  CanonicalComponent
} from './ir';
import {
  DependencyGraph,
  EndpointNode,
  SchemaNode,
  SecurityNode,
  ParameterNode,
  ResponseNode,
  ResolvedDependencies
} from './types';

/**
 * Builds a unified DependencyGraph representation from a list of CanonicalSpec IR objects.
 */
export function buildDependencyGraph(specs: CanonicalSpec[]): DependencyGraph {
  const graph: DependencyGraph = {
    endpoints: new Map<string, EndpointNode>(),
    schemas: new Map<string, SchemaNode>(),
    securitySchemes: new Map<string, SecurityNode>(),
    parameters: new Map<string, ParameterNode>(),
    responses: new Map<string, ResponseNode>()
  };

  for (const spec of specs) {
    // 1. Process endpoints
    for (const ep of spec.endpoints) {
      graph.endpoints.set(ep.id, {
        id: ep.id,
        specId: ep.specId,
        specName: ep.specName,
        path: ep.path,
        method: ep.method,
        operationId: ep.operationId,
        summary: ep.summary,
        description: ep.description,
        tags: ep.tags,
        parameters: ep.parameters,
        requestBody: ep.requestBody,
        responses: ep.responses,
        security: ep.security,
        refs: ep.refs
      });
    }

    // 2. Process schemas Map
    spec.schemas.forEach((s, name) => {
      const key = `${spec.id}::${name}`;
      graph.schemas.set(key, {
        name: s.name,
        specId: s.specId,
        specName: s.specName,
        raw: s.raw,
        refs: s.refs
      });
    });

    // 3. Process security schemes Map
    spec.securitySchemes.forEach((sec, name) => {
      const key = `${spec.id}::${name}`;
      graph.securitySchemes.set(key, {
        name: sec.name,
        specId: sec.specId,
        specName: sec.specName,
        raw: sec.raw
      });
    });

    // 4. Process parameters Map
    spec.parameters.forEach((p, name) => {
      const key = `${spec.id}::${name}`;
      graph.parameters.set(key, {
        name: p.name,
        specId: p.specId,
        specName: p.specName,
        raw: p.raw
      });
    });

    // 5. Process responses Map
    spec.responses.forEach((r, name) => {
      const key = `${spec.id}::${name}`;
      graph.responses.set(key, {
        name: r.name,
        specId: r.specId,
        specName: r.specName,
        raw: r.raw
      });
    });
  }

  return graph;
}

/**
 * Parses both Swagger 2.0 and OpenAPI 3.x reference strings.
 * e.g. "#/components/schemas/User" -> { type: 'schemas', name: 'User' }
 * e.g. "#/definitions/User"         -> { type: 'schemas', name: 'User' }
 */
export function parseRef(ref: string): { type: string; name: string } | null {
  if (!ref || typeof ref !== 'string') return null;

  // 1. OpenAPI 3.x Components
  if (ref.startsWith('#/components/')) {
    const parts = ref.split('/');
    if (parts.length < 4) return null;
    const type = parts[2]; // 'schemas', 'securitySchemes', etc.
    const name = parts.slice(3).join('/');
    return { type, name };
  }

  // 2. Swagger 2.0 definitions
  if (ref.startsWith('#/definitions/')) {
    const name = ref.substring('#/definitions/'.length);
    return { type: 'schemas', name };
  }
  if (ref.startsWith('#/securityDefinitions/')) {
    const name = ref.substring('#/securityDefinitions/'.length);
    return { type: 'securitySchemes', name };
  }
  if (ref.startsWith('#/parameters/')) {
    const name = ref.substring('#/parameters/'.length);
    return { type: 'parameters', name };
  }
  if (ref.startsWith('#/responses/')) {
    const name = ref.substring('#/responses/'.length);
    return { type: 'responses', name };
  }

  return null;
}

/**
 * Recursively resolves all dependencies starting from a set of selected endpoints.
 * Aborts on circular references safely using a visited tracker.
 */
export function resolveDependencies(
  selectedEndpointIds: string[],
  graph: DependencyGraph
): ResolvedDependencies {
  const resolved: ResolvedDependencies = {
    schemas: new Set<string>(),
    securitySchemes: new Set<string>(),
    parameters: new Set<string>(),
    responses: new Set<string>()
  };

  const visited = new Set<string>();

  function resolveRefRecursively(specId: string, refStr: string) {
    const parsed = parseRef(refStr);
    if (!parsed) return;

    const { type, name } = parsed;
    const cacheKey = `${specId}::${type}::${name}`;
    
    if (visited.has(cacheKey)) return;
    visited.add(cacheKey);

    const lookupKey = `${specId}::${name}`;

    if (type === 'schemas') {
      const schemaNode = graph.schemas.get(lookupKey);
      if (schemaNode) {
        resolved.schemas.add(lookupKey);
        for (const childRef of schemaNode.refs) {
          resolveRefRecursively(specId, childRef);
        }
      }
    } else if (type === 'securitySchemes') {
      const securityNode = graph.securitySchemes.get(lookupKey);
      if (securityNode) {
        resolved.securitySchemes.add(lookupKey);
      }
    } else if (type === 'parameters') {
      const parameterNode = graph.parameters.get(lookupKey);
      if (parameterNode) {
        resolved.parameters.add(lookupKey);
        for (const childRef of extractRefsFromRaw(parameterNode.raw)) {
          resolveRefRecursively(specId, childRef);
        }
      }
    } else if (type === 'responses') {
      const responseNode = graph.responses.get(lookupKey);
      if (responseNode) {
        resolved.responses.add(lookupKey);
        for (const childRef of extractRefsFromRaw(responseNode.raw)) {
          resolveRefRecursively(specId, childRef);
        }
      }
    }
  }

  // Process selected endpoint dependencies
  for (const epId of selectedEndpointIds) {
    const ep = graph.endpoints.get(epId);
    if (!ep) continue;

    // Process endpoints' security dependencies
    if (ep.security && Array.isArray(ep.security)) {
      for (const secRequirement of ep.security) {
        for (const schemeName in secRequirement) {
          const secKey = `${ep.specId}::${schemeName}`;
          if (graph.securitySchemes.has(secKey)) {
            resolved.securitySchemes.add(secKey);
          }
        }
      }
    }

    // Process explicitly harvested refs
    for (const ref of ep.refs) {
      resolveRefRecursively(ep.specId, ref);
    }
  }

  return resolved;
}

function extractRefsFromRaw(obj: any): string[] {
  const refs: string[] = [];
  function search(current: any) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(search);
    } else {
      if (typeof current['$ref'] === 'string') {
        refs.push(current['$ref']);
      }
      for (const k in current) {
        if (Object.prototype.hasOwnProperty.call(current, k)) {
          search(current[k]);
        }
      }
    }
  }
  search(obj);
  return refs;
}
