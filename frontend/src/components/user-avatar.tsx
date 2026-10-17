import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Glossy fallback tints; picked by user id so a person keeps the same colour everywhere.
const MARBLES = [
  ["#5bb8f0", "#0b5fa8"],
  ["#6fcf5a", "#1f7a2e"],
  ["#f2b84b", "#a35f00"],
  ["#a88df5", "#5536b0"],
  ["#4fcfbd", "#00695c"],
  ["#f59a78", "#a3340a"],
];

interface UserAvatarProps {
  user: { id: number; display_name: string; avatar_url: string | null };
  size?: number;
  className?: string;
}

/** "Glass marble" avatar: round, 2px white rim, soft shadow. Decorative; names sit next to it. */
export function UserAvatar({ user, size = 40, className }: UserAvatarProps) {
  const [from, to] = MARBLES[Math.abs(user.id) % MARBLES.length];
  return (
    <Avatar
      aria-hidden="true"
      className={cn("marble after:hidden", className)}
      style={{ width: size, height: size }}
    >
      {user.avatar_url ? <AvatarImage src={user.avatar_url} alt="" /> : null}
      <AvatarFallback
        className="font-semibold text-white [text-shadow:0_1px_1px_rgb(0_0_0/0.35)]"
        style={{
          fontSize: Math.max(11, Math.round(size * 0.38)),
          background: `radial-gradient(circle at 35% 25%, rgb(255 255 255 / 0.65) 0 10%, transparent 42%), linear-gradient(160deg, ${from}, ${to})`,
        }}
      >
        {initials(user.display_name)}
      </AvatarFallback>
    </Avatar>
  );
}
