import styles from './Avatar.module.css';

const COLORS = [
  '#1a7f6e', '#2563eb', '#7c3aed',
  '#c2410c', '#0891b2', '#65a30d',
];

const getColor = (name) => {
  if (!name) return COLORS[0];
  return COLORS[name.charCodeAt(0) % COLORS.length];
};

export default function Avatar({ user, size = 38, showOnline = true }) {
  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';
  const color    = getColor(user?.username);

  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, background: color, fontSize: size * 0.36 }}
      title={user?.username}
    >
      {initials}
      {showOnline && user?.isOnline && (
        <span
          className={styles.dot}
          style={{
            width: Math.max(8, size * 0.26),
            height: Math.max(8, size * 0.26),
          }}
        />
      )}
    </div>
  );
}