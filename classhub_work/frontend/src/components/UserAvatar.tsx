import { fileUrl } from '../lib/api';

export default function UserAvatar({
  name,
  avatar,
  size = 40,
  className = '',
}: {
  name: string;
  avatar?: string | null;
  size?: number;
  className?: string;
}) {
  if (avatar) {
    return (
      <img
        src={fileUrl(avatar)}
        alt=""
        style={{ width: size, height: size }}
        className={`rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      className={`rounded-full bg-violet-600 text-white grid place-items-center font-bold shrink-0 ${className}`}
    >
      {(name || '?')
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()}
    </span>
  );
}
