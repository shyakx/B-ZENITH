export function nextPinValue(current: string, key: string, maxLength = 6) {
  if (key === "C") return "";
  if (key === "←") return current.slice(0, -1);
  return current.length < maxLength ? current + key : current;
}
