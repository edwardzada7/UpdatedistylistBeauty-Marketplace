import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { feedAPI } from "@/services/api";

/**
 * PostComposerModal — Phase 4 Social Feed Lite
 *
 * Lite implementation:
 *  - Provider can paste an http(s) image URL OR pick a local file (converted to
 *    a data:image base64 URL on the client). No external storage dependency.
 *  - Caption is optional.
 *  - On success, calls onCreated(post) so the parent can prepend it.
 *
 * Props:
 *   open: boolean
 *   onOpenChange: (next) => void
 *   authId: string (provider auth_id)
 *   onCreated?: (post) => void
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB upper bound to keep DB rows sane

export default function PostComposerModal({ open, onOpenChange, authId, onCreated }) {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("file"); // 'file' | 'url'
  const [imageUrl, setImageUrl] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setMode("file");
    setImageUrl("");
    setImageDataUrl("");
    setCaption("");
    setSubmitting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (next) => {
    if (!next && !submitting) reset();
    onOpenChange(next);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Image is too large. Max 4MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result);
      setImageUrl(""); // file overrides url
    };
    reader.onerror = () => toast.error("Could not read file.");
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const finalUrl = mode === "url" ? imageUrl.trim() : imageDataUrl;
    if (!finalUrl) {
      toast.error("Please pick an image or paste an image URL.");
      return;
    }
    if (mode === "url" && !/^https?:\/\//i.test(finalUrl)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    if (!authId) {
      toast.error("Not signed in.");
      return;
    }
    try {
      setSubmitting(true);
      const res = await feedAPI.create(authId, {
        image_url: finalUrl,
        caption: caption.trim() || null,
      });
      toast.success("Post published");
      if (onCreated) onCreated(res.data);
      reset();
      onOpenChange(false);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Failed to post";
      toast.error(typeof msg === "string" ? msg : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const previewSrc = mode === "url" ? imageUrl : imageDataUrl;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-md sm:max-w-lg"
        data-testid="post-composer-modal"
      >
        <DialogHeader>
          <DialogTitle>Share a new post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mode switch */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "file" ? "default" : "outline"}
              onClick={() => setMode("file")}
              data-testid="composer-mode-file"
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "url" ? "default" : "outline"}
              onClick={() => setMode("url")}
              data-testid="composer-mode-url"
            >
              <Link2 className="h-4 w-4 mr-1" />
              Paste URL
            </Button>
          </div>

          {/* File picker / URL input */}
          {mode === "file" ? (
            <div>
              <Label htmlFor="post-file" className="text-sm">
                Choose photo (max 4MB)
              </Label>
              <Input
                id="post-file"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-1"
                data-testid="composer-file-input"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="post-url" className="text-sm">
                Image URL
              </Label>
              <Input
                id="post-url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageDataUrl("");
                }}
                placeholder="https://..."
                className="mt-1"
                data-testid="composer-url-input"
              />
            </div>
          )}

          {/* Preview */}
          {previewSrc && (
            <div className="relative rounded-lg overflow-hidden bg-gray-100 border">
              <img
                src={previewSrc}
                alt="Preview"
                className="w-full max-h-72 object-cover"
                onError={() => toast.error("Could not load preview from URL")}
                data-testid="composer-preview"
              />
              <button
                type="button"
                onClick={() => {
                  setImageUrl("");
                  setImageDataUrl("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                aria-label="Remove preview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Caption */}
          <div>
            <Label htmlFor="post-caption" className="text-sm">
              Caption (optional)
            </Label>
            <Textarea
              id="post-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tell us about this look..."
              rows={3}
              maxLength={2000}
              className="mt-1"
              data-testid="composer-caption"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {caption.length}/2000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={submitting}
            data-testid="composer-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!imageUrl && !imageDataUrl)}
            data-testid="composer-publish"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
