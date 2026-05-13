// @ts-nocheck  
import { Buffer } from "buffer";
import { describe, expect, it } from "vitest";

import {
  buildAuthnRequest,
  encodeForRedirect,
  parseSamlResponse,
  validateSamlResponse,
  type SamlConfig,
} from "./ssoSaml";

const CONFIG: SamlConfig = {
  entryPoint: "https://idp.example.com/sso",
  issuer: "https://app.ojas.com/sp",
  audience: "https://app.ojas.com/sp",
  callbackUrl: "https://app.ojas.com/auth/sso/1/saml/callback",
};

function buildSampleResponse(opts: {
  audience?: string;
  email?: string;
  inResponseTo?: string;
  notOnOrAfter?: string;
  signed?: boolean;
}): string {
  const audience = opts.audience ?? CONFIG.audience;
  const email = opts.email ?? "alice@example.com";
  const irt = opts.inResponseTo ? `InResponseTo="${opts.inResponseTo}" ` : "";
  const noa = opts.notOnOrAfter ?? "2099-01-01T00:00:00Z";
  const sigBlock = opts.signed
    ? `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo/></ds:Signature>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ${irt}ID="_responseid" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">
  <saml:Issuer>https://idp.example.com</saml:Issuer>
  ${sigBlock}
  <saml:Assertion ID="_assertionid" Version="2.0" IssueInstant="2026-01-01T00:00:00Z">
    <saml:Issuer>https://idp.example.com</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${email}</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2026-01-01T00:00:00Z" NotOnOrAfter="${noa}">
      <saml:AudienceRestriction>
        <saml:Audience>${audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>${email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue>Alice</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="lastName">
        <saml:AttributeValue>Anderson</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="groups">
        <saml:AttributeValue>admins</saml:AttributeValue>
        <saml:AttributeValue>devs</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;
  return Buffer.from(xml, "utf-8").toString("base64");
}

describe("buildAuthnRequest", () => {
  it("builds an XML AuthnRequest with the expected ACS + NameID format", () => {
    const r = buildAuthnRequest(CONFIG);
    expect(r.id).toMatch(/^_[a-f0-9]+$/);
    expect(r.xml).toContain('<samlp:AuthnRequest');
    expect(r.xml).toContain(`Destination="${CONFIG.entryPoint}"`);
    expect(r.xml).toContain(`AssertionConsumerServiceURL="${CONFIG.callbackUrl}"`);
    expect(r.xml).toContain('Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"');
    expect(r.xml).toContain(`<saml:Issuer>${CONFIG.issuer}</saml:Issuer>`);
  });

  it("escapes XML-significant characters in attributes", () => {
    const r = buildAuthnRequest({
      ...CONFIG,
      entryPoint: 'https://idp.example.com/sso?a=1&b="x"',
    });
    expect(r.xml).toContain("&amp;b=&quot;x&quot;");
    expect(r.xml).not.toContain('&b="x"');
  });

  it("encodeForRedirect returns base64", () => {
    const r = buildAuthnRequest(CONFIG);
    const enc = encodeForRedirect(r.xml);
    expect(Buffer.from(enc, "base64").toString("utf-8")).toBe(r.xml);
  });
});

describe("parseSamlResponse", () => {
  it("extracts NameID, attributes, and signature flag", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ signed: true })
    );
    expect(parsed.attributes.nameId).toBe("alice@example.com");
    expect(parsed.attributes.email).toBe("alice@example.com");
    expect(parsed.attributes.firstName).toBe("Alice");
    expect(parsed.attributes.lastName).toBe("Anderson");
    expect(parsed.attributes.groups).toEqual(["admins", "devs"]);
    expect(parsed.audience).toBe(CONFIG.audience);
    expect(parsed.signed).toBe(true);
  });

  it("captures InResponseTo when present", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ inResponseTo: "_request-1" })
    );
    expect(parsed.inResponseTo).toBe("_request-1");
  });

  it("throws on non-base64 input", async () => {
    await expect(parseSamlResponse("not base64 ?!?!")).rejects.toThrow();
  });

  it("throws when XML lacks a Response element", async () => {
    const xml = Buffer.from('<?xml version="1.0"?><Other/>').toString("base64");
    await expect(parseSamlResponse(xml)).rejects.toThrow(
      /does not contain a Response/
    );
  });

  it("throws when assertion missing", async () => {
    const xml = Buffer.from(
      '<?xml version="1.0"?><samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"></samlp:Response>'
    ).toString("base64");
    await expect(parseSamlResponse(xml)).rejects.toThrow(
      /missing <Assertion>/
    );
  });
});

describe("validateSamlResponse", () => {
  it("accepts a valid response within timing window", async () => {
    const parsed = await parseSamlResponse(buildSampleResponse({}));
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).not.toThrow();
  });

  it("rejects audience mismatch", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ audience: "https://other.example.com" })
    );
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).toThrow(/audience mismatch/);
  });

  it("rejects expired (NotOnOrAfter has passed)", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ notOnOrAfter: "2026-01-02T00:00:00Z" })
    );
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).toThrow(/NotOnOrAfter has passed/);
  });

  it("rejects InResponseTo mismatch", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ inResponseTo: "_request-1" })
    );
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        expectedInResponseTo: "_request-2",
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).toThrow(/InResponseTo/);
  });

  it("rejects unsigned responses when requireSignatureVerified is true", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ signed: false })
    );
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        requireSignatureVerified: true,
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).toThrow(/not signed/);
  });

  it("accepts signed responses when requireSignatureVerified is true", async () => {
    const parsed = await parseSamlResponse(
      buildSampleResponse({ signed: true })
    );
    expect(() =>
      validateSamlResponse(parsed, {
        expectedAudience: CONFIG.audience,
        requireSignatureVerified: true,
        now: new Date("2026-06-01T00:00:00Z"),
      })
    ).not.toThrow();
  });
});
