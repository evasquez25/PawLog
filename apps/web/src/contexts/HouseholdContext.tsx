import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataSchemas } from '@pawlog/shared';
import { useAuth } from '@/contexts/AuthContext';
import { getAccount } from '@/services/account';
import { apiRequest } from '@/services/client';
import { useCareRealtime } from '@/hooks/useCareRealtime';
function readSelection(key: string) {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function writeSelection(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Selection still works for this tab. */
  }
}
export function useHouseholdData() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const cache = useQueryClient();
  const [householdChoice, chooseHousehold] = useState(() =>
    readSelection(`pawlog:${userId}:household`),
  );
  const [petChoice, choosePet] = useState('');
  const account = useQuery({
    queryKey: ['account', userId],
    queryFn: ({ signal }) => getAccount(signal),
    retry: false,
  });
  const householdId =
    account.data?.households.find((h) => h.id === householdChoice)?.id ??
    account.data?.households[0]?.id ??
    '';
  const household = useQuery({
    queryKey: ['household', userId, householdId],
    queryFn: ({ signal }) =>
      apiRequest(`/households/${householdId}`, dataSchemas.household, { signal }),
    enabled: !!householdId,
    retry: false,
  });
  const members = useQuery({
    queryKey: ['members', userId, householdId],
    queryFn: ({ signal }) =>
      apiRequest(`/households/${householdId}/members`, dataSchemas.members, { signal }),
    enabled: !!householdId,
    retry: false,
  });
  const pets = useQuery({
    queryKey: ['pets', userId, householdId],
    queryFn: ({ signal }) =>
      apiRequest(`/households/${householdId}/pets`, dataSchemas.pets, { signal }),
    enabled: !!householdId,
    retry: false,
  });
  const petId = pets.data?.find((p) => p.id === petChoice)?.id ?? pets.data?.[0]?.id ?? '';
  const pet = pets.data?.find((p) => p.id === petId);
  const syncStatus = useCareRealtime(
    userId,
    householdId,
    household.isSuccess && members.isSuccess && !!members.data?.some((m) => m.user_id === userId),
  );
  const isAdmin = members.data?.find((m) => m.user_id === userId)?.role === 'admin';
  const setHousehold = (id: string) => {
    chooseHousehold(id);
    choosePet('');
    writeSelection(`pawlog:${userId}:household`, id);
  };
  const refresh = () =>
    cache.invalidateQueries({ predicate: (query) => query.queryKey[1] === userId });
  return {
    userId,
    syncStatus,
    account,
    household,
    members,
    pets,
    pet,
    petId,
    householdId,
    isAdmin,
    setHousehold,
    setPet: choosePet,
    refresh,
  };
}
type HouseholdContextValue = ReturnType<typeof useHouseholdData>;
const HouseholdContext = createContext<HouseholdContextValue | null>(null);
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const value = useHouseholdData();
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}
export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('HouseholdProvider required');
  return value;
}
