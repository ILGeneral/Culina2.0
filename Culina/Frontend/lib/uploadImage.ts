import { storage } from "@/lib/firebaseConfig";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from "uuid";

export async function uploadImageAsync(uri: string, userId: string, folder: string = 'inventory') {
  try {
    // Read the file as blob
    const response = await fetch(uri);
    const blob = await response.blob();

    // Create unique path
    const imageRef = ref(storage, `${folder}/${userId}/${uuidv4()}.jpg`);

    // Upload blob
    await uploadBytes(imageRef, blob);

    // Get the download URL
    const url = await getDownloadURL(imageRef);
    return url;
  } catch (error) {
    console.error("Upload failed:", error);
    throw error;
  }
}
