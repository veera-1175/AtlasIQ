import { useEffect, useState } from "react";
import { getAuthToken } from "../api";

interface Props {
  avatarUrl?: string | null;
  label: string;
  className?: string;
  cacheKey?: string | number;
}

export default function UserAvatar({ avatarUrl, label, className = "h-9 w-9", cacheKey }: Props) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl) {
      setSrc(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    const token = getAuthToken();
    fetch(avatarUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.blob() : null))
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [avatarUrl, cacheKey]);

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={`${className} shrink-0 object-cover`}
      />
    );
  }

  return (
    <div className={`${className} flex shrink-0 items-center justify-center bg-white font-mono text-sm font-bold text-black shadow-glow`}>
      {label[0]?.toUpperCase() || "?"}
    </div>
  );
}
