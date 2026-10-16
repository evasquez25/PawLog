import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityCreateInput,
  HouseholdUpdateInput,
  PetCreateInput,
  PetUpdateInput,
} from '@pawlog/shared';
import { databaseError, HttpError } from '../lib/errors.js';
export class PawlogService {
  constructor(
    private db: SupabaseClient,
    private userId: string,
  ) {}
  async rpc(name: string, args: Record<string, unknown>, singleRecord = false) {
    const { data, error } = await this.db.rpc(name, args);
    databaseError(error);
    // PostgREST may represent a composite return type as a one-row array.
    if (singleRecord && Array.isArray(data)) {
      if (data.length !== 1)
        throw new HttpError(
          503,
          'DATABASE_UNAVAILABLE',
          'The data service returned an unexpected result.',
        );
      return data[0];
    }
    return data;
  }
  async household(id: string, admin = false) {
    const { data, error } = await this.db
      .from('household_members')
      .select('role')
      .eq('household_id', id)
      .eq('user_id', this.userId)
      .maybeSingle();
    databaseError(error);
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Household not found.');
    if (admin && data.role !== 'admin')
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Only a household administrator can do this.');
  }
  async getHousehold(id: string) {
    await this.household(id);
    const { data, error } = await this.db.from('households').select('*').eq('id', id).single();
    databaseError(error);
    return data;
  }
  async listHouseholds() {
    const { data, error } = await this.db.from('households').select('*').order('created_at');
    databaseError(error);
    return data;
  }
  async updateHousehold(id: string, input: HouseholdUpdateInput) {
    await this.household(id, true);
    return this.rpc(
      'update_household',
      {
        target_household: id,
        new_name: input.name ?? null,
        warning_minutes: input.feeding_warning_minutes ?? null,
      },
      true,
    );
  }
  async members(id: string) {
    await this.household(id);
    const { data, error } = await this.db
      .from('household_members')
      .select(
        'user_id,role,joined_at,profile:profiles!household_members_user_id_fkey(id,display_name)',
      )
      .eq('household_id', id)
      .order('joined_at');
    databaseError(error);
    return data;
  }
  async getPet(id: string, admin = false) {
    const { data, error } = await this.db.from('pets').select('*').eq('id', id).maybeSingle();
    databaseError(error);
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Pet not found.');
    await this.household(data.household_id, admin);
    return data;
  }
  async pets(id: string) {
    await this.household(id);
    const { data, error } = await this.db
      .from('pets')
      .select('*')
      .eq('household_id', id)
      .order('created_at');
    databaseError(error);
    return data;
  }
  async createPet(id: string, input: PetCreateInput) {
    await this.household(id, true);
    return this.rpc(
      'create_pet',
      {
        target_household: id,
        pet_name: input.name,
        pet_species: input.species,
        pet_photo_url: input.photo_url ?? null,
      },
      true,
    );
  }
  async updatePet(id: string, input: PetUpdateInput) {
    await this.getPet(id, true);
    return this.rpc(
      'update_pet',
      {
        target_pet: id,
        pet_name: input.name ?? null,
        pet_species: input.species ?? null,
        pet_photo_url: input.photo_url ?? null,
        replace_photo: Object.prototype.hasOwnProperty.call(input, 'photo_url'),
      },
      true,
    );
  }
  async activityTypes(id: string) {
    await this.household(id);
    const { data, error } = await this.db
      .from('activity_types')
      .select('*')
      .eq('household_id', id)
      .eq('is_active', true)
      .order('sort_order');
    databaseError(error);
    return data;
  }
  async invitation(id: string) {
    await this.household(id, true);
    const code = randomBytes(32).toString('base64url');
    const invitationId = await this.rpc('create_household_invitation', {
      target_household: id,
      invitation_hash: hashCode(code),
    });
    return { id: invitationId, code, expires_in_seconds: 48 * 60 * 60 };
  }
  async redeem(code: string) {
    const result = await this.rpc('redeem_household_invitation', {
      invitation_hash: hashCode(code),
    });
    if (result.error)
      throw new HttpError(
        result.error === 'RATE_LIMITED' ? 429 : result.error === 'ALREADY_MEMBER' ? 409 : 400,
        result.error,
        result.error === 'RATE_LIMITED'
          ? 'Too many attempts. Try again in 15 minutes.'
          : result.error === 'ALREADY_MEMBER'
            ? 'You already belong to this household.'
            : 'This invitation is invalid, expired, or already used.',
      );
    return result;
  }
  async latest(id: string) {
    await this.getPet(id);
    return this.rpc('latest_activities', { target_pet: id });
  }
  async log(id: string, key: string, input: ActivityCreateInput) {
    await this.getPet(id);
    const result = await this.rpc('log_activity', {
      target_pet: id,
      target_type: input.activity_type_id,
      performer: input.performed_by,
      completed_at: input.performed_at,
      request_key: key,
      activity_notes: input.notes,
      allow_recent: input.allow_recent,
    });
    if (result.error === 'RECENT_FEEDING')
      throw new HttpError(
        409,
        'RECENT_FEEDING',
        'A feeding was completed recently. Confirm before logging another.',
        { latest: result.latest, warning_minutes: result.warning_minutes },
      );
    if (result.error === 'IDEMPOTENCY_CONFLICT')
      throw new HttpError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'This submission key was already used for a different activity.',
      );
    return result;
  }
}
export function hashCode(code: string) {
  return createHash('sha256').update(code).digest('hex');
}
