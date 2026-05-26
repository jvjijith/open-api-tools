import { CanonicalSpec, CanonicalEndpoint, CanonicalComponent } from './ir';
import { extractRefs } from './parser';

/**
 * Normalizes parameter definitions from Swagger 2.0 to OpenAPI 3.0 schema specs.
 */
function upgradeParameter(param: any): any {
  if (!param || typeof param !== 'object') return param;
  
  const upgraded = { ...param };
  
  // Swagger 2.0 schema-related fields directly on parameter root
  const schemaFields = [
    'type', 'format', 'default', 'enum', 'items', 'maximum', 'minimum',
    'exclusiveMaximum', 'exclusiveMinimum', 'maxLength', 'minLength',
    'pattern', 'maxItems', 'minItems', 'uniqueItems', 'multipleOf'
  ];

  const hasSchemaFields = schemaFields.some(field => field in upgraded);
  
  if (hasSchemaFields && !upgraded.schema) {
    const schema: any = {};
    schemaFields.forEach(field => {
      if (field in upgraded) {
        schema[field] = upgraded[field];
        delete upgraded[field];
      }
    });
    upgraded.schema = schema;
  }
  
  return upgraded;
}

/**
 * Upgrades response headers from Swagger 2.0 to OpenAPI 3.0 schema specs.
 */
function upgradeHeaders(headers: any): any {
  if (!headers || typeof headers !== 'object') return headers;
  
  const upgraded = { ...headers };
  for (const headerKey in upgraded) {
    if (Object.prototype.hasOwnProperty.call(upgraded, headerKey)) {
      let header = upgraded[headerKey];
      if (header && typeof header === 'object') {
        header = { ...header };
        const schemaFields = ['type', 'format', 'default', 'enum', 'items'];
        const hasSchemaFields = schemaFields.some(field => field in header);
        
        if (hasSchemaFields && !header.schema) {
          const schema: any = {};
          schemaFields.forEach(field => {
            if (field in header) {
              schema[field] = header[field];
              delete header[field];
            }
          });
          header.schema = schema;
        }
        upgraded[headerKey] = header;
      }
    }
  }
  return upgraded;
}

/**
 * Upgrades a single Swagger 2.0 endpoint to OpenAPI 3.0 specification.
 */
function upgradeEndpoint(ep: CanonicalEndpoint): CanonicalEndpoint {
  let upgradedParams: any[] = [];
  let requestBody: any = ep.requestBody;
  
  const rawParams = ep.parameters || [];
  const bodyParams = rawParams.filter(p => p && p.in === 'body');
  const formDataParams = rawParams.filter(p => p && p.in === 'formData');
  const otherParams = rawParams.filter(p => p && p.in !== 'body' && p.in !== 'formData');

  // 1. Process "in: body" -> requestBody
  if (bodyParams.length > 0 && !requestBody) {
    const bodyParam = bodyParams[0];
    requestBody = {
      description: bodyParam.description,
      required: bodyParam.required,
      content: {
        'application/json': {
          schema: bodyParam.schema || {}
        }
      }
    };
  }

  // 2. Process "in: formData" -> requestBody with urlencoded / multipart
  if (formDataParams.length > 0 && !requestBody) {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    formDataParams.forEach(p => {
      const schemaField = { ...p };
      delete schemaField.name;
      delete schemaField.in;
      delete schemaField.required;
      delete schemaField.description;

      properties[p.name] = schemaField;
      if (p.required) required.push(p.name);
    });

    const schemaObj: any = {
      type: 'object',
      properties
    };
    if (required.length > 0) schemaObj.required = required;

    requestBody = {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: schemaObj
        }
      }
    };
  }

  // 3. Process other parameters, wrapping schema fields
  upgradedParams = otherParams.map(upgradeParameter);

  // 4. Upgrade responses headers
  const responses = { ...ep.responses };
  for (const status in responses) {
    if (Object.prototype.hasOwnProperty.call(responses, status)) {
      const resp = responses[status];
      if (resp && typeof resp === 'object') {
        const upgradedResp = { ...resp };
        if (upgradedResp.headers) {
          upgradedResp.headers = upgradeHeaders(upgradedResp.headers);
        }
        responses[status] = upgradedResp;
      }
    }
  }

  return {
    ...ep,
    parameters: upgradedParams.length > 0 ? upgradedParams : undefined,
    requestBody,
    responses,
    refs: extractRefs({ parameters: upgradedParams, requestBody, responses })
  };
}

/**
 * Upgrades a Swagger 2.0 Security Scheme to OpenAPI 3.0 specification.
 */
function upgradeSecurityScheme(sec: CanonicalComponent): CanonicalComponent {
  const upgraded = { ...sec.raw };

  if (upgraded.type === 'basic') {
    upgraded.type = 'http';
    upgraded.scheme = 'basic';
  } else if (upgraded.type === 'oauth2') {
    const flowType = upgraded.flow; // implicit, password, application, accessCode
    const flows: any = {};

    let mappedFlowKey = flowType;
    if (flowType === 'application') mappedFlowKey = 'clientCredentials';
    if (flowType === 'accessCode') mappedFlowKey = 'authorizationCode';

    if (mappedFlowKey) {
      flows[mappedFlowKey] = {
        authorizationUrl: upgraded.authorizationUrl,
        tokenUrl: upgraded.tokenUrl,
        scopes: upgraded.scopes || {}
      };
    }

    upgraded.flows = flows;
    delete upgraded.flow;
    delete upgraded.authorizationUrl;
    delete upgraded.tokenUrl;
    delete upgraded.scopes;
  }

  return {
    ...sec,
    raw: upgraded,
    refs: extractRefs(upgraded)
  };
}

/**
 * Transforms a CanonicalSpec parsed from Swagger 2.0 into a fully valid OpenAPI 3.0 CanonicalSpec.
 */
export function upgradeSwaggerSpecToOpenAPI3(spec: CanonicalSpec): CanonicalSpec {
  if (spec.detectedFormat !== 'swagger2') return spec;

  // 1. Upgrade endpoints
  const upgradedEndpoints = spec.endpoints.map(upgradeEndpoint);

  // 2. Upgrade schemas (wrap direct parameter definition schemas inside schemas if Swagger defined them directly)
  const upgradedSchemas = new Map<string, CanonicalComponent>();
  spec.schemas.forEach((s, name) => {
    const upgradedRaw = upgradeParameter(s.raw); // handles schema fields directly on definitions
    upgradedSchemas.set(name, {
      ...s,
      raw: upgradedRaw,
      refs: extractRefs(upgradedRaw)
    });
  });

  // 3. Upgrade security schemes
  const upgradedSecurity = new Map<string, CanonicalComponent>();
  spec.securitySchemes.forEach((sec, name) => {
    upgradedSecurity.set(name, upgradeSecurityScheme(sec));
  });

  // 4. Upgrade parameters components
  const upgradedParameters = new Map<string, CanonicalComponent>();
  spec.parameters.forEach((p, name) => {
    const upgradedRaw = upgradeParameter(p.raw);
    upgradedParameters.set(name, {
      ...p,
      raw: upgradedRaw,
      refs: extractRefs(upgradedRaw)
    });
  });

  // 5. Upgrade responses components
  const upgradedResponses = new Map<string, CanonicalComponent>();
  spec.responses.forEach((r, name) => {
    const upgradedRaw = { ...r.raw };
    if (upgradedRaw.headers) {
      upgradedRaw.headers = upgradeHeaders(upgradedRaw.headers);
    }
    upgradedResponses.set(name, {
      ...r,
      raw: upgradedRaw,
      refs: extractRefs(upgradedRaw)
    });
  });

  return {
    ...spec,
    detectedFormat: 'openapi3.0',
    originalVersion: '3.0.0', // Normalised target
    endpoints: upgradedEndpoints,
    schemas: upgradedSchemas,
    securitySchemes: upgradedSecurity,
    parameters: upgradedParameters,
    responses: upgradedResponses
  };
}
