import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import api from "@/services/api";
import { avatarOf, isVerifiedProfile } from "@/utils/profile";

/**
 * Looks up people's photo / verified status the way the mobile app does: provider photos live in
 * the `stylists` table (profile_image_url), customer photos on the user record.
 * One cached directory query serves every list on the page.
 */

const TTL = 5 * 60 * 1000;
const COLUMNS = "user_id,auth_id,profile_image_url,business_name,is_verified,verified,rating,review_count";
let directoryPromise = null;
let directoryAt = 0;
let directoryMap = new Map();
const userCache = new Map();

export function getStylistDirectory() {
  if (!directoryPromise || Date.now() - directoryAt > TTL) {
    directoryAt = Date.now();
    directoryPromise = (async () => {
      let res = await supabase.from("stylists").select(COLUMNS);
      if (res.error) res = await supabase.from("stylists").select("*");
      if (res.error) {
        directoryAt = 0; // don't cache a failure
        return directoryMap;
      }
      const map = new Map();
      (res.data || []).forEach((row) => {
        if (row.user_id != null) map.set(String(row.user_id), row);
        if (row.auth_id) map.set(String(row.auth_id), row);
      });
      directoryMap = map;
      return map;
    })().catch(() => directoryMap);
  }
  return directoryPromise;
}

const fromRow = (row) =>
  row ? { name: row.business_name || null, avatar: row.profile_image_url || null, verified: row.is_verified === true || row.verified === true, rating: row.rating, reviewCount: row.review_count } : null;

/** Person summary (photo, verified, name) by stylist user id or auth id; falls back to the user record. */
export async function getPerson(key) {
  const k = String(key ?? "").trim();
  if (!k) return null;
  const dir = await getStylistDirectory();
  const row = fromRow(dir.get(k));
  if (row && row.avatar) return row;
  if (!userCache.has(k)) {
    // Numeric ids are users.id (e.g. a booking's customer_id); anything else is a Supabase auth id.
    const path = /^\d+$/.test(k) ? `/users/${k}` : `/users/by-auth/${k}`;
    userCache.set(
      k,
      api
        .get(path)
        .then((r) => r.data)
        .catch(() => null)
    );
  }
  const user = await userCache.get(k);
  if (!user && !row) return null;
  return {
    name: row?.name || user?.name || null,
    avatar: row?.avatar || avatarOf(user),
    verified: row?.verified || isVerifiedProfile(user),
  };
}

/** React hook: { avatar, verified, name } for a stylist/user key, filled in once the lookup resolves. */
export function usePerson(...keys) {
  const key = keys.find((k) => k !== undefined && k !== null && String(k).trim() !== "");
  const [person, setPerson] = useState(null);
  useEffect(() => {
    let cancelled = false;
    if (key === undefined) return undefined;
    getPerson(key).then((p) => !cancelled && setPerson(p));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return person;
}

/** Adds avatar/verified/rating from the directory to a list of provider objects. */
export async function withProviderAvatars(list, keyOf = (p) => p.provider_id ?? p.user_id) {
  const dir = await getStylistDirectory();
  return list.map((p) => {
    const row = dir.get(String(keyOf(p) ?? "")) || (p.user_id ? dir.get(String(p.user_id)) : undefined);
    if (!row) return p;
    const avatar = row.profile_image_url || avatarOf(p);
    return {
      ...p,
      ...(avatar ? { profile_image_url: avatar } : {}),
      is_verified: p.is_verified === true || row.is_verified === true || row.verified === true,
    };
  });
}
