import { ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Uploads a captured selfie and returns its Firebase Storage path (never a
 * public URL). Storage rules allow the owning teacher to write only under
 * attendance-selfies/{teacherId}/.
 */
export async function uploadAttendanceSelfie(
  teacherId: string,
  uri: string,
  eventType: "checkin" | "checkout"
): Promise<string> {
  if (!teacherId) throw new Error("Teacher profile not linked.");
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileName = `${Date.now()}-${eventType}.jpg`;
  const storagePath = `attendance-selfies/${teacherId}/${fileName}`;
  await uploadBytes(ref(storage, storagePath), blob, {
    contentType: blob.type || "image/jpeg"
  });
  return storagePath;
}
