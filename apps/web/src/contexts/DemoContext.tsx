import { createContext, useContext, useState, type ReactNode } from 'react';
import { initialLogs, type DemoLog } from '@/lib/demo';
type DemoState = {
  logs: DemoLog[];
  addLog: (log: DemoLog) => void;
  name: string;
  setName: (name: string) => void;
  household: string;
  setHousehold: (name: string) => void;
  petId: string;
  setPetId: (id: string) => void;
  reset: () => void;
};
const DemoContext = createContext<DemoState | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState(initialLogs);
  const [name, setName] = useState('Eric');
  const [household, setHousehold] = useState('The Vasquez household');
  const [petId, setPetId] = useState('max');
  const reset = () => {
    setLogs(initialLogs());
    setName('Eric');
    setHousehold('The Vasquez household');
    setPetId('max');
  };
  return (
    <DemoContext.Provider
      value={{
        logs,
        addLog: (log) =>
          setLogs((old) => (old.some((item) => item.id === log.id) ? old : [...old, log])),
        name,
        setName,
        household,
        setHousehold,
        petId,
        setPetId,
        reset,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider required');
  return value;
}
