export const truncateWords = (text: string, limit: number): string => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= limit) {
    return trimmed;
  }

  return `${words.slice(0, limit).join(" ")}...`;
};
