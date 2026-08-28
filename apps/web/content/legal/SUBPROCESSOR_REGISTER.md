# RakshEx Subprocessor Register

Version: 2026-07-12

This register identifies categories of service providers that may process Customer Personal Data for the hosted Service. A row marked "conditional" is used only if the relevant feature is configured. The production owner must update status, processing region, and effective date before enabling a provider.

| Provider or category                              | Purpose                                                                  | Data categories                                                             | Region                                             | Status            |
| ------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- |
| Railway                                           | Hosted API, PostgreSQL, Redis, private service networking                | Account, workspace, encrypted credentials, audit and usage metadata         | United States region selected for current service  | Active            |
| Vercel or equivalent frontend host                | Website and dashboard delivery                                           | Browser requests, static assets, optional account-session traffic           | To be confirmed before production frontend cutover | Conditional       |
| Stripe                                            | Global payment processing                                                | Billing contact and payment transaction references                          | Provider-configured                                | Conditional       |
| Razorpay                                          | India payment processing                                                 | Billing contact and payment transaction references                          | India / provider-configured                        | Conditional       |
| Transactional email provider                      | Account verification, alerts, invoices, support email                    | Email address, name, workspace and event metadata                           | To be selected                                     | Conditional       |
| Google                                            | Optional OAuth sign-in                                                   | OAuth identifier, email, profile data authorised by user                    | Provider-configured                                | Conditional       |
| GitHub                                            | Optional App, OAuth, Copilot governance, and source-control integrations | Installation, organisation, repository, user and authorised audit metadata  | Provider-configured                                | Conditional       |
| Sentry or equivalent                              | Error monitoring and diagnostics                                         | Pseudonymous technical diagnostics; configured PII scrubbing required       | To be selected                                     | Conditional       |
| Crisp or equivalent                               | Optional support chat                                                    | Visitor messages and contact information                                    | To be selected; consent required                   | Conditional       |
| Customer-selected AI, cloud, or identity provider | Provider routing and Customer-authorised discovery                       | Data directed by Customer, including prompts only when Customer routes them | Customer/provider selected                         | Customer-directed |

## Change Process

RakshEx will provide at least 30 days' notice before adding or replacing a material subprocessor that processes Customer Personal Data, except where an urgent security or legal need requires a shorter period. Enterprise Customers may object under the DPA. Contact privacy@rakshex.in for the current register or a completed vendor questionnaire.

## Customer-Directed Providers

When Customer connects a provider, Customer controls the account relationship, scopes, and data sent to that provider. Those providers are not RakshEx subprocessors when they independently process data under Customer's direct agreement and instructions.
