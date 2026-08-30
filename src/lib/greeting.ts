export function staffGreeting(name: string, date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}
