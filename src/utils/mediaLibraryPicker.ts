import * as ImagePicker from "expo-image-picker";

/**
 * Ask Photos for an SDR-compatible file. `Current` keeps HDR HEIC, which
 * ImageIO often fails to convert on the iOS Simulator (`IIOCallConvertHDRData -50`).
 * Uploads already JPEG-compress, so the original HDR asset is not needed.
 */
export const compatibleLibraryRepresentation =
  ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible;
