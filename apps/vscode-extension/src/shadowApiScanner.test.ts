import { describe, expect, it } from "vitest";
import {
  detectRoutesInFile,
  findShadowRoutes,
  normalisePath,
  scanWorkspace,
} from "./shadowApiScanner";

describe("normalisePath", () => {
  it("collapses parameter syntaxes to a uniform :param form", () => {
    expect(normalisePath("/users/:id")).toBe("/users/:id");
    expect(normalisePath("/users/{id}")).toBe("/users/:id");
    expect(normalisePath("/users/<int:id>")).toBe("/users/:id");
    expect(normalisePath("/users/<id>")).toBe("/users/:id");
  });

  it("lowercases and strips trailing slash and query string", () => {
    expect(normalisePath("/USERS/")).toBe("/users");
    expect(normalisePath("/users?include=email")).toBe("/users");
  });
});

describe("detectRoutesInFile", () => {
  it("detects Express routes (TypeScript)", () => {
    const src = `
import express from "express";
const app = express();
app.get("/health", (req, res) => res.send("ok"));
app.post("/users", (req, res) => {});
app.delete('/users/:id', handler);
const router = express.Router();
router.put("/items/:id", h);
app.use("/legacy", legacyRouter);
`;
    const routes = detectRoutesInFile("server/routes.ts", src);
    const summary = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(summary).toEqual([
      "* /legacy",
      "DELETE /users/:id",
      "GET /health",
      "POST /users",
      "PUT /items/:id",
    ]);
    expect(routes.every((r) => r.framework === "express")).toBe(true);
  });

  it("detects FastAPI routes (Python)", () => {
    const src = `
from fastapi import FastAPI, APIRouter
app = FastAPI()
router = APIRouter()

@app.get("/healthz")
def healthz():
    return {"ok": True}

@router.post("/items")
def create_item():
    pass

@app.delete("/items/{id}")
def delete_item(id: int):
    pass
`;
    const routes = detectRoutesInFile("api/main.py", src);
    const summary = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(summary).toEqual(["DELETE /items/{id}", "GET /healthz", "POST /items"]);
    expect(routes.every((r) => r.framework === "fastapi")).toBe(true);
  });

  it("detects Flask routes with default and explicit methods", () => {
    const src = `
from flask import Flask
app = Flask(__name__)

@app.route("/")
def index():
    return "ok"

@app.route("/login", methods=["POST", "GET"])
def login():
    return ""
`;
    const routes = detectRoutesInFile("app.py", src);
    const summary = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(summary).toEqual(["GET /", "POST /login"]);
  });

  it("detects Django path() routes (method unknown → '*')", () => {
    const src = `
from django.urls import path, re_path
urlpatterns = [
    path("admin/", admin.site.urls),
    path("users/<int:id>/", UserView.as_view()),
    re_path(r"^api/v1/items/$", ItemList.as_view()),
]
`;
    const routes = detectRoutesInFile("urls.py", src);
    expect(routes.find((r) => r.path === "admin/")?.method).toBe("*");
    expect(routes.find((r) => r.path === "users/<int:id>/")).toBeTruthy();
    expect(routes.length).toBe(3);
  });

  it("detects Spring Boot mappings", () => {
    const src = `
@RestController
@RequestMapping("/api")
public class UserController {
  @GetMapping("/users")
  public List<User> list() { return ...; }
  @PostMapping(value = "/users")
  public User create(@RequestBody User u) { return u; }
  @DeleteMapping("/users/{id}")
  public void remove(@PathVariable Long id) {}
}
`;
    const routes = detectRoutesInFile("UserController.java", src);
    const summary = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(summary).toEqual(["* /api", "DELETE /users/{id}", "GET /users", "POST /users"]);
  });

  it("detects Laravel routes", () => {
    const src = `<?php
Route::get('/users', [UserController::class, 'index']);
Route::post('/users', [UserController::class, 'store']);
Route::any('/legacy', LegacyController::class);
`;
    const routes = detectRoutesInFile("routes/web.php", src);
    const summary = routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(summary).toEqual(["* /legacy", "GET /users", "POST /users"]);
  });

  it("ignores files with the wrong extension", () => {
    const src = `app.get("/x")`;
    expect(detectRoutesInFile("README.md", src)).toEqual([]);
  });

  it("skips template-literal paths it cannot resolve statically", () => {
    const src = "app.get(`/users/${id}`, h);";
    expect(detectRoutesInFile("server.ts", src)).toEqual([]);
  });

  it("records 1-indexed line numbers", () => {
    const src = `// header\n// next\napp.get("/x", h);\n`;
    const r = detectRoutesInFile("server.ts", src);
    expect(r[0]?.line).toBe(3);
  });
});

describe("findShadowRoutes", () => {
  it("returns routes detected in code but not in the tracked set", () => {
    const detected = [
      { method: "GET", path: "/known", line: 1, framework: "express" as const, snippet: "" },
      { method: "POST", path: "/unknown", line: 2, framework: "express" as const, snippet: "" },
      { method: "DELETE", path: "/users/:id", line: 3, framework: "express" as const, snippet: "" },
    ];
    const tracked = ["GET:/known", "DELETE:/users/{id}"];
    const shadow = findShadowRoutes(detected, tracked);
    expect(shadow.map((s) => `${s.method} ${s.path}`)).toEqual(["POST /unknown"]);
  });

  it("treats wildcard tracked entries as covering any method", () => {
    const detected = [
      { method: "GET", path: "/x", line: 1, framework: "express" as const, snippet: "" },
      { method: "POST", path: "/x", line: 2, framework: "express" as const, snippet: "" },
    ];
    const shadow = findShadowRoutes(detected, ["*:/x"]);
    expect(shadow.length).toBe(0);
  });
});

describe("scanWorkspace", () => {
  it("aggregates across multiple files and returns shadow subset", () => {
    const files = [
      {
        path: "server/users.ts",
        contents: `app.get("/users", h);\napp.post("/users", h);`,
      },
      {
        path: "api/main.py",
        contents: `@app.get("/legacy")\ndef legacy(): pass`,
      },
    ];
    const tracked = ["GET:/users", "POST:/users"];
    const result = scanWorkspace(files, tracked);
    expect(result.detected.length).toBe(3);
    expect(result.shadow.length).toBe(1);
    expect(result.shadow[0]?.path).toBe("/legacy");
    expect(result.shadow[0]?.framework).toBe("fastapi");
  });
});
