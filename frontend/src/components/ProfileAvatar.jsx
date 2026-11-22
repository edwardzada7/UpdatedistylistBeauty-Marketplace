import { useEffect, useState } from "react";
import { avatarColorFor, initialsOf } from "@/utils/profile";

/** Round profile photo with a coloured-initials fallback (same look as the mobile app). */
export default function ProfileAvatar({ src, name, size = 48, className = "" }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  const initials = initialsOf(name);
  const box = { width: size, height: size, minWidth: size };
  return (
    <div className={`rounded-full overflow-hidden flex-shrink-0 ${className}`} style={box} data-testid="profile-avatar">
      {failed ? (
        <div
          className="w-full h-full flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: initials ? avatarColorFor(name) : "#7c5cfc", fontSize: size * 0.38 }}
        >
          {initials || "•"}
        </div>
      ) : (
        <img src={src} alt={name || "Profile"} loading="lazy" className="w-full h-full object-cover" onError={() => setFailed(true)} />
      )}
    </div>
  );
}
