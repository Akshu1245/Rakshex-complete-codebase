import React from "react";
import { DocsChrome } from "./DocsChrome";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <DocsChrome>{children}</DocsChrome>;
}
