import ProfileAvatar from "@/components/ProfileAvatar";
import VerifiedBadge from "@/components/VerifiedBadge";
import { usePerson } from "@/services/peopleApi";
import { avatarOf } from "@/utils/profile";

/** Avatar that fills in the photo itself from the people directory when the record has none. */
export default function PersonAvatar({ id, authId, src, name, size = 40, className = "" }) {
  const person = usePerson(authId, id);
  return <ProfileAvatar src={src || person?.avatar || avatarOf(person)} name={name || person?.name} size={size} className={className} />;
}

/** Verified tick that looks the person up when the record doesn't already say. */
export function PersonVerified({ id, authId, verified, size = 16 }) {
  const person = usePerson(authId, id);
  return <VerifiedBadge verified={verified || person?.verified} size={size} />;
}
