import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "@sri-narayana/shared";

export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress?.(percent);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      }
    );
  });
}

export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

export function getStudentPhotoPath(admissionNumber: string, fileName: string): string {
  return `students/${admissionNumber}/photos/${fileName}`;
}

export function getDocumentPath(admissionNumber: string, fileName: string): string {
  return `students/${admissionNumber}/documents/${fileName}`;
}
