// Internal dashboard surface — not for search indexing.
export const metadata = {
  title: "Enterprise Dashboard",
  robots: { index: false, follow: false },
};

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
