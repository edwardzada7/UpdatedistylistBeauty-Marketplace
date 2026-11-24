import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { usersAPI, stylistsAPI } from "@/services/api";

const MAX_BYTES = 8 * 1024 * 1024;

/** Shrinks big phone photos to a 640px JPEG so uploads stay fast. */
const shrink = (file) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => resolve(b || file), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

/** "Change photo" button: uploads to storage, saves the URL on the user (and provider) record. */
export default function AvatarUploader({ userData, isProvider, onDone, className = "" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > MAX_BYTES) return toast.error("Image is too large (max 8MB)");
    if (!userData?.id || !userData?.auth_id) return toast.error("Please sign in again");
    setBusy(true);
    try {
      const blob = await shrink(file);
      const path = `${userData.auth_id}/avatar/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message || "Upload failed");
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      await usersAPI.update(userData.id, { profile_image_url: url });
      if (isProvider) {
        try { await stylistsAPI.update(userData.id, { profile_image_url: url }); } catch (_) { /* column may not exist; user record is enough */ }
      }
      toast.success("Profile photo updated");
      if (onDone) await onDone(url);
    } catch (err) {
      toast.error("Could not upload photo", { description: err?.response?.data?.detail || err?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} data-testid="avatar-file-input" />
      <Button type="button" size="sm" variant="outline" className={className} disabled={busy} onClick={() => inputRef.current?.click()} data-testid="avatar-upload-btn">
        <Camera className="h-4 w-4 mr-1" />
        {busy ? "Uploading..." : "Change photo"}
      </Button>
    </>
  );
}
