// Choosing a photo from the camera or the library, shrunk to a JPEG data URL. Used by Create and by quest pictures.
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Expo SDK 58 currently prefixes its web file accept filter with a comma, which
// leaves Chrome's macOS picker unable to select images. Use a plain image input.
function pickWebPhoto(source: "camera" | "library", maxSide: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    if (source === "camera") input.capture = "environment";
    input.style.display = "none";
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = () => {
      const file = input.files?.[0]; input.remove();
      if (!file) { resolve(null); return; }
      const url = URL.createObjectURL(file);
      const image = document.createElement("img");
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.naturalWidth * scale);
        canvas.height = Math.round(image.naturalHeight * scale);
        const context = canvas.getContext("2d");
        if (!context) { URL.revokeObjectURL(url); reject(new Error("canvas unavailable")); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", .78));
      };
      image.src = url;
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** A JPEG data URL, null if the person cancelled, or "denied" without permission. Throws if the photo can't be read. */
export async function pickPhoto(source: "camera" | "library", maxSide = 1280): Promise<string | null | "denied"> {
  if (Platform.OS === "web") return pickWebPhoto(source, maxSide);
  const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return "denied";
  const result = source === "camera" ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0], scale = Math.min(1, maxSide / Math.max(asset.width, asset.height));
  const actions: ImageManipulator.Action[] = scale < 1 ? [{ resize: { width: Math.round(asset.width * scale), height: Math.round(asset.height * scale) } }] : [];
  const image = await ImageManipulator.manipulateAsync(asset.uri, actions, { format: ImageManipulator.SaveFormat.JPEG, compress: .78, base64: true });
  if (!image.base64) throw new Error("Missing JPEG bytes");
  return `data:image/jpeg;base64,${image.base64}`;
}
