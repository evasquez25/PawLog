import { z } from 'zod';

export const healthResponseSchema = z.object({
  data: z.object({ status: z.literal('ok'), service: z.literal('pawlog-api') }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ApiError = {
  error: { code: string; message: string; requestId: string };
};

export const uuidSchema = z.uuid();
const name = (max: number) => z.string().trim().min(1).max(max);
export const profileUpdateSchema = z.object({ display_name: name(60) }).strict();
export const householdCreateSchema = z.object({ name: name(80) }).strict();
export const householdUpdateSchema = z
  .object({
    name: name(80).optional(),
    feeding_warning_minutes: z.number().int().min(0).max(1440).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change.');
const photo = z
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === 'https:', 'Use an HTTPS photo URL.')
  .nullable();
export const petCreateSchema = z
  .object({ name: name(60), species: name(40), photo_url: photo.optional() })
  .strict();
export const petUpdateSchema = petCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change.');
export const invitationCreateSchema = z.object({}).strict();
export const invitationRedeemSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(
        /^(?:[A-Za-z0-9_-]{22}|[A-Za-z0-9_-]{43})$/,
        'Enter a valid invitation code.',
      ),
  })
  .strict();
export const activityCreateSchema = z
  .object({
    activity_type_id: uuidSchema,
    performed_by: uuidSchema,
    performed_at: z.iso
      .datetime({ offset: true })
      .refine((value) => Date.parse(value) <= Date.now(), 'Choose a time in the past or now.'),
    notes: z.string().trim().max(280).default(''),
    allow_recent: z.boolean().default(false),
  })
  .strict();
export type ActivityCreateInput = z.infer<typeof activityCreateSchema>;
export type PetCreateInput = z.infer<typeof petCreateSchema>;
export type PetUpdateInput = z.infer<typeof petUpdateSchema>;
export type HouseholdUpdateInput = z.infer<typeof householdUpdateSchema>;

export { ZodError } from 'zod';

export const profileSchema = z.object({ id: uuidSchema, display_name: z.string() });
export const householdSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  feeding_warning_minutes: z.number().int(),
});
export const petSchema = z.object({
  id: uuidSchema,
  household_id: uuidSchema,
  name: z.string(),
  species: z.string(),
  photo_url: z.string().nullable(),
});
export const memberSchema = z.object({
  user_id: uuidSchema,
  role: z.enum(['admin', 'member']),
  profile: profileSchema.nullable(),
});
export const activityTypeSchema = z.object({
  id: uuidSchema,
  household_id: uuidSchema,
  key: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  sort_order: z.number(),
  is_active: z.boolean(),
});
export const activityLogSchema = z.object({
  id: uuidSchema,
  pet_id: uuidSchema,
  activity_type_id: uuidSchema,
  performed_by: uuidSchema,
  logged_by: uuidSchema,
  performed_at: z.string(),
  notes: z.string(),
});
export const latestActivitySchema = z.object({
  activity_type: activityTypeSchema,
  latest: activityLogSchema.extend({ performed_by_name: z.string() }).nullable(),
});
export const accountSchema = z.object({
  profile: profileSchema,
  households: z.array(z.object({ id: uuidSchema, name: z.string() })),
});
export const dataSchemas = {
  account: accountSchema,
  households: z.array(householdSchema),
  household: householdSchema,
  pets: z.array(petSchema),
  pet: petSchema,
  members: z.array(memberSchema),
  latest: z.array(latestActivitySchema),
  created: z.object({ id: uuidSchema }),
  profileUpdate: z.object({ display_name: z.string() }),
  invitation: z.object({ id: uuidSchema, code: z.string(), expires_in_seconds: z.number() }),
  joined: z.object({ household_id: uuidSchema }),
  savedActivity: z.object({ log: activityLogSchema, replayed: z.boolean() }),
};
export type Pet = z.infer<typeof petSchema>;
export type Household = z.infer<typeof householdSchema>;
export type HouseholdMember = z.infer<typeof memberSchema>;
export type LatestActivity = z.infer<typeof latestActivitySchema>;
export type ActivityType = z.infer<typeof activityTypeSchema>;
