import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  Plus,
  RefreshCcw,
  ArrowLeft,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { feedAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import BottomNavigation, { BottomNavSpacer } from "@/components/BottomNavigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import PostComposerModal from "@/components/PostComposerModal";
import { timeAgoShort } from "@/utils/timeAgo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 20;

/**
 * FeedScreen — Phase 4 Social Feed Lite.
 *
 * - Public discovery feed (newest first).
 * - Providers see a "+ New post" FAB.
 * - Anyone authenticated can like/unlike a post.
 * - Tapping a post avatar navigates to the provider profile.
 */
export default function FeedScreen() {
  const navigate = useNavigate();
  const { userData, isProvider } = useAuth();
  const authId = userData?.auth_id;

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (opts = {}) => {
    const { append = false } = opts;
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setRefreshing(true);
      }
      const offset = append ? posts.length : 0;
      const res = await feedAPI.list(authId, PAGE_SIZE, offset);
      const items = res.data?.posts || [];
      setPosts((prev) => (append ? [...prev, ...items] : items));
      const total = res.data?.total ?? items.length;
      setHasMore((append ? posts.length : 0) + items.length < total);
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message;
      if (e?.response?.status === 503) {
        toast.error("Feed not enabled — run phase4_social_feed.sql migration");
      } else {
        toast.error(typeof msg === "string" ? msg : "Failed to load feed");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
    // posts intentionally excluded — we capture offset via the closure ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authId]);

  const handleCreated = (post) => {
    if (!post) return;
    setPosts((prev) => [post, ...prev]);
  };

  const handleLikeToggle = async (post) => {
    if (!authId) {
      toast.error("Please sign in to like posts.");
      return;
    }
    // Optimistic
    const willLike = !post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: willLike,
              likes_count: Math.max(0, (p.likes_count || 0) + (willLike ? 1 : -1)),
            }
          : p
      )
    );
    try {
      if (willLike) {
        await feedAPI.like(post.id, authId);
      } else {
        await feedAPI.unlike(post.id, authId);
      }
    } catch (e) {
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked_by_me: post.liked_by_me,
                likes_count: post.likes_count,
              }
            : p
        )
      );
      const msg = e?.response?.data?.detail || "Could not update like";
      toast.error(typeof msg === "string" ? msg : "Could not update like");
    }
  };

  const handleDelete = async (post) => {
    if (!authId) return;
    if (post.provider_auth_id !== authId) return;
    const ok = window.confirm("Delete this post? This cannot be undone.");
    if (!ok) return;
    try {
      await feedAPI.remove(post.id, authId, false);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Post deleted");
    } catch (e) {
      toast.error("Failed to delete post");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-2xl">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              data-testid="feed-back-btn"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" /> Discovery
            </h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => load()}
            disabled={refreshing}
            data-testid="feed-refresh-btn"
          >
            <RefreshCcw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 max-w-2xl">
        {loading ? (
          <LoadingSpinner message="Loading feed..." />
        ) : posts.length === 0 ? (
          <EmptyFeed isProvider={isProvider} onCreate={() => setComposerOpen(true)} />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                viewerAuthId={authId}
                onLikeToggle={() => handleLikeToggle(post)}
                onDelete={() => handleDelete(post)}
                onOpenProvider={() => {
                  if (post.provider?.id) {
                    navigate(`/user/providers/${post.provider.id}`);
                  }
                }}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => load({ append: true })}
                  disabled={loadingMore}
                  data-testid="feed-load-more"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating compose button (providers only) */}
      {isProvider && (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="fixed bottom-24 right-5 h-14 w-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition flex items-center justify-center z-20"
          aria-label="New post"
          data-testid="feed-new-post-fab"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <PostComposerModal
        open={composerOpen}
        onOpenChange={setComposerOpen}
        authId={authId}
        onCreated={handleCreated}
      />

      <BottomNavSpacer />
      <BottomNavigation />
    </div>
  );
}

function EmptyFeed({ isProvider, onCreate }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <ImageIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          No posts yet
        </h3>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          {isProvider
            ? "Share your work to attract more bookings. Tap the + button to create your first post."
            : "Check back soon — providers will start sharing their work here."}
        </p>
        {isProvider && (
          <Button className="mt-4" onClick={onCreate} data-testid="feed-empty-create">
            <Plus className="h-4 w-4 mr-1" /> New post
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PostCard - exported separately so HomeScreen preview can reuse it if needed.
 */
export function PostCard({
  post,
  viewerAuthId,
  onLikeToggle,
  onDelete,
  onOpenProvider,
  compact = false,
}) {
  const isOwner = viewerAuthId && post.provider_auth_id === viewerAuthId;
  const display = post.provider?.display_name || post.provider?.name || "Provider";
  const subtitle = [
    post.provider?.city,
    post.provider?.provider_type === "business" ? "Salon" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Card className="overflow-hidden" data-testid={`post-card-${post.id}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onOpenProvider}
          className="flex items-center gap-3 text-left hover:opacity-90"
          data-testid={`post-open-provider-${post.id}`}
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.provider?.photo_url || undefined} alt={display} />
            <AvatarFallback>{(display || "P").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-sm text-gray-900 leading-tight">
              {display}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {subtitle}
              </p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {timeAgoShort(post.created_at)}
          </span>
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100"
                  aria-label="Post actions"
                  data-testid={`post-actions-${post.id}`}
                >
                  <MoreVertical className="h-4 w-4 text-gray-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-700"
                  onClick={onDelete}
                  data-testid={`post-delete-${post.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="bg-gray-100">
        <img
          src={post.image_url}
          alt={post.caption || "Post"}
          className={`w-full object-cover ${compact ? "max-h-64" : "max-h-[520px]"}`}
          loading="lazy"
        />
      </div>

      {/* Footer */}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLikeToggle}
            className={`flex items-center gap-1.5 transition ${
              post.liked_by_me ? "text-pink-600" : "text-gray-600 hover:text-pink-600"
            }`}
            data-testid={`post-like-${post.id}`}
            aria-label={post.liked_by_me ? "Unlike" : "Like"}
          >
            <Heart
              className={`h-5 w-5 ${post.liked_by_me ? "fill-pink-600" : ""}`}
            />
            <span className="text-sm font-medium">{post.likes_count || 0}</span>
          </button>
        </div>
        {post.caption && (
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            <span className="font-semibold mr-1">{display}</span>
            {post.caption}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
