import { z } from 'zod';
export const activities = [
  {
    id: 'feeding',
    name: 'Feeding',
    verb: 'feeding',
    hint: 'A full bowl, a happy heart',
    tone: 'sage',
  },
  {
    id: 'potty',
    name: 'Potty break',
    verb: 'potty break',
    hint: 'A little fresh air',
    tone: 'peach',
  },
  {
    id: 'walking',
    name: 'Walking',
    verb: 'walk',
    hint: 'Sniffs, steps & adventures',
    tone: 'lavender',
  },
  { id: 'bathing', name: 'Bathing', verb: 'bath', hint: 'Fresh coat, extra cuddles', tone: 'blue' },
] as const;
export type ActivityId = (typeof activities)[number]['id'];
export type DemoLog = {
  id: string;
  petId: string;
  type: ActivityId;
  member: string;
  time: string;
  note: string;
};
export const pets = [
  { id: 'max', name: 'Max', species: 'Dog', breed: 'Golden retriever' },
  { id: 'luna', name: 'Luna', species: 'Cat', breed: 'Domestic shorthair' },
];
export const members = ['Eric', 'Sarah', 'Alex'];
export function initialLogs(): DemoLog[] {
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
  return [
    {
      id: 'sample-feed',
      petId: 'max',
      type: 'feeding',
      member: 'Eric',
      time: ago(125),
      note: 'Breakfast, all finished.',
    },
    { id: 'sample-potty', petId: 'max', type: 'potty', member: 'Sarah', time: ago(35), note: '' },
    {
      id: 'sample-walk',
      petId: 'max',
      type: 'walking',
      member: 'Alex',
      time: ago(190),
      note: 'A stroll around the neighborhood.',
    },
  ];
}
export const logInputSchema = z.object({
  member: z.enum(['Eric', 'Sarah', 'Alex']),
  time: z
    .string()
    .refine(
      (value) =>
        Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() <= Date.now(),
      'Choose a valid time in the past or now.',
    ),
  note: z.string().trim().max(280, 'Keep notes to 280 characters.'),
});
export function latestLog(logs: DemoLog[], petId: string, type: ActivityId) {
  return logs
    .filter((log) => log.petId === petId && log.type === type)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
}
