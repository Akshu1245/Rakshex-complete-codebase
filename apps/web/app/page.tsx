/* Design reminder: Trust Ledger — an honest, editorial overview page that explains action control and its boundaries before signup. */
"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, CircleAlert, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

const proofSteps = [
  [
    "01",
    "Describe the action",
    "RaksHex normalizes a requested refund, merge, export, or production write into a semantic business action.",
  ],
  [
    "02",
    "Delegate only what is needed",
    "Set the resource, amount, environment, time window, and approval boundary an agent may use.",
  ],
  [
    "03",
    "Broker the execution",
    "A brokered credential makes the decision meaningful at the provider path and records the result in the Action Ledger.",
  ],
];

const expectations = [
  ["Start in Shadow", "See what policy would block before enforcing it on a live workflow."],
  [
    "Protect the path",
    "Move sensitive credentials into the RaksHex broker and remove raw keys from the agent runtime.",
  ],
  [
    "Bring a real workflow",
    "Begin with one consequential action such as a refund, merge, production write, or data export.",
  ],
];

const faqs = [
  [
    "What does RaksHex actually control?",
    "RaksHex evaluates a requested business action against delegated authority and context. For a brokered credential path, its decision is enforced before the provider credential is used.",
  ],
  [
    "Does RaksHex automatically protect every AI agent?",
    "No. Direct provider keys, direct network egress, and unbrokered tools can bypass the control path. Strong enforcement requires that the sensitive action is routed through the RaksHex broker.",
  ],
  [
    "Who should begin with RaksHex?",
    "Teams that are moving AI agents beyond read only assistance into actions that affect money, production systems, customer data, source code, or regulated operations.",
  ],
];

function Seal() {
  return (
    <div className="rx-seal" aria-hidden="true">
      <ShieldCheck size={24} />
      <span>
        Action
        <br />
        authority
      </span>
      <i>verified at the path</i>
    </div>
  );
}

export default function RootHomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="rx-overview">
      <section className="rx-hero">
        <div className="rx-hero-gridline rx-hero-gridline-left" />
        <div className="rx-hero-gridline rx-hero-gridline-right" />
        <div className="rx-overview-wrap rx-hero-layout">
          <div className="rx-hero-copy">
            <p className="rx-kicker">
              <span /> RaksHex · Action control for AI systems
            </p>
            <h1>
              Give every AI action
              <br />
              <em>a boundary.</em>
            </h1>
            <p className="rx-hero-text">
              RaksHex is the control layer between autonomous agents and the real systems they can
              change. Define what an agent may do, route the sensitive action through a broker, and
              keep evidence of every decision.
            </p>
            <div className="rx-hero-actions">
              <Link href="/register" className="rx-button-primary">
                Create a workspace <ArrowRight size={17} />
              </Link>
              <a href="#how-it-works" className="rx-button-quiet">
                Understand the model <ArrowRight size={15} />
              </a>
            </div>
            <div className="rx-hero-notes">
              <span>
                <Check size={13} /> Start in Shadow
              </span>
              <span>
                <Check size={13} /> Broker when ready
              </span>
              <span>
                <Check size={13} /> Investigate with evidence
              </span>
            </div>
          </div>
          <div
            className="rx-hero-console"
            aria-label="Illustration of action authority being checked"
          >
            <div className="rx-console-top">
              <span>AUTHORIZATION TRACE</span>
              <b>
                <i /> live evaluation
              </b>
            </div>
            <div className="rx-console-flow">
              <div className="rx-console-node rx-agent-node">
                <small>REQUESTING AGENT</small>
                <strong>Refund assistant</strong>
                <span>financial.refund</span>
              </div>
              <div className="rx-console-line">
                <i />
              </div>
              <div className="rx-console-node rx-control-node">
                <small>RAKSHEX CHECK</small>
                <strong>Authority · policy · context</strong>
                <span>amount ≤ $100 · customer scope valid</span>
              </div>
              <div className="rx-console-line">
                <i />
              </div>
              <div className="rx-console-node rx-provider-node">
                <small>BROKERED EXECUTION</small>
                <strong>Provider credential</strong>
                <span>one action recorded</span>
              </div>
            </div>
            <div className="rx-console-outcome">
              <span>
                <ShieldCheck size={17} /> ALLOW
              </span>
              <p>Delegated authority is valid for this action.</p>
              <code>ledger: 7f4c:6b1e:authorized</code>
            </div>
            <Seal />
          </div>
        </div>
      </section>

      <section className="rx-proof-strip">
        <div className="rx-overview-wrap rx-proof-strip-inner">
          <p>What RaksHex is built to do</p>
          <span>Authorize consequential actions</span>
          <i />
          <span>Broker sensitive credentials</span>
          <i />
          <span>Preserve decision evidence</span>
        </div>
      </section>

      <section className="rx-developer-bridge">
        <div className="rx-overview-wrap rx-developer-bridge-inner">
          <div>
            <p className="rx-kicker">For the developer who ships the agent</p>
            <h2>
              Think in actions,
              <br />
              <em>not vague permissions.</em>
            </h2>
            <p>
              Start with the business change an agent is trying to make. RaksHex keeps the policy
              conversation concrete: who is asking, what resource is affected, what limit applies,
              and whether the protected execution path may continue.
            </p>
          </div>
          <div className="rx-action-payload" aria-label="Illustrative action definition">
            <div className="rx-action-payload-head">
              <span>illustrative action definition</span>
              <b>JSON</b>
            </div>
            <pre>{`{
  "agent": "refund-assistant",
  "action": "financial.refund",
  "resource": "customer:1827",
  "limit": { "amount": "≤ 10,000 INR" },
  "execution": "brokered"
}`}</pre>
            <p>
              <Check size={14} /> A decision becomes a record, not another invisible permission.
            </p>
          </div>
        </div>
      </section>

      <section className="rx-overview-section" id="how-it-works">
        <div className="rx-overview-wrap rx-section-intro">
          <p className="rx-kicker">How it works</p>
          <div>
            <h2>
              Make the action legible
              <br />
              <em>before you make it autonomous.</em>
            </h2>
            <p>
              Most AI security products talk about sessions, prompts, or model traffic. RaksHex
              focuses on the consequential business action: what the agent asked to do, what
              authority it holds, and whether execution should happen.
            </p>
          </div>
        </div>
        <div className="rx-overview-wrap rx-steps-grid">
          {proofSteps.map(([number, title, detail]) => (
            <article key={number} className="rx-step-card">
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rx-boundary" id="boundaries">
        <div className="rx-overview-wrap rx-boundary-layout">
          <div>
            <p className="rx-kicker">The trust boundary</p>
            <h2>
              A policy decision is only useful when it reaches the path that executes the action.
            </h2>
            <p>
              RaksHex does not claim universal enforcement. It becomes a meaningful control when the
              agent uses a brokered credential and no longer holds a raw provider key.
            </p>
          </div>
          <div className="rx-boundary-card">
            <div className="rx-boundary-pass">
              <ShieldCheck size={18} />
              <div>
                <strong>Protected path</strong>
                <span>Brokered credential · enforced decision</span>
              </div>
              <b>CONTROLLED</b>
            </div>
            <div className="rx-boundary-rule" />
            <div className="rx-boundary-limit">
              <CircleAlert size={18} />
              <div>
                <strong>Outside the boundary</strong>
                <span>Raw keys, direct egress, or unbrokered tools</span>
              </div>
              <b>EXPLICIT LIMIT</b>
            </div>
          </div>
        </div>
      </section>

      <section className="rx-overview-section" id="before-you-sign">
        <div className="rx-overview-wrap rx-section-intro rx-before-intro">
          <p className="rx-kicker">Before you sign up</p>
          <div>
            <h2>
              A good first rollout is
              <br />
              <em>deliberately narrow.</em>
            </h2>
            <p>
              RaksHex is most valuable when you begin with one high consequence workflow, verify the
              coverage path, and expand from proof rather than assumption.
            </p>
          </div>
        </div>
        <div className="rx-overview-wrap rx-expectation-grid">
          {expectations.map(([title, detail]) => (
            <article key={title}>
              <span>
                <Sparkles size={16} />
              </span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
          <aside>
            <p className="rx-kicker">Your first hour</p>
            <ol>
              <li>
                <b>01</b> Create an agent identity
              </li>
              <li>
                <b>02</b> Delegate a small authority
              </li>
              <li>
                <b>03</b> Store a brokered credential
              </li>
              <li>
                <b>04</b> Test an allow and a deny
              </li>
            </ol>
            <Link href="/register">
              Start the guided setup <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      </section>

      <section className="rx-overview-section rx-faq-section">
        <div className="rx-overview-wrap rx-section-intro">
          <p className="rx-kicker">Questions worth asking</p>
          <div>
            <h2>
              Understand the boundary
              <br />
              <em>before you trust the control.</em>
            </h2>
          </div>
        </div>
        <div className="rx-overview-wrap rx-faq-list">
          {faqs.map(([question, answer], index) => (
            <article className={openFaq === index ? "rx-faq-open" : ""} key={question}>
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                aria-expanded={openFaq === index}
              >
                <span>{question}</span>
                <ChevronDown size={18} />
              </button>
              <div>
                <p>{answer}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rx-cta-section">
        <div className="rx-overview-wrap rx-cta-inner">
          <div>
            <p className="rx-kicker">Ready to evaluate</p>
            <h2>
              Bring one real agent action.
              <br />
              <em>We will help you make it governable.</em>
            </h2>
          </div>
          <div>
            <Link href="/register" className="rx-button-primary">
              Create your workspace <ArrowRight size={17} />
            </Link>
            <Link href="/login" className="rx-cta-signin">
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </section>
      <footer className="rx-public-footer">
        <div className="rx-overview-wrap">
          <span>RAKSHEX</span>
          <p>Evidence led control for consequential AI actions.</p>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
