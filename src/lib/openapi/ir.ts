import { ConflictType } from './types';

export type SpecFormat = 'swagger2' | 'openapi3.0' | 'openapi3.1';

export interface CanonicalEndpoint {
  id: string;          // unique key: specId + "::" + path + "::" + method
  specId: string;
  specName: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  security?: any[];
  refs: string[];      // harvested $ref paths
}

export interface CanonicalComponent {
  name: string;
  specId: string;
  specName: string;
  type: ConflictType;  // 'schema' | 'security' | etc.
  raw: any;            // raw JSON-schema or configuration block
  refs: string[];      // inner $ref references
}

export interface CanonicalSpec {
  id: string;
  name: string;
  detectedFormat: SpecFormat;
  originalVersion: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  endpoints: CanonicalEndpoint[];
  schemas: Map<string, CanonicalComponent>;
  securitySchemes: Map<string, CanonicalComponent>;
  parameters: Map<string, CanonicalComponent>;
  responses: Map<string, CanonicalComponent>;
}
