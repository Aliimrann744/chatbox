export const getStatusText = (isTyping: string | boolean, chat: any) => {
  if (isTyping) return "typing...";
  if (chat?.isOnline) return "online";
  if (chat?.lastSeen) {
    const lastSeen = new Date(chat?.lastSeen);
    const now = new Date();
    const isToday = lastSeen.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = lastSeen.toDateString() === yesterday.toDateString();
    const timeStr = lastSeen.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (isToday) return `last seen today at ${timeStr}`;
    if (isYesterday) return `last seen yesterday at ${timeStr}`;
    return `last seen ${lastSeen.toLocaleDateString()} at ${timeStr}`;
  }
  return "";
};

export const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable YYYYMMDD key for a date, used to group messages by calendar day. */
export function getDateKey(dateString: string): string {
  const d = new Date(dateString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * WhatsApp-style date separator label: "Today" / "Yesterday" / DD/MM/YYYY.
 */
export function getDateSeparatorLabel(dateString: string): string {
  const d = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}
