export type WhatsAppSendResult = {
  success: boolean;
  providerMessageId: string;
  errorMessage: string;
};

export async function sendWhatsAppReminder(params: {
  to: string;
  templateName?: string;
  variables: Record<string, string>;
  apiKey: string;
  phoneNumberId: string;
}): Promise<WhatsAppSendResult> {
  const { to, apiKey, phoneNumberId } = params;

  if (!apiKey || !phoneNumberId) {
    return { success: false, providerMessageId: "", errorMessage: "WhatsApp API not configured" };
  }

  if (!to || to.length < 10) {
    return { success: false, providerMessageId: "", errorMessage: "Invalid mobile number" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: params.templateName || "fee_reminder",
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: Object.entries(params.variables).map(
                  ([key, value]) => ({
                    type: "text",
                    parameter_name: key,
                    text: value
                  })
                )
              }
            ]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `WhatsApp API error: ${response.status}`;
      return { success: false, providerMessageId: "", errorMessage: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id || "";
    return { success: true, providerMessageId: messageId, errorMessage: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "WhatsApp API request failed";
    return { success: false, providerMessageId: "", errorMessage: message };
  }
}
