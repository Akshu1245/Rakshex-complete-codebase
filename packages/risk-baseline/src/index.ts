export type {
  BaselineComparison,
  BaselineFinding,
  FindingDelta,
  GateOptions,
  RegressionKind,
  RiskBaseline,
  Severity,
  SeverityCounts,
} from "./types.js";

export { compareToBaseline, countSeverities, createBaseline, shouldFailCi } from "./baseline.js";
