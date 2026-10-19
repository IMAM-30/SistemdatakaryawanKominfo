"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { backend } from "@/lib/client-api";
import adminImage from "../../image/admin.png";

const photoCache = new Map<string, string>();

export function EmployeeAvatar({ fileId, name, publicAccess = false }: { fileId?: string; name: string; publicAccess?: boolean }) {
  const src = useRemotePhoto(fileId, publicAccess);
  return <span className={`avatar ${src ? "avatar--photo" : "avatar--initial"}`} aria-hidden="true">
    {src ? <Image src={src} width={72} height={72} unoptimized alt=""/> : name.slice(0, 1).toUpperCase()}
  </span>;
}

export function AccountAvatar({ fileId }: { fileId?: string; name: string }) {
  const src = useRemotePhoto(fileId, false);
  return <span className="avatar avatar--photo" aria-hidden="true">
    <Image src={src || adminImage} width={72} height={72} unoptimized={Boolean(src)} alt=""/>
  </span>;
}

function useRemotePhoto(fileId?: string, publicAccess = false) {
  const cacheKey = fileId ? `${publicAccess ? "public" : "private"}:${fileId}` : "";
  const [photo, setPhoto] = useState({ key: "", src: "" });
  const src = cacheKey ? photoCache.get(cacheKey) ?? (photo.key === cacheKey ? photo.src : "") : "";

  useEffect(() => {
    if (!fileId || !cacheKey || photoCache.has(cacheKey)) return;
    let live = true;
    backend<{ mimeType: string; base64: string }>(publicAccess ? "files.publicGet" : "files.get", { id: fileId })
      .then((file) => {
        const next = `data:${file.mimeType};base64,${file.base64}`;
        photoCache.set(cacheKey, next);
        if (live) setPhoto({ key: cacheKey, src: next });
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [cacheKey, fileId, publicAccess]);
  return src;
}
