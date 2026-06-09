export const formatSquareTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();

  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isSameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return `昨天 ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  const dayBefore = new Date(now);
  dayBefore.setDate(now.getDate() - 2);
  const isDayBefore =
    date.getDate() === dayBefore.getDate() &&
    date.getMonth() === dayBefore.getMonth() &&
    date.getFullYear() === dayBefore.getFullYear();

  if (isDayBefore) {
    return `前天 ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date
      .toLocaleDateString([], {
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");
  }

  return date
    .toLocaleDateString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
};

export const formatSquareDetailTime = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString([], {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

