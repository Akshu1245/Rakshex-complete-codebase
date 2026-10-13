/** Synthetic import fixtures for parser tests only. */
export const SAFE_SAMPLE_COLLECTIONS = {
  postman_v21: {
    info: {
      name: "Sample Secure API",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: "Health",
        request: {
          method: "GET",
          url: "https://api.example.com/health",
          header: [{ key: "Authorization", value: "Bearer {{token}}" }],
        },
      },
    ],
  },
  openapi3: {
    openapi: "3.0.3",
    info: { title: "Sample API", version: "1.0.0" },
    paths: {
      "/health": {
        get: {
          security: [{ bearerAuth: [] }],
          responses: { "200": { description: "ok" } },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
    },
  },
  swagger2: {
    swagger: "2.0",
    info: { title: "Sample Swagger", version: "1.0.0" },
    paths: {
      "/pets": {
        get: {
          security: [{ api_key: [] }],
          responses: { "200": { description: "ok" } },
        },
      },
    },
    securityDefinitions: {
      api_key: { type: "apiKey", name: "X-API-Key", in: "header" },
    },
  },
} as const;
