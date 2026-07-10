export function formatDate(value?: string) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  });
}
