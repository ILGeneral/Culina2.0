import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

export async function submitReport(data: {
  type: string;
  description: string;
  appVersion: string;
  device: string;
}) {
  try {
    const callSubmitReport = httpsCallable(functions, "submitReport");
    const result = await callSubmitReport(data);
    console.log("Report submitted!:", result.data);
    return result.data;
  } catch (error: any) {
    console.error(" submitReport error:", error);
    throw error;
  }
}
