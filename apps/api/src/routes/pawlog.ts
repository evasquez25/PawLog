import { Router, type Request, type Response } from 'express';
import {
  activityCreateSchema,
  householdCreateSchema,
  householdUpdateSchema,
  invitationRedeemSchema,
  invitationCreateSchema,
  petCreateSchema,
  petUpdateSchema,
  profileUpdateSchema,
  uuidSchema,
} from '@pawlog/shared';
import { requireAuth, type VerifyToken, type VerifiedIdentity } from '../middleware/auth.js';
import { PawlogService } from '../services/pawlog.js';
function service(res: Response) {
  const identity = res.locals.identity as VerifiedIdentity;
  return new PawlogService(identity.db, identity.userId);
}
function id(req: Request, name: string) {
  return uuidSchema.parse(req.params[name]);
}
export function pawlogRoutes(verify?: VerifyToken) {
  const router = Router();
  const auth = requireAuth(verify);
  router.patch('/me', auth, async (req, res) => {
    const input = profileUpdateSchema.parse(req.body);
    await service(res).rpc('update_profile', { new_display_name: input.display_name });
    res.json({ data: { display_name: input.display_name } });
  });
  router.get('/households', auth, async (_req, res) =>
    res.json({ data: await service(res).listHouseholds() }),
  );
  router.post('/households', auth, async (req, res) => {
    const input = householdCreateSchema.parse(req.body);
    const householdId = await service(res).rpc('create_household', { household_name: input.name });
    res.status(201).json({ data: { id: householdId } });
  });
  router.get('/households/:householdId', auth, async (req, res) =>
    res.json({ data: await service(res).getHousehold(id(req, 'householdId')) }),
  );
  router.patch('/households/:householdId', auth, async (req, res) =>
    res.json({
      data: await service(res).updateHousehold(
        id(req, 'householdId'),
        householdUpdateSchema.parse(req.body),
      ),
    }),
  );
  router.get('/households/:householdId/members', auth, async (req, res) =>
    res.json({ data: await service(res).members(id(req, 'householdId')) }),
  );
  router.post('/households/:householdId/invitations', auth, async (req, res) => {
    invitationCreateSchema.parse(req.body ?? {});
    res.status(201).json({ data: await service(res).invitation(id(req, 'householdId')) });
  });
  router.post('/invitations/redeem', auth, async (req, res) =>
    res.json({ data: await service(res).redeem(invitationRedeemSchema.parse(req.body).code) }),
  );
  router.get('/households/:householdId/pets', auth, async (req, res) =>
    res.json({ data: await service(res).pets(id(req, 'householdId')) }),
  );
  router.post('/households/:householdId/pets', auth, async (req, res) =>
    res.status(201).json({
      data: await service(res).createPet(id(req, 'householdId'), petCreateSchema.parse(req.body)),
    }),
  );
  router.get('/pets/:petId', auth, async (req, res) =>
    res.json({ data: await service(res).getPet(id(req, 'petId')) }),
  );
  router.patch('/pets/:petId', auth, async (req, res) =>
    res.json({
      data: await service(res).updatePet(id(req, 'petId'), petUpdateSchema.parse(req.body)),
    }),
  );
  router.get('/households/:householdId/activity-types', auth, async (req, res) =>
    res.json({ data: await service(res).activityTypes(id(req, 'householdId')) }),
  );
  router.get('/pets/:petId/latest-activities', auth, async (req, res) =>
    res.json({ data: await service(res).latest(id(req, 'petId')) }),
  );
  router.post('/pets/:petId/activities', auth, async (req, res) => {
    const petId = id(req, 'petId');
    const key = uuidSchema.parse(req.header('Idempotency-Key'));
    const input = activityCreateSchema.parse(req.body);
    const result = await service(res).log(petId, key, input);
    res.status(result.replayed ? 200 : 201).json({ data: result });
  });
  return router;
}
