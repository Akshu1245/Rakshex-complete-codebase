//! Pure, side-effect-free Rust implementation of the existing TypeScript
//! `packages/action-control/src/evaluate.ts` decision contract.
//!
//! This crate is NOT wired to the live API. It must pass shared parity tests
//! and security review before the existing TypeScript engine is replaced.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Shadow,
    Enforce,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub name: String,
    pub effect: String,
    pub known: bool,
    pub resource: Option<String>,
    pub environment: Option<String>,
    pub amount_minor: Option<i64>,
    pub currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Authority {
    pub actions: Vec<String>,
    pub resources: Option<Vec<String>>,
    pub environments: Option<Vec<String>>,
    pub max_amount_minor: Option<i64>,
    pub currency: Option<String>,
    pub max_count: Option<u64>,
    pub valid_from: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Cumulative {
    pub action_count: u64,
    pub amount_minor: i64,
    pub recent_actions: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    pub version: String,
    pub deny_actions: Option<Vec<String>>,
    pub approval_actions: Option<Vec<String>>,
    pub approval_above_minor: Option<i64>,
    pub daily_amount_limit_minor: Option<i64>,
    pub dangerous_sequences: Option<Vec<Vec<String>>>,
    pub unknown_write_decision: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationInput {
    pub mode: Mode,
    pub action: Action,
    pub authority: Option<Authority>,
    pub cumulative: Option<Cumulative>,
    pub policy: Option<Policy>,
    pub now: Option<String>,
    #[serde(default)]
    pub frozen: bool,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResult {
    pub decision: String,
    pub effective_decision: String,
    pub would_block: bool,
    pub enforced: bool,
    pub reasons: Vec<String>,
    pub policy_version: String,
}

fn matches_action(pattern: &str, value: &str) -> bool {
    pattern == "*"
        || if let Some(prefix) = pattern.strip_suffix('*') {
            value.starts_with(prefix)
        } else {
            pattern == value
        }
}

fn any_matches(patterns: Option<&Vec<String>>, value: &str) -> bool {
    patterns
        .is_some_and(|patterns| patterns.iter().any(|pattern| matches_action(pattern, value)))
}

fn sequence_matches(history: &[String], sequence: &[String]) -> bool {
    !sequence.is_empty()
        && sequence.len() <= history.len()
        && history[history.len() - sequence.len()..]
            .iter()
            .zip(sequence.iter())
            .all(|(actual, pattern)| matches_action(pattern, actual))
}

fn parse_time(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.with_timezone(&Utc))
}

fn authority_reasons(
    scope: &Authority,
    action: &Action,
    now: DateTime<Utc>,
) -> Vec<String> {
    let mut reasons = Vec::new();

    if !scope
        .actions
        .iter()
        .any(|pattern| matches_action(pattern, &action.name))
    {
        reasons.push(format!(
            "Action {} is outside delegated authority",
            action.name
        ));
    }
    if let Some(resources) = scope.resources.as_ref().filter(|v| !v.is_empty()) {
        if !action
            .resource
            .as_ref()
            .is_some_and(|resource| resources.iter().any(|p| matches_action(p, resource)))
        {
            reasons.push("Resource is outside delegated authority".to_string());
        }
    }
    if let Some(environments) = scope.environments.as_ref().filter(|v| !v.is_empty()) {
        if !action
            .environment
            .as_ref()
            .is_some_and(|environment| environments.contains(environment))
        {
            reasons.push("Environment is outside delegated authority".to_string());
        }
    }
    if let Some(from) = &scope.valid_from {
        match parse_time(from) {
            Some(from) if now < from => reasons.push("Authority is not active yet".to_string()),
            None => reasons.push("Authority validity timestamp is invalid".to_string()),
            _ => {}
        }
    }
    if let Some(until) = &scope.expires_at {
        match parse_time(until) {
            Some(until) if now >= until => reasons.push("Authority has expired".to_string()),
            None => reasons.push("Authority expiry timestamp is invalid".to_string()),
            _ => {}
        }
    }
    if scope
        .max_amount_minor
        .is_some_and(|limit| action.amount_minor.unwrap_or(0) > limit)
    {
        reasons.push(format!(
            "Amount exceeds delegated limit of {} minor units",
            scope.max_amount_minor.unwrap_or_default()
        ));
    }
    if let (Some(scope_currency), Some(action_currency)) =
        (&scope.currency, &action.currency)
    {
        if scope_currency != action_currency {
            reasons.push(format!(
                "Currency {} is outside delegated authority",
                action_currency
            ));
        }
    }
    reasons
}

/// Parity-oriented version of the TypeScript decision function.
/// No database, broker, queue or external request is performed here.
pub fn evaluate(input: &EvaluationInput) -> EvaluationResult {
    let mut reasons = Vec::<String>::new();
    let mut decision = "ALLOW";
    let policy_version = input
        .policy
        .as_ref()
        .map_or("builtin:0.1", |policy| policy.version.as_str());

    let now = match input.now.as_deref() {
        Some(time) => parse_time(time),
        None => Some(Utc::now()),
    };

    if input.frozen {
        decision = "FREEZE";
        reasons.push("Agent or workspace is frozen".to_string());
    } else if input.authority.is_none() {
        decision = "DENY";
        reasons.push("No active delegated authority was supplied".to_string());
    } else if let (Some(authority), Some(now)) = (&input.authority, now) {
        let failures = authority_reasons(authority, &input.action, now);
        if !failures.is_empty() {
            decision = "DENY";
            reasons.extend(failures);
        }
    } else {
        decision = "DENY";
        reasons.push("Evaluation timestamp is invalid".to_string());
    }

    if decision == "ALLOW" && !input.action.known && input.action.effect != "read" {
        decision = input
            .policy
            .as_ref()
            .and_then(|policy| policy.unknown_write_decision.as_deref())
            .filter(|value| *value == "APPROVAL_REQUIRED")
            .unwrap_or("DENY");
        reasons.push(
            "Unknown write or destructive action follows the restrictive path".to_string(),
        );
    }

    if decision == "ALLOW"
        && any_matches(
            input.policy.as_ref().and_then(|policy| policy.deny_actions.as_ref()),
            &input.action.name,
        )
    {
        decision = "DENY";
        reasons.push("Organization policy denies this action".to_string());
    }
    if decision == "ALLOW"
        && any_matches(
            input.policy.as_ref().and_then(|policy| policy.approval_actions.as_ref()),
            &input.action.name,
        )
    {
        decision = "APPROVAL_REQUIRED";
        reasons.push("Organization policy requires approval for this action".to_string());
    }
    if decision == "ALLOW"
        && input
            .policy
            .as_ref()
            .and_then(|policy| policy.approval_above_minor)
            .is_some_and(|threshold| input.action.amount_minor.unwrap_or(0) > threshold)
    {
        decision = "APPROVAL_REQUIRED";
        reasons.push("Action amount exceeds the approval threshold".to_string());
    }
    if decision == "ALLOW"
        && input
            .authority
            .as_ref()
            .and_then(|authority| authority.max_count)
            .is_some_and(|limit| {
                input.cumulative.as_ref().map_or(0, |c| c.action_count) >= limit
            })
    {
        decision = "LIMIT";
        reasons.push("Delegated action-count limit has been reached".to_string());
    }
    if decision == "ALLOW"
        && input
            .policy
            .as_ref()
            .and_then(|policy| policy.daily_amount_limit_minor)
            .is_some_and(|limit| {
                input
                    .cumulative
                    .as_ref()
                    .map_or(0, |c| c.amount_minor)
                    .checked_add(input.action.amount_minor.unwrap_or(0))
                    .is_none_or(|amount| amount > limit)
            })
    {
        decision = "PAUSE";
        reasons.push("Cumulative daily amount limit would be exceeded".to_string());
    }
    if decision == "ALLOW" {
        if let Some(sequences) = input
            .policy
            .as_ref()
            .and_then(|policy| policy.dangerous_sequences.as_ref())
        {
            let mut history = input
                .cumulative
                .as_ref()
                .map_or_else(Vec::new, |c| c.recent_actions.clone());
            history.push(input.action.name.clone());
            if sequences
                .iter()
                .any(|sequence| sequence_matches(&history, sequence))
            {
                decision = "APPROVAL_REQUIRED";
                reasons.push("Action completes a configured high-risk sequence".to_string());
            }
        }
    }

    let pass_through = matches!(decision, "ALLOW" | "REDACT" | "SANDBOX");
    let enforced = matches!(input.mode, Mode::Enforce);
    let effective_decision = if !enforced || pass_through {
        "ALLOW"
    } else if decision == "APPROVAL_REQUIRED" {
        "PENDING_APPROVAL"
    } else {
        "DENY"
    };

    EvaluationResult {
        decision: decision.to_string(),
        effective_decision: effective_decision.to_string(),
        would_block: !pass_through,
        enforced,
        reasons: if reasons.is_empty() {
            vec!["Action is within delegated authority and policy".to_string()]
        } else {
            reasons
        },
        policy_version: policy_version.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct ParityCase {
        name: String,
        input: EvaluationInput,
        expected: EvaluationResult,
    }

    #[test]
    fn typescript_parity_vectors() {
        let source = include_str!("../fixtures/policy_cases.json");
        let cases: Vec<ParityCase> = serde_json::from_str(source).expect("parse fixture");
        assert!(cases.len() >= 10, "meaningful parity coverage required");
        for case in cases {
            assert_eq!(evaluate(&case.input), case.expected, "case: {}", case.name);
        }
    }

    #[test]
    fn wildcard_matching_matches_typescript_contract() {
        assert!(matches_action("*", "financial.refund"));
        assert!(matches_action("financial.*", "financial.refund"));
        assert!(!matches_action("financial.refund", "financial.refund.extra"));
        assert!(!matches_action("*.refund", "financial.refund"));
    }

    #[test]
    fn malformed_timestamp_fails_closed_in_enforce_mode() {
        let input: EvaluationInput = serde_json::from_str(r#"{
            "mode":"enforce",
            "action":{"name":"financial.refund","effect":"write","known":true},
            "authority":{"actions":["*"],"expiresAt":"not-a-date"}
        }"#).expect("parse");
        let result = evaluate(&input);
        assert_eq!(result.decision, "DENY");
        assert_eq!(result.effective_decision, "DENY");
    }
}
