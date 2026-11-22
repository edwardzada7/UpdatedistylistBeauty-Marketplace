import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { feedAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgoShort } from "@/utils/timeAgo";

/** Comment list + composer shown under a feed post. */
export default function PostComments({ postId, authId, onCountChange }) {
  const { userData } = useAuth();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    feedAPI
      .comments(postId)
      .then((r) => !cancelled && setComments(r.data?.comments || []))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    if (!authId) return toast.error("Please sign in to comment.");
    setSending(true);
    try {
      const res = await feedAPI.addComment(postId, authId, content);
      setComments((prev) => [...(prev || []), { ...res.data, author_name: res.data?.author_name || userData?.name || "You" }]);
      setText("");
      onCountChange?.((comments?.length || 0) + 1);
    } catch (err) {
      const msg = err?.response?.data?.detail;
      toast.error(typeof msg === "string" ? msg : "Could not post your comment");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pt-2 border-t space-y-2" data-testid={`post-comments-${postId}`}>
      {comments === null ? (
        <p className="text-xs text-gray-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-1.5 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="text-sm text-gray-800 break-words">
              <span className="font-semibold mr-1">{c.author_name || "Anonymous"}</span>
              {c.content}
              <span className="text-xs text-gray-400 ml-2">{timeAgoShort(c.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Add a comment..."
          className="flex-1 min-w-0 rounded-full border px-3 py-1.5 text-sm"
          data-testid={`post-comment-input-${postId}`}
        />
        <Button type="submit" size="sm" disabled={sending || !text.trim()}>
          {sending ? "..." : "Post"}
        </Button>
      </form>
    </div>
  );
}
