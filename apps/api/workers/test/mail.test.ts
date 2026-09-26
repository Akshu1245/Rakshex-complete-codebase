import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMail } from "../src/adapters/mail";
import type { Env } from "../src/env";

const baseEnv = { MAILCHANNELS_FROM: "welcome@rakshex.in" } as Env;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mail adapter", () => {
  it("POSTs the MailChannels payload via fetch", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200, headers: { "x-message-id": "mc-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMail(baseEnv, {
      to: "boss@example.com",
      subject: "Digest",
      text: "hello",
      html: "<p>hello</p>",
    });
    expect(result).toEqual({ ok: true, messageId: "mc-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.mailchannels.net/tx/v1/send");
    const body = JSON.parse(init.body as string);
    expect(body.from.email).toBe("welcome@rakshex.in");
    expect(body.personalizations[0].to[0].email).toBe("boss@example.com");
    expect(body.subject).toBe("Digest");
  });

  it("fails closed when MAILCHANNELS_FROM is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendMail({} as Env, { to: "a@b.com", subject: "x", text: "y" })).rejects.toThrow(
      /not configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid recipient addresses before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendMail(baseEnv, { to: "not-an-email", subject: "x", text: "y" }),
    ).rejects.toThrow(/Invalid recipient/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws on MailChannels HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 401 })));
    await expect(sendMail(baseEnv, { to: "a@b.com", subject: "x", text: "y" })).rejects.toThrow(
      /MailChannels send failed \(401\)/,
    );
  });

  it("includes reply_to when provided, omits it otherwise", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendMail(baseEnv, { to: "a@b.com", subject: "x", text: "y", replyTo: "founder@x.com" });
    const withReply = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(withReply.reply_to).toEqual({ email: "founder@x.com" });

    fetchMock.mockClear();
    await sendMail(baseEnv, { to: "a@b.com", subject: "x", text: "y" });
    const withoutReply = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(withoutReply).not.toHaveProperty("reply_to");
  });
});
