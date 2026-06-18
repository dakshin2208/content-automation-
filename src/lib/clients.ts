export interface ClientOption {
  id: string;
  label: string;
  role: string;
  city: string;
}

export const CLIENTS: ClientOption[] = [
  {
    id: "dr_shrutika",
    label: "Dr. Shrutika",
    role: "Dentist",
    city: "Bangalore",
  },
  {
    id: "dr_bharath",
    label: "Dr. Bharath",
    role: "Sports Doctor",
    city: "Bangalore",
  },
  {
    id: "choose_your_college",
    label: "ChooseYourCollege",
    role: "Education Platform",
    city: "India",
  },
];

export function getClientDisplayName(clientId: string): string {
  const c = CLIENTS.find((x) => x.id === clientId);
  if (!c) return clientId;
  return `${c.label} (${c.role}, ${c.city})`;
}

export function getClientLabel(clientId: string): string {
  const c = CLIENTS.find((x) => x.id === clientId);
  return c?.label ?? clientId;
}

export function isValidClientId(id: string): boolean {
  return CLIENTS.some((c) => c.id === id);
}
