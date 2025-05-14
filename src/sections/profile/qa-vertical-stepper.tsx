import {doc, updateDoc, serverTimestamp, Timestamp} from "firebase/firestore";
import {useState, useEffect, useCallback} from 'react';
import {useFirestore} from "reactfire";
import { Box } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';

import Step from '@mui/material/Step';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import StepLabel from '@mui/material/StepLabel';
import TextField from "@mui/material/TextField";
import Typography from '@mui/material/Typography';
import StepContent from '@mui/material/StepContent';
import {Accordion, AccordionDetails, AccordionSummary} from "@mui/material";

import {useAuthContext} from "../../auth/hooks";
import {Iconify} from "../../components/iconify";
import { 
  COLLECTIONS, 
  QuestionsAnswers, 
  Timestamping, 
  UserInfo,
  VerificationStatus 
} from '@livve-1/database-types';

// ----------------------------------------------------------------------

interface GroupedQAsBySection {
  [key: string]: Array<{
    id: string;
    question: string;
    answer: string;
    createdAt: Timestamp;
    updatedAt?: Timestamp;
  }>;
}

// Props for QAVerticalStepper
interface QAVerticalStepperProps {
  qasData: QuestionsAnswers | null;
  isLoading: boolean;
  // We might need userInfo for save operations later, or pass userId
  userId: string | undefined; 
}

// ----------------------------------------------------------------------

export function QAVerticalStepper({ qasData, isLoading, userId }: QAVerticalStepperProps) {
  // const {user} = useAuthContext(); // user.uid was used for profileRef, now userId prop
  const firestore = useFirestore();

  // Return loading state if isLoading prop is true
  if (isLoading) { // Changed condition
    return <Paper sx={{ p: 3, textAlign: 'center' }}>Loading user profile...</Paper>;
  }
  
  // Removed: Internal data fetching for profile document
  // const profileRef = doc(firestore, COLLECTIONS.USERS.USER_INFO, user.uid); 
  // const { status, data: profile } = useFirestoreDocData(profileRef);

  const [activeStep, setActiveStep] = useState(0);
  const [groupedQAs, setGroupedQAs] = useState<GroupedQAsBySection>({});

  const [controlled, setControlled] = useState<string | false>(false);
  // const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({}); // Related to old update logic
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [changedAnswers, setChangedAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState<Record<string, boolean>>({});

  const handleChangeControlled =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setControlled(isExpanded ? panel : false);
    };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  // Initialize local answers from qasData prop
  useEffect(() => {
    if (qasData?.questions) { // Changed to use qasData
      const answers: Record<string, string> = {};
      Object.entries(qasData.questions).forEach(([id, qa]) => {
        answers[id] = qa.answer || '';
      });
      setLocalAnswers(answers);
    } else {
      setLocalAnswers({}); // Clear if no qasData
    }
  }, [qasData]); // Dependency on qasData

  const handleAnswerChange = (questionId: string, newAnswer: string) => {
    setLocalAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
    
    const normalizeText = (text: string) => text.trim().replace(/\\s+/g, ' ');
    
    // Original answer now comes from qasData
    const originalAnswer = qasData?.questions?.[questionId]?.answer || '';
    const hasRealChange = 
      normalizeText(newAnswer) !== normalizeText(originalAnswer) && 
      normalizeText(newAnswer) !== '';
    
    if (hasRealChange) {
      setChangedAnswers(prev => ({ ...prev, [questionId]: newAnswer }));
    } else {
      setChangedAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const handleSaveAnswer = async (questionId: string) => {
    if (!userId) {
      console.error("User ID is missing, cannot save answer.");
      return;
    }
    const newAnswer = localAnswers[questionId];
    setSavingAnswers(prev => ({ ...prev, [questionId]: true }));
    
    // IMPORTANT: This needs to update COLLECTIONS.MARRIAGE.QUESTIONS_ANSWERS
    // For now, this is a placeholder and will likely FAIL or update the wrong place
    // if profileRef was pointing to USER_INFO.
    // We need a qasRef.
    const qasDocRef = doc(firestore, COLLECTIONS.MARRIAGE.QUESTIONS_ANSWERS, userId);

    try {
      // This update path assumes 'questions' is the top-level field in QAS doc
      await updateDoc(qasDocRef, {
        [`questions.${questionId}.answer`]: newAnswer,
        [`questions.${questionId}.updatedAt`]: serverTimestamp(),
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      setChangedAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch (error) {
      console.error('Error updating answer:', error);
    } finally {
      setSavingAnswers(prev => ({ ...prev, [questionId]: false }));
    }
  };

  function groupQAsBySection(questions: QuestionsAnswers['questions'] | undefined): GroupedQAsBySection { // Changed signature
    if (!questions) return {}; // Handle undefined questions
    // First group QAs by section
    const grouped = Object.entries(questions).reduce<GroupedQAsBySection>((grouped, [key, qa]) => {
      const section = qa.section || "uncategorized";
      
      if (!grouped[section]) {
        grouped[section] = [];
      }
      
      grouped[section].push({
        id: key,
        question: qa.question,
        answer: qa.answer,
        createdAt: qa.createdAt as any, // Timestamps might need conversion if not Firestore Timestamps
        updatedAt: qa.updatedAt as any
      });

      return grouped;
    }, {});

    // Sort QAs within each section by timestamp
    Object.values(grouped).forEach(qasInSection => { // Renamed qas to qasInSection to avoid conflict
      qasInSection.sort((a, b) => {
        const timeA = (a.createdAt as any)?.toMillis === 'function' ? (a.createdAt as any)?.toMillis() : Number(a.createdAt) ;
        const timeB = (b.createdAt as any)?.toMillis === 'function' ? (b.createdAt as any)?.toMillis() : Number(b.createdAt);
        if (timeA == null && timeB == null) return 0;
        if (timeA == null) return 1;
        if (timeB == null) return -1;
        return timeA - timeB;
      });
    });

    // Convert to array of [section, qas] pairs and sort by earliest question in each section
    const sortedEntries = Object.entries(grouped).sort(([, qasA], [, qasB]) => {
      const timeA = (qasA[0]?.createdAt as any)?.toMillis === 'function' ? (qasA[0]?.createdAt as any)?.toMillis() : Number(qasA[0]?.createdAt);
      const timeB = (qasB[0]?.createdAt as any)?.toMillis === 'function' ? (qasB[0]?.createdAt as any)?.toMillis() : Number(qasB[0]?.createdAt);
      if (timeA == null && timeB == null) return 0;
      if (timeA == null) return 1;
      if (timeB == null) return -1;
      return timeA - timeB;
    });

    // Convert back to object
    return Object.fromEntries(sortedEntries);
  }

  useEffect(() => {
    // Use qasData prop to group QAs
    setGroupedQAs(groupQAsBySection(qasData?.questions));
  }, [qasData]); // Dependency on qasData

  // Add empty state handling
  // isLoading is now a prop, status is removed
  const hasQAs = !isLoading && qasData && Object.keys(qasData.questions || {}).length > 0 && Object.keys(groupedQAs).length > 0;

  useEffect(() => {
    const handleScroll = (event: CustomEvent) => {
      const { section, questionId } = event.detail;
      // Find and scroll to the section/question
      // You might need to use refs or element IDs
      const element = document.querySelector(`[data-section=\"${section}\"][data-question=\"${questionId}\"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        element.classList.add('highlight');
        setTimeout(() => element.classList.remove('highlight'), 2000);
      }
    };

    window.addEventListener('scrollToQuestion', handleScroll as EventListener);
    return () => window.removeEventListener('scrollToQuestion', handleScroll as EventListener);
  }, []);

  return (
    <>
      {isLoading ? ( // Use isLoading prop
        <span>loading...</span>
      ) : (
        <>
          {!hasQAs && (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1">
                No questions and answers have been added to this profile yet.
              </Typography>
            </Paper>
          )}

          {hasQAs && Object.entries(groupedQAs).map(([section, qasInSection]) => ( // Renamed qas to qasInSection
            <Accordion 
              key={section}
              expanded={controlled === section}
              onChange={handleChangeControlled(section)}
              sx={{ py: 3, px: 0, bgcolor: 'background.paper', marginBottom: 0 }}
            >
              <AccordionSummary expandIcon={<Iconify icon="eva:arrow-ios-downward-fill" />}>
                <Typography variant="subtitle1">{section}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2 }}>
                <Stepper activeStep={activeStep} orientation="vertical" sx={{ width: '100%' }}>
                  {qasInSection.map((qa) => (
                    <Step 
                      active 
                      key={qa.id}
                      data-section={section}
                      data-question={qa.id}
                      sx={{ width: '100%' }}
                    >
                      <StepLabel>{qa.question}</StepLabel>
                      <StepContent sx={{ width: '100%', '.MuiStepContent-root': { paddingTop: 1, paddingBottom: 1 } }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', mt: 2 }}>
                          <TextField
                            variant="outlined"
                            rows={5}
                            fullWidth
                            multiline
                            label="Answer"
                            value={localAnswers[qa.id] || ''}
                            onChange={(e) => handleAnswerChange(qa.id, e.target.value)}
                          />
                          <LoadingButton
                            loading={savingAnswers[qa.id]}
                            disabled={!changedAnswers[qa.id]}
                            variant="contained"
                            color="primary"
                            loadingPosition="start"
                            onClick={() => handleSaveAnswer(qa.id)}
                            sx={{ alignSelf: 'center', minWidth: 100 }}
                          >
                            Save
                          </LoadingButton>
                        </Box>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </AccordionDetails>
            </Accordion>
          ))}
        </>
      )}
    </>
  );
}
