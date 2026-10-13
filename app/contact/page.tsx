import { ResourcePage } from "@/components/resource-page";
export const metadata = { title: "Contact | AudiFox" };
export const dynamic = "force-dynamic";
export default function ContactPage() {
  const email = process.env.SUPPORT_EMAIL?.trim() || "govindwork902@gmail.com";
  const configured = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return <ResourcePage title="Contact AudiFox"><p>For help, billing questions or deletion requests, include the investigation link and describe the issue. Do not send passwords, access tokens or payment details.</p>{configured ? <p><a className="text-cta" href={`mailto:${email}`}>Email support: {email}</a></p> : <p className="policy-notice" role="status">Support contact is not configured on this deployment. The product owner must set SUPPORT_EMAIL and confirm the support and deletion process before launch.</p>}</ResourcePage>;
}
