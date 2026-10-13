/**
 * YC #13: conservative OpenAPI contract-diff foundation.
 *
 * Pure, deterministic, offline, no LLM, no network access, no automatic edits.
 * Scope: OpenAPI 3.x; $ref, callbacks, polymorphism and media-specific schemas
 * are deliberately NOT resolved. Fail explicitly instead of reporting "safe".
 */
export type ContractChangeKind =
  | "operation_removed"
  | "required_parameter_added"
  | "request_body_required"
  | "required_request_property_added"
  | "response_property_removed";

export interface ContractChange {
  kind: ContractChangeKind;
  method: string;
  path: string;
  location: string;
  message: string;
}

export interface ContractDiffResult {
  breaking: boolean;
  changes: ContractChange[];
  scope: string;
}

type Obj = Record<string, unknown>;

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;

function record(value: unknown): Obj | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : null;
}

function sorted(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function assertSimple(value: unknown, where: string): Obj {
  const obj = record(value);
  if (!obj || obj["$ref"]) {
    throw new Error(`Unsupported unresolved or invalid OpenAPI object at ${where}`);
  }
  return obj;
}

function spec(input: unknown, label: string): Obj {
  const obj = assertSimple(input, label);
  if (typeof obj.openapi !== "string" || !/^3\.[01](?:\.|$)/.test(obj.openapi)) {
    throw new Error(`${label} must be OpenAPI 3.0 or 3.1`);
  }
  if (!record(obj.paths)) {
    throw new Error(`${label}.paths must be an object`);
  }
  return obj;
}

function params(root: Obj, operation: Obj, where: string): Map<string, boolean> {
  const path = assertSimple(root, where + ".path");
  const rows = [
    ...(Array.isArray(path.parameters) ? path.parameters : []),
    ...(Array.isArray(operation.parameters) ? operation.parameters : []),
  ];
  const result = new Map<string, boolean>();
  for (const [index, item] of rows.entries()) {
    const param = assertSimple(item, `${where}.parameters[${index}]`);
    if (typeof param.name !== "string" || typeof param.in !== "string") {
      throw new Error(`Invalid parameter at ${where}.parameters[${index}]`);
    }
    result.set(`${param.in}:${param.name}`, param.in === "path" || param.required === true);
  }
  return result;
}

function jsonSchema(body: Obj, where: string): Obj | null {
  const content = record(body.content);
  if (!content) return null;
  const json = record(content["application/json"]);
  if (!json || json.schema === undefined) return null;
  return assertSimple(json.schema, where + ".content.application/json.schema");
}

function schemaProperties(schema: Obj, where: string): { properties: Obj; required: Set<string> } {
  const properties =
    schema.properties === undefined ? {} : assertSimple(schema.properties, where + ".properties");
  for (const [key, value] of Object.entries(properties)) {
    assertSimple(value, where + ".properties." + key);
  }
  if (schema.allOf || schema.oneOf || schema.anyOf || schema.not || schema.discriminator) {
    throw new Error(`Unsupported composition at ${where}`);
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (!required.every((item) => typeof item === "string")) {
    throw new Error(`Invalid required list at ${where}`);
  }
  return { properties, required: new Set(required as string[]) };
}

function responseSchema(operation: Obj, where: string): Obj | null {
  const responses = assertSimple(operation.responses, where + ".responses");
  const success = record(responses["200"]);
  if (!success) return null;
  return jsonSchema(assertSimple(success, where + ".responses.200"), where + ".responses.200");
}

export function diffOpenApiContracts(
  beforeInput: unknown,
  afterInput: unknown,
): ContractDiffResult {
  const before = spec(beforeInput, "before");
  const after = spec(afterInput, "after");
  const beforePaths = assertSimple(before.paths, "before.paths");
  const afterPaths = assertSimple(after.paths, "after.paths");
  const changes: ContractChange[] = [];
  const add = (
    kind: ContractChangeKind,
    method: string,
    path: string,
    location: string,
    message: string,
  ) => {
    changes.push({ kind, method: method.toUpperCase(), path, location, message });
  };

  for (const path of sorted(Object.keys(beforePaths))) {
    const oldPath = assertSimple(beforePaths[path], "before.paths." + path);
    const newPathValue = afterPaths[path];
    const newPath =
      newPathValue === undefined ? null : assertSimple(newPathValue, "after.paths." + path);

    for (const method of METHODS) {
      if (oldPath[method] === undefined) continue;
      const oldOp = assertSimple(oldPath[method], `before.paths.${path}.${method}`);
      if (!newPath || newPath[method] === undefined) {
        add("operation_removed", method, path, "paths", "Previously available operation removed");
        continue;
      }

      const newOp = assertSimple(newPath[method], `after.paths.${path}.${method}`);
      const oldParams = params(oldPath, oldOp, `before.paths.${path}.${method}`);
      const newParams = params(newPath, newOp, `after.paths.${path}.${method}`);
      for (const key of sorted([...newParams.keys()])) {
        if (newParams.get(key) && !oldParams.get(key)) {
          add(
            "required_parameter_added",
            method,
            path,
            "parameters." + key,
            `Newly required parameter: ${key}`,
          );
        }
      }

      const oldBody =
        oldOp.requestBody === undefined
          ? null
          : assertSimple(oldOp.requestBody, "before.requestBody");
      const newBody =
        newOp.requestBody === undefined
          ? null
          : assertSimple(newOp.requestBody, "after.requestBody");
      if (newBody?.required === true && oldBody?.required !== true) {
        add("request_body_required", method, path, "requestBody", "Request body became required");
      }

      const oldSchema = oldBody ? jsonSchema(oldBody, "before.requestBody") : null;
      const newSchema = newBody ? jsonSchema(newBody, "after.requestBody") : null;
      if (newSchema) {
        const newer = schemaProperties(newSchema, "after.requestBody.schema");
        const older = oldSchema
          ? schemaProperties(oldSchema, "before.requestBody.schema")
          : { properties: {}, required: new Set<string>() };
        for (const key of sorted([...newer.required])) {
          if (!older.required.has(key)) {
            add(
              "required_request_property_added",
              method,
              path,
              "requestBody.application/json." + key,
              `Newly required JSON request property: ${key}`,
            );
          }
        }
      }

      const oldResponse = responseSchema(oldOp, "before");
      const newResponse = responseSchema(newOp, "after");
      if (oldResponse && newResponse) {
        const older = schemaProperties(oldResponse, "before.response.schema");
        const newer = schemaProperties(newResponse, "after.response.schema");
        for (const key of sorted(Object.keys(older.properties))) {
          if (!(key in newer.properties)) {
            add(
              "response_property_removed",
              method,
              path,
              "responses.200.application/json." + key,
              `JSON 200 response property removed: ${key}`,
            );
          }
        }
      }
    }
  }

  return {
    breaking: changes.length > 0,
    changes,
    scope:
      "Partial OpenAPI 3.0/3.1 detection: operations, required parameters, JSON body requirements, JSON 200 property removal. A clean result is NOT proof of compatibility.",
  };
}
