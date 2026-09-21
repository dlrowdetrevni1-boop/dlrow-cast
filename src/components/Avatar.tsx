import React, { useState } from "react";

interface AvatarProps {
  name: string;
  avatarColor?: string;
  avatarUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  isSpeaking?: boolean;
}

const SIZE_MAP = {
  xs: "w-4 h-4 text-[9px]",
  sm: "w-5 h-5 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-9 h-9 text-xs",
  xl: "w-20 h-20 text-2xl",
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarColor = "#6366f1",
  avatarUrl,
  size = "md",
  className = "",
  isSpeaking = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const initial = (name || "U").trim().charAt(0).toUpperCase();

  const showImage = Boolean(avatarUrl && !imageError);

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden font-bold select-none ${sizeClasses} ${
        isSpeaking ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950" : ""
      } ${className}`}
      style={{ backgroundColor: !showImage ? avatarColor : "#18181b" }}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-white drop-shadow-sm">{initial}</span>
      )}
    </div>
  );
};
