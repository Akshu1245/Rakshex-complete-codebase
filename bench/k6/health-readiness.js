import http from "k6/http";
import { check } from "k6";

const BASE_URL = (__ENV.BASE_URL || "https://api.rakshex.in").replace(/\/$/, "");

export const options = {
  scenarios: {
    readiness: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE || 20),
      timeUnit: "1s",
      duration: __ENV.DURATION || "2m",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<250", "p(99)<500"],
    checks: ["rate>0.999"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health/ready`, {
    tags: { surface: "readiness" },
  });
  check(res, {
    "readiness returns 200": (r) => r.status === 200,
    "readiness reports ok": (r) => {
      try {
        return r.json("status") === "ok";
      } catch {
        return false;
      }
    },
  });
}
