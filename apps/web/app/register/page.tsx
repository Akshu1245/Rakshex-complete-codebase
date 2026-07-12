import { redirect } from "next/navigation";

/**
 * Sign-up is OAuth-only (GitHub + Google). The dedicated registration form
 * has been removed, so /register now points users at the unified login page
 * where they can continue with GitHub or Google.
 */
export default function RegisterPage() {
  redirect("/login");
}
