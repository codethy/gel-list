// components/profile/ProfileAccountCard.tsx
//
// The account-identity card at the top of a profile page: avatar, name +
// handle, and read-only email/member-since. Used by both /profile (the
// signed-in user's own, editable=true — avatar upload, name/handle editing)
// and /u/[handle] (a public, read-only view of someone else's profile,
// editable=false — no edit controls, no email). Replaces the old static
// card + separate ProfileSignOutButton — sign-out already lives in the
// Navbar, so neither page needs its own copy.

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useUploadThing } from "@/lib/uploadthing";
import { isHeicFile, convertHeicToJpeg } from "@/components/set-detail/AddGelModal";
import { getInitials } from "@/lib/initials";

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 30;
const NAME_PATTERN = /^[A-Za-z0-9 ]+$/;

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

interface ProfileAccountCardProps {
  initialName:         string;
  initialHandle:       string | null;
  initialProfileImage: string | null;
  email:               string | null;
  memberSince:         string | null;
  // false on the public /u/[handle] view — hides the avatar upload/remove
  // controls and the name/handle edit control. Defaults to true (the
  // signed-in user's own /profile).
  editable?: boolean;
}

export default function ProfileAccountCard({
  initialName,
  initialHandle,
  initialProfileImage,
  email,
  memberSince,
  editable = true,
}: ProfileAccountCardProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  const [name, setName]                 = useState(initialName);
  const [handle, setHandle]             = useState(initialHandle);
  const [profileImage, setProfileImage] = useState(initialProfileImage);

  const [editing, setEditing]   = useState(false);
  const [nameInput, setNameInput]     = useState(initialName);
  const [handleInput, setHandleInput] = useState(initialHandle ?? "");
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [identityError, setIdentityError]   = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { startUpload } = useUploadThing("cardImage", {
    onUploadError: () => {
      alert("Could not upload this image. Please try again.");
    },
  });

  const avatarSrc = profileImage;

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const treatAsHeic = await isHeicFile(file);

    if (!file.type.startsWith("image/") && !treatAsHeic) {
      alert("Please select an image file (JPG, PNG, WEBP, etc.)");
      return;
    }

    setAvatarBusy(true);
    try {
      let fileToUpload: File = file;

      if (treatAsHeic) {
        try {
          const jpegBlob = await convertHeicToJpeg(file);
          fileToUpload = new File(
            [jpegBlob],
            file.name.replace(/\.(heic|heif)$/i, ".jpg"),
            { type: "image/jpeg" }
          );
        } catch {
          alert("Could not convert this HEIC photo. Please try a different image.");
          return;
        }
      }

      if (fileToUpload.size > 16 * 1024 * 1024) {
        alert("Please choose an image smaller than 16 MB.");
        return;
      }

      const result = await startUpload([fileToUpload]);
      if (!result?.[0]) {
        alert("Could not upload this image. Please try again.");
        return;
      }

      const res = await fetch("/api/user/image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImage: result[0].ufsUrl }),
      });
      if (!res.ok) {
        alert("Could not save this image. Please try again.");
        return;
      }
      setProfileImage(result[0].ufsUrl);
      await updateSession(); // picks up the new photo in the Navbar avatar too
      router.refresh();
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarBusy(true);
    try {
      const res = await fetch("/api/user/image", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileImage: null }),
      });
      if (!res.ok) return;
      setProfileImage(null);
      await updateSession();
      router.refresh();
    } finally {
      setAvatarBusy(false);
    }
  }

  // ── Name / handle edit ──────────────────────────────────────────────────────
  const trimmedName   = nameInput.trim();
  const trimmedHandle = handleInput.trim();

  function openEdit() {
    setNameInput(name);
    setHandleInput(handle ?? "");
    setIdentityError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setIdentityError(null);
  }

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    setIdentityError(null);

    if (trimmedName.length < NAME_MIN_LENGTH || trimmedName.length > NAME_MAX_LENGTH || !NAME_PATTERN.test(trimmedName)) {
      setIdentityError(`Name must be ${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} characters, letters/numbers/spaces only`);
      return;
    }
    if (trimmedHandle.length < HANDLE_MIN_LENGTH || trimmedHandle.length > HANDLE_MAX_LENGTH || !HANDLE_PATTERN.test(trimmedHandle)) {
      setIdentityError(`Handle must be ${HANDLE_MIN_LENGTH}-${HANDLE_MAX_LENGTH} characters, lowercase letters/numbers/underscores only`);
      return;
    }

    setSavingIdentity(true);
    try {
      const requests: Promise<Response>[] = [];
      if (trimmedName !== name) {
        requests.push(
          fetch("/api/user/name", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: trimmedName }),
          })
        );
      }
      if (trimmedHandle !== handle) {
        requests.push(
          fetch("/api/user/handle", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ handle: trimmedHandle }),
          })
        );
      }

      if (requests.length === 0) {
        setEditing(false);
        return;
      }

      const results = await Promise.all(requests);
      for (const res of results) {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setIdentityError(data.error ?? "Something went wrong. Please try again.");
          return;
        }
      }

      setName(trimmedName);
      setHandle(trimmedHandle);
      setEditing(false);
      await updateSession();
      router.refresh();
    } finally {
      setSavingIdentity(false);
    }
  }

  return (
    <>
    <div className="w-full sm:w-[340px] shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/60 px-8 py-7 flex flex-col items-center justify-between gap-6">
      <div className="flex flex-col items-center gap-4">
        {/* Avatar */}
        <div className="relative group">
          {avatarSrc ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                aria-label="View profile picture"
                title="View image"
                className="block cursor-zoom-in"
              >
                <img
                  src={avatarSrc}
                  alt=""
                  className="w-[126px] h-[126px] rounded-full border border-slate-600/50 object-cover"
                />
              </button>

              {editable && (
                <>
                  {/* Darkens on hover to set up the reveal below */}
                  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors pointer-events-none" />

                  {/* Hover-only — removing a photo only makes sense once one exists */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveAvatar();
                    }}
                    disabled={avatarBusy}
                    title="Remove profile picture"
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/80 border border-white/20 flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    ×
                  </button>
                </>
              )}
            </>
          ) : (
            // Default icon for every user who hasn't uploaded their own photo —
            // their own initials (up to 3), not a pull from Google's profile
            // picture. Derived from the live `name` state, so it updates the
            // moment the user renames themself; an uploaded photo always
            // takes precedence over this, regardless of later name changes.
            <div className="w-[126px] h-[126px] rounded-full bg-black border border-slate-600/50 flex items-center justify-center">
              <span className="text-3xl font-black text-white tracking-tight">{getInitials(name)}</span>
            </div>
          )}

          {editable && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                aria-label="Upload profile picture"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                title="Change profile picture"
                className="absolute -bottom-1.5 -right-1.5 w-12 h-12 rounded-full bg-slate-600 border border-slate-800 flex items-center justify-center text-base text-white hover:bg-slate-500 transition-colors disabled:opacity-50"
              >
                {avatarBusy ? (
                  <span className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  "✎"
                )}
              </button>
            </>
          )}
        </div>

        {/* Name / handle */}
        {editing ? (
          <form onSubmit={handleSaveIdentity} className="w-full flex flex-col gap-3">
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Name"
              className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white text-center placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
            />
            <div className="flex items-center justify-center gap-1.5 w-full">
              <span className="text-sm text-slate-500">@</span>
              <input
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value.toLowerCase())}
                placeholder="handle"
                className="flex-1 bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white text-center placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors"
              />
            </div>

            {identityError && (
              <p className="text-xs text-red-400 text-center">{identityError}</p>
            )}

            <div className="flex items-center gap-2 w-full mt-1">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingIdentity}
                className="flex-1 text-sm font-medium text-slate-400 hover:text-white border border-slate-700/50 rounded-lg py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingIdentity}
                className="flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg py-2 transition-colors disabled:opacity-50"
              >
                {savingIdentity ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-white">{name}</p>
              {editable && (
                <button
                  type="button"
                  onClick={openEdit}
                  title="Edit name and handle"
                  className="text-slate-500 hover:text-white transition-colors text-sm"
                >
                  ✎
                </button>
              )}
            </div>
            {handle && <p className="text-sm text-slate-500">@{handle}</p>}
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="w-full h-px bg-slate-700/50" />

        <div className="w-full flex flex-col gap-2 text-sm">
          {email && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Email</span>
              <span className="text-slate-300 truncate">{email}</span>
            </div>
          )}
          {memberSince && (
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 shrink-0">Member since</span>
              <span className="text-slate-300">{memberSince}</span>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Full-size profile picture preview — opened by clicking the avatar */}
    {previewOpen && avatarSrc && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
        onClick={() => setPreviewOpen(false)}
      >
        <div
          className="relative max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            aria-label="Close"
            className="absolute -top-10 right-0 text-slate-300 hover:text-white text-sm"
          >
            Close ✕
          </button>
          <img
            src={avatarSrc}
            alt=""
            className="w-full rounded-2xl border border-slate-700/60 shadow-2xl shadow-black/60"
          />
        </div>
      </div>
    )}
    </>
  );
}
