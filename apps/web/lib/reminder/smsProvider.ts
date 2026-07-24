export type SmsSendResult = {
  success: boolean;
  providerMessageId: string;
  errorMessage: string;
};

export async function sendSmsReminder(params: {
  to: string;
  message: string;
  apiUrl: string;
  apiKey: string;
  senderId: string;
  dltPeId: string;
  dltHeaderId: string;
  dltTemplateId: string;
}): Promise<SmsSendResult> {
  const { to, message, apiUrl, apiKey, senderId, dltPeId, dltHeaderId, dltTemplateId } = params;

  if (!apiUrl || !apiKey) {
    return { success: false, providerMessageId: "", errorMessage: "SMS API not configured" };
  }

  if (!to || to.length < 10) {
    return { success: false, providerMessageId: "", errorMessage: "Invalid mobile number" };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        to,
        message,
        senderId: senderId || "SNHSCH",
        dltEntityId: dltPeId,
        dltHeaderId: dltHeaderId,
        dltTemplateId: dltTemplateId,
        channel: "trans"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `SMS API error: ${response.status}`;
      return { success: false, providerMessageId: "", errorMessage: errorMsg };
    }

    const messageId = data?.messageId || data?.id || data?.data?.messageId || "";
    return { success: true, providerMessageId: messageId, errorMessage: "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMS API request failed";
    return { success: false, providerMessageId: "", errorMessage: message };
  }
}
