import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { components } from '@/api/schema';

export type InvitationLookup = components['schemas']['InvitationLookupResponse'];
export type StudyAnswer = components['schemas']['StudyAnswerIn'];
export type AvailabilityInput = components['schemas']['AvailabilityUpdate'];

type JoinSession = {
  code: string | null;
  lookup: InvitationLookup | null;
  answers: StudyAnswer[];
  availability: AvailabilityInput | null;
  startJoin: (code: string) => void;
  setLookup: (lookup: InvitationLookup | null) => void;
  setAnswers: (answers: StudyAnswer[]) => void;
  setAvailability: (availability: AvailabilityInput | null) => void;
  reset: () => void;
};

const JoinSessionContext = createContext<JoinSession | null>(null);

export function JoinProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(null);
  const [lookup, setLookupState] = useState<InvitationLookup | null>(null);
  const [answers, setAnswersState] = useState<StudyAnswer[]>([]);
  const [availability, setAvailabilityState] = useState<AvailabilityInput | null>(null);

  const value = useMemo<JoinSession>(
    () => ({
      code,
      lookup,
      answers,
      availability,
      startJoin: (nextCode) => {
        setCode(nextCode);
        setLookupState(null);
        setAnswersState([]);
        setAvailabilityState(null);
      },
      setLookup: setLookupState,
      setAnswers: setAnswersState,
      setAvailability: setAvailabilityState,
      reset: () => {
        setCode(null);
        setLookupState(null);
        setAnswersState([]);
        setAvailabilityState(null);
      },
    }),
    [answers, availability, code, lookup],
  );

  return <JoinSessionContext.Provider value={value}>{children}</JoinSessionContext.Provider>;
}

export function useJoinSession(): JoinSession {
  const session = useContext(JoinSessionContext);

  if (!session) {
    throw new Error('useJoinSession must be used inside JoinProvider');
  }

  return session;
}
