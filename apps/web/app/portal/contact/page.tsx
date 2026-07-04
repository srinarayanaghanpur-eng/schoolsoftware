"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES, SCHOOL_CONTACT } from "@sri-narayana/shared";
import { Mail, Phone, MapPin, Send, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

type Contacts = Record<string, string>;

const MESSAGE_TYPES = [
  { value: "enquiry", label: "General Enquiry" },
  { value: "complaint", label: "Complaint / Suggestion" },
  { value: "support", label: "Support Ticket" },
  { value: "meeting", label: "Parent-Teacher Meeting Request" },
];

function Contact() {
  const [contacts, setContacts] = useState<Contacts>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", message: "", type: "enquiry" });

  useEffect(() => {
    adminApiRequest<{ ok: true; contacts: Contacts }>("/api/portal/messages")
      .then((result) => setContacts(result.contacts))
      .catch(() => {});
  }, []);

  // Always show the school's own details, falling back to the constants when
  // the admin hasn't configured overrides in settings.
  const phone = contacts.phone || SCHOOL_CONTACT.phone;
  const email = contacts.email;
  const address = contacts.address || SCHOOL_CONTACT.address;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) return;
    setSending(true);
    setError(null);
    setSent(false);
    try {
      await adminApiRequest<{ ok: true; id: string }>("/api/portal/messages", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSent(true);
      setForm({ subject: "", message: "", type: "enquiry" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader title="Contact School" description="Reach out to the school administration" />
      <section className="space-y-5 p-4 md:p-7">
        <div className="card p-5">
          <h3 className="font-extrabold text-[#1b1d32]">{SCHOOL_CONTACT.name}</h3>
          <div className="stagger-children mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f7f8fd] p-4">
              <Phone size={20} className="mb-2 text-[#3033a1]" />
              <h4 className="font-extrabold text-[#1b1d32]">Phone</h4>
              <p className="mt-1 text-sm font-medium text-[#7d86a8]">{phone}</p>
            </div>
            {email && (
              <div className="rounded-xl bg-[#f7f8fd] p-4">
                <Mail size={20} className="mb-2 text-[#3033a1]" />
                <h4 className="font-extrabold text-[#1b1d32]">Email</h4>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">{email}</p>
              </div>
            )}
            <div className="rounded-xl bg-[#f7f8fd] p-4">
              <MapPin size={20} className="mb-2 text-[#3033a1]" />
              <h4 className="font-extrabold text-[#1b1d32]">Address</h4>
              <p className="mt-1 text-sm font-medium text-[#7d86a8]">{address}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <MessageSquare size={20} className="text-[#3033a1]" />
            <h2 className="font-extrabold text-[#1f2136]">Send a Message</h2>
          </div>

          {sent && (
            <div className="mb-4 rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">
              Your message has been sent. The school will respond shortly.
            </div>
          )}
          {error && <div className="mb-4 rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[#303247]">Type</label>
              <select
                className="field"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {MESSAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[#303247]">Subject</label>
              <input
                className="field"
                placeholder="Enter subject"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[#303247]">Message</label>
              <textarea
                className="field min-h-[120px] resize-y"
                placeholder="Write your message here..."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={sending || !form.subject || !form.message}>
              <Send size={16} /> {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

export default function PortalContactPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <Contact />
      </AppShell>
    </AuthGate>
  );
}
