import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

type StudyFocusValue = {
  focusedStudyId: string | null;
  focusStudy: (studyId: string) => void;
};

const StudyFocusContext = createContext<StudyFocusValue | null>(null);

let applyStudyFocus: ((studyId: string) => void) | null = null;

/** For code outside React: a notification makes the study it belongs to the current one. */
export function focusStudyOutsideReact(studyId: string): void {
  applyStudyFocus?.(studyId);
}

/**
 * Which study the Today tab shows. It lives above the tabs so that pushing Today from the
 * studies tab keeps the chosen study even when the tabs layout mounts again.
 */
export function StudyFocusProvider({ children }: PropsWithChildren) {
  const [focusedStudyId, setFocusedStudyId] = useState<string | null>(null);
  const focusStudy = useCallback((studyId: string) => {
    setFocusedStudyId(studyId);
  }, []);
  // A layout effect runs before the effect in Today that lets a pending notification open.
  useLayoutEffect(() => {
    applyStudyFocus = focusStudy;
    return () => {
      applyStudyFocus = null;
    };
  }, [focusStudy]);
  const value = useMemo(
    () => ({ focusedStudyId, focusStudy }),
    [focusStudy, focusedStudyId],
  );

  return (
    <StudyFocusContext.Provider value={value}>
      {children}
    </StudyFocusContext.Provider>
  );
}

export function useStudyFocus(): StudyFocusValue {
  const value = useContext(StudyFocusContext);
  if (!value) {
    throw new Error('useStudyFocus must be used inside a StudyFocusProvider');
  }
  return value;
}
