import yaml from 'js-yaml';
import { CanonicalSpec, CanonicalEndpoint, CanonicalComponent, SpecFormat } from './ir';

/**
 * Recursively search an object for all "$ref" values.
 */
export function extractRefs(obj: any): string[] {
  const refs: string[] = [];
  
  function recurse(current: any) {
    if (!current || typeof current !== 'object') return;
    
    if (Array.isArray(current)) {
      for (const item of current) {
        recurse(item);
      }
    } else {
      if (typeof current['$ref'] === 'string') {
        refs.push(current['$ref']);
      }
      for (const key in current) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          recurse(current[key]);
        }
      }
    }
  }
  
  recurse(obj);
  return Array.from(new Set(refs));
}

/**
 * Parses YAML or JSON text and compiles a version-agnostic CanonicalSpec IR object.
 */
export function parseSpec(id: string, name: string, content: string): CanonicalSpec {
  let parsed: any = null;
  const trimmed = content.trim();
  
  if (trimmed.startsWith('{')) {
    parsed = JSON.parse(content);
  } else {
    parsed = yaml.load(content);
  }
  
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid spec content: File is not a valid YAML or JSON object');
  }

  // 1. Detect spec format
  let detectedFormat: SpecFormat = 'openapi3.0';
  let originalVersion = '3.0.0';

  if (parsed.swagger && typeof parsed.swagger === 'string') {
    detectedFormat = 'swagger2';
    originalVersion = parsed.swagger;
  } else if (parsed.openapi && typeof parsed.openapi === 'string') {
    originalVersion = parsed.openapi;
    if (parsed.openapi.startsWith('3.1')) {
      detectedFormat = 'openapi3.1';
    } else {
      detectedFormat = 'openapi3.0';
    }
  }

  // 2. Extract global metadata info
  const info = {
    title: parsed.info?.title || 'Untitled Spec',
    version: parsed.info?.version || '1.0.0',
    description: parsed.info?.description
  };

  // 3. Initialize Component Maps
  const schemas = new Map<string, CanonicalComponent>();
  const securitySchemes = new Map<string, CanonicalComponent>();
  const parameters = new Map<string, CanonicalComponent>();
  const responses = new Map<string, CanonicalComponent>();

  // 4. Ingest raw components based on version properties (isolated logic)
  if (detectedFormat === 'swagger2') {
    // Swagger 2.0 definitions structures
    if (parsed.definitions) {
      for (const name in parsed.definitions) {
        const raw = parsed.definitions[name];
        schemas.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (parsed.securityDefinitions) {
      for (const name in parsed.securityDefinitions) {
        const raw = parsed.securityDefinitions[name];
        securitySchemes.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'security',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (parsed.parameters) {
      for (const name in parsed.parameters) {
        const raw = parsed.parameters[name];
        parameters.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema', // treated inside graph parameter resolver
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (parsed.responses) {
      for (const name in parsed.responses) {
        const raw = parsed.responses[name];
        responses.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
  } else {
    // OpenAPI 3.0.x and 3.1.x components structures
    const components = parsed.components || {};
    if (components.schemas) {
      for (const name in components.schemas) {
        const raw = components.schemas[name];
        schemas.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (components.securitySchemes) {
      for (const name in components.securitySchemes) {
        const raw = components.securitySchemes[name];
        securitySchemes.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'security',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (components.parameters) {
      for (const name in components.parameters) {
        const raw = components.parameters[name];
        parameters.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
    if (components.responses) {
      for (const name in components.responses) {
        const raw = components.responses[name];
        responses.set(name, {
          name,
          specId: id,
          specName: name,
          type: 'schema',
          raw,
          refs: extractRefs(raw)
        });
      }
    }
  }

  // 5. Ingest Endpoints
  const endpoints: CanonicalEndpoint[] = [];
  const paths = parsed.paths || {};
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

  for (const pathKey in paths) {
    if (!Object.prototype.hasOwnProperty.call(paths, pathKey)) continue;
    const pathItem = paths[pathKey];
    if (!pathItem || typeof pathItem !== 'object') continue;

    for (const methodKey of methods) {
      const operation = pathItem[methodKey];
      if (!operation || typeof operation !== 'object') continue;

      const endpointId = `${id}::${pathKey}::${methodKey}`;
      const refs = extractRefs(operation);

      endpoints.push({
        id: endpointId,
        specId: id,
        specName: name,
        path: pathKey,
        method: methodKey,
        summary: operation.summary || operation.operationId,
        description: operation.description,
        tags: Array.isArray(operation.tags) ? operation.tags : [],
        parameters: operation.parameters,
        requestBody: operation.requestBody,
        responses: operation.responses,
        security: operation.security || parsed.security || undefined,
        refs
      });
    }
  }

  return {
    id,
    name,
    detectedFormat,
    originalVersion,
    info,
    endpoints,
    schemas,
    securitySchemes,
    parameters,
    responses
  };
}
