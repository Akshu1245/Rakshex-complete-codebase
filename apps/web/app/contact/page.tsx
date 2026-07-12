import Link from "next/link";
import { Mail, MapPin, Phone, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Contact Us — RaksHex",
  description: "Get in touch with the RaksHex team for sales, support, or partnership inquiries.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-32 pb-16 px-6 xl:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 font-manrope">Get in Touch</h1>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Whether you are evaluating AI governance, need help with an integration, or want to
            explore a partnership — we are here to help.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-[#14B8A6]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Email</h3>
                <a
                  href="mailto:akshay@devpulse.ai"
                  className="text-neutral-400 hover:text-[#14B8A6] transition-colors"
                >
                  akshay@devpulse.ai
                </a>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-[#14B8A6]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Office</h3>
                <p className="text-neutral-400">
                  Rashi Technologies
                  <br />
                  Bengaluru, India
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/10 border border-[#14B8A6]/20 flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5 text-[#14B8A6]" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">Sales</h3>
                <p className="text-neutral-400">Book a demo call with our team</p>
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 mt-2 text-sm text-[#14B8A6] hover:text-[#2dd4bf] transition-colors"
                >
                  Schedule a demo <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Quick links */}
            <div className="pt-8 border-t border-neutral-800">
              <h3 className="font-semibold text-white mb-4">Quick Links</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: "Docs", href: "/docs" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Status", href: "/status" },
                  { label: "Changelog", href: "/changelog" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-1.5 rounded-lg text-sm bg-black/50 border border-neutral-800 text-neutral-400 hover:text-white hover:border-[#14B8A6]/40 transition-all"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-black/50 rounded-2xl border border-neutral-800 p-8">
            <h2 className="text-xl font-semibold mb-6">Send a Message</h2>
            <form
              action="mailto:akshay@devpulse.ai"
              method="post"
              encType="text/plain"
              className="space-y-5"
            >
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  className="w-full bg-black/50 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-[#14B8A6]/50 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full bg-black/50 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-[#14B8A6]/50 transition-colors"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Topic</label>
                <select
                  name="topic"
                  className="w-full bg-black/50 border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#14B8A6]/50 transition-colors"
                >
                  <option>General Inquiry</option>
                  <option>Sales / Enterprise</option>
                  <option>Technical Support</option>
                  <option>Partnership</option>
                  <option>Media / Press</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-neutral-400 mb-2">Message</label>
                <textarea
                  name="message"
                  rows={4}
                  required
                  className="w-full bg-black/50 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:border-[#14B8A6]/50 transition-colors resize-none"
                  placeholder="How can we help?"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#14B8A6] to-[#2dd4bf] text-black font-semibold hover:opacity-90 transition-opacity"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
